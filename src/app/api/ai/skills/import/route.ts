// ═══════════════════════════════════════════════════════
// API: /api/ai/skills/import — Import a packaged Skill (.zip / .md)
// ═══════════════════════════════════════════════════════
//
// Supports 3 import modes:
//   - preserved: Raw instructions kept as-is, runtime metadata extracted
//   - compatible (default): Adapted with runtime semantics preserved
//   - degraded: Flattened to content-only prompt (legacy behavior)
//
// Returns a compatibility report with every import.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import JSZip from 'jszip';
import { adaptSkillForNousio } from '@/lib/community-skills/adapt-skill';
import { parseSkillManifest } from '@/lib/skills/manifest-parser';
import { validateCompatibility } from '@/lib/skills/compatibility-validator';
import type { ImportMode } from '@/lib/skills/types';

// ─── YAML frontmatter parser (minimal, no dependency) ──

function parseFrontmatter(content: string): { data: Record<string, string>; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { data: {}, body: content };
    const data: Record<string, string> = {};
    for (const line of match[1].split(/\r?\n/)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim();
            data[key] = val;
        }
    }
    return { data, body: match[2].trim() };
}

// ─── Simple YAML parser for agents/*.yaml ──────────────

function parseSimpleYaml(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let currentSection = result;
    for (const line of content.split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const indent = line.search(/\S/);
        const colonIdx = line.indexOf(':');
        if (colonIdx <= 0) continue;
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!val) {
            // Section header
            const section: Record<string, unknown> = {};
            result[key] = section;
            currentSection = section;
        } else if (indent > 0) {
            currentSection[key] = val;
        } else {
            result[key] = val;
        }
    }
    return result;
}

// ─── POST: Parse and import a .zip or .md skill package ───────

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.dbUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const assistantTypeRaw = formData.get('assistantType') as string | null;
        const assistantTypesRaw = formData.get('assistantTypes') as string | null;
        const mode = formData.get('mode') as string | null; // 'preview' or 'import'
        const autoAdaptRaw = formData.get('autoAdapt') as string | null;
        const autoAdapt = autoAdaptRaw !== 'false'; // default true
        const importModeRaw = (formData.get('importMode') as string | null) || 'compatible';
        const importMode: ImportMode = (['PRESERVED', 'COMPATIBLE', 'DEGRADED'].includes(importModeRaw.toUpperCase())
            ? importModeRaw.toUpperCase() as ImportMode
            : 'COMPATIBLE');

        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        if (!file.name.endsWith('.zip') && !file.name.endsWith('.md')) {
            return NextResponse.json({ error: 'File must be a .zip or .md' }, { status: 400 });
        }

        // Size guard: max 2MB
        const MAX_SIZE = 2 * 1024 * 1024;
        if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 });

        // ── Raw .md file: parse directly ──────────────
        if (file.name.endsWith('.md')) {
            const mdContent = await file.text();
            const { data: fm, body: rawInstructions } = parseFrontmatter(mdContent);
            if (!rawInstructions.trim()) {
                return NextResponse.json({ error: 'SKILL.md has no instruction content' }, { status: 400 });
            }

            const skillKey = (fm.name || file.name.replace(/\.md$/, ''))
                .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') + '_' + crypto.randomUUID().split('-')[0];
            const skillDisplayName = (fm.name || file.name.replace(/\.md$/, ''))
                .replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

            // Parse manifest for runtime analysis
            const manifest = parseSkillManifest({
                key: skillKey,
                name: skillDisplayName,
                description: fm.description,
                category: fm.category,
                instructions: rawInstructions,
                sourceFormat: 'md',
            });

            // Validate compatibility
            const compatReport = validateCompatibility(manifest);

            const parsed = {
                key: skillKey,
                name: skillDisplayName,
                description: fm.description || null,
                category: fm.category || null,
                instructionPrompt: rawInstructions,
                trainingMaterials: [] as { id: string; filename: string; textContent: string; uploadedAt: string }[],
                trainingMaterialCount: 0,
                promptLength: rawInstructions.length,
                // Runtime metadata
                runtimeCategory: manifest.runtimeCategory,
                responseMode: manifest.responseMode,
                requiredCapabilities: manifest.requiredCapabilities,
                artifactContracts: manifest.artifactContracts,
                detectedPatterns: manifest.detectedPatterns,
                compatibilityReport: compatReport,
                importMode,
            };

            if (mode !== 'import') {
                return NextResponse.json({ preview: parsed });
            }

            // Import the .md skill
            let types: string[] = [];
            if (assistantTypesRaw) {
                try { types = JSON.parse(assistantTypesRaw); } catch { types = [assistantTypesRaw]; }
            } else if (assistantTypeRaw) {
                types = [assistantTypeRaw];
            }

            // Determine instructions based on import mode
            let finalInstructions = rawInstructions;
            const trainingMats: { id: string; filename: string; textContent: string; uploadedAt: string }[] = [];

            if (importMode === 'PRESERVED') {
                // Keep raw instructions as-is
                finalInstructions = rawInstructions;
            } else if (importMode === 'COMPATIBLE' && autoAdapt) {
                // Adapt but preserve runtime metadata
                const { adapted } = await adaptSkillForNousio(rawInstructions, {
                    name: skillDisplayName, description: fm.description,
                });
                finalInstructions = adapted;
                trainingMats.push({
                    id: crypto.randomUUID(),
                    filename: 'original_skill.md',
                    textContent: rawInstructions.slice(0, 50000),
                    uploadedAt: new Date().toISOString(),
                });
            } else if (importMode === 'DEGRADED' && autoAdapt) {
                // Full adaptation, strip runtime semantics
                const { adapted } = await adaptSkillForNousio(rawInstructions, {
                    name: skillDisplayName, description: fm.description,
                });
                finalInstructions = adapted;
                trainingMats.push({
                    id: crypto.randomUUID(),
                    filename: 'original_skill.md',
                    textContent: rawInstructions.slice(0, 50000),
                    uploadedAt: new Date().toISOString(),
                });
            }

            const db = createAdminClient();
            const skillId = crypto.randomUUID();
            const { data: skill, error } = await db.from('AssistantSkill').insert({
                id: skillId, companyId: auth.dbUser.companyId,
                assistantType: types[0] || null, key: skillKey, name: parsed.name,
                description: parsed.description, icon: null, category: parsed.category,
                instructionPrompt: finalInstructions, outputSchema: null, requiredInputs: null,
                defaultParams: null, trainingMaterials: trainingMats.length > 0 ? trainingMats : null,
                isDefault: false, status: 'ACTIVE', sortOrder: 99, version: 1,
                enabledActions: [], updatedAt: new Date().toISOString(),
            }).select().single();
            if (error) {
                if (error.message?.includes('unique') || error.code === '23505') {
                    return NextResponse.json({ error: `A skill with key "${skillKey}" already exists` }, { status: 409 });
                }
                throw error;
            }
            if (types.length > 0) {
                await db.from('SkillAssignment').insert(types.map(t => ({ id: crypto.randomUUID(), skillId, assistantType: t })));
            }
            await db.from('SkillVersionLog').insert({
                id: crypto.randomUUID(), skillId, version: 1,
                instructionPrompt: finalInstructions, changedBy: auth.dbUser.id,
                changeSummary: `Imported from ${file.name} (mode: ${importMode})`,
            });
            return NextResponse.json({
                skill: { ...skill, assistantTypes: types },
                imported: true,
                adapted: importMode !== 'PRESERVED',
                importMode,
                compatibilityReport: compatReport,
            }, { status: 201 });
        }

        // ── .zip file ──────────────────────────────────
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);

        // Find SKILL.md (could be at root or inside a folder)
        let skillMdPath: string | null = null;
        const allPaths = Object.keys(zip.files);
        for (const p of allPaths) {
            if (p.endsWith('SKILL.md') && !zip.files[p].dir) {
                skillMdPath = p;
                break;
            }
        }

        if (!skillMdPath) {
            return NextResponse.json({ error: 'SKILL.md not found in zip — this is required' }, { status: 400 });
        }

        // Determine base path (folder the SKILL.md is in)
        const basePath = skillMdPath.includes('/') ? skillMdPath.substring(0, skillMdPath.lastIndexOf('/') + 1) : '';

        // Parse SKILL.md
        const skillMdContent = await zip.files[skillMdPath].async('string');
        const { data: frontmatter, body: instructionPrompt } = parseFrontmatter(skillMdContent);

        if (!frontmatter.name && !instructionPrompt) {
            return NextResponse.json({ error: 'SKILL.md must have a name in frontmatter and instruction content' }, { status: 400 });
        }

        // Parse agents/*.yaml for display metadata
        let displayName = '';
        let shortDescription = '';
        let category = '';
        for (const p of allPaths) {
            if (p.startsWith(basePath + 'agents/') && (p.endsWith('.yaml') || p.endsWith('.yml')) && !zip.files[p].dir) {
                const yamlContent = await zip.files[p].async('string');
                const parsed = parseSimpleYaml(yamlContent);
                const iface = parsed.interface as Record<string, string> | undefined;
                if (iface) {
                    displayName = iface.display_name || '';
                    shortDescription = iface.short_description || '';
                    category = iface.category || '';
                }
                break; // only first yaml
            }
        }

        // Read and CLASSIFY all package files
        const supportedExts = ['.md', '.ts', '.js', '.py', '.yaml', '.yml', '.json', '.txt', '.tsx', '.jsx', '.css'];
        const packageFiles: { path: string; content?: string; sizeBytes?: number }[] = [];
        const trainingMaterials: { id: string; filename: string; textContent: string; uploadedAt: string }[] = [];

        for (const p of allPaths) {
            if (zip.files[p].dir || p === skillMdPath) continue;
            const matchesExt = supportedExts.some(ext => p.endsWith(ext));
            if (!matchesExt) continue;

            const content = await zip.files[p].async('string');
            const relativePath = p.startsWith(basePath) ? p.slice(basePath.length) : p;
            const filename = p.split('/').pop() || p;

            packageFiles.push({
                path: relativePath,
                content: content.slice(0, 50000),
                sizeBytes: content.length,
            });

            // For backward compat: also create training materials from reference-type files
            trainingMaterials.push({
                id: crypto.randomUUID(),
                filename,
                textContent: content.slice(0, 50000),
                uploadedAt: new Date().toISOString(),
            });
        }

        // Build the skill key
        const skillKey = (frontmatter.name || 'imported_skill')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/(^_|_$)/g, '') + '_' + crypto.randomUUID().split('-')[0];

        const skillName = displayName || frontmatter.name || skillKey;

        // Parse manifest
        const manifest = parseSkillManifest({
            key: skillKey,
            name: skillName,
            description: shortDescription || frontmatter.description,
            category: category || undefined,
            instructions: instructionPrompt,
            packageFiles,
            sourceFormat: 'zip',
        });

        // Validate compatibility
        const compatReport = validateCompatibility(manifest);

        // Build the parsed result
        const parsed = {
            key: skillKey,
            name: skillName,
            description: shortDescription || frontmatter.description || null,
            category: category || null,
            instructionPrompt,
            trainingMaterials,
            trainingMaterialCount: trainingMaterials.length,
            promptLength: instructionPrompt.length,
            // Runtime metadata
            runtimeCategory: manifest.runtimeCategory,
            responseMode: manifest.responseMode,
            requiredCapabilities: manifest.requiredCapabilities,
            artifactContracts: manifest.artifactContracts,
            packageFiles: manifest.packageFiles,
            detectedPatterns: manifest.detectedPatterns,
            compatibilityReport: compatReport,
            importMode,
        };

        // Preview mode: return parsed data without saving
        if (mode !== 'import') {
            return NextResponse.json({ preview: parsed });
        }

        // Import mode: create the skill
        let types: string[] = [];
        if (assistantTypesRaw) {
            try { types = JSON.parse(assistantTypesRaw); } catch { types = [assistantTypesRaw]; }
        } else if (assistantTypeRaw) {
            types = [assistantTypeRaw];
        }

        // Determine final instructions based on import mode
        let finalInstructions = instructionPrompt;
        if (importMode === 'PRESERVED') {
            finalInstructions = instructionPrompt;
        } else if ((importMode === 'COMPATIBLE' || importMode === 'DEGRADED') && autoAdapt) {
            const { adapted } = await adaptSkillForNousio(instructionPrompt, {
                name: parsed.name, description: parsed.description || undefined,
            });
            finalInstructions = adapted;
        }

        // Store raw package in Supabase Storage
        let rawPackageRef: string | null = null;
        try {
            const db = createAdminClient();
            const storagePath = `${auth.dbUser.companyId}/imports/${skillKey}_${Date.now()}.zip`;
            await db.storage.from('skill-artifacts').upload(storagePath, new Uint8Array(buffer), {
                contentType: 'application/zip',
                upsert: false,
            });
            rawPackageRef = storagePath;
        } catch { /* storage optional for now */ }

        const db = createAdminClient();
        const skillId = crypto.randomUUID();

        // Build training materials array (include original if adapted)
        const allTrainingMats = [
            ...(importMode !== 'PRESERVED' && autoAdapt
                ? [{ id: crypto.randomUUID(), filename: 'original_skill.md', textContent: instructionPrompt.slice(0, 50000), uploadedAt: new Date().toISOString() }]
                : []),
            ...trainingMaterials,
        ];

        const { data: skill, error } = await db.from('AssistantSkill').insert({
            id: skillId,
            companyId: auth.dbUser.companyId,
            assistantType: types[0] || null,
            key: skillKey,
            name: parsed.name,
            description: parsed.description,
            icon: null,
            category: parsed.category,
            instructionPrompt: finalInstructions,
            outputSchema: null,
            requiredInputs: null,
            defaultParams: null,
            trainingMaterials: allTrainingMats.length > 0 ? allTrainingMats : null,
            isDefault: false,
            status: 'ACTIVE',
            sortOrder: 99,
            version: 1,
            enabledActions: [],
            updatedAt: new Date().toISOString(),
        }).select().single();

        if (error) {
            if (error.message?.includes('unique') || error.code === '23505') {
                return NextResponse.json({ error: `A skill with key "${skillKey}" already exists` }, { status: 409 });
            }
            throw error;
        }

        // Create SkillAssignment rows
        if (types.length > 0) {
            const assignments = types.map(t => ({
                id: crypto.randomUUID(),
                skillId,
                assistantType: t,
            }));
            await db.from('SkillAssignment').insert(assignments);
        }

        // Create initial version log
        await db.from('SkillVersionLog').insert({
            id: crypto.randomUUID(),
            skillId,
            version: 1,
            instructionPrompt: finalInstructions,
            changedBy: auth.dbUser.id,
            changeSummary: `Imported from ${file.name} (mode: ${importMode})`,
        });

        return NextResponse.json({
            skill: { ...skill, assistantTypes: types },
            imported: true,
            adapted: importMode !== 'PRESERVED',
            importMode,
            compatibilityReport: compatReport,
        }, { status: 201 });
    } catch (error) {
        console.error('[api/ai/skills/import] POST error:', error);
        return NextResponse.json({ error: 'Failed to import skill' }, { status: 500 });
    }
}
