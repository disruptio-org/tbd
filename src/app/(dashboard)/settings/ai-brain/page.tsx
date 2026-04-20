'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import { useT } from '@/i18n/context';
import {
    BRAIN_TYPES,
} from '@/lib/ai-brains/schema';
import {
    BRAIN_TYPE_LABELS,
    BRAIN_TYPE_ICONS,
    BRAIN_TYPE_DESCRIPTIONS,
    BRAIN_TYPE_TO_ASSISTANT_TYPE,
} from '@/lib/ai-brains/defaults';
import type {
    BrainType,
} from '@/lib/ai-brains/schema';
import {
    TEAM_GOAL_OPTIONS,
    TEAM_SIZE_RANGES,
    PROFILE_MIN_THRESHOLD,
    PROFILE_WARN_THRESHOLD,
} from '@/lib/ai-brains/team-designer';
import type {
    TeamGoal,
    TeamSize,
    TeamDesignResult,
    TeamMemberProposal,
} from '@/lib/ai-brains/team-designer';
import { TEAM_TEMPLATES } from '@/lib/ai-brains/team-templates';
import type { TeamTemplate } from '@/lib/ai-brains/team-templates';
import type { TeamAnalysisResult, TeamSuggestion } from '@/app/api/ai/brains/analyze-team/route';
import {
    Users, Rocket, Loader, X,
    Building2, Coins, Megaphone, GraduationCap, Target, Package,
    Brain, Plus, Sparkles, Settings, Zap,
    Pencil, Trash2, AlertTriangle, RefreshCw, Check, Wand2,
    Search, TrendingUp, ArrowRight, ChevronDown, ChevronUp,
    GitBranch, Camera, ImageIcon,
} from 'lucide-react';
import './ai-brain.css';

// ─── Icon Map ────────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
    'brain': <Brain size={22} />,
    'building-2': <Building2 size={22} />,
    'coins': <Coins size={22} />,
    'megaphone': <Megaphone size={22} />,
    'graduation-cap': <GraduationCap size={22} />,
    'target': <Target size={22} />,
    'package': <Package size={22} />,
    'sparkles': <Sparkles size={22} />,
    'rocket': <Rocket size={22} />,
    'settings': <Settings size={22} />,
};
function renderIcon(name: string) {
    return ICON_MAP[name] ?? <Brain size={22} />;
}

// ─── Types ────────────────────────────────────────────
interface BrainProfile {
    id: string;
    brainType: string;
    name: string;
    description: string | null;
    status: string;
    isEnabled: boolean;
    configJson?: import('@/lib/ai-brains/schema').BrainConfig;
    createdAt: string;
    updatedAt: string;
}

interface SkillSummary {
    id: string;
    name: string;
    assistantType: string;
}

// ─── Designer Wizard Steps ────────────────────────────
type DesignerStep = 'goal' | 'size' | 'generating' | 'review' | 'profile-block';
type DesignerTab = 'wizard' | 'templates';

// ─── Component ────────────────────────────────────────
export default function AITeamPage() {
    const { showToast, showConfirm } = useUIFeedback();
    const { t } = useT();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    // Brain state
    const [brains, setBrains] = useState<BrainProfile[]>([]);
    const [skillCounts, setSkillCounts] = useState<Record<string, number>>({});

    // Custom member creation modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [customIcon, setCustomIcon] = useState('brain');
    const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
    const [customDisplayName, setCustomDisplayName] = useState('');
    const createAvatarRef = useRef<HTMLInputElement>(null);

    // Identity editing modal
    const [editingIdentityBrain, setEditingIdentityBrain] = useState<BrainProfile | null>(null);
    const [identityDisplayName, setIdentityDisplayName] = useState('');
    const [identityAvatarUrl, setIdentityAvatarUrl] = useState<string | null>(null);
    const [savingIdentity, setSavingIdentity] = useState(false);
    const identityFileRef = useRef<HTMLInputElement>(null);

    // ─── Team Designer State ────────────────────────────
    const [showDesigner, setShowDesigner] = useState(false);
    const [designerStep, setDesignerStep] = useState<DesignerStep>('goal');
    const [designerTab, setDesignerTab] = useState<DesignerTab>('wizard');
    const [selectedGoal, setSelectedGoal] = useState<TeamGoal | null>(null);
    const [selectedSize, setSelectedSize] = useState<TeamSize>('standard');
    const [userIntent, setUserIntent] = useState('');
    const [customGoal, setCustomGoal] = useState('');
    const [isCustomGoal, setIsCustomGoal] = useState(false);
    const [profileScore, setProfileScore] = useState<number | null>(null);
    const [designResult, setDesignResult] = useState<TeamDesignResult | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [suggestingGoal, setSuggestingGoal] = useState(false);
    const [suggestingPriorities, setSuggestingPriorities] = useState(false);
    const [editingMemberIdx, setEditingMemberIdx] = useState<number | null>(null);
    const [removedMembers, setRemovedMembers] = useState<Set<number>>(new Set());

    // ─── Team Analysis State ────────────────────────────
    const [analysisResult, setAnalysisResult] = useState<TeamAnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showCollabDiagram, setShowCollabDiagram] = useState(true);

    // ─── Editable model state ────────────────────────────
    const [editingSummary, setEditingSummary] = useState(false);
    const [editingCollab, setEditingCollab] = useState(false);
    const [suggestingModel, setSuggestingModel] = useState<'operating' | 'collab' | null>(null);

    // ─── Team Structure Panel (main page) ──────────────
    const [showTeamStructure, setShowTeamStructure] = useState(false);
    const [teamStructure, setTeamStructure] = useState({ operatingModel: '', collaborationModel: '' });
    const [teamStructureLoading, setTeamStructureLoading] = useState(false);
    const [savingStructure, setSavingStructure] = useState(false);
    const [suggestingStructure, setSuggestingStructure] = useState<'operating' | 'collab' | null>(null);
    const [showStructureDiagram, setShowStructureDiagram] = useState(true);

    // ─── Load Data ──────────────────────────────────────
    const loadBrains = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/brains');
            const data = await res.json();
            setBrains(data.brains || []);
        } catch {
            showToast('Error loading team', 'error');
        }
        setLoading(false);
    }, [showToast]);

    const loadSkillCounts = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/skills');
            const data = await res.json();
            const skills = (data.skills || []) as SkillSummary[];
            const counts: Record<string, number> = {};
            for (const s of skills) {
                counts[s.assistantType] = (counts[s.assistantType] || 0) + 1;
            }
            setSkillCounts(counts);
        } catch { /* non-critical */ }
    }, []);

    useEffect(() => {
        loadBrains();
        loadSkillCounts();
    }, [loadBrains, loadSkillCounts]);

    // ─── Team Structure load/save ───────────────────
    async function loadTeamStructure() {
        setTeamStructureLoading(true);
        try {
            const res = await fetch('/api/ai/brains/team-structure');
            if (res.ok) {
                const data = await res.json();
                const opModel = data.operatingModel || '';
                const collabModel = data.collaborationModel || '';
                // If API returns empty, try to pull from current designResult as fallback
                setTeamStructure({
                    operatingModel: opModel || designResult?.summary || '',
                    collaborationModel: collabModel || designResult?.collaboration || '',
                });
            }
        } catch { /* ignore */ }
        setTeamStructureLoading(false);
    }

    async function saveTeamStructure() {
        setSavingStructure(true);
        try {
            const res = await fetch('/api/ai/brains/team-structure', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(teamStructure),
            });
            if (res.ok) {
                showToast('Team structure saved', 'success');
            } else {
                showToast('Failed to save', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setSavingStructure(false);
    }

    async function askStructureSuggestion(field: 'operating' | 'collab') {
        setSuggestingStructure(field);
        const type = field === 'operating' ? 'operating_model' : 'collaboration_model';
        const currentValue = field === 'operating' ? teamStructure.operatingModel : teamStructure.collaborationModel;
        const memberNames = roleBrains.map(b => b.name);

        try {
            const res = await fetch('/api/ai/brains/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, currentValue: currentValue.trim() || undefined, teamMembers: memberNames }),
            });
            const data = await res.json();
            if (res.ok && data.suggestion) {
                if (field === 'operating') {
                    setTeamStructure(prev => ({ ...prev, operatingModel: data.suggestion }));
                } else {
                    setTeamStructure(prev => ({ ...prev, collaborationModel: data.suggestion }));
                }
            } else {
                showToast(data.error || 'Suggestion failed', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setSuggestingStructure(null);
    }

    function openTeamStructure() {
        setShowTeamStructure(true);
        loadTeamStructure();
    }

    // ─── Create Company Brain if none exists ────────────
    async function createCompanyBrain() {
        setSaving(true);
        try {
            const res = await fetch('/api/ai/brains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brainType: 'COMPANY', name: 'Company DNA' }),
            });
            if (res.ok) {
                showToast('Company DNA created!', 'success');
                await loadBrains();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to create', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setSaving(false);
    }

    // ─── Avatar / Identity Helpers ────────────────────────
    function getInitials(name: string): string {
        return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    }

    function resizeImage(file: File, maxSize: number): Promise<string> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > maxSize || h > maxSize) {
                        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                        else { w = Math.round(w * maxSize / h); h = maxSize; }
                    }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/webp', 0.85));
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        });
    }

    function getBrainDisplayName(brain: BrainProfile): string {
        return (brain.configJson as any)?.identity?.displayName
            || BRAIN_TYPE_LABELS[brain.brainType as BrainType]
            || brain.name;
    }

    function getBrainAvatarUrl(brain: BrainProfile): string | null {
        return (brain.configJson as any)?.identity?.avatarUrl || null;
    }

    function getBrainRoleLabel(brain: BrainProfile): string {
        return BRAIN_TYPE_LABELS[brain.brainType as BrainType] || brain.name;
    }

    // ─── Open Edit Identity Modal ────────────────────────
    function openIdentityEditor(brain: BrainProfile) {
        setEditingIdentityBrain(brain);
        setIdentityDisplayName((brain.configJson as any)?.identity?.displayName || '');
        setIdentityAvatarUrl((brain.configJson as any)?.identity?.avatarUrl || null);
    }

    async function handleIdentityFileChange(e: React.ChangeEvent<HTMLInputElement>, target: 'identity' | 'create') {
        const file = e.target.files?.[0];
        if (!file) return;
        const dataUrl = await resizeImage(file, 200);
        if (target === 'identity') setIdentityAvatarUrl(dataUrl);
        else setCustomAvatarUrl(dataUrl);
    }

    async function saveIdentity() {
        if (!editingIdentityBrain) return;
        setSavingIdentity(true);
        try {
            const currentConfig = editingIdentityBrain.configJson || {} as any;
            const updatedConfig = {
                ...currentConfig,
                identity: {
                    ...(currentConfig as any).identity,
                    displayName: identityDisplayName.trim() || undefined,
                    avatarUrl: identityAvatarUrl || undefined,
                },
            };

            const res = await fetch(`/api/ai/brains/${editingIdentityBrain.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configJson: updatedConfig }),
            });

            if (res.ok) {
                showToast('Identity updated!', 'success');
                setEditingIdentityBrain(null);
                await loadBrains();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to save', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setSavingIdentity(false);
    }

    // ─── Create Custom Brain ────────────────────────────
    async function createCustomBrain() {
        if (!customName.trim()) {
            showToast('Name is required', 'warning');
            return;
        }
        setSaving(true);
        const typeKey = 'CUSTOM_' + customName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
        try {
            const configJson: any = {};
            if (customDisplayName.trim() || customAvatarUrl) {
                configJson.identity = {
                    displayName: customDisplayName.trim() || undefined,
                    avatarUrl: customAvatarUrl || undefined,
                };
            }

            const res = await fetch('/api/ai/brains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brainType: typeKey,
                    name: customName.trim(),
                    description: customDescription.trim() || null,
                    ...(Object.keys(configJson).length > 0 ? { configJson } : {}),
                }),
            });
            if (res.ok) {
                showToast(`${customDisplayName.trim() || customName.trim()} added to team!`, 'success');
                setShowCreateModal(false);
                setCustomName('');
                setCustomDescription('');
                setCustomIcon('brain');
                setCustomDisplayName('');
                setCustomAvatarUrl(null);
                await loadBrains();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to create', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setSaving(false);
    }

    // ─── Publish all brains ─────────────────────────────
    async function handlePublish() {
        setPublishing(true);
        try {
            let published = 0;
            let failed = 0;
            for (const brain of brains) {
                try {
                    const res = await fetch(`/api/ai/brains/${brain.id}/publish`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ changeSummary: 'Published from AI Team' }),
                    });
                    if (res.ok) published++;
                    else failed++;
                } catch { failed++; }
            }
            if (failed === 0) {
                showToast(`All ${published} member(s) published! ✨`, 'success');
            } else {
                showToast(`Published ${published}, failed ${failed}`, 'warning');
            }
            await loadBrains();
        } catch {
            showToast('Connection error', 'error');
        }
        setPublishing(false);
    }

    // ─── Delete a brain ───────────────────────────
    function handleDeleteBrain(brain: BrainProfile) {
        const label = BRAIN_TYPE_LABELS[brain.brainType as BrainType] || brain.name;
        showConfirm(
            `Remove "${label}" from your AI team? This will delete all its personality, skills configuration, and settings.`,
            async () => {
                try {
                    const res = await fetch(`/api/ai/brains/${brain.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast(`${label} removed from team`, 'success');
                        await loadBrains();
                    } else {
                        const err = await res.json();
                        showToast(err.error || 'Failed to remove', 'error');
                    }
                } catch {
                    showToast('Connection error', 'error');
                }
            }
        );
    }

    // ═══════════════════════════════════════════════════
    // TEAM DESIGNER FUNCTIONS
    // ═══════════════════════════════════════════════════

    async function openDesigner() {
        setShowDesigner(true);
        setDesignerStep('goal');
        setDesignerTab('wizard');
        setSelectedGoal(null);
        setSelectedSize('standard');
        setUserIntent('');
        setCustomGoal('');
        setIsCustomGoal(false);
        setDesignResult(null);
        setEditingMemberIdx(null);
        setRemovedMembers(new Set());

        // Check profile completion
        try {
            const res = await fetch('/api/company/profile/completion');
            const data = await res.json();
            const score = data.completionScore ?? 0;
            setProfileScore(score);
            if (score < PROFILE_MIN_THRESHOLD) {
                setDesignerStep('profile-block');
            }
        } catch {
            setProfileScore(null); // proceed anyway
        }
    }

    function closeDesigner() {
        setShowDesigner(false);
        setDesignerStep('goal');
        setDesignResult(null);
        setIsGenerating(false);
        setEditingMemberIdx(null);
        setRemovedMembers(new Set());
    }

    async function startGeneration() {
        if (!selectedGoal && !isCustomGoal) return;
        if (isCustomGoal && !customGoal.trim()) return;

        setDesignerStep('generating');
        setIsGenerating(true);

        try {
            const res = await fetch('/api/ai/brains/design-team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    goal: isCustomGoal ? 'general' : selectedGoal,
                    teamSize: selectedSize,
                    userIntent: isCustomGoal
                        ? customGoal.trim()
                        : (userIntent.trim() || undefined),
                }),
            });

            const data = await res.json();

            if (res.ok && data.team) {
                setDesignResult(data.team);
                setDesignerStep('review');
            } else {
                showToast(data.error || 'Team generation failed', 'error');
                setDesignerStep('size');
            }
        } catch {
            showToast('Connection error', 'error');
            setDesignerStep('size');
        }

        setIsGenerating(false);
    }

    async function createTeam(autoPublish = false) {
        if (!designResult) return;

        const activeMembers = designResult.members.filter((_, idx) => !removedMembers.has(idx));
        if (activeMembers.length === 0) {
            showToast('No members to create — add at least one back', 'warning');
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch('/api/ai/brains/create-team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ members: activeMembers, autoPublish }),
            });

            const data = await res.json();

            if (res.ok) {
                const msg = data.totalCreated > 0
                    ? `${data.totalCreated} team member${data.totalCreated !== 1 ? 's' : ''} ${autoPublish ? 'created & published' : 'created'}! ${data.totalSkipped > 0 ? `(${data.totalSkipped} skipped — already exist)` : ''}`
                    : 'No new members created (all types already exist)';
                showToast(msg, data.totalCreated > 0 ? 'success' : 'warning');

                // Auto-persist team structure from designer
                if (designResult.summary || designResult.collaboration) {
                    fetch('/api/ai/brains/team-structure', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            operatingModel: designResult.summary || '',
                            collaborationModel: designResult.collaboration || '',
                        }),
                    }).catch(() => { /* best-effort */ });
                }

                closeDesigner();
                await loadBrains();
            } else {
                showToast(data.error || 'Failed to create team', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setIsCreating(false);
    }

    // ─── Derived data ───────────────────────────────────
    const companyBrain = brains.find(b => b.brainType === 'COMPANY');
    const roleBrains = brains.filter(b => b.brainType !== 'COMPANY');
    const existingTypes = new Set(brains.map(b => b.brainType));
    const availableTypes = BRAIN_TYPES.filter(t => t !== 'COMPANY' && !existingTypes.has(t));
    const hasTeam = roleBrains.length >= 3;

    // ─── Team Analysis ──────────────────────────────────
    async function analyzeTeam() {
        setIsAnalyzing(true);
        setShowAnalysis(true);
        setAnalysisResult(null);
        try {
            const res = await fetch('/api/ai/brains/analyze-team', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setAnalysisResult(data);
            } else {
                showToast(data.error || 'Analysis failed', 'error');
                setShowAnalysis(false);
            }
        } catch {
            showToast('Connection error', 'error');
            setShowAnalysis(false);
        }
        setIsAnalyzing(false);
    }

    // ─── AI Suggestion Helper ───────────────────────────
    async function askAiSuggestion(type: 'custom_goal' | 'priorities' | 'operating_model' | 'collaboration_model') {
        if (type === 'custom_goal') setSuggestingGoal(true);
        else if (type === 'priorities') setSuggestingPriorities(true);
        else setSuggestingModel(type === 'operating_model' ? 'operating' : 'collab');

        try {
            const currentValue = type === 'custom_goal' ? customGoal
                : type === 'priorities' ? userIntent
                : type === 'operating_model' ? designResult?.summary
                : designResult?.collaboration;

            const teamMembers = type === 'operating_model' || type === 'collaboration_model'
                ? designResult?.members?.filter((_, i) => !removedMembers.has(i)).map(m => m.name)
                : undefined;

            const res = await fetch('/api/ai/brains/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, currentValue: (currentValue || '').trim() || undefined, teamMembers }),
            });
            const data = await res.json();
            if (res.ok && data.suggestion) {
                if (type === 'custom_goal') setCustomGoal(data.suggestion);
                else if (type === 'priorities') setUserIntent(data.suggestion);
                else if (type === 'operating_model' && designResult) {
                    setDesignResult({ ...designResult, summary: data.suggestion });
                } else if (type === 'collaboration_model' && designResult) {
                    setDesignResult({ ...designResult, collaboration: data.suggestion });
                }
            } else {
                showToast(data.error || 'Could not generate suggestion', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }

        if (type === 'custom_goal') setSuggestingGoal(false);
        else if (type === 'priorities') setSuggestingPriorities(false);
        else setSuggestingModel(null);
    }

    // ─── Member Editing Helpers ─────────────────────────
    function updateMember(idx: number, field: string, value: string | string[]) {
        if (!designResult) return;
        const updated = { ...designResult };
        const members = [...updated.members];
        members[idx] = { ...members[idx], [field]: value };
        updated.members = members;
        setDesignResult(updated);
    }

    function removeMember(idx: number) {
        setRemovedMembers(prev => {
            const next = new Set(prev);
            next.add(idx);
            return next;
        });
        if (editingMemberIdx === idx) setEditingMemberIdx(null);
    }

    function restoreMember(idx: number) {
        setRemovedMembers(prev => {
            const next = new Set(prev);
            next.delete(idx);
            return next;
        });
    }

    // ─── Template Application ─────────────────────────
    function applyTemplate(template: TeamTemplate) {
        setDesignResult({
            summary: `Pre-built ${template.label} team with ${template.teamSize} specialized members optimized for ${template.description.toLowerCase()}`,
            collaboration: `Team members collaborate through structured handoffs: ${template.members.map(m => m.name).join(' → ')}.`,
            members: template.members,
        });
        setRemovedMembers(new Set());
        setEditingMemberIdx(null);
        setDesignerStep('review');
    }

    // ─── P2.6: Build collaboration diagram ─────────
    interface CollabEdge { from: number; to: number }
    interface CollabDiagramData {
        nodes: { name: string; type: string }[];
        edges: CollabEdge[];
        connectionsPerNode: Map<number, number[]>; // nodeIdx -> list of connected nodeIdxs
    }

    function buildCollaborationDiagram(members: TeamMemberProposal[]): CollabDiagramData | null {
        const activeMembers = members.filter((_, i) => !removedMembers.has(i));
        if (activeMembers.length < 2) return null;

        const nodes = activeMembers.map(m => ({ name: m.name, type: m.brainType }));

        // Build name lookup
        const nameToIdx = new Map<string, number>();
        activeMembers.forEach((m, i) => nameToIdx.set(m.name.toLowerCase(), i));

        // Extract edges from collaboration rules
        const edges: CollabEdge[] = [];
        const edgeSet = new Set<string>();

        activeMembers.forEach((m, fromIdx) => {
            for (const rule of m.collaborationRules || []) {
                const ruleLower = rule.toLowerCase();
                for (const [name, toIdx] of nameToIdx.entries()) {
                    if (toIdx === fromIdx) continue;
                    if (ruleLower.includes(name)) {
                        const key = `${Math.min(fromIdx, toIdx)}-${Math.max(fromIdx, toIdx)}`;
                        if (!edgeSet.has(key)) {
                            edgeSet.add(key);
                            edges.push({ from: fromIdx, to: toIdx });
                        }
                    }
                }
            }
        });

        // Fallback: chain
        if (edges.length === 0) {
            for (let i = 0; i < activeMembers.length - 1; i++) {
                edges.push({ from: i, to: i + 1 });
            }
        }

        // Build per-node connection map
        const connectionsPerNode = new Map<number, number[]>();
        for (let i = 0; i < nodes.length; i++) connectionsPerNode.set(i, []);
        for (const edge of edges) {
            connectionsPerNode.get(edge.from)!.push(edge.to);
            connectionsPerNode.get(edge.to)!.push(edge.from);
        }

        return { nodes, edges, connectionsPerNode };
    }

    // ─── Loading state ──────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                <div className="spinner" />
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────
    return (
        <div className="team-page">
            {/* ── Header ── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Users size={20} strokeWidth={2} /></span>
                    <h1>AI TEAM</h1>
                </div>
                <div className="assistant-page-workspace" style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={openDesigner} disabled={saving}>
                        <Sparkles size={14} /> Design My AI Team
                    </button>
                    {hasTeam && (
                        <>
                            <button className="btn btn-secondary" onClick={openTeamStructure} disabled={!companyBrain}>
                                <GitBranch size={14} /> Edit Structure
                            </button>
                            <button className="btn btn-secondary" onClick={analyzeTeam} disabled={isAnalyzing}>
                                {isAnalyzing ? <Loader size={14} /> : <TrendingUp size={14} />} Optimize Team
                            </button>
                        </>
                    )}
                    {companyBrain && (
                        <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
                            {publishing ? <Loader size={14} /> : <Rocket size={14} />} Publish All
                        </button>
                    )}
                </div>
            </div>

            {/* ── Company DNA Card ── */}
            {!companyBrain ? (
                <div className="team-dna-card team-dna-empty">
                    <div className="team-dna-icon"><Building2 size={32} strokeWidth={1.5} /></div>
                    <div className="team-dna-content">
                        <h2>COMPANY DNA</h2>
                        <p>Define the shared culture, tone, and guardrails that all team members inherit.</p>
                        <button className="btn btn-primary" onClick={createCompanyBrain} disabled={saving}>
                            {saving ? 'Creating…' : 'Create Company DNA'}
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className="team-dna-card"
                    onClick={() => router.push('/settings/ai-brain/company')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="team-dna-avatar">
                        {getBrainAvatarUrl(companyBrain) ? (
                            <img src={getBrainAvatarUrl(companyBrain)!} alt={getBrainDisplayName(companyBrain)} />
                        ) : (
                            <span className="team-avatar-fallback">
                                <Building2 size={24} strokeWidth={1.5} />
                            </span>
                        )}
                    </div>
                    <div className="team-dna-content">
                        <div className="team-dna-header">
                            <h2>{getBrainDisplayName(companyBrain)}</h2>
                            <div className={`team-status ${companyBrain.status === 'ACTIVE' ? 'active' : 'draft'}`}>
                                {companyBrain.status === 'ACTIVE' ? '● Active' : '◌ Draft'}
                            </div>
                            <button
                                className="team-identity-edit-btn"
                                title="Edit identity"
                                onClick={(e) => { e.stopPropagation(); openIdentityEditor(companyBrain); }}
                            >
                                <Camera size={14} />
                            </button>
                        </div>
                        {(companyBrain.configJson as any)?.identity?.displayName && (
                            <div className="team-dna-role">Company DNA</div>
                        )}
                        <p>{BRAIN_TYPE_DESCRIPTIONS.COMPANY}</p>
                        <div className="team-dna-meta">
                            {companyBrain.configJson?.identity?.tonePreset && (
                                <span className="team-meta-chip">
                                    {companyBrain.configJson.identity.tonePreset.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                </span>
                            )}
                            {companyBrain.configJson?.identity?.communicationStyle && (
                                <span className="team-meta-chip">
                                    {companyBrain.configJson.identity.communicationStyle.charAt(0).toUpperCase() + companyBrain.configJson.identity.communicationStyle.slice(1)}
                                </span>
                            )}
                            {(companyBrain.configJson?.identity?.personalityTraits || []).slice(0, 3).map((trait: string) => (
                                <span key={trait} className="trait-chip trait-chip-sm">{trait}</span>
                            ))}
                        </div>
                    </div>
                    <div className="team-dna-action">
                        <Settings size={16} /> Configure
                    </div>
                </div>
            )}

            {/* ── Team Analysis Panel ── */}
            {showAnalysis && (
                <div className="analysis-panel">
                    <div className="analysis-panel-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <TrendingUp size={18} />
                            <h3>TEAM ANALYSIS</h3>
                        </div>
                        <button className="slideover-close" onClick={() => setShowAnalysis(false)} style={{ width: 28, height: 28 }}>
                            <X size={14} />
                        </button>
                    </div>

                    {isAnalyzing ? (
                        <div className="analysis-loading">
                            <div className="spinner" style={{ width: 28, height: 28 }} />
                            <span>Analyzing your team composition…</span>
                        </div>
                    ) : analysisResult ? (
                        <>
                            {/* Score + Assessment */}
                            <div className="analysis-score-row">
                                <div className={`analysis-score-badge ${analysisResult.overallScore >= 7 ? 'score-good' : analysisResult.overallScore >= 5 ? 'score-ok' : 'score-weak'}`}>
                                    {analysisResult.overallScore}/10
                                </div>
                                <div className="analysis-assessment">{analysisResult.overallAssessment}</div>
                            </div>

                            {/* Strengths */}
                            {analysisResult.strengths?.length > 0 && (
                                <div className="analysis-strengths">
                                    <div className="analysis-section-label">✓ Strengths</div>
                                    <ul>
                                        {analysisResult.strengths.map((s, i) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Suggestions */}
                            {analysisResult.suggestions?.length > 0 && (
                                <div className="analysis-suggestions">
                                    <div className="analysis-section-label">Suggestions ({analysisResult.suggestions.length})</div>
                                    <div className="analysis-suggestions-grid">
                                        {analysisResult.suggestions.map((s: TeamSuggestion, i: number) => (
                                            <div key={i} className={`analysis-suggestion-card severity-${s.severity}`}>
                                                <div className="analysis-suggestion-header">
                                                    <span className={`analysis-severity-chip severity-${s.severity}`}>
                                                        {s.severity}
                                                    </span>
                                                    <span className="analysis-type-chip">
                                                        {s.type === 'add_role' ? 'Add Role'
                                                            : s.type === 'upgrade_config' ? 'Upgrade'
                                                            : s.type === 'collaboration_gap' ? 'Collaboration'
                                                            : 'General'}
                                                    </span>
                                                </div>
                                                <div className="analysis-suggestion-title">{s.title}</div>
                                                <div className="analysis-suggestion-desc">{s.description}</div>
                                                {s.type === 'add_role' && s.brainType && (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                                                        onClick={() => {
                                                            setShowAnalysis(false);
                                                            openDesigner();
                                                        }}
                                                    >
                                                        <ArrowRight size={12} /> {s.actionLabel}
                                                    </button>
                                                )}
                                                {s.type === 'upgrade_config' && s.targetBrain && (
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                                                        onClick={() => {
                                                            const brain = brains.find(b => b.name === s.targetBrain);
                                                            if (brain) router.push(`/settings/ai-brain/${brain.brainType.toLowerCase()}`);
                                                        }}
                                                    >
                                                        <Settings size={12} /> {s.actionLabel}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Re-analyze */}
                            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                <button className="btn-brain-secondary" onClick={analyzeTeam} disabled={isAnalyzing}>
                                    <RefreshCw size={12} /> Re-analyze
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
            )}

            {/* ── Team Members Grid ── */}
            <div className="team-section-label">
                <h3>TEAM MEMBERS</h3>
                <div className="team-add-dropdown">
                    <button className="btn btn-primary btn-sm" disabled={saving || !companyBrain}>
                        <Plus size={14} /> Add Member
                    </button>
                    <div className="team-add-menu">
                        <button
                            className="team-add-option team-add-custom"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <Pencil size={22} />
                            <span>Create Custom Member</span>
                        </button>
                    </div>
                </div>
            </div>

            {roleBrains.length === 0 ? (
                <div className="team-empty-members">
                    <Users size={32} strokeWidth={1} style={{ opacity: 0.3 }} />
                    <p>No team members yet. Use <strong>"Design My AI Team"</strong> to auto-generate a complete, company-aligned team — or add members manually.</p>
                    <button className="btn btn-primary" onClick={openDesigner} style={{ marginTop: 8 }}>
                        <Sparkles size={14} /> Design My AI Team
                    </button>
                </div>
            ) : (
                <div className="team-grid">
                    {roleBrains.map(brain => {
                        const assistantType = BRAIN_TYPE_TO_ASSISTANT_TYPE[brain.brainType] || brain.brainType;
                        const skills = skillCounts[assistantType] || 0;
                        const traits = brain.configJson?.identity?.personalityTraits || [];
                        const desc = BRAIN_TYPE_DESCRIPTIONS[brain.brainType as BrainType] || brain.description;
                        const displayName = getBrainDisplayName(brain);
                        const avatarUrl = getBrainAvatarUrl(brain);
                        const roleLabel = getBrainRoleLabel(brain);
                        const hasCustomName = !!(brain.configJson as any)?.identity?.displayName;
                        return (
                            <div
                                key={brain.id}
                                className="team-member-card"
                                onClick={() => router.push(`/settings/ai-brain/${brain.brainType.toLowerCase()}`)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="team-member-top">
                                    <div className="team-member-avatar">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt={displayName} />
                                        ) : (
                                            <span className="team-avatar-fallback">
                                                {getInitials(displayName)}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div className={`team-status ${brain.status === 'ACTIVE' ? 'active' : 'draft'}`}>
                                            {brain.status === 'ACTIVE' ? '● Active' : '◌ Draft'}
                                        </div>
                                        <button
                                            className="team-identity-edit-btn"
                                            title="Edit identity"
                                            onClick={(e) => { e.stopPropagation(); openIdentityEditor(brain); }}
                                        >
                                            <Camera size={14} />
                                        </button>
                                        <button
                                            className="team-member-delete-btn"
                                            title="Remove from team"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteBrain(brain); }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="team-member-name">
                                    {displayName}
                                </div>
                                {hasCustomName && (
                                    <div className="team-member-role">{roleLabel}</div>
                                )}
                                {desc && (
                                    <div className="team-member-desc">{desc}</div>
                                )}
                                <div className="team-member-traits">
                                    {traits.slice(0, 3).map(t => (
                                        <span key={t} className="trait-chip trait-chip-sm">{t}</span>
                                    ))}
                                    {traits.length === 0 && (
                                        <span className="team-member-no-traits">No personality set</span>
                                    )}
                                </div>
                                <div className="team-member-footer">
                                    <span className="team-member-stats">
                                        <Zap size={12} /> {skills} skill{skills !== 1 ? 's' : ''}
                                    </span>
                                    {traits.length > 0 && (
                                        <span className="team-member-stats">
                                            Personality set
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Create Custom Member Modal ── */}
            {showCreateModal && (
                <>
                    <div className="slideover-overlay" onClick={() => setShowCreateModal(false)} />
                    <div className="team-create-modal">
                        <div className="team-create-modal-header">
                            <h2><Pencil size={18} /> Create Custom Member</h2>
                            <button className="slideover-close" onClick={() => setShowCreateModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="team-create-modal-body">
                            {/* Avatar Upload */}
                            <div className="team-create-avatar-section">
                                <div className="team-avatar-preview">
                                    {customAvatarUrl ? (
                                        <img src={customAvatarUrl} alt="Avatar" />
                                    ) : (
                                        <span className="team-avatar-fallback-lg">
                                            <ImageIcon size={20} strokeWidth={1.5} />
                                        </span>
                                    )}
                                </div>
                                <div className="team-avatar-upload-actions">
                                    <h4>Profile Image</h4>
                                    <p>JPG, PNG, WebP — optional</p>
                                    <div className="team-avatar-upload-btns">
                                        <button className="team-avatar-upload-btn" onClick={() => createAvatarRef.current?.click()}>
                                            <Camera size={12} /> Upload
                                        </button>
                                        {customAvatarUrl && (
                                            <button className="team-avatar-upload-btn remove" onClick={() => setCustomAvatarUrl(null)}>
                                                <X size={12} /> Remove
                                            </button>
                                        )}
                                    </div>
                                    <input ref={createAvatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleIdentityFileChange(e, 'create')} />
                                </div>
                            </div>
                            <div className="brain-textarea-group">
                                <label>Member Role *</label>
                                <input
                                    type="text"
                                    className="team-create-input"
                                    value={customName}
                                    onChange={e => setCustomName(e.target.value)}
                                    placeholder="e.g. Content Strategist, Data Analyst..."
                                    autoFocus
                                />
                            </div>
                            <div className="brain-textarea-group">
                                <label>Display Name</label>
                                <input
                                    type="text"
                                    className="team-create-input"
                                    value={customDisplayName}
                                    onChange={e => setCustomDisplayName(e.target.value)}
                                    placeholder="e.g. John, Sarah — shown on the card"
                                />
                            </div>
                            <div className="brain-textarea-group">
                                <label>Description</label>
                                <textarea
                                    className="team-create-textarea"
                                    value={customDescription}
                                    onChange={e => setCustomDescription(e.target.value)}
                                    placeholder="What does this team member do? What are their responsibilities?"
                                    rows={3}
                                />
                            </div>
                            <div className="brain-textarea-group">
                                <label>Icon</label>
                                <div className="team-create-icon-grid">
                                    {Object.keys(ICON_MAP).map(iconName => (
                                        <button
                                            key={iconName}
                                            className={`team-create-icon-btn ${customIcon === iconName ? 'selected' : ''}`}
                                            onClick={() => setCustomIcon(iconName)}
                                            title={iconName}
                                        >
                                            {ICON_MAP[iconName]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="team-create-modal-footer">
                            <button className="btn-brain-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={createCustomBrain} disabled={saving || !customName.trim()}>
                                {saving ? <Loader size={14} /> : <Plus size={14} />} Create Member
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Edit Identity Modal ── */}
            {editingIdentityBrain && (
                <>
                    <div className="slideover-overlay" onClick={() => setEditingIdentityBrain(null)} />
                    <div className="team-identity-modal">
                        <div className="team-identity-modal-header">
                            <h2><Camera size={16} /> Edit Identity</h2>
                            <button className="slideover-close" onClick={() => setEditingIdentityBrain(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="team-identity-modal-body">
                            {/* Avatar Upload */}
                            <div className="team-avatar-upload">
                                <div className="team-avatar-preview">
                                    {identityAvatarUrl ? (
                                        <img src={identityAvatarUrl} alt="Avatar" />
                                    ) : (
                                        <span className="team-avatar-fallback-lg">
                                            {getInitials(identityDisplayName || getBrainRoleLabel(editingIdentityBrain))}
                                        </span>
                                    )}
                                </div>
                                <div className="team-avatar-upload-actions">
                                    <h4>Profile Photo</h4>
                                    <p>JPG, PNG, WebP — max 200×200</p>
                                    <div className="team-avatar-upload-btns">
                                        <button className="team-avatar-upload-btn" onClick={() => identityFileRef.current?.click()}>
                                            <Camera size={12} /> Change Photo
                                        </button>
                                        {identityAvatarUrl && (
                                            <button className="team-avatar-upload-btn remove" onClick={() => setIdentityAvatarUrl(null)}>
                                                <X size={12} /> Remove
                                            </button>
                                        )}
                                    </div>
                                    <input ref={identityFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleIdentityFileChange(e, 'identity')} />
                                </div>
                            </div>

                            {/* Display Name */}
                            <div className="team-identity-field">
                                <label>Display Name</label>
                                <input
                                    type="text"
                                    value={identityDisplayName}
                                    onChange={e => setIdentityDisplayName(e.target.value)}
                                    placeholder={getBrainRoleLabel(editingIdentityBrain)}
                                    autoFocus
                                />
                                <div className="field-hint">Custom name shown across the platform</div>
                            </div>

                            {/* Role Chip */}
                            <div className="team-identity-field">
                                <label>Role</label>
                                <div className="team-identity-role-chip">
                                    <Brain size={12} /> {getBrainRoleLabel(editingIdentityBrain)}
                                </div>
                            </div>
                        </div>
                        <div className="team-identity-modal-footer">
                            <button className="btn-brain-secondary" onClick={() => setEditingIdentityBrain(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveIdentity} disabled={savingIdentity}>
                                {savingIdentity ? <Loader size={14} /> : <Check size={14} />} Save Identity
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ═══════════════════════════════════════════════
                TEAM DESIGNER WIZARD MODAL
               ═══════════════════════════════════════════════ */}
            {showDesigner && (
                <div className="designer-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDesigner(); }}>
                    <div className="designer-modal">
                        {/* ── Header ── */}
                        <div className="designer-header">
                            <div className="designer-header-left">
                                <div className="designer-header-icon">
                                    <Sparkles size={20} />
                                </div>
                                <h2>AI Team Designer</h2>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                {designerStep !== 'profile-block' && designerStep !== 'generating' && (
                                    <span className="designer-step-indicator">
                                        {designerStep === 'goal' && 'Step 1 of 3'}
                                        {designerStep === 'size' && 'Step 2 of 3'}
                                        {designerStep === 'review' && 'Step 3 of 3'}
                                    </span>
                                )}
                                <button className="slideover-close" onClick={closeDesigner}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* ── Body ── */}
                        <div className="designer-body">
                            {/* ── Tab Switcher ── */}
                            {designerStep !== 'generating' && designerStep !== 'review' && designerStep !== 'profile-block' && (
                                <div className="designer-tab-bar">
                                    <button
                                        className={`designer-tab ${designerTab === 'wizard' ? 'active' : ''}`}
                                        onClick={() => setDesignerTab('wizard')}
                                    >
                                        <Sparkles size={13} /> AI Designer
                                    </button>
                                    <button
                                        className={`designer-tab ${designerTab === 'templates' ? 'active' : ''}`}
                                        onClick={() => setDesignerTab('templates')}
                                    >
                                        <Package size={13} /> Quick Templates
                                    </button>
                                </div>
                            )}

                            {/* ═══ Templates Tab ═══ */}
                            {designerTab === 'templates' && designerStep !== 'generating' && designerStep !== 'review' && designerStep !== 'profile-block' && (
                                <>
                                    <h3 className="designer-step-title">Choose a team template</h3>
                                    <p className="designer-step-desc">
                                        Pre-built team configurations for common business types. Click one to preview — you can edit before creating.
                                    </p>
                                    <div className="designer-templates-grid">
                                        {TEAM_TEMPLATES.map(template => (
                                            <button
                                                key={template.key}
                                                className="designer-template-card"
                                                onClick={() => applyTemplate(template)}
                                            >
                                                <div className="designer-template-icon">
                                                    {renderIcon(template.icon)}
                                                </div>
                                                <div className="designer-template-label">{template.label}</div>
                                                <div className="designer-template-desc">{template.description}</div>
                                                <div className="designer-template-size">{template.teamSize} members</div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* ═══ Wizard Tab ═══ */}
                            {designerTab === 'wizard' && (
                            <>
                            {/* ── Profile Block ── */}
                            {designerStep === 'profile-block' && (
                                <div className="designer-profile-warning">
                                    <div className="designer-profile-warning-icon">
                                        <AlertTriangle size={28} />
                                    </div>
                                    <h3>Company Profile Needed</h3>
                                    <p>
                                        Your Company Profile is only <strong>{profileScore}%</strong> complete.
                                        The AI Team Designer needs at least your company description, industry,
                                        and goals to generate a meaningful team.
                                    </p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => router.push('/settings/company-profile')}
                                    >
                                        Complete Profile →
                                    </button>
                                </div>
                            )}

                            {/* ── Step 1: Goal ── */}
                            {designerStep === 'goal' && (
                                <>
                                    {profileScore !== null && profileScore < PROFILE_WARN_THRESHOLD && profileScore >= PROFILE_MIN_THRESHOLD && (
                                        <div className="designer-profile-hint">
                                            <AlertTriangle size={14} />
                                            Better profile = better team. <a href="/settings/company-profile">Improve your profile</a> for more accurate results.
                                        </div>
                                    )}
                                    <h3 className="designer-step-title">What&apos;s your primary goal?</h3>
                                    <p className="designer-step-desc">
                                        This shapes the team composition. You&apos;ll get specialists aligned with this orientation.
                                    </p>
                                    <div className="designer-goal-grid">
                                        {TEAM_GOAL_OPTIONS.map(opt => (
                                            <button
                                                key={opt.key}
                                                className={`designer-goal-card ${selectedGoal === opt.key && !isCustomGoal ? 'selected' : ''}`}
                                                onClick={() => { setSelectedGoal(opt.key); setIsCustomGoal(false); }}
                                            >
                                                <div className="designer-goal-icon">
                                                    {renderIcon(opt.icon)}
                                                </div>
                                                <div className="designer-goal-label">{opt.label}</div>
                                                <div className="designer-goal-desc">{opt.description}</div>
                                            </button>
                                        ))}
                                        <button
                                            className={`designer-goal-card ${isCustomGoal ? 'selected' : ''}`}
                                            onClick={() => { setIsCustomGoal(true); setSelectedGoal(null); }}
                                        >
                                            <div className="designer-goal-icon">
                                                <Plus size={22} />
                                            </div>
                                            <div className="designer-goal-label">Custom</div>
                                            <div className="designer-goal-desc">Define your own goal</div>
                                        </button>
                                    </div>
                                    {isCustomGoal && (
                                        <div style={{ marginTop: -16, marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <label className="designer-intent-label" style={{ margin: 0 }}>Describe your custom goal</label>
                                                <button
                                                    className="btn-brain-secondary"
                                                    style={{ padding: '4px 12px', fontSize: 11 }}
                                                    onClick={() => askAiSuggestion('custom_goal')}
                                                    disabled={suggestingGoal}
                                                >
                                                    {suggestingGoal ? <Loader size={12} /> : <Wand2 size={12} />}
                                                    {suggestingGoal ? 'Thinking…' : 'Ask Company DNA'}
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                className="designer-intent-input"
                                                value={customGoal}
                                                onChange={e => setCustomGoal(e.target.value)}
                                                placeholder='e.g. "Build an investor relations team", "Support multilingual customer service"...'
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Step 2: Size & Intent ── */}
                            {designerStep === 'size' && (
                                <>
                                    <h3 className="designer-step-title">Team size &amp; priorities</h3>
                                    <p className="designer-step-desc">
                                        Choose your team size and optionally describe any specific priorities.
                                    </p>
                                    <div className="designer-size-grid">
                                        {(Object.keys(TEAM_SIZE_RANGES) as TeamSize[]).map(size => (
                                            <button
                                                key={size}
                                                className={`designer-size-card ${selectedSize === size ? 'selected' : ''}`}
                                                onClick={() => setSelectedSize(size)}
                                            >
                                                <div className="designer-size-label">{size}</div>
                                                <div className="designer-size-range">
                                                    {TEAM_SIZE_RANGES[size].min}–{TEAM_SIZE_RANGES[size].max} members
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <label className="designer-intent-label" style={{ margin: 0 }}>Any specific priorities? (optional)</label>
                                            <button
                                                className="btn-brain-secondary"
                                                style={{ padding: '4px 12px', fontSize: 11 }}
                                                onClick={() => askAiSuggestion('priorities')}
                                                disabled={suggestingPriorities}
                                            >
                                                {suggestingPriorities ? <Loader size={12} /> : <Wand2 size={12} />}
                                                {suggestingPriorities ? 'Thinking…' : 'Ask Company DNA'}
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            className="designer-intent-input"
                                            value={userIntent}
                                            onChange={e => setUserIntent(e.target.value)}
                                            placeholder='e.g. "Focus on B2B SaaS sales", "Need strong content creation"...'
                                        />
                                    </div>
                                </>
                            )}

                            {/* ── Generating ── */}
                            {designerStep === 'generating' && (
                                <div className="designer-loading">
                                    <div className="spinner" style={{ width: 32, height: 32 }} />
                                    <div className="designer-loading-text">Designing your AI team…</div>
                                    <div className="designer-loading-sub">
                                        Analyzing your company profile, industry, and goals to build a coherent team structure.
                                    </div>
                                </div>
                            )}

                            {/* ── Step 3: Review ── */}
                            {designerStep === 'review' && designResult && (
                                <>
                                    {/* Team Summary — Editable */}
                                    <div className="designer-summary-card">
                                        <div className="designer-model-header">
                                            <h3>Team Operating Model</h3>
                                            <div className="designer-model-actions">
                                                <button
                                                    className="btn-brain-secondary"
                                                    style={{ padding: '4px 10px', fontSize: 10 }}
                                                    onClick={() => askAiSuggestion('operating_model')}
                                                    disabled={suggestingModel === 'operating'}
                                                >
                                                    {suggestingModel === 'operating' ? <Loader size={10} /> : <Wand2 size={10} />}
                                                    {suggestingModel === 'operating' ? 'Thinking…' : 'Ask DNA'}
                                                </button>
                                                <button
                                                    className="btn-brain-secondary"
                                                    style={{ padding: '4px 10px', fontSize: 10 }}
                                                    onClick={() => setEditingSummary(v => !v)}
                                                >
                                                    <Pencil size={10} />
                                                    {editingSummary ? 'Done' : 'Edit'}
                                                </button>
                                            </div>
                                        </div>
                                        {editingSummary ? (
                                            <textarea
                                                className="designer-model-textarea"
                                                value={designResult.summary}
                                                onChange={e => setDesignResult({ ...designResult, summary: e.target.value })}
                                                rows={4}
                                            />
                                        ) : (
                                            <p>{designResult.summary}</p>
                                        )}
                                    </div>

                                    {/* Collaboration Model — Editable */}
                                    <div className="designer-collab-card">
                                        <div className="designer-model-header">
                                            <h3>Collaboration Model</h3>
                                            <div className="designer-model-actions">
                                                <button
                                                    className="btn-brain-secondary"
                                                    style={{ padding: '4px 10px', fontSize: 10 }}
                                                    onClick={() => askAiSuggestion('collaboration_model')}
                                                    disabled={suggestingModel === 'collab'}
                                                >
                                                    {suggestingModel === 'collab' ? <Loader size={10} /> : <Wand2 size={10} />}
                                                    {suggestingModel === 'collab' ? 'Thinking…' : 'Ask DNA'}
                                                </button>
                                                <button
                                                    className="btn-brain-secondary"
                                                    style={{ padding: '4px 10px', fontSize: 10 }}
                                                    onClick={() => setEditingCollab(v => !v)}
                                                >
                                                    <Pencil size={10} />
                                                    {editingCollab ? 'Done' : 'Edit'}
                                                </button>
                                            </div>
                                        </div>
                                        {editingCollab ? (
                                            <textarea
                                                className="designer-model-textarea"
                                                value={designResult.collaboration || ''}
                                                onChange={e => setDesignResult({ ...designResult, collaboration: e.target.value })}
                                                rows={4}
                                            />
                                        ) : (
                                            <p>{designResult.collaboration || 'No collaboration model defined. Click Edit or Ask DNA to create one.'}</p>
                                        )}
                                    </div>

                                    {/* P2.6: Collaboration Diagram */}
                                    {(() => {
                                        const diagram = buildCollaborationDiagram(designResult.members);
                                        if (!diagram) return null;
                                        return (
                                            <div className="designer-diagram-card">
                                                <button
                                                    className="designer-diagram-toggle"
                                                    onClick={() => setShowCollabDiagram(v => !v)}
                                                >
                                                    <GitBranch size={14} />
                                                    <span>Collaboration Flow ({diagram.edges.length} connections)</span>
                                                    {showCollabDiagram ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                {showCollabDiagram && (
                                                    <div className="collab-flow-visual">
                                                        {/* Company DNA parent node */}
                                                        <div className="collab-flow-dna-row">
                                                            <div className="collab-flow-node collab-flow-node--dna">
                                                                <span className="collab-flow-node-icon">🧠</span>
                                                                <span className="collab-flow-node-name">Company DNA</span>
                                                            </div>
                                                        </div>
                                                        {/* Inheritance arrow */}
                                                        <div className="collab-flow-inherit-arrow">
                                                            <svg width="2" height="24" viewBox="0 0 2 24">
                                                                <line x1="1" y1="0" x2="1" y2="16" stroke="#0f172a" strokeWidth="2" strokeDasharray="4 3" />
                                                                <polygon points="-3,16 5,16 1,24" fill="#0f172a" />
                                                            </svg>
                                                            <span className="collab-flow-inherit-label">inherits</span>
                                                        </div>
                                                        {/* Team member cards with connections inside */}
                                                        <div className="collab-flow-members">
                                                            {diagram.nodes.map((node, i) => {
                                                                const connections = diagram.connectionsPerNode.get(i) || [];
                                                                return (
                                                                    <div key={i} className="collab-flow-member-card">
                                                                        <div className="collab-flow-member-header">
                                                                            <span className="collab-flow-member-name">{node.name}</span>
                                                                            <span className="collab-flow-member-type">{node.type.replace(/_/g, ' ')}</span>
                                                                        </div>
                                                                        {connections.length > 0 && (
                                                                            <div className="collab-flow-member-connections">
                                                                                <span className="collab-flow-conn-label">Collaborates with</span>
                                                                                <div className="collab-flow-conn-tags">
                                                                                    {connections.map((connIdx, ci) => (
                                                                                        <span key={ci} className="collab-flow-conn-tag">
                                                                                            <ArrowRight size={9} />
                                                                                            {diagram.nodes[connIdx]?.name}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Members */}
                                    <div className="designer-members-label">
                                        Team Members ({designResult.members.filter((_, i) => !removedMembers.has(i)).length} of {designResult.members.length})
                                    </div>
                                    <div className="designer-members-grid">
                                        {designResult.members.map((member: TeamMemberProposal, idx: number) => {
                                            const isRemoved = removedMembers.has(idx);
                                            const isEditing = editingMemberIdx === idx;
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`designer-member-card ${isRemoved ? 'designer-member-removed' : ''}`}
                                                    style={isRemoved ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
                                                >
                                                    <div className="designer-member-header">
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                className="designer-intent-input"
                                                                style={{ fontSize: 14, fontWeight: 800, padding: '4px 8px' }}
                                                                value={member.name}
                                                                onChange={e => updateMember(idx, 'name', e.target.value)}
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                        ) : (
                                                            <div
                                                                className="designer-member-name"
                                                                style={{ cursor: 'pointer' }}
                                                                onClick={() => setEditingMemberIdx(idx)}
                                                                title="Click to edit"
                                                            >
                                                                {member.name}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span className="designer-member-type">{member.brainType.replace(/^CUSTOM_/, '').replace(/_/g, ' ')}</span>
                                                            {!isRemoved && (
                                                                <button
                                                                    className="slideover-close"
                                                                    style={{ width: 24, height: 24, pointerEvents: 'auto' }}
                                                                    title="Remove from team"
                                                                    onClick={(e) => { e.stopPropagation(); removeMember(idx); }}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isEditing ? (
                                                        <textarea
                                                            className="designer-intent-input"
                                                            style={{ fontSize: 12, fontStyle: 'italic', padding: '6px 8px', minHeight: 48, resize: 'vertical' }}
                                                            value={member.mission}
                                                            onChange={e => updateMember(idx, 'mission', e.target.value)}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="designer-member-mission"
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => setEditingMemberIdx(idx)}
                                                            title="Click to edit"
                                                        >
                                                            &ldquo;{member.mission}&rdquo;
                                                        </div>
                                                    )}

                                                    <div className="designer-member-section-label">
                                                        Responsibilities
                                                        {isEditing && <span style={{ fontWeight: 400, marginLeft: 6 }}>(one per line)</span>}
                                                    </div>
                                                    {isEditing ? (
                                                        <textarea
                                                            className="designer-intent-input"
                                                            style={{ fontSize: 12, padding: '6px 8px', minHeight: 80, resize: 'vertical' }}
                                                            value={member.responsibilities.join('\n')}
                                                            onChange={e => updateMember(idx, 'responsibilities', e.target.value.split('\n'))}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <ol className="designer-member-list" onClick={() => setEditingMemberIdx(idx)} style={{ cursor: 'pointer' }} title="Click to edit">
                                                            {member.responsibilities.map((r, i) => (
                                                                <li key={i}>{r}</li>
                                                            ))}
                                                        </ol>
                                                    )}

                                                    {member.personalityTraits.length > 0 && (
                                                        <>
                                                            <div className="designer-member-section-label">Personality</div>
                                                            <div className="designer-member-traits">
                                                                {member.personalityTraits.map(t => (
                                                                    <span key={t} className="trait-chip trait-chip-sm">{t}</span>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}

                                                    {member.collaborationRules.length > 0 && (
                                                        <div className="designer-member-collab">
                                                            <div className="designer-member-section-label">Collaboration</div>
                                                            <ul className="designer-member-collab-list">
                                                                {member.collaborationRules.map((r, i) => (
                                                                    <li key={i}>{r}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {isEditing && (
                                                        <button
                                                            className="btn-brain-secondary"
                                                            style={{ padding: '4px 12px', fontSize: 11, alignSelf: 'flex-end', marginTop: 4 }}
                                                            onClick={() => setEditingMemberIdx(null)}
                                                        >
                                                            <Check size={12} /> Done
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Restore removed members */}
                                    {removedMembers.size > 0 && (
                                        <div style={{ marginTop: -8, marginBottom: 16 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #888)', marginRight: 8 }}>
                                                REMOVED ({removedMembers.size}):
                                            </span>
                                            {Array.from(removedMembers).map(idx => (
                                                <button
                                                    key={idx}
                                                    className="btn-brain-secondary"
                                                    style={{ padding: '2px 10px', fontSize: 10, marginRight: 6 }}
                                                    onClick={() => restoreMember(idx)}
                                                >
                                                    <RefreshCw size={10} /> Restore {designResult.members[idx]?.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                            {/* close wizard tab wrapper */}
                            </>
                            )}
                        </div>

                        {/* ── Footer ── */}
                        {designerStep !== 'profile-block' && designerStep !== 'generating' && (
                            <div className="designer-footer">
                                <div className="designer-footer-left">
                                    {designerStep === 'size' && (
                                        <button className="btn-brain-secondary" onClick={() => setDesignerStep('goal')}>
                                            ← Back
                                        </button>
                                    )}
                                    {designerStep === 'review' && (
                                        <button className="btn-brain-secondary" onClick={() => startGeneration()} disabled={isGenerating}>
                                            <RefreshCw size={13} /> Regenerate
                                        </button>
                                    )}
                                </div>
                                <div className="designer-footer-right">
                                    <button className="btn-brain-secondary" onClick={closeDesigner}>
                                        Cancel
                                    </button>

                                    {designerStep === 'goal' && (
                                        <button
                                            className="btn btn-primary"
                                            disabled={!selectedGoal && !(isCustomGoal && customGoal.trim())}
                                            onClick={() => setDesignerStep('size')}
                                        >
                                            Next →
                                        </button>
                                    )}

                                    {designerStep === 'size' && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={startGeneration}
                                        >
                                            <Sparkles size={14} /> Generate Team
                                        </button>
                                    )}

                                    {designerStep === 'review' && (
                                        <>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => createTeam(false)}
                                                disabled={isCreating}
                                            >
                                                {isCreating ? <Loader size={14} /> : <Check size={14} />}
                                                Create as Draft
                                            </button>
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => createTeam(true)}
                                                disabled={isCreating}
                                            >
                                                {isCreating ? <Loader size={14} /> : <Rocket size={14} />}
                                                Create &amp; Publish
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* ── Team Structure Modal ── */}
            {showTeamStructure && (
                <div className="modal-backdrop" onClick={() => setShowTeamStructure(false)}>
                    <div className="team-structure-modal" onClick={e => e.stopPropagation()}>
                        <div className="team-structure-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <GitBranch size={18} />
                                <h3>TEAM STRUCTURE & COLLABORATION</h3>
                            </div>
                            <button className="slideover-close" onClick={() => setShowTeamStructure(false)} style={{ width: 28, height: 28 }}>
                                <X size={14} />
                            </button>
                        </div>

                        {teamStructureLoading ? (
                            <div className="analysis-loading">
                                <div className="spinner" style={{ width: 28, height: 28 }} />
                                <span>Loading team structure…</span>
                            </div>
                        ) : (
                            <div className="team-structure-modal-body">
                                {/* ── Operating Model ── */}
                                <div className="team-structure-field">
                                    <div className="team-structure-field-header">
                                        <label className="team-structure-label">Team Operating Model</label>
                                        <button
                                            className="btn-brain-secondary"
                                            style={{ padding: '4px 10px', fontSize: 10 }}
                                            onClick={() => askStructureSuggestion('operating')}
                                            disabled={suggestingStructure === 'operating'}
                                        >
                                            {suggestingStructure === 'operating' ? <Loader size={10} /> : <Wand2 size={10} />}
                                            {suggestingStructure === 'operating' ? 'Thinking…' : 'Ask DNA'}
                                        </button>
                                    </div>
                                    <textarea
                                        className="designer-model-textarea"
                                        value={teamStructure.operatingModel}
                                        onChange={e => setTeamStructure(prev => ({ ...prev, operatingModel: e.target.value }))}
                                        rows={4}
                                        placeholder="Describe how your AI team operates: methodology, value delivery, approach…"
                                    />
                                </div>

                                {/* ── Collaboration Model ── */}
                                <div className="team-structure-field">
                                    <div className="team-structure-field-header">
                                        <label className="team-structure-label">Collaboration Model</label>
                                        <button
                                            className="btn-brain-secondary"
                                            style={{ padding: '4px 10px', fontSize: 10 }}
                                            onClick={() => askStructureSuggestion('collab')}
                                            disabled={suggestingStructure === 'collab'}
                                        >
                                            {suggestingStructure === 'collab' ? <Loader size={10} /> : <Wand2 size={10} />}
                                            {suggestingStructure === 'collab' ? 'Thinking…' : 'Ask DNA'}
                                        </button>
                                    </div>
                                    <textarea
                                        className="designer-model-textarea"
                                        value={teamStructure.collaborationModel}
                                        onChange={e => setTeamStructure(prev => ({ ...prev, collaborationModel: e.target.value }))}
                                        rows={4}
                                        placeholder="Describe how team members collaborate: handoffs, escalation, feedback loops…"
                                    />
                                </div>

                                {/* ── Collaboration Diagram (live team) ── */}
                                {roleBrains.length >= 2 && (() => {
                                    // Build diagram from live roleBrains
                                    const nodes = roleBrains.map(b => ({ name: b.name, type: b.brainType }));
                                    const nameToIdx = new Map<string, number>();
                                    roleBrains.forEach((b, i) => nameToIdx.set(b.name.toLowerCase(), i));

                                    // Build edges: every brain connects to all others (full mesh for live team)
                                    const edges: { from: number; to: number }[] = [];
                                    for (let i = 0; i < nodes.length; i++) {
                                        for (let j = i + 1; j < nodes.length; j++) {
                                            edges.push({ from: i, to: j });
                                        }
                                    }

                                    const connectionsPerNode = new Map<number, number[]>();
                                    for (let i = 0; i < nodes.length; i++) connectionsPerNode.set(i, []);
                                    for (const edge of edges) {
                                        connectionsPerNode.get(edge.from)!.push(edge.to);
                                        connectionsPerNode.get(edge.to)!.push(edge.from);
                                    }

                                    return (
                                        <div className="designer-diagram-card">
                                            <button
                                                className="designer-diagram-toggle"
                                                onClick={() => setShowStructureDiagram(v => !v)}
                                            >
                                                <GitBranch size={14} />
                                                <span>Collaboration Flow ({edges.length} connections)</span>
                                                {showStructureDiagram ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                            {showStructureDiagram && (
                                                <div className="collab-flow-visual">
                                                    {/* Company DNA parent node */}
                                                    <div className="collab-flow-dna-row">
                                                        <div className="collab-flow-node collab-flow-node--dna">
                                                            <span className="collab-flow-node-icon">🧠</span>
                                                            <span className="collab-flow-node-name">Company DNA</span>
                                                        </div>
                                                    </div>
                                                    {/* Inheritance arrow */}
                                                    <div className="collab-flow-inherit-arrow">
                                                        <svg width="2" height="24" viewBox="0 0 2 24">
                                                            <line x1="1" y1="0" x2="1" y2="16" stroke="#0f172a" strokeWidth="2" strokeDasharray="4 3" />
                                                            <polygon points="-3,16 5,16 1,24" fill="#0f172a" />
                                                        </svg>
                                                        <span className="collab-flow-inherit-label">inherits</span>
                                                    </div>
                                                    {/* Team member cards */}
                                                    <div className="collab-flow-members">
                                                        {nodes.map((node, i) => {
                                                            const connections = connectionsPerNode.get(i) || [];
                                                            return (
                                                                <div key={i} className="collab-flow-member-card">
                                                                    <div className="collab-flow-member-header">
                                                                        <span className="collab-flow-member-name">{node.name}</span>
                                                                        <span className="collab-flow-member-type">{node.type.replace(/_/g, ' ')}</span>
                                                                    </div>
                                                                    {connections.length > 0 && (
                                                                        <div className="collab-flow-member-connections">
                                                                            <span className="collab-flow-conn-label">Collaborates with</span>
                                                                            <div className="collab-flow-conn-tags">
                                                                                {connections.map((connIdx, ci) => (
                                                                                    <span key={ci} className="collab-flow-conn-tag">
                                                                                        <ArrowRight size={9} />
                                                                                        {nodes[connIdx]?.name}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ── Save ── */}
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
                                    <button className="btn btn-secondary" onClick={() => setShowTeamStructure(false)}>
                                        Cancel
                                    </button>
                                    <button className="btn btn-primary" onClick={saveTeamStructure} disabled={savingStructure}>
                                        {savingStructure ? <Loader size={14} /> : <Check size={14} />}
                                        {savingStructure ? 'Saving…' : 'Save Structure'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
