import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { openai } from '@/lib/openai';

type RouteContext = { params: Promise<{ id: string; taskId: string }> };

/**
 * POST /api/boardroom/initiatives/[id]/tasks/[taskId]/edit-image
 * 
 * Edits a wireframe image using DALL-E 2 inpainting.
 * Body: { artifactId, selection: {x, y, width, height}, prompt, imageWidth, imageHeight }
 * 
 * The selection coordinates are relative to the displayed image dimensions.
 * We scale them to the actual image (1024x1024) for mask creation.
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, taskId } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Verify initiative
    const { data: initiative } = await db
        .from('Initiative')
        .select('id')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const body = await req.json();
    const { artifactId, selection, prompt, imageWidth, imageHeight } = body;

    if (!artifactId || !selection || !prompt?.trim()) {
        return NextResponse.json({ error: 'artifactId, selection, and prompt are required' }, { status: 400 });
    }

    // Fetch the artifact
    const { data: artifact } = await db
        .from('InitiativeArtifact')
        .select('id, contentUrl, storageKey, title')
        .eq('id', artifactId)
        .eq('initiativeId', id)
        .maybeSingle();

    if (!artifact || !artifact.storageKey) {
        return NextResponse.json({ error: 'Artifact not found or has no stored image' }, { status: 404 });
    }

    try {
        // Download original image from storage
        const { data: imageData, error: downloadErr } = await db.storage
            .from('documents')
            .download(artifact.storageKey);

        if (downloadErr || !imageData) {
            return NextResponse.json({ error: 'Failed to download original image' }, { status: 500 });
        }

        const originalBuffer = Buffer.from(await imageData.arrayBuffer());

        // Create mask: 1024x1024 PNG with transparent area where we want edits
        // We'll create a simple RGBA buffer: black (opaque) everywhere EXCEPT the selection (transparent)
        const MASK_SIZE = 1024;
        const scaleX = MASK_SIZE / (imageWidth || MASK_SIZE);
        const scaleY = MASK_SIZE / (imageHeight || MASK_SIZE);

        // Scale selection to mask coordinates
        const selX = Math.max(0, Math.floor(selection.x * scaleX));
        const selY = Math.max(0, Math.floor(selection.y * scaleY));
        const selW = Math.min(MASK_SIZE - selX, Math.ceil(selection.width * scaleX));
        const selH = Math.min(MASK_SIZE - selY, Math.ceil(selection.height * scaleY));

        // Build raw RGBA mask (we'll encode it as PNG manually)
        // For the mask: transparent pixels = area to edit, opaque = keep
        // We'll use a simpler approach: create a minimal PNG

        // Use the canvas-free approach: create mask as raw RGBA and encode to PNG
        const maskRgba = new Uint8Array(MASK_SIZE * MASK_SIZE * 4);
        
        // Fill everything with opaque black (keep)
        for (let i = 0; i < MASK_SIZE * MASK_SIZE; i++) {
            maskRgba[i * 4 + 0] = 0;   // R
            maskRgba[i * 4 + 1] = 0;   // G
            maskRgba[i * 4 + 2] = 0;   // B
            maskRgba[i * 4 + 3] = 255; // A (opaque = keep)
        }

        // Make selected area transparent (edit)
        for (let y = selY; y < selY + selH && y < MASK_SIZE; y++) {
            for (let x = selX; x < selX + selW && x < MASK_SIZE; x++) {
                const idx = (y * MASK_SIZE + x) * 4;
                maskRgba[idx + 3] = 0; // transparent = edit this area
            }
        }

        // Encode RGBA to PNG using minimal PNG encoder
        const maskPng = encodePNG(MASK_SIZE, MASK_SIZE, maskRgba);

        // Create File objects for OpenAI — use Uint8Array to avoid Buffer type issues
        const imageFile = new File([new Uint8Array(originalBuffer)], 'image.png', { type: 'image/png' });
        const maskFile = new File([new Uint8Array(maskPng)], 'mask.png', { type: 'image/png' });

        // Call DALL-E 2 edit (inpainting)
        const editResponse = await openai.images.edit({
            model: 'dall-e-2',
            image: imageFile,
            mask: maskFile,
            prompt: `In this website wireframe, update the selected area: ${prompt}. Keep the wireframe style consistent - clean, professional, grayscale wireframe mockup.`,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json',
        });

        const b64 = editResponse.data?.[0]?.b64_json;
        if (!b64) {
            return NextResponse.json({ error: 'No edited image returned' }, { status: 500 });
        }

        // Upload edited image
        const editedBuffer = Buffer.from(b64, 'base64');
        const newFileName = `${companyId}/boardroom/${id}/${taskId}/${crypto.randomUUID()}.png`;

        const { error: uploadError } = await db.storage
            .from('documents')
            .upload(newFileName, editedBuffer, {
                contentType: 'image/png',
                upsert: false,
            });

        if (uploadError) {
            return NextResponse.json({ error: 'Failed to upload edited image' }, { status: 500 });
        }

        // Get signed URL
        const { data: urlData } = await db.storage
            .from('documents')
            .createSignedUrl(newFileName, 60 * 60 * 24 * 365);

        const newUrl = urlData?.signedUrl || '';

        // Update artifact with new image
        const now = new Date().toISOString();
        await db.from('InitiativeArtifact').update({
            contentUrl: newUrl,
            storageKey: newFileName,
            content: `${artifact.title} — Edited: ${prompt}`,
            updatedAt: now,
        }).eq('id', artifactId);

        // Optionally delete old image (keep for history later)
        // await db.storage.from('documents').remove([artifact.storageKey]);

        // Log event
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            taskId: taskId,
            actorType: 'ai_member',
            actorLabel: 'DALL-E 2',
            action: 'artifact_edited',
            description: `Wireframe edited: "${artifact.title}" — ${prompt}`,
        });

        return NextResponse.json({
            success: true,
            contentUrl: newUrl,
            storageKey: newFileName,
        });
    } catch (error) {
        console.error('[edit-image] Error:', error);
        return NextResponse.json({ error: 'Image edit failed', detail: String(error) }, { status: 500 });
    }
}

/**
 * Minimal PNG encoder — encodes raw RGBA data into a valid PNG file.
 * No external dependencies needed.
 */
function encodePNG(width: number, height: number, rgbaData: Uint8Array): Buffer {
    // PNG spec: http://www.w3.org/TR/PNG/
    const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    function crc32(buf: Buffer): number {
        let c = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
            c = crc32Table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        }
        return c ^ 0xffffffff;
    }

    // Build CRC table
    const crc32Table: number[] = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crc32Table[n] = c;
    }

    function chunk(type: string, data: Buffer): Buffer {
        const typeBuffer = Buffer.from(type, 'ascii');
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length, 0);

        const combined = Buffer.concat([typeBuffer, data]);
        const crcValue = crc32(combined);
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE(crcValue >>> 0, 0);

        return Buffer.concat([length, combined, crcBuf]);
    }

    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type: RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    // IDAT — raw image data with filter bytes
    const rawRows: Buffer[] = [];
    for (let y = 0; y < height; y++) {
        rawRows.push(Buffer.from([0])); // filter: none
        const rowStart = y * width * 4;
        rawRows.push(Buffer.from(rgbaData.slice(rowStart, rowStart + width * 4)));
    }
    const rawData = Buffer.concat(rawRows);

    // Deflate compress using zlib
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(rawData);

    // IEND
    const iend = Buffer.alloc(0);

    return Buffer.concat([
        SIGNATURE,
        chunk('IHDR', ihdr),
        chunk('IDAT', compressed),
        chunk('IEND', iend),
    ]);
}
