'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import { useT } from '@/i18n/context';
import {
    IDENTITY_SLIDERS,
    REASONING_SLIDERS,
    KNOWLEDGE_SLIDERS,
    TASK_BEHAVIOR_SLIDERS,
    COMMUNICATION_STYLES,
    TONE_PRESETS,
    PERSONALITY_TRAIT_OPTIONS,
} from '@/lib/ai-brains/schema';
import {
    BRAIN_TYPE_LABELS,
    BRAIN_TYPE_ICONS,
    BRAIN_TYPE_DESCRIPTIONS,
    BRAIN_TYPE_TO_ASSISTANT_TYPE,
} from '@/lib/ai-brains/defaults';
import type {
    BrainConfig,
    BrainAdvancedInstructions,
    SliderFieldMeta,
    BrainType,
} from '@/lib/ai-brains/schema';
import { traitsToSliders, slidersToTraits } from '@/lib/ai-brains/trait-mapper';
import type { BrainTemplate } from '@/lib/ai-brains/templates';
import {
    ArrowLeft, Save, Loader,
    Building2, Coins, Megaphone, GraduationCap, Target, Package,
    Brain, Plus, Sparkles, Shield, Zap, Settings, Rocket,
    BookOpen, Drama, Archive, ArchiveRestore, Trash2, ExternalLink,
} from 'lucide-react';
import '../ai-brain.css';

// ─── Icon Maps ───────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
    'brain': <Brain size={20} strokeWidth={2} />,
    'building-2': <Building2 size={20} strokeWidth={2} />,
    'coins': <Coins size={20} strokeWidth={2} />,
    'megaphone': <Megaphone size={20} strokeWidth={2} />,
    'graduation-cap': <GraduationCap size={20} strokeWidth={2} />,
    'target': <Target size={20} strokeWidth={2} />,
    'package': <Package size={20} strokeWidth={2} />,
    'sparkles': <Sparkles size={20} strokeWidth={2} />,
    'rocket': <Rocket size={20} strokeWidth={2} />,
};
function renderIcon(name: string) { return ICON_MAP[name] ?? <Brain size={20} strokeWidth={2} />; }

// ─── Types ───────────────────────────────────────────
interface BrainProfile {
    id: string; brainType: string; name: string; description: string | null;
    status: string; isEnabled: boolean;
    configJson?: BrainConfig; advancedInstructions?: BrainAdvancedInstructions | null;
    createdAt: string; updatedAt: string;
}

interface SkillItem {
    id: string; name: string; description: string | null; icon: string | null;
    category: string | null; status: string; version: number; isDefault: boolean;
    key: string; instructionPrompt: string | null; assistantType: string;
}

type TabKey = 'overview' | 'persona' | 'skills' | 'knowledge' | 'advanced';

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ReactNode; skipForCompany?: boolean }[] = [
    { key: 'overview', label: 'Overview', icon: <Brain size={14} strokeWidth={2} /> },
    { key: 'persona', label: 'Persona', icon: <Drama size={14} strokeWidth={2} /> },
    { key: 'skills', label: 'Skills', icon: <Zap size={14} strokeWidth={2} />, skipForCompany: true },
    { key: 'knowledge', label: 'Knowledge', icon: <BookOpen size={14} strokeWidth={2} /> },
    { key: 'advanced', label: 'Advanced', icon: <Settings size={14} strokeWidth={2} /> },
];

// ─── Resource Workspace ──────────────────────────────
export default function ResourceWorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const { showToast, showConfirm } = useUIFeedback();
    const { t } = useT();

    const brainType = (params.brainType as string || '').toUpperCase() as BrainType;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [brain, setBrain] = useState<BrainProfile | null>(null);
    const [editConfig, setEditConfig] = useState<BrainConfig | null>(null);
    const [editAdvanced, setEditAdvanced] = useState<BrainAdvancedInstructions | null>(null);
    const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    // Skills
    const [skills, setSkills] = useState<SkillItem[]>([]);
    const [loadingSkills, setLoadingSkills] = useState(false);

    // Templates (for Company DNA Quick Presets)
    const [templates, setTemplates] = useState<BrainTemplate[]>([]);

    // ─── Load brain ─────────────────────────────────────
    const loadBrain = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/brains');
            const data = await res.json();
            const found = (data.brains || []).find((b: BrainProfile) => b.brainType === brainType);
            if (!found) { router.push('/settings/ai-brain'); return; }

            const detailRes = await fetch(`/api/ai/brains/${found.id}`);
            const detailData = await detailRes.json();
            const full = detailData.brain as BrainProfile;
            setBrain(full);

            const cfg = full.configJson as BrainConfig;
            setEditConfig(cfg);
            setEditAdvanced(full.advancedInstructions as BrainAdvancedInstructions | null);

            const storedTraits = cfg?.identity?.personalityTraits;
            if (storedTraits && storedTraits.length > 0) {
                setSelectedTraits(storedTraits);
            } else if (cfg?.identity) {
                setSelectedTraits(slidersToTraits(cfg.identity));
            } else {
                setSelectedTraits([]);
            }
        } catch {
            showToast('Error loading resource', 'error');
            router.push('/settings/ai-brain');
        }
        setLoading(false);
    }, [brainType, router, showToast]);

    const loadSkills = useCallback(async () => {
        const assistantType = BRAIN_TYPE_TO_ASSISTANT_TYPE[brainType] || brainType;
        setLoadingSkills(true);
        try {
            const res = await fetch(`/api/ai/skills?assistantType=${assistantType}`);
            const data = await res.json();
            setSkills((data.skills || []).filter((s: SkillItem) =>
                !('executionType' in s) || (s as any).executionType === 'NATIVE'
            ));
        } catch { setSkills([]); }
        setLoadingSkills(false);
    }, [brainType]);

    const loadTemplates = useCallback(async () => {
        if (brainType !== 'COMPANY') return;
        try {
            const res = await fetch('/api/ai/brain-templates');
            const data = await res.json();
            setTemplates(data.templates || []);
        } catch { /* non-critical */ }
    }, [brainType]);

    useEffect(() => { loadBrain(); loadSkills(); loadTemplates(); }, [loadBrain, loadSkills, loadTemplates]);

    // ─── Save ───────────────────────────────────────────
    async function handleSave() {
        if (!brain || !editConfig) return;
        setSaving(true);
        try {
            const traitSliders = traitsToSliders(selectedTraits);
            const updatedConfig: BrainConfig = {
                ...editConfig,
                identity: { ...traitSliders, ...editConfig.identity, personalityTraits: selectedTraits },
            };
            const res = await fetch(`/api/ai/brains/${brain.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configJson: updatedConfig, advancedInstructions: editAdvanced }),
            });
            if (res.ok) {
                showToast('Changes saved!', 'success');
                setEditConfig(updatedConfig);
            } else showToast('Failed to save', 'error');
        } catch { showToast('Connection error', 'error'); }
        setSaving(false);
    }

    // ─── Publish ────────────────────────────────────────
    async function handlePublish() {
        if (!brain) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/ai/brains/${brain.id}/publish`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changeSummary: 'Published from Resource Workspace' }),
            });
            if (res.ok) { showToast('Published! ✨', 'success'); loadBrain(); }
            else showToast('Publish failed', 'error');
        } catch { showToast('Connection error', 'error'); }
        setSaving(false);
    }

    // ─── Apply Template (Company DNA Quick Presets) ─────
    async function applyTemplate(templateId: string) {
        if (!brain) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/ai/brains/${brain.id}/apply-template`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId }),
            });
            if (res.ok) {
                showToast('Preset applied!', 'success');
                loadBrain();
            } else {
                showToast('Failed to apply preset', 'error');
            }
        } catch { showToast('Connection error', 'error'); }
        setSaving(false);
    }

    // ─── Skill Actions ──────────────────────────────────
    async function handleToggleSkillStatus(skill: SkillItem) {
        const newStatus = skill.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
        try {
            await fetch(`/api/ai/skills/${skill.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            showToast(`Skill ${newStatus === 'ACTIVE' ? 'activated' : 'archived'}`, 'success');
            loadSkills();
        } catch { showToast('Error updating skill', 'error'); }
    }

    async function handleDeleteSkill(skill: SkillItem) {
        showConfirm(
            skill.isDefault ? 'Archive this default skill?' : 'Delete this custom skill?',
            async () => {
                try {
                    await fetch(`/api/ai/skills/${skill.id}`, { method: 'DELETE' });
                    showToast(skill.isDefault ? 'Skill archived' : 'Skill deleted', 'success');
                    loadSkills();
                } catch { showToast('Error deleting skill', 'error'); }
            }
        );
    }

    // ─── Trait toggle ───────────────────────────────────
    function toggleTrait(trait: string) {
        setSelectedTraits(prev => {
            if (prev.includes(trait)) return prev.filter(t => t !== trait);
            if (prev.length >= 5) { showToast('Maximum 5 traits', 'warning'); return prev; }
            return [...prev, trait];
        });
    }

    // ─── Config updaters ────────────────────────────────
    function updateSlider(domain: keyof BrainConfig, key: string, value: number) {
        if (!editConfig) return;
        setEditConfig({ ...editConfig, [domain]: { ...editConfig[domain], [key]: value } });
    }
    function updateToggle(domain: keyof BrainConfig, key: string, value: boolean) {
        if (!editConfig) return;
        setEditConfig({ ...editConfig, [domain]: { ...editConfig[domain], [key]: value } });
    }
    function updateSelect(domain: keyof BrainConfig, key: string, value: string) {
        if (!editConfig) return;
        setEditConfig({ ...editConfig, [domain]: { ...editConfig[domain], [key]: value } });
    }

    // ─── Filtered tabs ──────────────────────────────────
    const visibleTabs = brainType === 'COMPANY'
        ? TAB_CONFIG.filter(t => !t.skipForCompany)
        : TAB_CONFIG;

    // ─── Loading ────────────────────────────────────────
    if (loading || !brain || !editConfig) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
                <div className="spinner" />
            </div>
        );
    }

    const label = (brain.configJson as unknown as any)?.identity?.displayName
        || (brainType === 'COMPANY' ? 'Company DNA' : (BRAIN_TYPE_LABELS[brainType] || brain.name));
    const roleLabel = brainType === 'COMPANY' ? 'Company DNA' : (BRAIN_TYPE_LABELS[brainType] || brain.name);
    const hasCustomName = !!(brain.configJson as unknown as any)?.identity?.displayName;
    const avatarUrl = (brain.configJson as unknown as any)?.identity?.avatarUrl || null;
    const iconName = BRAIN_TYPE_ICONS[brainType] || 'brain';

    function getInitials(name: string) {
        return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    }

    return (
        <div className="resource-workspace">
            {/* ═══ COMPACT HEADER — title only ═══ */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <button
                        className="resource-back-btn"
                        onClick={() => router.push('/settings/ai-brain')}
                        title="Back to AI Team"
                    >
                        <ArrowLeft size={16} strokeWidth={2} />
                    </button>
                    {avatarUrl ? (
                        <div className="team-member-avatar" style={{ width: 32, height: 32 }}>
                            <img src={avatarUrl} alt={label} />
                        </div>
                    ) : (
                        <span className="assistant-page-icon">{renderIcon(iconName)}</span>
                    )}
                    <div>
                        <h1>{label}</h1>
                        {hasCustomName && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: -2, letterSpacing: '0.03em' }}>{roleLabel}</div>
                        )}
                    </div>
                    <div className={`team-status ${brain.status === 'ACTIVE' ? 'active' : 'draft'}`}>
                        {brain.status === 'ACTIVE' ? '● Active' : '◌ Draft'}
                    </div>
                </div>
            </div>

            {/* ═══ TABS + ACTIONS — inside page content ═══ */}
            <div className="resource-toolbar">
                <div className="resource-toolbar-tabs">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.key}
                            className={`assistant-tab ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.icon} {tab.key === 'skills' ? `${tab.label} (${skills.length})` : tab.label}
                        </button>
                    ))}
                </div>
                <div className="resource-toolbar-actions">
                    <button className="btn-brain-secondary" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader size={14} /> : <Save size={14} />} Save
                    </button>
                    <button className="btn btn-primary" onClick={handlePublish} disabled={saving}>
                        <Rocket size={14} strokeWidth={2} /> Publish
                    </button>
                </div>
            </div>

            {/* ═══ TAB CONTENT ═══ */}
            <div className="resource-content">
                {/* ═══ Overview Tab ═══ */}
                {activeTab === 'overview' && (
                    <div className="resource-overview">
                        <div className="resource-overview-grid">
                            <div className="resource-stat-card">
                                <div className="resource-stat-label">Status</div>
                                <div className={`team-status ${brain.status === 'ACTIVE' ? 'active' : 'draft'}`}>
                                    {brain.status === 'ACTIVE' ? '● Active' : '◌ Draft'}
                                </div>
                            </div>
                            {brainType !== 'COMPANY' && (
                                <div className="resource-stat-card">
                                    <div className="resource-stat-label">Skills</div>
                                    <div className="resource-stat-value">{skills.length}</div>
                                </div>
                            )}
                            <div className="resource-stat-card">
                                <div className="resource-stat-label">Personality</div>
                                <div className="resource-stat-value">
                                    {selectedTraits.length > 0 ? selectedTraits.join(', ') : 'Not set'}
                                </div>
                            </div>
                            <div className="resource-stat-card">
                                <div className="resource-stat-label">Tone</div>
                                <div className="resource-stat-value">
                                    {editConfig.identity.tonePreset?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Default'}
                                </div>
                            </div>
                            <div className="resource-stat-card">
                                <div className="resource-stat-label">Style</div>
                                <div className="resource-stat-value">
                                    {editConfig.identity.communicationStyle ?
                                        editConfig.identity.communicationStyle.charAt(0).toUpperCase() + editConfig.identity.communicationStyle.slice(1)
                                        : 'Default'}
                                </div>
                            </div>
                            <div className="resource-stat-card">
                                <div className="resource-stat-label">Last Updated</div>
                                <div className="resource-stat-value">
                                    {new Date(brain.updatedAt).toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        {BRAIN_TYPE_DESCRIPTIONS[brainType] && (
                            <div className="resource-description-card">
                                <p>{BRAIN_TYPE_DESCRIPTIONS[brainType]}</p>
                            </div>
                        )}

                        {/* Quick personality preview */}
                        {selectedTraits.length > 0 && (
                            <div className="resource-section">
                                <label className="resource-section-label">Personality Traits</label>
                                <div className="trait-chips">
                                    {selectedTraits.map(trait => (
                                        <span key={trait} className="trait-chip selected" style={{ cursor: 'default' }}>{trait}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick skills preview */}
                        {brainType !== 'COMPANY' && skills.length > 0 && (
                            <div className="resource-section">
                                <label className="resource-section-label">Skills</label>
                                <div className="skills-inline-list">
                                    {skills.slice(0, 5).map(skill => (
                                        <div key={skill.id} className="skill-inline-card">
                                            <div className="skill-inline-icon"><Zap size={14} /></div>
                                            <div className="skill-inline-info">
                                                <div className="skill-inline-name">
                                                    {skill.name}
                                                    {skill.isDefault && <span className="skill-badge default">Default</span>}
                                                </div>
                                                {skill.description && <div className="skill-inline-desc">{skill.description}</div>}
                                            </div>
                                            <span className={`skill-status-dot ${skill.status.toLowerCase()}`}>
                                                {skill.status === 'ACTIVE' ? '●' : '◌'}
                                            </span>
                                        </div>
                                    ))}
                                    {skills.length > 5 && (
                                        <button className="skills-library-link" onClick={() => setActiveTab('skills')}>
                                            + {skills.length - 5} more skills
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Persona Tab ═══ */}
                {activeTab === 'persona' && (
                    <div className="resource-form">
                        <label className="resource-section-label">Character Traits (select up to 5)</label>
                        <div className="trait-chips">
                            {PERSONALITY_TRAIT_OPTIONS.map(trait => (
                                <button
                                    key={trait}
                                    className={`trait-chip ${selectedTraits.includes(trait) ? 'selected' : ''}`}
                                    onClick={() => toggleTrait(trait)}
                                >
                                    {trait}
                                </button>
                            ))}
                        </div>

                        {/* Quick Presets — only for Company DNA */}
                        {brainType === 'COMPANY' && templates.length > 0 && (
                            <div className="slideover-presets" style={{ marginBottom: 24 }}>
                                <label className="resource-section-label">Quick Presets</label>
                                <div className="preset-grid">
                                    {templates.map(tpl => (
                                        <button
                                            key={tpl.id}
                                            className="preset-card"
                                            onClick={() => applyTemplate(tpl.id)}
                                        >
                                            <span className="preset-name">{tpl.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="slideover-field-row">
                            <div className="brain-select-group">
                                <label>Tone</label>
                                <select value={editConfig.identity.tonePreset}
                                    onChange={e => updateSelect('identity', 'tonePreset', e.target.value)}>
                                    {TONE_PRESETS.map(tp => (
                                        <option key={tp} value={tp}>
                                            {tp.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="brain-select-group">
                                <label>Style</label>
                                <select value={editConfig.identity.communicationStyle}
                                    onChange={e => updateSelect('identity', 'communicationStyle', e.target.value)}>
                                    {COMMUNICATION_STYLES.map(cs => (
                                        <option key={cs} value={cs}>
                                            {cs.charAt(0).toUpperCase() + cs.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="advanced-group-label" style={{ marginTop: 32 }}>Identity Sliders</div>
                        {IDENTITY_SLIDERS.map(s => (
                            <SliderControl key={s.key} meta={s}
                                value={(editConfig.identity as unknown as Record<string, number>)[s.key]}
                                onChange={v => updateSlider('identity', s.key, v)} />
                        ))}
                    </div>
                )}

                {/* ═══ Skills Tab ═══ */}
                {activeTab === 'skills' && brainType !== 'COMPANY' && (
                    <div className="resource-form">
                        <div className="resource-skills-header">
                            <h3>{skills.length} Skill{skills.length !== 1 ? 's' : ''}</h3>
                            <a href="/skills" className="skills-library-link" style={{ textDecoration: 'none' }}>
                                <ExternalLink size={12} /> Open Library
                            </a>
                        </div>

                        {loadingSkills ? (
                            <div style={{ textAlign: 'center', padding: 48 }}>
                                <Loader size={20} className="spin" /> Loading...
                            </div>
                        ) : skills.length === 0 ? (
                            <div className="skills-inline-empty">
                                <Zap size={28} style={{ opacity: 0.3 }} />
                                <p>No skills attached to this resource yet.</p>
                                <a href="/skills" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                                    <Plus size={14} /> Create in Skill Library
                                </a>
                            </div>
                        ) : (
                            <div className="skills-inline-list">
                                {skills.map(skill => (
                                    <div key={skill.id} className={`skill-inline-card ${skill.status === 'ARCHIVED' ? 'archived' : ''}`}>
                                        <div className="skill-inline-icon"><Zap size={14} /></div>
                                        <div className="skill-inline-info">
                                            <div className="skill-inline-name">
                                                {skill.name}
                                                {skill.isDefault && <span className="skill-badge default">Default</span>}
                                                {!skill.isDefault && <span className="skill-badge custom">Custom</span>}
                                            </div>
                                            {skill.description && <div className="skill-inline-desc">{skill.description}</div>}
                                            <div className="skill-inline-meta">
                                                <span className={`skill-status-dot ${skill.status.toLowerCase()}`}>
                                                    {skill.status === 'ACTIVE' ? '●' : '◌'} {skill.status}
                                                </span>
                                                <span>v{skill.version}</span>
                                                {skill.instructionPrompt && <span>✓ Instructions</span>}
                                                {skill.category && <span>{skill.category}</span>}
                                            </div>
                                        </div>
                                        <div className="skill-inline-actions">
                                            <button className="skill-action-btn toggle"
                                                title={skill.status === 'ACTIVE' ? 'Archive' : 'Activate'}
                                                onClick={() => handleToggleSkillStatus(skill)}>
                                                {skill.status === 'ACTIVE' ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                                            </button>
                                            {!skill.isDefault && (
                                                <button className="skill-action-btn delete" title="Delete"
                                                    onClick={() => handleDeleteSkill(skill)}>
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Knowledge Tab ═══ */}
                {activeTab === 'knowledge' && (
                    <div className="resource-form">
                        <ToggleControl label="Use Company Profile" checked={editConfig.knowledge.useCompanyProfile}
                            onChange={v => updateToggle('knowledge', 'useCompanyProfile', v)} />
                        <ToggleControl label="Prefer Internal Sources" checked={editConfig.knowledge.preferInternalSources}
                            onChange={v => updateToggle('knowledge', 'preferInternalSources', v)} />
                        <ToggleControl label="Prefer Curated Sources" checked={editConfig.knowledge.preferCuratedSources}
                            onChange={v => updateToggle('knowledge', 'preferCuratedSources', v)} />

                        <div className="advanced-group-label" style={{ marginTop: 32 }}>Knowledge Sliders</div>
                        {KNOWLEDGE_SLIDERS.map(s => (
                            <SliderControl key={s.key} meta={s}
                                value={(editConfig.knowledge as unknown as Record<string, number>)[s.key]}
                                onChange={v => updateSlider('knowledge', s.key, v)} />
                        ))}
                    </div>
                )}

                {/* ═══ Advanced Tab ═══ */}
                {activeTab === 'advanced' && (
                    <div className="resource-form">
                        {/* Guardrails (Company DNA only) */}
                        {brainType === 'COMPANY' && (
                            <>
                                <div className="advanced-group-label">Guardrails</div>
                                <ToggleControl label="Avoid Inventing Data" checked={editConfig.guardrails.avoidInventingData}
                                    onChange={v => updateToggle('guardrails', 'avoidInventingData', v)} />
                                <ToggleControl label="Flag Uncertainty" checked={editConfig.guardrails.flagUncertainty}
                                    onChange={v => updateToggle('guardrails', 'flagUncertainty', v)} />
                                <ToggleControl label="Avoid Legal Advice" checked={editConfig.guardrails.avoidLegalAdvice}
                                    onChange={v => updateToggle('guardrails', 'avoidLegalAdvice', v)} />
                                <ToggleControl label="Avoid Financial Advice" checked={editConfig.guardrails.avoidFinancialAdvice}
                                    onChange={v => updateToggle('guardrails', 'avoidFinancialAdvice', v)} />
                            </>
                        )}

                        {/* Reasoning */}
                        <div className="advanced-group-label">Reasoning</div>
                        {REASONING_SLIDERS.map(s => (
                            <SliderControl key={s.key} meta={s}
                                value={(editConfig.reasoning as unknown as Record<string, number>)[s.key]}
                                onChange={v => updateSlider('reasoning', s.key, v)} />
                        ))}
                        <ToggleControl label="Ask When Uncertain" checked={editConfig.reasoning.askWhenUncertain}
                            onChange={v => updateToggle('reasoning', 'askWhenUncertain', v)} />
                        <ToggleControl label="Provide Options" checked={editConfig.reasoning.provideOptions}
                            onChange={v => updateToggle('reasoning', 'provideOptions', v)} />
                        <ToggleControl label="Explain Reasoning" checked={editConfig.reasoning.explainReasoning}
                            onChange={v => updateToggle('reasoning', 'explainReasoning', v)} />

                        {/* Output Behavior */}
                        <div className="advanced-group-label">Output Behavior</div>
                        {TASK_BEHAVIOR_SLIDERS.map(s => (
                            <SliderControl key={s.key} meta={s}
                                value={(editConfig.taskBehavior as unknown as Record<string, number>)[s.key]}
                                onChange={v => updateSlider('taskBehavior', s.key, v)} />
                        ))}

                        {/* Custom Instructions */}
                        <div className="advanced-group-label">Custom Instructions</div>
                        <div className="brain-textarea-group">
                            <label>Additional System Instructions</label>
                            <textarea
                                value={editAdvanced?.additionalSystemInstructions || ''}
                                onChange={e => setEditAdvanced({
                                    ...(editAdvanced || { additionalSystemInstructions: '', forbiddenPhrasing: '', preferredTerminology: '', outputExamples: '', roleSpecificNotes: '' }),
                                    additionalSystemInstructions: e.target.value,
                                })}
                                placeholder="Extra instructions to include in the system prompt..."
                            />
                        </div>
                        <div className="brain-textarea-group">
                            <label>Preferred Terminology</label>
                            <textarea
                                value={editAdvanced?.preferredTerminology || ''}
                                onChange={e => setEditAdvanced({
                                    ...(editAdvanced || { additionalSystemInstructions: '', forbiddenPhrasing: '', preferredTerminology: '', outputExamples: '', roleSpecificNotes: '' }),
                                    preferredTerminology: e.target.value,
                                })}
                                placeholder="Company-specific terms the AI should prefer..."
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Shared Sub-Components ────────────────────────────

function SliderControl({ meta, value, onChange }: { meta: SliderFieldMeta; value: number; onChange: (v: number) => void }) {
    return (
        <div className="brain-slider-control">
            <div className="brain-slider-header">
                <span className="brain-slider-label">{meta.label}</span>
                <span className="brain-slider-value">{value ?? meta.min}</span>
            </div>
            <input type="range" min={meta.min} max={meta.max} step={meta.step}
                value={value ?? meta.min} onChange={e => onChange(Number(e.target.value))} />
            <div className="brain-slider-labels">
                <span>{meta.lowLabel}</span><span>{meta.highLabel}</span>
            </div>
        </div>
    );
}

function ToggleControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="brain-toggle-control">
            <input type="checkbox" checked={checked ?? false} onChange={e => onChange(e.target.checked)} />
            <span className="brain-toggle-label">{label}</span>
        </label>
    );
}
