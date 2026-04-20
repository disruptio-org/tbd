'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUIFeedback } from '@/components/UIFeedback';
import {
    Plus, Pencil, Trash2, Archive, ArchiveRestore, Loader, X, Upload, Brain, Play,
    Briefcase, Globe, PenLine, Mail, CalendarDays, Rocket, Tag,
    ClipboardList, Settings, Wrench, User, CheckSquare, Puzzle,
    Target, Map, Package, Plug, Microscope, Phone, FileText,
    RefreshCw, Shield, BarChart3, Search, BookOpen, HelpCircle,
    Cog, Users, TrendingUp, Crosshair, DollarSign, GraduationCap,
    Building2, Sparkles, Zap, ThumbsUp, ThumbsDown, History, RotateCcw,
    Clock, Eye, Paperclip, ImageIcon, Maximize2, Minimize2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { TableShell, TableToolbar, StatusBadge, RowActionMenu, TableEmptyState, TableLoadingState } from '@/components/table';
import '@/components/table/table.css';
import { CompatibilityBadge } from '@/components/skills/CompatibilityBadge';

// ─── Icon Map (lucide name → component) ───────────────

const ICON_MAP: Record<string, React.ReactNode> = {
    'briefcase':      <Briefcase size={16} />,
    'globe':          <Globe size={16} />,
    'pen-line':       <PenLine size={16} />,
    'mail':           <Mail size={16} />,
    'calendar-days':  <CalendarDays size={16} />,
    'rocket':         <Rocket size={16} />,
    'tag':            <Tag size={16} />,
    'clipboard-list': <ClipboardList size={16} />,
    'settings':       <Settings size={16} />,
    'wrench':         <Wrench size={16} />,
    'user':           <User size={16} />,
    'check-square':   <CheckSquare size={16} />,
    'puzzle':         <Puzzle size={16} />,
    'target':         <Target size={16} />,
    'map':            <Map size={16} />,
    'package':        <Package size={16} />,
    'plug':           <Plug size={16} />,
    'microscope':     <Microscope size={16} />,
    'phone':          <Phone size={16} />,
    'file-text':      <FileText size={16} />,
    'refresh-cw':     <RefreshCw size={16} />,
    'shield':         <Shield size={16} />,
    'bar-chart-3':    <BarChart3 size={16} />,
    'search':         <Search size={16} />,
    'book-open':      <BookOpen size={16} />,
    'help-circle':    <HelpCircle size={16} />,
    'cog':            <Cog size={16} />,
    'users':          <Users size={16} />,
    'trending-up':    <TrendingUp size={16} />,
    'crosshair':      <Crosshair size={16} />,
    'dollar-sign':    <DollarSign size={16} />,
    'graduation-cap': <GraduationCap size={16} />,
    'building-2':     <Building2 size={16} />,
    'sparkles':       <Sparkles size={16} />,
    'zap':            <Zap size={16} />,
};

function renderIcon(name?: string | null) {
    if (!name) return <Zap size={16} />;
    return ICON_MAP[name] ?? <Zap size={16} />;
}

// ─── Types ────────────────────────────────────────────

interface TrainingMaterial {
    id: string;
    filename: string;
    textContent: string;
    uploadedAt: string;
}

interface Skill {
    id: string;
    companyId: string;
    assistantType: string | null;
    assistantTypes?: string[];
    key: string;
    name: string;
    description: string | null;
    icon: string | null;
    category: string | null;
    status: string;
    executionType?: string;
    executionConfig?: unknown;
    sortOrder: number;
    isDefault: boolean;
    version: number;
    instructionPrompt: string | null;
    outputSchema: unknown;
    requiredInputs: unknown;
    defaultParams: unknown;
    enabledActions?: string[];
    outputActions?: string[];
    trainingMaterials: TrainingMaterial[] | null;
    createdAt: string;
    updatedAt: string;
    // Runtime metadata
    importMode?: string | null;
    runtimeCategory?: string | null;
    responseMode?: string | null;
    compatibilityState?: string | null;
}

// Fallback labels for predefined assistant types
const FALLBACK_TYPE_LABELS: Record<string, string> = {
    MARKETING: 'Marketing Assistant',
    PRODUCT_ASSISTANT: 'Product Assistant',
    SALES: 'Sales Assistant',
    ONBOARDING: 'Onboarding Assistant',
    COMPANY_ADVISOR: 'Company Advisor',
    LEAD_DISCOVERY: 'Lead Discovery',
    GENERAL_AI: 'General AI',
};

const FALLBACK_TYPE_ICONS: Record<string, React.ReactNode> = {
    MARKETING:         <Rocket size={16} />,
    PRODUCT_ASSISTANT: <Package size={16} />,
    SALES:             <DollarSign size={16} />,
    ONBOARDING:        <GraduationCap size={16} />,
    COMPANY_ADVISOR:   <Building2 size={16} />,
    LEAD_DISCOVERY:    <Target size={16} />,
    GENERAL_AI:        <Sparkles size={16} />,
};

interface TeamMember {
    brainType: string;
    label: string;
    icon: React.ReactNode;
}

const ICON_OPTIONS = Object.keys(ICON_MAP);

const OUTPUT_ACTION_OPTIONS = [
    { key: 'preview', label: 'Preview (Inline Markdown)' },
    { key: 'copy', label: 'Copy to Clipboard' },
    { key: 'regenerate', label: 'Regenerate Button' },
    { key: 'export_md', label: 'Export Markdown (.md)' },
    { key: 'export_docx', label: 'Export Document (.docx)' },
    { key: 'export_pptx', label: 'Export Presentation (.pptx)' },
    { key: 'export_xlsx', label: 'Export Spreadsheet (.xlsx)' },
    { key: 'export_zip', label: 'Export ZIP Archive (.zip)' },
    { key: 'render_ui', label: 'Render UI (Web Components)' },
    { key: 'render_chart', label: 'Render Chart' },
];

const RESPONSE_MODE_OPTIONS = [
    { key: 'chat', label: 'Chat', desc: 'Inline text response (markdown)' },
    { key: 'artifact_first', label: 'Artifact First', desc: 'Generates a downloadable artifact (DOCX, PPTX, etc.)' },
    { key: 'artifact_plus_chat', label: 'Artifact + Chat', desc: 'Artifact with summary message' },
    { key: 'ui_rendered', label: 'UI Rendered', desc: 'Renders a visual component (chart, wireframe, etc.)' },
    { key: 'action_result', label: 'Action Result', desc: 'Returns structured action output' },
    { key: 'multi_output', label: 'Multi Output', desc: 'Multiple artifacts and messages' },
];

// ─── Component ────────────────────────────────────────

export default function SkillsManagerPanel() {
    const { showToast, showConfirm } = useUIFeedback();
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('ALL');
    const [showArchived, setShowArchived] = useState(false);
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
    const [schedulingSkill, setSchedulingSkill] = useState<Skill | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showUrlImportModal, setShowUrlImportModal] = useState(false);
    const importFileRef = useRef<HTMLInputElement>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    // ─── Load Team Members (brains) ───────────────────────

    const loadTeamMembers = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/brains');
            const data = await res.json();
            const brains = (data.brains || []).filter((b: { brainType: string }) => b.brainType !== 'COMPANY');
            const members: TeamMember[] = brains.map((b: { brainType: string; name: string }) => ({
                brainType: b.brainType,
                label: FALLBACK_TYPE_LABELS[b.brainType] || b.name,
                icon: FALLBACK_TYPE_ICONS[b.brainType] || <Brain size={16} />,
            }));
            setTeamMembers(members);
        } catch {
            // Fallback to hardcoded list if brains API fails
            setTeamMembers(
                Object.entries(FALLBACK_TYPE_LABELS).map(([key, label]) => ({
                    brainType: key,
                    label,
                    icon: FALLBACK_TYPE_ICONS[key] || <Sparkles size={16} />,
                }))
            );
        }
    }, []);

    // ─── Load Skills ──────────────────────────────────────

    const loadSkills = useCallback(async () => {
        try {
            const url = showArchived ? '/api/ai/skills?includeArchived=true' : '/api/ai/skills';
            const res = await fetch(url);
            const data = await res.json();
            // Filter out imported Zapier actions — those are now in ExternalAction catalog
            const result = (data.skills || []).filter((s: Skill) => !s.executionType || s.executionType === 'NATIVE');
            setSkills(result);
        } catch {
            showToast('Error loading skills', 'error');
        }
        setLoading(false);
    }, [showToast, showArchived]);

    useEffect(() => { loadTeamMembers(); loadSkills(); }, [loadTeamMembers, loadSkills]);

    // ─── Client-side filter ──────────────────────────────

    const filteredSkills = filter === 'ALL'
        ? skills
        : skills.filter(s => (s.assistantTypes || []).includes(filter) || s.assistantType === filter);

    // ─── Handlers ─────────────────────────────────────────

    async function handleToggleStatus(skill: Skill) {
        const newStatus = skill.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
        try {
            const res = await fetch(`/api/ai/skills/${skill.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error();
            showToast(`Skill ${newStatus === 'ACTIVE' ? 'activated' : 'archived'}`, 'success');
            loadSkills();
        } catch {
            showToast('Error updating skill', 'error');
        }
    }

    async function handleDelete(skill: Skill) {
        showConfirm(
            skill.isDefault ? 'Archive this default skill?' : 'Delete this custom skill?',
            async () => {
                try {
                    const res = await fetch(`/api/ai/skills/${skill.id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error();
                    showToast(skill.isDefault ? 'Skill archived' : 'Skill deleted', 'success');
                    loadSkills();
                } catch {
                    showToast('Error deleting skill', 'error');
                }
            }
        );
    }

    // ─── Render ───────────────────────────────────────────

    if (loading) {
        return (
            <div className="skills-manager">
                <TableShell>
                    <TableLoadingState rows={6} columns={7} />
                </TableShell>
            </div>
        );
    }

    return (
        <div className="skills-manager">
            {/* ─── Toolbar ──────────────────────────── */}
            <TableShell>
                <TableToolbar
                    filters={
                        <>
                        <select
                            className="nousio-toolbar-filter"
                            style={{ padding: '6px 10px' }}
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        >
                            <option value="ALL">All Resources</option>
                            {teamMembers.map(m => (
                                <option key={m.brainType} value={m.brainType}>{m.label}</option>
                            ))}
                        </select>
                        <button
                            className={`btn btn-secondary ${showArchived ? 'active' : ''}`}
                            onClick={() => setShowArchived(!showArchived)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '5px 10px', opacity: showArchived ? 1 : 0.6 }}
                            title={showArchived ? 'Showing archived skills — click to hide' : 'Show archived skills'}
                        >
                            <Archive size={13} /> {showArchived ? 'Archived ✓' : 'Archived'}
                        </button>
                        </>
                    }
                    actions={
                        <>
                            <input ref={importFileRef} type="file" accept=".zip,.md" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setShowImportModal(true); }} />
                            <button className="btn btn-secondary" onClick={() => setShowUrlImportModal(true)}><Globe size={14} /> From URL</button>
                            <button className="btn btn-secondary" onClick={() => importFileRef.current?.click()}><Upload size={14} /> Import</button>
                            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={14} /> New Skill</button>
                        </>
                    }
                    resultCount={`${filteredSkills.length} skill${filteredSkills.length !== 1 ? 's' : ''}`}
                />

                {/* ─── Single flat table ─────────────────── */}
                <div style={{ overflowX: 'auto' }}>
                <table className="nousio-table" style={{ minWidth: 780 }}>
                    <thead>
                        <tr>
                            <th style={{ width: '25%' }}>Name</th>
                            <th style={{ width: '14%' }}>Resource</th>
                            <th style={{ width: '12%' }}>Key</th>
                            <th style={{ width: '10%' }}>Category</th>
                            <th style={{ width: '9%' }}>Status</th>
                            <th style={{ width: '9%' }}>Runtime</th>
                            <th style={{ width: '8%' }}>Prompt</th>
                            <th className="align-right" style={{ width: '12%' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSkills.map(skill => (
                            <tr key={skill.id} style={skill.status === 'ARCHIVED' ? { opacity: 0.5 } : undefined}>
                                <td className="cell-primary">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--color-text-secondary, #64748b)' }}>{renderIcon(skill.icon)}</span>
                                        {skill.name}
                                        {skill.isDefault && <StatusBadge variant="info">Default</StatusBadge>}
                                        {!skill.isDefault && <StatusBadge variant="neutral">Custom</StatusBadge>}
                                        {skill.enabledActions?.length ? <StatusBadge variant="warning">⚡ {skill.enabledActions.length}</StatusBadge> : null}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                        {(skill.assistantTypes || (skill.assistantType ? [skill.assistantType] : [])).map(t => {
                                            const member = teamMembers.find(m => m.brainType === t);
                                            return (
                                            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2px 6px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em', borderRadius: 4 }}>
                                                {member?.icon || FALLBACK_TYPE_ICONS[t] || <Brain size={16} />}
                                                {(member?.label || FALLBACK_TYPE_LABELS[t] || t).replace(/ Assistant| AI/g, '')}
                                            </span>
                                            );
                                        })}
                                        {!(skill.assistantTypes?.length || skill.assistantType) && <span className="cell-muted">—</span>}
                                    </div>
                                </td>
                                <td className="cell-muted"><code style={{ fontSize: 11 }}>{skill.key}</code></td>
                                <td className="cell-muted">{skill.category || '—'}</td>
                                <td>
                                    <StatusBadge variant={skill.status === 'ACTIVE' ? 'success' : skill.status === 'DRAFT' ? 'warning' : 'neutral'}>
                                        {skill.status === 'ACTIVE' ? 'Active' : skill.status === 'DRAFT' ? 'Draft' : 'Archived'}
                                    </StatusBadge>
                                </td>
                                <td>
                                    {skill.importMode && skill.importMode !== 'LEGACY' ? (
                                        <CompatibilityBadge
                                            state={skill.compatibilityState || 'UNKNOWN'}
                                            size="sm"
                                            tooltip={`Import: ${skill.importMode} | Runtime: ${skill.runtimeCategory || 'content-generation'}`}
                                        />
                                    ) : (
                                        <span className="cell-muted" style={{ fontSize: 10 }}>Legacy</span>
                                    )}
                                </td>
                                <td>
                                    {skill.instructionPrompt ? (
                                        <StatusBadge variant="success">✓ Set</StatusBadge>
                                    ) : (
                                        <span className="cell-muted">—</span>
                                    )}
                                </td>
                                <td>
                                    <RowActionMenu
                                        primaryAction={{
                                            icon: <Pencil size={14} />,
                                            title: 'Edit',
                                            onClick: () => setEditingSkill(skill),
                                        }}
                                        items={[
                                            {
                                                label: skill.status === 'ACTIVE' ? 'Archive' : 'Activate',
                                                icon: skill.status === 'ACTIVE' ? <Archive size={14} /> : <ArchiveRestore size={14} />,
                                                onClick: () => handleToggleStatus(skill),
                                            },
                                            {
                                                label: 'Schedule',
                                                icon: <Clock size={14} />,
                                                onClick: () => setSchedulingSkill(skill),
                                            },
                                            ...(!skill.isDefault ? [{
                                                label: 'Delete',
                                                icon: <Trash2 size={14} />,
                                                onClick: () => handleDelete(skill),
                                                danger: true,
                                            }] : []),
                                        ]}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </TableShell>

            {skills.length === 0 && (
                <TableEmptyState
                    icon={<Zap size={32} />}
                    title="No skills found"
                    description="Run the seed script or create a new skill."
                    action={<button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ New Skill</button>}
                />
            )}

            {/* ─── Edit Modal ──────────────────────────── */}
            {editingSkill && (
                <SkillEditModal
                    skill={editingSkill}
                    onClose={() => setEditingSkill(null)}
                    onSaved={() => { setEditingSkill(null); loadSkills(); }}
                    showToast={showToast}
                    teamMembers={teamMembers}
                />
            )}

            {/* ─── Create Modal ────────────────────────── */}
            {showCreateModal && (
                <SkillCreateModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => { setShowCreateModal(false); loadSkills(); }}
                    showToast={showToast}
                    teamMembers={teamMembers}
                />
            )}

            {/* ── Schedule Modal ─────────────────────── */}
            {schedulingSkill && (
                <ScheduleSkillModal
                    skill={schedulingSkill}
                    onClose={() => setSchedulingSkill(null)}
                    showToast={showToast}
                />
            )}

            {/* ── Import Modal ─────────────────────────── */}
            {showImportModal && importFileRef.current?.files?.[0] && (
                <SkillImportModal
                    file={importFileRef.current.files[0]}
                    onClose={() => {
                        setShowImportModal(false);
                        if (importFileRef.current) importFileRef.current.value = '';
                    }}
                    onImported={() => {
                        setShowImportModal(false);
                        if (importFileRef.current) importFileRef.current.value = '';
                        loadSkills();
                    }}
                    showToast={showToast}
                    teamMembers={teamMembers}
                />
            )}

            {/* ── URL Import Modal ─────────────────────── */}
            {showUrlImportModal && (
                <SkillUrlImportModal
                    onClose={() => setShowUrlImportModal(false)}
                    onImported={() => {
                        setShowUrlImportModal(false);
                        loadSkills();
                    }}
                    showToast={showToast}
                    teamMembers={teamMembers}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// Edit Modal
// ═══════════════════════════════════════════════════════

function SkillEditModal({
    skill,
    onClose,
    onSaved,
    showToast,
    teamMembers,
}: {
    skill: Skill;
    onClose: () => void;
    onSaved: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    teamMembers: TeamMember[];
}) {
    const [name, setName] = useState(skill.name);
    const [description, setDescription] = useState(skill.description || '');
    const [icon, setIcon] = useState(skill.icon || '');
    const [category, setCategory] = useState(skill.category || '');
    const [instructionPrompt, setInstructionPrompt] = useState(skill.instructionPrompt || '');
    const [saving, setSaving] = useState(false);
    const [showIconPicker, setShowIconPicker] = useState(false);

    // Training materials state
    const [trainingMaterials, setTrainingMaterials] = useState<TrainingMaterial[]>(skill.trainingMaterials || []);
    const [training, setTraining] = useState(false);
    const [trainingStatus, setTrainingStatus] = useState('');
    const trainingFileRef = useRef<HTMLInputElement>(null);

    // Analytics state
    const [analytics, setAnalytics] = useState<{ totalRatings: number; thumbsUp: number; thumbsDown: number; avgRating: number } | null>(null);
    // Version history state
    interface VersionEntry { id: string; version: number; instructionPrompt: string | null; changeSummary: string | null; createdAt: string; }
    const [versions, setVersions] = useState<VersionEntry[]>([]);
    const [showVersions, setShowVersions] = useState(false);

    // Test skill state
    const [showTest, setShowTest] = useState(false);
    const [testInput, setTestInput] = useState('');
    const [testOutput, setTestOutput] = useState('');
    const [testing, setTesting] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [testFiles, setTestFiles] = useState<File[]>([]);
    const testFileRef = useRef<HTMLInputElement>(null);
    const [testPreviewMode, setTestPreviewMode] = useState<'code' | 'preview'>('code');
    const [fullscreenPreview, setFullscreenPreview] = useState(false);

    // Team member assignments
    const [assignedTypes, setAssignedTypes] = useState<string[]>(
        skill.assistantTypes || (skill.assistantType ? [skill.assistantType] : [])
    );
    const [outputActions, setOutputActions] = useState<string[]>(
        skill.outputActions || ['preview', 'copy', 'regenerate']
    );

    // Build preview HTML from test output
    const buildPreviewHtml = useCallback((rawOutput: string) => {
        let code = rawOutput;
        // Find the LARGEST code block
        const codeBlockRegex = /```(?:html|jsx|tsx|react|javascript|js|typescript|ts)?\n([\s\S]*?)```/g;
        let match;
        let largestBlock = '';
        while ((match = codeBlockRegex.exec(code)) !== null) {
            if (match[1].length > largestBlock.length) largestBlock = match[1];
        }
        if (largestBlock) {
            code = largestBlock;
        } else {
            const importIdx = code.search(/^import\s+/m);
            if (importIdx > 0) code = code.substring(importIdx);
        }

        const isReactCode = /import\s+React|useState|useEffect|useMemo|useCallback|useRef|export\s+default\s+function/.test(code);

        if (isReactCode) {
            code = code.replace(/^import\s+.*$/gm, '');
            const exportMatch = code.match(/export\s+default\s+function\s+(\w+)/);
            const componentName = exportMatch?.[1] || 'App';
            code = code.replace(/export\s+default\s+function/, 'function');
            code = `const { useState, useEffect, useMemo, useCallback, useRef, memo, createContext, useContext, Fragment } = React;\n${code}\nwindow['${componentName}'] = ${componentName};`;

            return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></` + `script>
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></` + `script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></` + `script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></` + `script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>body{font-family:'Inter',sans-serif;margin:0;padding:0}*{box-sizing:border-box}</style>
</head><body><div id="root"><div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px;">Loading preview...</div></div>
<script>
window.addEventListener('DOMContentLoaded', function() {
  var codeStr = ${JSON.stringify(code)};
  try {
    var output = Babel.transform(codeStr, { presets: ['react', 'typescript'], filename: 'preview.tsx' });
    var fn = new Function('React', 'ReactDOM', output.code);
    fn(React, ReactDOM);
    var componentName = '${componentName}';
    if (window[componentName]) {
      var root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(window[componentName]));
    }
  } catch(e) {
    document.getElementById('root').innerHTML = '<div style="padding:24px;color:#ef4444;font-family:monospace;font-size:13px;white-space:pre-wrap;"><strong>Render Error:</strong><br/>' + e.message + '</div>';
    console.error('Preview render error:', e);
  }
});
</` + `script></body></html>`;
        }

        // Fallback: static HTML
        code = code.replace(/^\s*import\s+.*$/gm, '');
        code = code.replace(/^\s*require\(.*$/gm, '');
        code = code.replace(/^\s*export\s+default\s+/gm, '');
        code = code.replace(/^\s*export\s+/gm, '');
        const returnMatch = code.match(/return\s*\(([\s\S]*?)\);?\s*\}\s*$/m);
        if (returnMatch) { code = returnMatch[1].trim(); }
        else { const arrowMatch = code.match(/=>\s*\(([\s\S]*?)\);?\s*$/m); if (arrowMatch) code = arrowMatch[1].trim(); }
        code = code
            .replace(/className=/g, 'class=')
            .replace(/htmlFor=/g, 'for=')
            .replace(/\{["']([^"']*)['"]\}/g, '"$1"')
            .replace(/\{[^{}]*\}/g, '')
            .replace(/\s(on[A-Z]\w+)=\{[^}]*\}/g, '')
            .replace(/<(img|input|br|hr)\s+([^>]*?)\s*\/>/gi, '<$1 $2>');
        code = code.replace(/^\s*(const|let|var|function)\s+.*$/gm, '');
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><script src="https://cdn.tailwindcss.com"></` + `script><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/><style>body{font-family:'Inter',sans-serif;margin:0;padding:0}*{box-sizing:border-box}</style></head><body>${code}</body></html>`;
    }, []);

    // External actions state
    interface ExternalActionItem { id: string; name: string; description: string | null; serviceApp: string; toolName: string; }
    const [externalActions, setExternalActions] = useState<ExternalActionItem[]>([]);
    const [enabledActions, setEnabledActions] = useState<string[]>((skill as any).enabledActions || []);
    const [showExternalActions, setShowExternalActions] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Chain configuration state
    const existingChain = ((skill as any).defaultParams as Record<string, unknown> | null)?.chain as string[] | undefined;
    const [chainSteps, setChainSteps] = useState<string[]>(existingChain || []);
    const [showChainConfig, setShowChainConfig] = useState(false);

    // Fetch analytics + versions on mount
    useEffect(() => {
        // Analytics
        fetch(`/api/ai/skills/analytics?assistantType=${skill.assistantType}`)
            .then(r => r.json())
            .then(data => {
                const found = (data.analytics || []).find((a: { skillKey: string }) => a.skillKey === skill.key.toUpperCase());
                if (found) setAnalytics(found);
            })
            .catch(() => {});
        // Versions
        fetch(`/api/ai/skills/versions?skillId=${skill.id}`)
            .then(r => r.json())
            .then(data => setVersions(data.versions || []))
            .catch(() => {});
        // External actions catalog
        fetch('/api/external-actions')
            .then(r => r.json())
            .then(data => setExternalActions(data.actions || []))
            .catch(() => {});
    }, [skill.id, skill.key, skill.assistantType]);

    function handleRestoreVersion(prompt: string | null) {
        if (prompt !== null) {
            setInstructionPrompt(prompt);
            showToast('Instruction restored — click Save to apply', 'success');
        }
    }

    // ─── File Upload Handler ─────────────────────────────

    async function handleFileUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        const newMaterials: TrainingMaterial[] = [...trainingMaterials];

        for (const file of Array.from(files)) {
            try {
                let textContent = '';
                if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                    textContent = await file.text();
                } else if (file.type === 'application/pdf') {
                    // Upload to server for PDF text extraction
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await fetch('/api/documents/extract-text', { method: 'POST', body: formData });
                    if (res.ok) {
                        const data = await res.json();
                        textContent = data.text || '';
                    } else {
                        textContent = `[PDF: ${file.name} — text extraction failed]`;
                    }
                } else {
                    textContent = await file.text();
                }

                if (textContent.trim()) {
                    newMaterials.push({
                        id: crypto.randomUUID(),
                        filename: file.name,
                        textContent: textContent.slice(0, 50000), // Cap at ~50k chars
                        uploadedAt: new Date().toISOString(),
                    });
                }
            } catch {
                showToast(`Failed to read ${file.name}`, 'error');
            }
        }

        setTrainingMaterials(newMaterials);
        // Auto-save materials to the skill
        await fetch(`/api/ai/skills/${skill.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainingMaterials: newMaterials }),
        });
        if (trainingFileRef.current) trainingFileRef.current.value = '';
        showToast(`${files.length} file(s) added`, 'success');
    }

    async function handleRemoveMaterial(materialId: string) {
        const updated = trainingMaterials.filter(m => m.id !== materialId);
        setTrainingMaterials(updated);
        await fetch(`/api/ai/skills/${skill.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainingMaterials: updated }),
        });
    }

    // ─── Train Skill Handler ─────────────────────────────

    async function handleTrain() {
        if (trainingMaterials.length === 0) {
            showToast('Upload training materials first', 'error');
            return;
        }
        setTraining(true);
        setTrainingStatus('Analyzing training materials...');
        try {
            const res = await fetch(`/api/ai/skills/${skill.id}/train`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Training failed', 'error');
                setTraining(false);
                setTrainingStatus('');
                return;
            }
            setTrainingStatus('Prompt improved! Review below.');
            setInstructionPrompt(data.improvedPrompt);
            showToast('Training complete — review the improved prompt and click Save', 'success');
        } catch {
            showToast('Training failed — please try again', 'error');
        }
        setTraining(false);
        setTimeout(() => setTrainingStatus(''), 5000);
    }

    // ─── Save Handler ────────────────────────────────────

    async function handleSave() {
        setSaving(true);
        try {
            const res = await fetch(`/api/ai/skills/${skill.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description: description || null,
                    icon: icon || null,
                    category: category || null,
                    instructionPrompt: instructionPrompt || null,
                    trainingMaterials: trainingMaterials.length > 0 ? trainingMaterials : null,
                    enabledActions,
                    assistantTypes: assignedTypes,
                    outputActions,
                    defaultParams: chainSteps.filter(Boolean).length > 1
                        ? { ...((skill as any).defaultParams || {}), chain: chainSteps.filter(Boolean) }
                        : (skill as any).defaultParams || null,
                }),
            });
            if (!res.ok) throw new Error();
            showToast('Skill updated', 'success');
            onSaved();
        } catch {
            showToast('Error saving skill', 'error');
        }
        setSaving(false);
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="skill-modal" onClick={e => e.stopPropagation()}>
                <div className="skill-modal-header">
                    <h2>
                        {renderIcon(icon)} Edit Skill: {skill.name}
                    </h2>
                    <button className="skill-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="skill-modal-body">
                    <div className="skill-form-row">
                        <div className="skill-form-group">
                            <label>Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="skill-form-group">
                            <label>Category</label>
                            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. social_media" />
                        </div>
                    </div>

                    <div className="skill-form-row">
                        <div className="skill-form-group">
                            <label>Icon</label>
                            <div className="skill-icon-selector">
                                <button className="skill-icon-preview" onClick={() => setShowIconPicker(!showIconPicker)}>
                                    {renderIcon(icon)} <span>{icon || 'Select icon'}</span>
                                </button>
                                {showIconPicker && (
                                    <div className="skill-icon-picker">
                                        {ICON_OPTIONS.map(name => (
                                            <button
                                                key={name}
                                                className={`skill-icon-option ${icon === name ? 'selected' : ''}`}
                                                onClick={() => { setIcon(name); setShowIconPicker(false); }}
                                                title={name}
                                            >
                                                {ICON_MAP[name]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="skill-form-group">
                            <label>Key</label>
                            <input type="text" value={skill.key} disabled className="skill-input-disabled" />
                        </div>
                    </div>

                    <div className="skill-form-group">
                        <label>Description <span className="skill-label-hint">— used for auto-triggering (AI matches user requests to this description)</span></label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Describe what this skill does and when to use it. The AI reads this to auto-trigger the skill when a user's request matches."
                        />
                    </div>

                    {/* ─── Dynamic Context Reference ────────────── */}
                    <div className="skill-form-group" style={{ background: 'rgba(37, 99, 235, 0.04)', border: '1px solid rgba(37, 99, 235, 0.15)', padding: '10px 14px', fontSize: 11, lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2563eb', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Zap size={12} /> Dynamic Context Placeholders
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                            <code style={{ fontSize: 10 }}>{'!{COMPANY_PRODUCTS}'}</code>
                            <span>Products/services</span>
                            <code style={{ fontSize: 10 }}>{'!{COMPANY_CUSTOMERS}'}</code>
                            <span>Target customers</span>
                            <code style={{ fontSize: 10 }}>{'!{COMPANY_GOALS}'}</code>
                            <span>Strategic goals</span>
                            <code style={{ fontSize: 10 }}>{'!{COMPANY_COMPETITORS}'}</code>
                            <span>Competitors</span>
                            <code style={{ fontSize: 10 }}>{'!{RECENT_DOCS}'}</code>
                            <span>Recent documents</span>
                            <code style={{ fontSize: 10 }}>{'!{TEAM_NOTES}'}</code>
                            <span>Recent generation notes</span>
                            <code style={{ fontSize: 10 }}>{'$ARGUMENTS'}</code>
                            <span>Full user input (topic)</span>
                            <code style={{ fontSize: 10 }}>{'$0, $1, $2...'}</code>
                            <span>Individual words from input</span>
                        </div>
                    </div>

                    <div className="skill-form-group skill-instruction-group">
                        <label>
                            Instruction Prompt <span className="skill-label-hint">v{skill.version} — the &quot;program.md&quot;</span>
                        </label>
                        <textarea
                            value={instructionPrompt}
                            onChange={e => setInstructionPrompt(e.target.value)}
                            rows={12}
                            className="skill-instruction-editor"
                            placeholder={`Write structured instructions for this skill...\n\nYou can use dynamic context:\n  !{COMPANY_PRODUCTS} — inject company products\n  !{COMPANY_GOALS} — inject strategic goals\n  $ARGUMENTS — the user's topic/input\n\nExample:\nYou are creating a LinkedIn post about $ARGUMENTS.\n\nCompany products: !{COMPANY_PRODUCTS}\nTarget audience: !{COMPANY_CUSTOMERS}\n\nStructure:\n1. Hook — attention-grabbing first line\n2. Value body — 3-5 short paragraphs\n3. Call to action`}
                        />
                    </div>

                    {/* ─── External Actions Section ────────────── */}
                    {externalActions.length > 0 && (!skill.executionType || skill.executionType === 'NATIVE') && (
                        <div className="skill-section">
                            <div className="skill-section-header" style={{ cursor: 'pointer' }} onClick={() => setShowExternalActions(!showExternalActions)}>
                                <div className="skill-section-title">
                                    <Zap size={16} style={{ color: '#ff6d00' }} />
                                    <span>External Actions</span>
                                    <span className="skill-section-badge">({enabledActions.length} enabled)</span>
                                </div>
                                <div className="skill-section-actions">
                                    <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); setShowExternalActions(!showExternalActions); }}>
                                        {showExternalActions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        {showExternalActions ? 'Collapse' : 'Expand'}
                                    </button>
                                </div>
                            </div>
                            {showExternalActions && (
                                <>
                                    <div className="skill-section-subtitle">
                                        Tools this skill&apos;s AI agent can use during execution
                                    </div>
                                    {(() => {
                                        const grouped: Record<string, ExternalActionItem[]> = {};
                                        for (const a of externalActions) {
                                            if (!grouped[a.serviceApp]) grouped[a.serviceApp] = [];
                                            grouped[a.serviceApp].push(a);
                                        }
                                        return Object.entries(grouped).map(([app, actions]) => {
                                            const isGroupCollapsed = collapsedGroups[app] ?? true;
                                            const enabledCount = actions.filter(a => enabledActions.includes(a.id)).length;
                                            return (
                                                <div key={app}>
                                                    <div
                                                        className="skill-action-group-label"
                                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [app]: !prev[app] }))}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {isGroupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                                            {app}
                                                        </div>
                                                        <span style={{ fontSize: 9, fontWeight: 700, color: enabledCount > 0 ? '#0f172a' : '#94a3b8' }}>
                                                            {enabledCount}/{actions.length}
                                                        </span>
                                                    </div>
                                                    {!isGroupCollapsed && actions.map(action => {
                                                        const isEnabled = enabledActions.includes(action.id);
                                                        return (
                                                            <label
                                                                key={action.id}
                                                                className={`skill-action-row ${isEnabled ? 'skill-action-row--enabled' : ''}`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isEnabled}
                                                                    onChange={() => {
                                                                        setEnabledActions(prev =>
                                                                            prev.includes(action.id)
                                                                                ? prev.filter(id => id !== action.id)
                                                                                : [...prev, action.id]
                                                                        );
                                                                    }}
                                                                />
                                                                <div className="skill-action-info">
                                                                    <div className="skill-action-name">{action.name}</div>
                                                                    {action.description && (
                                                                        <div className="skill-action-desc">{action.description}</div>
                                                                    )}
                                                                </div>
                                                                {isEnabled && <span className="skill-action-enabled-badge">Enabled</span>}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        });
                                    })()}
                                </>
                            )}
                        </div>
                    )}

                    {/* ─── Skill Chain Configuration ───────────── */}
                    <div className="skill-section">
                        <div className="skill-section-header" style={{ cursor: 'pointer' }} onClick={() => setShowChainConfig(!showChainConfig)}>
                            <div className="skill-section-title">
                                <Sparkles size={16} style={{ color: '#8b5cf6' }} />
                                <span>Skill Chain</span>
                                <span className="skill-section-badge">
                                    ({chainSteps.length > 0 ? `${chainSteps.length} steps` : 'none'})
                                </span>
                            </div>
                            {showChainConfig ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                        {showChainConfig && (
                            <div style={{ padding: '12px 0' }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
                                    Chain multiple skills into a pipeline. Output from each step feeds into the next.
                                    Use skill keys (e.g. <code style={{ fontSize: 10 }}>linkedin_post</code>, <code style={{ fontSize: 10 }}>copy_review</code>).
                                </div>
                                {chainSteps.map((step: string, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-text-secondary)', width: 20, textAlign: 'center' }}>
                                            {idx + 1}
                                        </span>
                                        <input
                                            type="text"
                                            value={step}
                                            onChange={e => {
                                                const newSteps = [...chainSteps];
                                                newSteps[idx] = e.target.value;
                                                setChainSteps(newSteps);
                                            }}
                                            placeholder="skill_key"
                                            style={{ flex: 1, fontSize: 12 }}
                                        />
                                        {idx > 0 && (
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '4px 8px' }}
                                                onClick={() => setChainSteps((prev: string[]) => prev.filter((_s: string, i: number) => i !== idx))}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 11, marginTop: 4 }}
                                    onClick={() => setChainSteps((prev: string[]) => [...prev, ''])}
                                >
                                    <Plus size={12} /> Add Step
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ─── Training Materials Section ─────────── */}
                    <div className="skill-section">
                        <div className="skill-section-header">
                            <div className="skill-section-title">
                                <Brain size={16} />
                                <span>Training Materials</span>
                                <span className="skill-section-badge">({trainingMaterials.length} files)</span>
                            </div>
                            <div className="skill-section-actions">
                                <button className="btn btn-secondary" onClick={() => trainingFileRef.current?.click()}>
                                    <Upload size={12} /> Upload Files
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleTrain}
                                    disabled={training || trainingMaterials.length === 0}
                                >
                                    {training ? <Loader size={12} className="spin" /> : <Brain size={12} />}
                                    {training ? 'Training...' : 'Train Skill'}
                                </button>
                            </div>
                        </div>

                        <div className="skill-section-body">
                            <input
                                ref={trainingFileRef}
                                type="file"
                                multiple
                                accept=".txt,.md,.pdf,.docx,.csv"
                                style={{ display: 'none' }}
                                onChange={e => handleFileUpload(e.target.files)}
                            />

                            {trainingStatus && (
                                <div className={`skill-status-alert ${training ? 'skill-status-alert--info' : 'skill-status-alert--success'}`}>
                                    {training && <Loader size={12} className="spin" />}
                                    {trainingStatus}
                                </div>
                            )}

                            {trainingMaterials.length === 0 ? (
                                <div className="skill-dropzone" onClick={() => trainingFileRef.current?.click()}>
                                    <Upload size={20} />
                                    <span>Upload training files</span>
                                    <span className="skill-dropzone-hint">TXT, MD, PDF — YouTube transcripts, guides, articles</span>
                                </div>
                            ) : (
                                <div className="skill-file-list">
                                    {trainingMaterials.map(m => (
                                        <div key={m.id} className="skill-file-item">
                                            <FileText size={14} className="skill-file-icon" />
                                            <div className="skill-file-info">
                                                <div className="skill-file-name">{m.filename}</div>
                                                <div className="skill-file-meta">
                                                    {(m.textContent.length / 1000).toFixed(1)}k chars · {new Date(m.uploadedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <button className="skill-file-remove" onClick={() => handleRemoveMaterial(m.id)} title="Remove">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── Analytics Section ────────────────── */}
                    {analytics && (
                        <div className="skill-analytics-section">
                            <div className="skill-analytics-header">
                                <BarChart3 size={14} /> Performance
                            </div>
                            <div className="skill-analytics-grid">
                                <div className="skill-analytics-stat">
                                    <span className="skill-stat-value">{analytics.totalRatings}</span>
                                    <span className="skill-stat-label">Total Ratings</span>
                                </div>
                                <div className="skill-analytics-stat">
                                    <span className="skill-stat-value" style={{ color: '#16a34a' }}>
                                        <ThumbsUp size={14} /> {analytics.thumbsUp}
                                    </span>
                                    <span className="skill-stat-label">Positive</span>
                                </div>
                                <div className="skill-analytics-stat">
                                    <span className="skill-stat-value" style={{ color: '#ea580c' }}>
                                        <ThumbsDown size={14} /> {analytics.thumbsDown}
                                    </span>
                                    <span className="skill-stat-label">Negative</span>
                                </div>
                                <div className="skill-analytics-stat">
                                    <span className="skill-stat-value">{analytics.avgRating}%</span>
                                    <span className="skill-stat-label">Approval</span>
                                </div>
                            </div>
                            {analytics.totalRatings > 0 && (
                                <div className="skill-analytics-bar">
                                    <div
                                        className="skill-analytics-bar-fill"
                                        style={{ width: `${analytics.avgRating}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Version History ──────────────────── */}
                    {versions.length > 0 && (
                        <div className="skill-section">
                            <div className="skill-section-header">
                                <div className="skill-section-title">
                                    <History size={16} style={{ color: '#2563eb' }} />
                                    <span>Version History</span>
                                    <span className="skill-section-badge">({versions.length})</span>
                                </div>
                                <div className="skill-section-actions">
                                    <button className="btn btn-secondary" onClick={() => setShowVersions(!showVersions)}>
                                        {showVersions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        {showVersions ? 'Collapse' : 'Expand'}
                                    </button>
                                </div>
                            </div>
                            {showVersions && (
                                <div className="skill-section-body" style={{ padding: 0 }}>
                                    {versions.map((v, i) => (
                                        <div
                                            key={v.id}
                                            className="skill-action-row"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                borderBottom: i < versions.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: 32,
                                                    height: 24,
                                                    fontSize: 11,
                                                    fontWeight: 900,
                                                    letterSpacing: '0.04em',
                                                    border: '2px solid #0f172a',
                                                    background: i === 0 ? '#2563eb' : '#f8fafc',
                                                    color: i === 0 ? '#fff' : '#0f172a',
                                                    flexShrink: 0,
                                                }}>
                                                    v{v.version}
                                                </span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {v.changeSummary || `Version ${v.version}`}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                                                        {new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                            {v.instructionPrompt && (
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: 10, padding: '3px 10px', flexShrink: 0 }}
                                                    onClick={() => handleRestoreVersion(v.instructionPrompt)}
                                                    title="Restore this version's instruction prompt"
                                                >
                                                    <RotateCcw size={12} /> Restore
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Test Skill Section ─────────────────── */}
                    <div className="skill-section skill-section--strong">
                        <div className="skill-section-header">
                            <div className="skill-section-title">
                                <Play size={16} style={{ color: '#2563eb' }} />
                                <span>Test Skill</span>
                            </div>
                            <div className="skill-section-actions">
                                <button className="btn btn-secondary" onClick={() => setShowTest(!showTest)}>
                                    {showTest ? 'Hide' : 'Expand'}
                                </button>
                            </div>
                        </div>
                        {showTest && (
                            <div className="skill-section-body">
                                <div className="skill-form-group">
                                    <label>Test Message</label>
                                    <textarea
                                        value={testInput}
                                        onChange={e => setTestInput(e.target.value)}
                                        rows={3}
                                        placeholder="Type a test prompt to try this skill..."
                                    />
                                </div>

                                {testFiles.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                        {testFiles.map((f, i) => {
                                            const isImage = f.type.startsWith('image/');
                                            const thumbUrl = isImage ? URL.createObjectURL(f) : null;
                                            return (
                                                <div key={`${f.name}-${f.size}-${i}`} className="skill-test-file-chip">
                                                    {isImage && thumbUrl ? (
                                                        <img src={thumbUrl} alt={f.name} />
                                                    ) : (
                                                        <FileText size={16} style={{ color: '#64748b' }} />
                                                    )}
                                                    <div className="skill-test-file-chip-info">
                                                        <span className="skill-test-file-chip-name">{f.name}</span>
                                                        <span className="skill-test-file-chip-size">{(f.size / 1024).toFixed(0)} KB</span>
                                                    </div>
                                                    <button
                                                        className="skill-test-file-chip-remove"
                                                        onClick={() => setTestFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                        title="Remove"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="skill-test-controls">
                                    <label className="btn btn-secondary" style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                                        <input
                                            type="file"
                                            accept="image/*,.md,.txt,.pdf,.doc,.docx"
                                            multiple
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                            onChange={e => {
                                                if (e.target.files && e.target.files.length > 0) {
                                                    setTestFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                        <Paperclip size={12} /> Attach File
                                    </label>
                                    <button
                                        className="btn btn-primary"
                                        onClick={async () => {
                                            if (!testInput.trim()) return;
                                            setTesting(true);
                                            setTestOutput('');
                                            try {
                                                const formData = new FormData();
                                                formData.append('testMessage', testInput);
                                                formData.append('instructionPrompt', instructionPrompt);
                                                formData.append('trainingMaterials', JSON.stringify(trainingMaterials || []));
                                                for (const f of testFiles) {
                                                    formData.append('files', f);
                                                }
                                                const res = await fetch('/api/ai/skills/test', {
                                                    method: 'POST',
                                                    body: formData,
                                                });
                                                const data = await res.json();
                                                if (!res.ok) {
                                                    setTestOutput(`Error: ${data.error || 'Test failed'}`);
                                                } else {
                                                    setTestOutput(data.output);
                                                }
                                            } catch {
                                                setTestOutput('Error: Test execution failed');
                                            }
                                            setTesting(false);
                                        }}
                                        disabled={testing || !testInput.trim()}
                                    >
                                        {testing ? <Loader size={12} className="spin" /> : <Play size={12} />}
                                        {testing ? 'Running...' : 'Run Test'}
                                    </button>
                                </div>

                                {testOutput && (
                                    <div>
                                        <div className="skill-test-tabs">
                                            <button
                                                className={`skill-test-tab ${testPreviewMode === 'code' ? 'skill-test-tab--active' : ''}`}
                                                onClick={() => setTestPreviewMode('code')}
                                            >
                                                Code
                                            </button>
                                            <button
                                                className={`skill-test-tab ${testPreviewMode === 'preview' ? 'skill-test-tab--active' : ''}`}
                                                onClick={() => setTestPreviewMode('preview')}
                                            >
                                                <Eye size={12} /> Preview
                                            </button>
                                            {testPreviewMode === 'preview' && (
                                                <button
                                                    className="skill-test-tab skill-test-tab--dark"
                                                    onClick={() => setFullscreenPreview(true)}
                                                >
                                                    <Maximize2 size={12} /> Fullscreen
                                                </button>
                                            )}
                                        </div>
                                        {testPreviewMode === 'code' ? (
                                            <div className="skill-test-output">{testOutput}</div>
                                        ) : (
                                            <div className="skill-test-preview">
                                                <iframe
                                                    srcDoc={buildPreviewHtml(testOutput)}
                                                    sandbox="allow-scripts allow-same-origin allow-modals"
                                                    title="Skill test preview"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Fullscreen Preview Overlay */}
                                {fullscreenPreview && testOutput && (
                                    <div className="skill-fullscreen-overlay">
                                        <div className="skill-fullscreen-bar">
                                            <div className="skill-fullscreen-title">
                                                <Eye size={16} style={{ color: '#60a5fa' }} />
                                                Fullscreen Preview
                                            </div>
                                            <button className="skill-fullscreen-close" onClick={() => setFullscreenPreview(false)}>
                                                <Minimize2 size={12} /> Close
                                            </button>
                                        </div>
                                        <div style={{ flex: 1, background: '#fff' }}>
                                            <iframe
                                                srcDoc={buildPreviewHtml(testOutput)}
                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                                sandbox="allow-scripts allow-same-origin allow-modals"
                                                title="Skill test fullscreen preview"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ─── Team Member Assignments ──────────── */}
                    <div className="skill-section">
                        <div className="skill-section-header">
                            <div className="skill-section-title">
                                <Users size={16} style={{ color: '#2563eb' }} />
                                <span>Team Member Assignments</span>
                                <span className="skill-section-badge">({assignedTypes.length} assigned)</span>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                            {teamMembers.map(member => {
                                const isAssigned = assignedTypes.includes(member.brainType);
                                return (
                                    <label
                                        key={member.brainType}
                                        className={`skill-action-row ${isAssigned ? 'skill-action-row--enabled' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isAssigned}
                                            onChange={() => {
                                                setAssignedTypes(prev =>
                                                    prev.includes(member.brainType)
                                                        ? prev.filter(t => t !== member.brainType)
                                                        : [...prev, member.brainType]
                                                );
                                            }}
                                        />
                                        <div className="skill-action-info">
                                            <div className="skill-action-name" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                                {member.icon} {member.label}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* ─── Output Actions ──────────── */}
                    <div className="skill-section">
                        <div className="skill-section-header">
                            <div className="skill-section-title">
                                <FileText size={16} style={{ color: '#2563eb' }} />
                                <span>Output Actions</span>
                                <span className="skill-section-badge">({outputActions.length} enabled)</span>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                            {OUTPUT_ACTION_OPTIONS.map(opt => {
                                const isAssigned = outputActions.includes(opt.key);
                                return (
                                    <label
                                        key={opt.key}
                                        className={`skill-action-row ${isAssigned ? 'skill-action-row--enabled' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isAssigned}
                                            onChange={() => {
                                                setOutputActions(prev =>
                                                    prev.includes(opt.key)
                                                        ? prev.filter(t => t !== opt.key)
                                                        : [...prev, opt.key]
                                                );
                                            }}
                                        />
                                        <div className="skill-action-info">
                                            <div className="skill-action-name" style={{ fontSize: 13 }}>
                                                {opt.label}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="skill-form-meta">
                        <span>Status: <strong>{skill.status}</strong></span>
                        <span>Version: <strong>v{skill.version}</strong></span>
                        <span>Default: <strong>{skill.isDefault ? 'Yes' : 'No'}</strong></span>
                    </div>
                </div>

                <div className="skill-modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {skill.status !== 'ACTIVE' && (
                            <button
                                className="btn--publish"
                                onClick={async () => {
                                    setPublishing(true);
                                    try {
                                        const res = await fetch(`/api/ai/skills/${skill.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ status: 'ACTIVE' }),
                                        });
                                        if (!res.ok) throw new Error();
                                        showToast('Skill published and activated!', 'success');
                                        onSaved();
                                    } catch {
                                        showToast('Error publishing skill', 'error');
                                    }
                                    setPublishing(false);
                                }}
                                disabled={publishing}
                            >
                                {publishing ? <Loader size={12} className="spin" /> : <Rocket size={14} />}
                                Publish
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
                            {saving ? <Loader size={14} className="spin" /> : <Pencil size={14} />} Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// Create Modal
// ═══════════════════════════════════════════════════════

function SkillCreateModal({
    onClose,
    onCreated,
    showToast,
    teamMembers,
}: {
    onClose: () => void;
    onCreated: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    teamMembers: TeamMember[];
}) {
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['MARKETING']);
    const [key, setKey] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('zap');
    const [category, setCategory] = useState('');
    const [instructionPrompt, setInstructionPrompt] = useState('');
    const [saving, setSaving] = useState(false);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [outputActions, setOutputActions] = useState<string[]>(['preview', 'copy', 'regenerate']);
    const [responseMode, setResponseMode] = useState('chat');

    // Auto-generate key from name
    function handleNameChange(val: string) {
        setName(val);
        if (!key || key === nameToKey(name)) {
            setKey(nameToKey(val));
        }
    }

    function nameToKey(n: string) {
        return n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }

    async function handleCreate() {
        if (!key || !name) {
            showToast('Name and key are required', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/ai/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assistantTypes: selectedTypes,
                    key,
                    name,
                    description: description || null,
                    icon: icon || null,
                    category: category || null,
                    instructionPrompt: instructionPrompt || null,
                    outputActions,
                    responseMode,
                    runtimeCategory: responseMode === 'chat' ? 'content-generation'
                        : responseMode === 'artifact_first' || responseMode === 'artifact_plus_chat' ? 'artifact-generation'
                        : responseMode === 'ui_rendered' ? 'ui-rendering'
                        : 'content-generation',
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Error creating skill', 'error');
                setSaving(false);
                return;
            }
            showToast('Skill created!', 'success');
            onCreated();
        } catch {
            showToast('Error creating skill', 'error');
        }
        setSaving(false);
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="skill-modal" onClick={e => e.stopPropagation()}>
                <div className="skill-modal-header">
                    <h2><Plus size={18} /> New Skill</h2>
                    <button className="skill-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="skill-modal-body">
                    <div className="skill-form-row">
                        <div className="skill-form-group">
                            <label>Team Members</label>
                            <div className="skill-form-grid">
                                {teamMembers.map(member => {
                                    const isSelected = selectedTypes.includes(member.brainType);
                                    return (
                                        <label
                                            key={member.brainType}
                                            className={`skill-action-row ${isSelected ? 'skill-action-row--enabled' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {
                                                    setSelectedTypes(prev =>
                                                        prev.includes(member.brainType)
                                                            ? prev.filter(t => t !== member.brainType)
                                                            : [...prev, member.brainType]
                                                    );
                                                }}
                                            />
                                            <div className="skill-action-info">
                                                <div className="skill-action-name">
                                                    {member.icon} {member.label}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="skill-form-row">
                        <div className="skill-form-group">
                            <label>Response Mode</label>
                            <div className="skill-form-grid">
                                {RESPONSE_MODE_OPTIONS.map(opt => {
                                    const isSelected = responseMode === opt.key;
                                    return (
                                        <label
                                            key={opt.key}
                                            className={`skill-action-row ${isSelected ? 'skill-action-row--enabled' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="responseMode"
                                                checked={isSelected}
                                                onChange={() => setResponseMode(opt.key)}
                                            />
                                            <div className="skill-action-info">
                                                <div className="skill-action-name">{opt.label}</div>
                                                <div className="skill-action-desc">{opt.desc}</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="skill-form-row">
                        <div className="skill-form-group">
                            <label>Output Actions</label>
                            <div className="skill-form-grid">
                                {OUTPUT_ACTION_OPTIONS.map(opt => {
                                    const isSelected = outputActions.includes(opt.key);
                                    return (
                                        <label
                                            key={opt.key}
                                            className={`skill-action-row ${isSelected ? 'skill-action-row--enabled' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {
                                                    setOutputActions(prev =>
                                                        prev.includes(opt.key)
                                                            ? prev.filter(t => t !== opt.key)
                                                            : [...prev, opt.key]
                                                    );
                                                }}
                                            />
                                            <div className="skill-action-info">
                                                <div className="skill-action-name">
                                                    {opt.label}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="skill-form-row">
                        <div className="skill-form-group">
                            <label>Icon</label>
                            <div className="skill-icon-selector">
                                <button className="skill-icon-preview" onClick={() => setShowIconPicker(!showIconPicker)}>
                                    {renderIcon(icon)} <span>{icon || 'Select icon'}</span>
                                </button>
                                {showIconPicker && (
                                    <div className="skill-icon-picker">
                                        {ICON_OPTIONS.map(name => (
                                            <button
                                                key={name}
                                                className={`skill-icon-option ${icon === name ? 'selected' : ''}`}
                                                onClick={() => { setIcon(name); setShowIconPicker(false); }}
                                                title={name}
                                            >
                                                {ICON_MAP[name]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="skill-form-row">
                        <div className="skill-form-group">
                            <label>Name</label>
                            <input type="text" value={name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Case Study" />
                        </div>
                        <div className="skill-form-group">
                            <label>Key <span className="skill-label-hint">(auto-generated)</span></label>
                            <input type="text" value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. case_study" />
                        </div>
                    </div>

                    <div className="skill-form-row">
                        <div className="skill-form-group">
                            <label>Category</label>
                            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. content" />
                        </div>
                    </div>

                    <div className="skill-form-group">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Brief description of what this skill produces..."
                        />
                    </div>

                    <div className="skill-form-group skill-instruction-group">
                        <label>Instruction Prompt <span className="skill-label-hint">the &quot;program.md&quot;</span></label>
                        <textarea
                            value={instructionPrompt}
                            onChange={e => setInstructionPrompt(e.target.value)}
                            rows={10}
                            className="skill-instruction-editor"
                            placeholder="Write structured instructions for this skill..."
                        />
                    </div>
                </div>

                <div className="skill-modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !name.trim() || !key.trim()}>
                        {saving ? <Loader size={14} className="spin" /> : <Plus size={14} />} Create Skill
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// Import Modal
// ═══════════════════════════════════════════════════════

interface ImportPreview {
    key: string;
    name: string;
    description: string | null;
    category: string | null;
    instructionPrompt: string;
    trainingMaterials: { id: string; filename: string; textContent: string }[];
    trainingMaterialCount: number;
    promptLength: number;
}

function SkillImportModal({
    file,
    onClose,
    onImported,
    showToast,
    teamMembers,
}: {
    file: File;
    onClose: () => void;
    onImported: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    teamMembers: TeamMember[];
}) {
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['GENERAL_AI']);
    const [showPrompt, setShowPrompt] = useState(false);
    const [autoAdapt, setAutoAdapt] = useState(true);

    // Parse the zip on mount
    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('mode', 'preview');
                const res = await fetch('/api/ai/skills/import', { method: 'POST', body: formData });
                const data = await res.json();
                if (!res.ok) {
                    setError(data.error || 'Failed to parse skill package');
                } else {
                    setPreview(data.preview);
                }
            } catch {
                setError('Failed to upload file');
            }
            setLoading(false);
        })();
    }, [file]);

    async function handleImport() {
        if (!preview) return;
        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mode', 'import');
            formData.append('assistantTypes', JSON.stringify(selectedTypes));
            formData.append('autoAdapt', String(autoAdapt));
            const res = await fetch('/api/ai/skills/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Import failed', 'error');
                setImporting(false);
                return;
            }
            showToast(`Skill imported${autoAdapt ? ' (auto-adapted for Nousio)' : ''}`, 'success');
            onImported();
        } catch {
            showToast('Import failed', 'error');
        }
        setImporting(false);
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="skill-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <div className="skill-modal-header">
                    <h2><Upload size={18} /> Import Skill</h2>
                    <button className="skill-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="skill-modal-body">
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', justifyContent: 'center' }}>
                            <Loader size={16} className="spin" /> Parsing {file.name}...
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: 16, border: '2px solid #ef4444', color: '#ef4444', fontWeight: 700, fontSize: 13 }}>
                            {error}
                        </div>
                    )}

                    {preview && !loading && (
                        <>
                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 16, fontWeight: 600 }}>
                                Parsed from: <strong style={{ color: '#0f172a' }}>{file.name}</strong>
                            </div>

                            <div className="skill-form-row">
                                <div className="skill-form-group">
                                    <label>Name</label>
                                    <input type="text" value={preview.name} disabled className="skill-input-disabled" />
                                </div>
                                <div className="skill-form-group">
                                    <label>Key</label>
                                    <input type="text" value={preview.key} disabled className="skill-input-disabled" />
                                </div>
                            </div>

                            <div className="skill-form-row">
                                <div className="skill-form-group">
                                    <label>Team Members</label>
                                    <div className="skill-form-grid">
                                        {teamMembers.map(member => {
                                            const isSelected = selectedTypes.includes(member.brainType);
                                            return (
                                                <label
                                                    key={member.brainType}
                                                    className={`skill-action-row ${isSelected ? 'skill-action-row--enabled' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            setSelectedTypes(prev =>
                                                                prev.includes(member.brainType)
                                                                    ? prev.filter(t => t !== member.brainType)
                                                                    : [...prev, member.brainType]
                                                            );
                                                        }}
                                                    />
                                                    <div className="skill-action-info">
                                                        <div className="skill-action-name" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                                            {member.icon} {member.label}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="skill-form-group">
                                    <label>Category</label>
                                    <input type="text" value={preview.category || '—'} disabled className="skill-input-disabled" />
                                </div>
                            </div>

                            {preview.description && (
                                <div className="skill-form-group">
                                    <label>Description</label>
                                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, padding: '8px 0' }}>
                                        {preview.description}
                                    </div>
                                </div>
                            )}

                            <div className="skill-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Instruction Prompt ({(preview.promptLength / 1000).toFixed(1)}K chars)</span>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: 10, padding: '3px 10px' }}
                                        onClick={() => setShowPrompt(!showPrompt)}
                                    >
                                        <Eye size={12} /> {showPrompt ? 'Hide' : 'Preview'}
                                    </button>
                                </label>
                                {showPrompt && (
                                    <textarea
                                        value={preview.instructionPrompt}
                                        readOnly
                                        rows={8}
                                        className="skill-instruction-editor"
                                        style={{ opacity: 0.8, cursor: 'default' }}
                                    />
                                )}
                            </div>

                            {preview.trainingMaterialCount > 0 && (
                                <div className="skill-form-group">
                                    <label>Bundled References ({preview.trainingMaterialCount} files)</label>
                                    <div className="skill-training-files">
                                        {preview.trainingMaterials.map(m => (
                                            <div key={m.id} className="skill-training-file">
                                                <FileText size={14} style={{ flexShrink: 0, color: '#2563eb' }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.filename}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary, #888)' }}>
                                                        {(m.textContent.length / 1000).toFixed(1)}k chars
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Auto-adapt toggle ────────────── */}
                            <div className="skill-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={autoAdapt}
                                        onChange={e => setAutoAdapt(e.target.checked)}
                                        style={{ width: 16, height: 16 }}
                                    />
                                    <span>Auto-adapt for Nousio + OpenAI</span>
                                </label>
                                <div style={{ fontSize: 11, color: 'var(--color-text-secondary, #888)', marginTop: 4, paddingLeft: 26 }}>
                                    Rewrites coding-agent instructions to work with Nousio&apos;s company context and structured output format. Original instructions are preserved as reference material.
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="skill-modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={!preview || importing || !!error}
                    >
                        {importing ? <Loader size={14} className="spin" /> : <Upload size={14} />}
                        {importing ? 'Importing...' : 'Import as Draft'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// URL Import Modal (GitHub)
// ═══════════════════════════════════════════════════════

interface UrlImportPreview {
    key: string;
    name: string;
    description: string | null;
    category: string | null;
    source: string;
    instructionPrompt: string;
    supportingFiles: string[];
    supportingFileCount: number;
    promptLength: number;
}

function SkillUrlImportModal({
    onClose,
    onImported,
    showToast,
    teamMembers,
}: {
    onClose: () => void;
    onImported: () => void;
    showToast: (msg: string, type: 'success' | 'error') => void;
    teamMembers: TeamMember[];
}) {
    const [repoUrl, setRepoUrl] = useState('https://github.com/');
    const [skillName, setSkillName] = useState('');
    const [availableSkills, setAvailableSkills] = useState<string[]>([]);
    const [loadingSkills, setLoadingSkills] = useState(false);
    const [preview, setPreview] = useState<UrlImportPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['GENERAL_AI']);
    const [autoAdapt, setAutoAdapt] = useState(true);
    const [showPrompt, setShowPrompt] = useState(false);

    // Browse available skills in repo
    async function handleBrowseSkills() {
        if (!repoUrl.trim() || repoUrl === 'https://github.com/') {
            showToast('Enter a valid GitHub repository URL', 'error');
            return;
        }
        setLoadingSkills(true);
        setError(null);
        setAvailableSkills([]);
        try {
            const res = await fetch('/api/ai/skills/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl, mode: 'list' }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to browse repo');
            } else if (data.skills?.length === 0) {
                setError('No SKILL.md skills found in this repository');
            } else {
                setAvailableSkills(data.skills || []);
            }
        } catch {
            setError('Failed to connect to GitHub');
        }
        setLoadingSkills(false);
    }

    // Preview a specific skill
    async function handlePreview() {
        if (!skillName.trim()) { showToast('Enter a skill name', 'error'); return; }
        setLoadingPreview(true);
        setError(null);
        setPreview(null);
        try {
            const res = await fetch('/api/ai/skills/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl, skillName, mode: 'preview' }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to fetch skill');
            } else {
                setPreview(data.preview);
            }
        } catch {
            setError('Failed to fetch skill from GitHub');
        }
        setLoadingPreview(false);
    }

    // Import the skill
    async function handleImport() {
        if (!preview) return;
        setImporting(true);
        try {
            const res = await fetch('/api/ai/skills/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repoUrl,
                    skillName,
                    assistantTypes: selectedTypes,
                    autoAdapt,
                    mode: 'import',
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Import failed', 'error');
                setImporting(false);
                return;
            }
            showToast(
                `Skill "${preview.name}" imported${autoAdapt ? ' (auto-adapted for OpenAI)' : ''}`,
                'success',
            );
            onImported();
        } catch {
            showToast('Import failed', 'error');
        }
        setImporting(false);
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="skill-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
                <div className="skill-modal-header">
                    <h2><Globe size={18} /> Import from GitHub</h2>
                    <button className="skill-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="skill-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {/* ── Repo URL input ─────────────────── */}
                    <div className="skill-form-group">
                        <label>GitHub Repository URL</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                type="text"
                                value={repoUrl}
                                onChange={e => setRepoUrl(e.target.value)}
                                placeholder="https://github.com/owner/repo"
                                style={{ flex: 1 }}
                            />
                            <button
                                className="btn btn-secondary"
                                onClick={handleBrowseSkills}
                                disabled={loadingSkills}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {loadingSkills ? <Loader size={14} className="spin" /> : <Search size={14} />}
                                {' '}Browse
                            </button>
                        </div>
                    </div>

                    {/* ── Skill name input ──────────────── */}
                    <div className="skill-form-group">
                        <label>Skill Name</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                type="text"
                                value={skillName}
                                onChange={e => setSkillName(e.target.value)}
                                placeholder="e.g. frontend-design"
                                style={{ flex: 1 }}
                                list="available-skills"
                            />
                            <button
                                className="btn btn-secondary"
                                onClick={handlePreview}
                                disabled={loadingPreview || !skillName.trim()}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {loadingPreview ? <Loader size={14} className="spin" /> : <Eye size={14} />}
                                {' '}Preview
                            </button>
                        </div>
                        {/* Datalist for auto-complete */}
                        {availableSkills.length > 0 && (
                            <datalist id="available-skills">
                                {availableSkills.map(s => <option key={s} value={s} />)}
                            </datalist>
                        )}
                    </div>

                    {/* Available skills chips */}
                    {availableSkills.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                                Available Skills ({availableSkills.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {availableSkills.map(s => (
                                    <button
                                        key={s}
                                        className={`btn ${skillName === s ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ fontSize: 11, padding: '3px 10px' }}
                                        onClick={() => { setSkillName(s); setPreview(null); }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{ padding: 12, border: '2px solid #ef4444', color: '#ef4444', fontWeight: 700, fontSize: 12, marginBottom: 12 }}>
                            {error}
                        </div>
                    )}

                    {/* ── Preview ──────────────────────── */}
                    {preview && (
                        <>
                            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16, marginTop: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                                    Skill Preview
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12, marginBottom: 16 }}>
                                    <div><strong>Name:</strong> {preview.name}</div>
                                    <div><strong>Key:</strong> <code style={{ fontSize: 11 }}>{preview.key}</code></div>
                                    <div><strong>Source:</strong> {preview.source}</div>
                                    <div><strong>Category:</strong> {preview.category || '—'}</div>
                                    <div><strong>Prompt:</strong> {(preview.promptLength / 1000).toFixed(1)}K chars</div>
                                    <div><strong>Files:</strong> {preview.supportingFileCount} supporting</div>
                                </div>

                                {preview.description && (
                                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                                        {preview.description}
                                    </div>
                                )}

                                {/* Instruction preview */}
                                <div className="skill-form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>Instruction Prompt</span>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: 10, padding: '3px 10px' }}
                                            onClick={() => setShowPrompt(!showPrompt)}
                                        >
                                            <Eye size={12} /> {showPrompt ? 'Hide' : 'Preview'}
                                        </button>
                                    </label>
                                    {showPrompt && (
                                        <textarea
                                            value={preview.instructionPrompt}
                                            readOnly
                                            rows={8}
                                            className="skill-instruction-editor"
                                            style={{ opacity: 0.8, cursor: 'default' }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* ── Configuration ───────────────── */}
                            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16, marginTop: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                                    Configuration
                                </div>

                                {/* Team members */}
                                <div className="skill-form-group">
                                    <label>Assign to Team Members</label>
                                    <div className="skill-form-grid">
                                        {teamMembers.map(member => {
                                            const isSelected = selectedTypes.includes(member.brainType);
                                            return (
                                                <label
                                                    key={member.brainType}
                                                    className={`skill-action-row ${isSelected ? 'skill-action-row--enabled' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            setSelectedTypes(prev =>
                                                                prev.includes(member.brainType)
                                                                    ? prev.filter(t => t !== member.brainType)
                                                                    : [...prev, member.brainType]
                                                            );
                                                        }}
                                                    />
                                                    <div className="skill-action-info">
                                                        <div className="skill-action-name" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                                            {member.icon} {member.label}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Auto-adapt toggle */}
                                <div className="skill-form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={autoAdapt}
                                            onChange={e => setAutoAdapt(e.target.checked)}
                                            style={{ width: 16, height: 16 }}
                                        />
                                        <span>Auto-adapt for Nousio + OpenAI</span>
                                    </label>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary, #888)', marginTop: 4, paddingLeft: 26 }}>
                                        Rewrites coding-agent instructions (designed for Claude, Cursor, etc.) to work with OpenAI and Nousio&apos;s structured output format. Original instructions preserved.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="skill-modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={!preview || importing}
                    >
                        {importing ? <Loader size={14} className="spin" /> : <Globe size={14} />}
                        {importing ? ' Importing...' : ' Import Skill'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// Schedule Modal
// ═══════════════════════════════════════════════════════

interface ScheduleData {
    id: string;
    skillId: string;
    name: string;
    frequency: string;
    runAtTime: string;
    timezone: string;
    daysOfWeek: number[] | null;
    isActive: boolean;
    nextRunAt: string;
    lastRunAt: string | null;
    showOnToday?: boolean;
    includeInBrief?: boolean;
}

interface RunData {
    id: string;
    triggerType: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    outputTitle: string | null;
    outputText: string | null;
    errorMessage: string | null;
}

const TIMEZONES = [
    'UTC',
    'Europe/Lisbon',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Lightweight markdown → HTML for the newsletter view */
function simpleMarkdown(md: string): string {
    return md
        // Escape HTML
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        // Headers
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold + italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links [text](url)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Horizontal rule
        .replace(/^---+$/gm, '<hr/>')
        // Bullet lists
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        // Numbered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Paragraphs (double newline)
        .replace(/\n\n/g, '</p><p>')
        // Single newline → <br>
        .replace(/\n/g, '<br/>')
        // Wrap in <p>
        .replace(/^/, '<p>').replace(/$/, '</p>');
}

function ScheduleSkillModal({
    skill,
    onClose,
    showToast,
}: {
    skill: Skill;
    onClose: () => void;
    showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
    const [tab, setTab] = useState<'schedule' | 'runs'>('schedule');
    const [schedules, setSchedules] = useState<ScheduleData[]>([]);
    const [runs, setRuns] = useState<RunData[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New schedule form
    const [name, setName] = useState(skill.name + ' — Daily');
    const [frequency, setFrequency] = useState('daily');
    const [runAtTime, setRunAtTime] = useState('08:00');
    const [timezone, setTimezone] = useState('Europe/Lisbon');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
    const [showOnToday, setShowOnToday] = useState(false);
    const [includeInBrief, setIncludeInBrief] = useState(false);

    const loadSchedules = useCallback(async () => {
        const res = await fetch(`/api/skills/schedules?skillId=${skill.id}`);
        const data = await res.json();
        setSchedules(data.schedules || []);
    }, [skill.id]);

    const loadRuns = useCallback(async () => {
        const res = await fetch(`/api/skills/runs?skillId=${skill.id}&limit=20`);
        const data = await res.json();
        setRuns(data.runs || []);
    }, [skill.id]);

    useEffect(() => {
        setLoading(true);
        Promise.all([loadSchedules(), loadRuns()]).finally(() => setLoading(false));
    }, [loadSchedules, loadRuns]);

    const handleCreate = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/skills/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skillId: skill.id,
                    name,
                    frequency,
                    runAtTime,
                    timezone,
                    daysOfWeek: frequency === 'weekly' ? daysOfWeek : null,
                    showOnToday,
                    includeInBrief,
                }),
            });
            if (!res.ok) throw new Error('Failed to create schedule');
            showToast('Schedule created', 'success');
            loadSchedules();
        } catch {
            showToast('Failed to create schedule', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (schedule: ScheduleData) => {
        await fetch(`/api/skills/schedules?id=${schedule.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !schedule.isActive }),
        });
        loadSchedules();
    };

    const handleDeleteSchedule = async (id: string) => {
        await fetch(`/api/skills/schedules?id=${id}`, { method: 'DELETE' });
        showToast('Schedule deleted', 'success');
        loadSchedules();
    };

    const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

    const handleRunNow = async (schedule: ScheduleData) => {
        setRunningScheduleId(schedule.id);
        showToast('Triggering skill execution…');
        try {
            // Create a SkillRun and dispatch execution directly
            const res = await fetch('/api/skills/scheduler/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    runId: crypto.randomUUID(),
                    skillId: skill.id,
                    scheduleId: schedule.id,
                    companyId: '', // Server will use admin context
                    manualTrigger: true,
                }),
            });
            if (res.ok) {
                showToast('Skill executed successfully!', 'success');
            } else {
                const data = await res.json();
                showToast(data.error || 'Execution failed', 'error');
            }
            loadSchedules();
            loadRuns();
        } catch {
            showToast('Failed to trigger execution', 'error');
        } finally {
            setRunningScheduleId(null);
        }
    };

    const [expandedRun, setExpandedRun] = useState<string | null>(null);
    const [viewingRun, setViewingRun] = useState<RunData | null>(null);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="skill-modal schedule-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                <div className="skill-modal-header">
                    <h2><Clock size={18} /> SCHEDULE: {skill.name.toUpperCase()}</h2>
                    <button className="skill-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Tabs */}
                <div className="schedule-tabs">
                    <button
                        className={`schedule-tab ${tab === 'schedule' ? 'active' : ''}`}
                        onClick={() => setTab('schedule')}
                    >
                        <Clock size={14} /> Schedules
                    </button>
                    <button
                        className={`schedule-tab ${tab === 'runs' ? 'active' : ''}`}
                        onClick={() => setTab('runs')}
                    >
                        <History size={14} /> Run History
                    </button>
                </div>

                <div className="skill-modal-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 32 }}>
                            <Loader size={20} className="spin" />
                        </div>
                    ) : tab === 'schedule' ? (
                        <>
                            {/* Existing Schedules */}
                            {schedules.length > 0 && (
                                <div className="schedule-existing">
                                    <h3 className="schedule-section-title">Active Schedules</h3>
                                    {schedules.map(sch => (
                                        <div key={sch.id} className="schedule-card">
                                            <div className="schedule-card-main">
                                                <span className={`schedule-status ${sch.isActive ? 'active' : 'paused'}`}>
                                                    {sch.isActive ? '● Active' : '○ Paused'}
                                                </span>
                                                <strong>{sch.name}</strong>
                                                <span className="schedule-meta">
                                                    {sch.frequency} at {sch.runAtTime} ({sch.timezone})
                                                </span>
                                            </div>
                                            <div className="schedule-card-info">
                                                <span>Next: {sch.nextRunAt ? new Date(sch.nextRunAt).toLocaleString() : '—'}</span>
                                                <span>Last: {sch.lastRunAt ? new Date(sch.lastRunAt).toLocaleString() : 'Never'}</span>
                                                {(sch.showOnToday || sch.includeInBrief) && (
                                                    <span style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                                        {sch.showOnToday && <span style={{ fontSize: 10, background: 'rgba(210,240,0,0.1)', color: '#D2F000', padding: '1px 6px', borderRadius: 4 }}>🏠 Today</span>}
                                                        {sch.includeInBrief && <span style={{ fontSize: 10, background: 'rgba(0,218,243,0.1)', color: '#00daf3', padding: '1px 6px', borderRadius: 4 }}>📋 Brief</span>}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="schedule-card-actions">
                                                <button
                                                    className="skill-action-btn run-now"
                                                    onClick={() => handleRunNow(sch)}
                                                    disabled={!!runningScheduleId}
                                                    title="Run Now"
                                                    style={{ color: '#D2F000' }}
                                                >
                                                    {runningScheduleId === sch.id ? <Loader size={14} className="spin" /> : <Play size={14} />}
                                                </button>
                                                <button
                                                    className="skill-action-btn toggle"
                                                    onClick={() => handleToggle(sch)}
                                                    title={sch.isActive ? 'Pause' : 'Resume'}
                                                >
                                                    {sch.isActive ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                                                </button>
                                                <button
                                                    className="skill-action-btn delete"
                                                    onClick={() => handleDeleteSchedule(sch.id)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* New Schedule Form */}
                            <div className="schedule-form">
                                <h3 className="schedule-section-title" style={{ marginTop: schedules.length > 0 ? 24 : 0 }}>
                                    {schedules.length > 0 ? 'Add Another Schedule' : 'Create Schedule'}
                                </h3>

                                <div className="skill-form-group">
                                    <label>Schedule Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} />
                                </div>

                                <div className="skill-form-row">
                                    <div className="skill-form-group" style={{ flex: 1 }}>
                                        <label>Frequency</label>
                                        <select value={frequency} onChange={e => setFrequency(e.target.value)}>
                                            <option value="daily">Every Day</option>
                                            <option value="weekdays">Weekdays (Mon-Fri)</option>
                                            <option value="weekly">Specific Days</option>
                                        </select>
                                    </div>
                                    <div className="skill-form-group" style={{ flex: 1 }}>
                                        <label>Time</label>
                                        <input type="time" value={runAtTime} onChange={e => setRunAtTime(e.target.value)} />
                                    </div>
                                </div>

                                {frequency === 'weekly' && (
                                    <div className="skill-form-group">
                                        <label>Days</label>
                                        <div className="schedule-days">
                                            {DAY_LABELS.map((label, i) => (
                                                <button
                                                    key={i}
                                                    className={`schedule-day-btn ${daysOfWeek.includes(i) ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setDaysOfWeek(prev =>
                                                            prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                                                        );
                                                    }}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="skill-form-group">
                                    <label>Timezone</label>
                                    <select value={timezone} onChange={e => setTimezone(e.target.value)}>
                                        {TIMEZONES.map(tz => (
                                            <option key={tz} value={tz}>{tz}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* ── Visibility Options ────────────── */}
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16, paddingTop: 16 }}>
                                    <h3 className="schedule-section-title" style={{ marginBottom: 12, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-secondary, #71717a)' }}>Visibility Options</h3>
                                    <div style={{ display: 'flex', gap: 24 }}>
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', flex: 1 }}>
                                            <input
                                                type="checkbox"
                                                checked={showOnToday}
                                                onChange={e => setShowOnToday(e.target.checked)}
                                                style={{ marginTop: 3, accentColor: '#D2F000' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    🏠 Show on Today Page
                                                </div>
                                                <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                                                    Display latest output on the Today dashboard
                                                </div>
                                            </div>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', flex: 1 }}>
                                            <input
                                                type="checkbox"
                                                checked={includeInBrief}
                                                onChange={e => setIncludeInBrief(e.target.checked)}
                                                style={{ marginTop: 3, accentColor: '#00daf3' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    📋 Include in Daily Brief
                                                </div>
                                                <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                                                    Include output summary in the Daily Brief
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Run History Tab */
                        <div className="schedule-runs">
                            {runs.length === 0 ? (
                                <div className="schedule-empty-state">
                                    <History size={24} />
                                    <p>No runs yet</p>
                                </div>
                            ) : (
                                runs.map(run => (
                                    <div key={run.id} className="run-card" onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}>
                                        <div className="run-card-header">
                                            <span className={`run-status ${run.status}`}>
                                                {run.status === 'success' ? '✓' : run.status === 'failed' ? '✗' : run.status === 'running' ? '⟳' : '◌'}
                                                {' '}{run.status.toUpperCase()}
                                            </span>
                                            <span className="run-trigger">{run.triggerType}</span>
                                            <span className="run-time">{new Date(run.startedAt).toLocaleString()}</span>
                                            {run.finishedAt && (
                                                <span className="run-duration">
                                                    {Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                                                </span>
                                            )}
                                        </div>
                                            {run.status === 'success' && run.outputText && (
                                                <button
                                                    className="run-view-btn"
                                                    onClick={(e) => { e.stopPropagation(); setViewingRun(run); }}
                                                    title="View Output"
                                                >
                                                    <Eye size={14} /> View
                                                </button>
                                            )}
                                        {expandedRun === run.id && (
                                            <div className="run-card-body">
                                                {run.outputTitle && <h4>{run.outputTitle}</h4>}
                                                {run.outputText && (
                                                    <pre className="run-output">{run.outputText.substring(0, 2000)}</pre>
                                                )}
                                                {run.errorMessage && (
                                                    <pre className="run-error">{run.errorMessage}</pre>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {tab === 'schedule' && (
                    <div className="skill-modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Close</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleCreate}
                            disabled={saving || !name.trim()}
                        >
                            {saving ? <Loader size={14} className="spin" /> : <Clock size={14} />}
                            {' '}Create Schedule
                        </button>
                    </div>
                )}
            </div>

            {/* Newsletter View Modal */}
            {viewingRun && (
                <div className="newsletter-overlay" onClick={() => setViewingRun(null)}>
                    <div className="newsletter-modal" onClick={e => e.stopPropagation()}>
                        <div className="newsletter-header">
                            <div className="newsletter-header-left">
                                <span className="newsletter-badge">AI GENERATED</span>
                                <span className="newsletter-date">{new Date(viewingRun.startedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                            <button className="skill-modal-close" onClick={() => setViewingRun(null)}><X size={18} /></button>
                        </div>
                        {viewingRun.outputTitle && (
                            <h1 className="newsletter-title">{viewingRun.outputTitle}</h1>
                        )}
                        <div className="newsletter-divider" />
                        <div
                            className="newsletter-content"
                            dangerouslySetInnerHTML={{ __html: simpleMarkdown(viewingRun.outputText || '') }}
                        />
                        <div className="newsletter-footer">
                            <span>Generated by Nousio AI</span>
                            <span>{viewingRun.triggerType === 'scheduled' ? '⏱ Scheduled Run' : '▶ Manual Run'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
