// ═══════════════════════════════════════════════════════
// API: /api/ai/skills/import-url — Import a skill from a GitHub URL
// ═══════════════════════════════════════════════════════
//
// POST { repoUrl, skillName, assistantTypes[], autoAdapt }
//
// Fetches SKILL.md + supporting files directly from a public GitHub repo,
// parses them, optionally adapts instructions for Nousio, and creates
// the AssistantSkill + SkillAssignment rows.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { adaptSkillForNousio } from '@/lib/community-skills/adapt-skill';
import { parseSkillManifest } from '@/lib/skills/manifest-parser';
import { validateCompatibility } from '@/lib/skills/compatibility-validator';
import type { ImportMode } from '@/lib/skills/types';

// ─── GitHub API helpers ─────────────────────────────────

interface GitHubFileEntry {
    name: string;
    path: string;
    type: 'file' | 'dir';
    download_url: string | null;
}

/**
 * Parse a GitHub URL into owner/repo.
 * Supports: https://github.com/owner/repo, https://github.com/owner/repo.git,
 *           https://github.com/owner/repo/tree/main/...
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    try {
        const u = new URL(url);
        if (!u.hostname.includes('github.com')) return null;
        const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
        if (parts.length < 2) return null;
        return { owner: parts[0], repo: parts[1] };
    } catch {
        return null;
    }
}

/**
 * Try multiple known folder conventions to find a skill's SKILL.md.
 */
async function findSkillInRepo(
    owner: string,
    repo: string,
    skillName: string,
): Promise<{ skillMdUrl: string; basePath: string; files: GitHubFileEntry[] } | null> {
    // Common conventions for where skills live
    const candidatePaths = [
        `.skills/${skillName}`,
        `skills/${skillName}`,
        skillName,
        `${skillName}/skills/${skillName}`,
    ];

    for (const basePath of candidatePaths) {
        try {
            const res = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${basePath}`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Nousio-Skill-Importer',
                        ...(process.env.GITHUB_TOKEN
                            ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }
                            : {}),
                    },
                },
            );
            if (!res.ok) continue;

            const entries: GitHubFileEntry[] = await res.json();
            if (!Array.isArray(entries)) continue;

            const skillMd = entries.find(e => e.name === 'SKILL.md' && e.type === 'file');
            if (skillMd?.download_url) {
                return { skillMdUrl: skillMd.download_url, basePath, files: entries };
            }
        } catch {
            continue;
        }
    }

    return null;
}

/**
 * List available skills in a repo (look for directories containing SKILL.md).
 */
async function listAvailableSkills(owner: string, repo: string): Promise<string[]> {
    const candidateRoots = ['.skills', 'skills', ''];
    const skills: string[] = [];

    for (const root of candidateRoots) {
        try {
            const path = root || '';
            const res = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Nousio-Skill-Importer',
                        ...(process.env.GITHUB_TOKEN
                            ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }
                            : {}),
                    },
                },
            );
            if (!res.ok) continue;

            const entries: GitHubFileEntry[] = await res.json();
            if (!Array.isArray(entries)) continue;

            // Each directory that is a potential skill
            const dirs = entries.filter(e => e.type === 'dir');
            for (const dir of dirs) {
                // Check if it contains SKILL.md
                try {
                    const subRes = await fetch(
                        `https://api.github.com/repos/${owner}/${repo}/contents/${dir.path}/SKILL.md`,
                        {
                            headers: {
                                'Accept': 'application/vnd.github.v3+json',
                                'User-Agent': 'Nousio-Skill-Importer',
                                ...(process.env.GITHUB_TOKEN
                                    ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }
                                    : {}),
                            },
                        },
                    );
                    if (subRes.ok) {
                        skills.push(dir.name);
                    }
                } catch {
                    // Not a skill directory
                }
            }

            if (skills.length > 0) break; // Found skills in this root, stop
        } catch {
            continue;
        }
    }

    return skills;
}

/**
 * Fetch supporting files from sub-directories (scripts/, examples/, resources/, references/).
 */
async function fetchSupportingFiles(
    owner: string,
    repo: string,
    basePath: string,
    entries: GitHubFileEntry[],
): Promise<{ filename: string; textContent: string }[]> {
    const supportDirs = ['scripts', 'examples', 'resources', 'references'];
    const supportedExts = ['.md', '.ts', '.js', '.py', '.yaml', '.yml', '.json', '.txt', '.tsx', '.jsx', '.css'];
    const materials: { filename: string; textContent: string }[] = [];

    for (const dir of entries.filter(e => e.type === 'dir' && supportDirs.includes(e.name))) {
        try {
            const res = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${basePath}/${dir.name}`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Nousio-Skill-Importer',
                        ...(process.env.GITHUB_TOKEN
                            ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }
                            : {}),
                    },
                },
            );
            if (!res.ok) continue;

            const subEntries: GitHubFileEntry[] = await res.json();
            for (const file of subEntries) {
                if (file.type !== 'file' || !file.download_url) continue;
                if (!supportedExts.some(ext => file.name.endsWith(ext))) continue;

                try {
                    const contentRes = await fetch(file.download_url);
                    if (!contentRes.ok) continue;
                    const text = await contentRes.text();
                    materials.push({
                        filename: `${dir.name}/${file.name}`,
                        textContent: text.slice(0, 50000),
                    });
                } catch {
                    // Skip this file
                }
            }
        } catch {
            continue;
        }
    }

    return materials;
}

// ─── Frontmatter parser ───────────────────────────────

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

// ─── POST handler ─────────────────────────────────────

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.dbUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    try {
        const body = await request.json();
        const {
            repoUrl,
            skillName,
            assistantTypes = [],
            autoAdapt = true,
            mode = 'import',   // 'preview', 'import', or 'list'
            importMode: importModeRaw = 'compatible',
        } = body;

        const importMode: ImportMode = (['PRESERVED', 'COMPATIBLE', 'DEGRADED'].includes(String(importModeRaw).toUpperCase())
            ? String(importModeRaw).toUpperCase() as ImportMode
            : 'COMPATIBLE');

        // ── List available skills in a repo ──────────
        if (mode === 'list') {
            if (!repoUrl) return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
            const parsed = parseGitHubUrl(repoUrl);
            if (!parsed) return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });

            const skills = await listAvailableSkills(parsed.owner, parsed.repo);
            return NextResponse.json({ skills, repo: `${parsed.owner}/${parsed.repo}` });
        }

        // ── Preview / Import a specific skill ────────
        if (!repoUrl || !skillName) {
            return NextResponse.json({ error: 'repoUrl and skillName are required' }, { status: 400 });
        }

        const parsed = parseGitHubUrl(repoUrl);
        if (!parsed) return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });

        // 1. Find the skill in the repo
        const found = await findSkillInRepo(parsed.owner, parsed.repo, skillName);
        if (!found) {
            return NextResponse.json({
                error: `Skill "${skillName}" not found in ${parsed.owner}/${parsed.repo}. Looked in: .skills/${skillName}/, skills/${skillName}/, ${skillName}/`,
            }, { status: 404 });
        }

        // 2. Fetch SKILL.md content
        const skillMdRes = await fetch(found.skillMdUrl);
        if (!skillMdRes.ok) {
            return NextResponse.json({ error: 'Failed to fetch SKILL.md from GitHub' }, { status: 502 });
        }
        const skillMdContent = await skillMdRes.text();
        const { data: frontmatter, body: rawInstructions } = parseFrontmatter(skillMdContent);

        if (!rawInstructions.trim()) {
            return NextResponse.json({ error: 'SKILL.md has no instruction content' }, { status: 400 });
        }

        // 3. Fetch supporting files
        const supportingFiles = await fetchSupportingFiles(
            parsed.owner, parsed.repo, found.basePath, found.files,
        );

        // 4. Build skill metadata
        const skillKey = (frontmatter.name || skillName)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/(^_|_$)/g, '');

        const skillDisplayName = frontmatter.name
            ? frontmatter.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
            : skillName.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

        const preview = {
            key: skillKey,
            name: skillDisplayName,
            description: frontmatter.description || null,
            category: frontmatter.category || null,
            source: `${parsed.owner}/${parsed.repo}`,
            sourceUrl: repoUrl,
            instructionPrompt: rawInstructions,
            supportingFiles: supportingFiles.map(f => f.filename),
            supportingFileCount: supportingFiles.length,
            promptLength: rawInstructions.length,
        };

        // Parse manifest for runtime analysis
        const manifest = parseSkillManifest({
            key: skillKey,
            name: skillDisplayName,
            description: frontmatter.description,
            category: frontmatter.category,
            instructions: rawInstructions,
            packageFiles: supportingFiles.map(f => ({ path: f.filename, content: f.textContent })),
            sourceFormat: 'github',
        });

        const compatReport = validateCompatibility(manifest);

        // Preview mode: return parsed data + runtime metadata
        if (mode === 'preview') {
            return NextResponse.json({
                preview: {
                    ...preview,
                    runtimeCategory: manifest.runtimeCategory,
                    responseMode: manifest.responseMode,
                    requiredCapabilities: manifest.requiredCapabilities,
                    artifactContracts: manifest.artifactContracts,
                    detectedPatterns: manifest.detectedPatterns,
                    compatibilityReport: compatReport,
                    importMode,
                },
            });
        }

        // ── Import mode ─────────────────────────────
        const db = createAdminClient();

        // Check for duplicate
        const { data: existing } = await db
            .from('AssistantSkill')
            .select('id')
            .eq('companyId', auth.dbUser.companyId)
            .eq('key', skillKey)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: `A skill with key "${skillKey}" already exists` }, { status: 409 });
        }

        // Auto-adapt instructions if requested (based on import mode)
        let finalInstructions = rawInstructions;
        let adaptationNote = '';
        if (importMode === 'PRESERVED') {
            finalInstructions = rawInstructions;
            adaptationNote = 'Preserved original instructions (raw import).';
        } else if (autoAdapt) {
            const { adapted, success, error } = await adaptSkillForNousio(rawInstructions, {
                name: skillDisplayName,
                description: frontmatter.description,
            });
            finalInstructions = adapted;
            adaptationNote = success
                ? `Instructions auto-adapted for Nousio (mode: ${importMode}).`
                : `Adaptation failed (${error}). Using raw instructions.`;
        }

        // Build training materials (original SKILL.md + supporting files)
        const trainingMaterials = [
            {
                id: crypto.randomUUID(),
                filename: 'original_skill.md',
                textContent: rawInstructions.slice(0, 50000),
                uploadedAt: new Date().toISOString(),
            },
            ...supportingFiles.map(f => ({
                id: crypto.randomUUID(),
                filename: f.filename,
                textContent: f.textContent,
                uploadedAt: new Date().toISOString(),
            })),
        ];

        // Create the skill
        const skillId = crypto.randomUUID();
        const types: string[] = assistantTypes.length > 0 ? assistantTypes : [];

        const { data: skill, error: insertError } = await db.from('AssistantSkill').insert({
            id: skillId,
            companyId: auth.dbUser.companyId,
            assistantType: types[0] || null,
            key: skillKey,
            name: preview.name,
            description: preview.description,
            icon: null,
            category: preview.category,
            instructionPrompt: finalInstructions,
            outputSchema: null,
            requiredInputs: null,
            defaultParams: null,
            trainingMaterials,
            isDefault: false,
            status: 'ACTIVE',
            sortOrder: 99,
            version: 1,
            enabledActions: [],
            updatedAt: new Date().toISOString(),
        }).select().single();

        if (insertError) {
            if (insertError.message?.includes('unique') || insertError.code === '23505') {
                return NextResponse.json({ error: `A skill with key "${skillKey}" already exists` }, { status: 409 });
            }
            throw insertError;
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

        // Create version log
        await db.from('SkillVersionLog').insert({
            id: crypto.randomUUID(),
            skillId,
            version: 1,
            instructionPrompt: finalInstructions,
            changedBy: auth.dbUser.id,
            changeSummary: `Imported from GitHub: ${parsed.owner}/${parsed.repo}/${skillName} (mode: ${importMode}). ${adaptationNote}`,
        });

        return NextResponse.json({
            skill: { ...skill, assistantTypes: types },
            imported: true,
            adapted: importMode !== 'PRESERVED',
            adaptationNote,
            source: `${parsed.owner}/${parsed.repo}`,
            importMode,
            compatibilityReport: compatReport,
        }, { status: 201 });

    } catch (error) {
        console.error('[api/ai/skills/import-url] POST error:', error);
        return NextResponse.json({ error: 'Failed to import skill from GitHub' }, { status: 500 });
    }
}
