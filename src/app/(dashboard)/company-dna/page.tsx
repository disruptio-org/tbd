'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Dna, Sparkles, Target, Cpu, Building, Building2, FolderOpen, Zap, X, FileText, ArrowRight, Check, Loader2, Circle, Search, ChevronRight, RefreshCw, AlertTriangle, TrendingUp, Upload, BookOpen, Lightbulb, ShieldAlert, Pencil, Trash2, Plus, Shield } from 'lucide-react';
import './company-dna.css';

/* ─── Types ───────────────────────────────────────────── */

interface ResourceItem {
    id: string;
    name: string;
    description: string;
    icon: string;
    nodeTypes: string[];
    nodeCount: number;
    isDefault?: boolean;
}

interface NodeItem {
    id: string;
    type: string;
    title: string;
    content: Record<string, unknown>;
    summary: string | null;
    confidenceScore: number;
    sourceDocumentIds: string[];
    status: string;
    updatedAt: string;
}

interface NodeDetail extends NodeItem {
    edges: {
        id: string;
        direction: 'outgoing' | 'incoming';
        relationType: string;
        strength: number;
        node: { id: string; title: string; type: string };
    }[];
    sourceDocs: { id: string; filename: string; source: string }[];
}

interface ProcessEvent {
    step: string;
    document?: string;
    detail?: string;
    totalProcessed?: number;
    totalEntities?: number;
    totalRelationships?: number;
    coverageScore?: number;
}

interface DNAOverview {
    coverageScore: number;
    nodeCount: number;
    nodesByType: Record<string, number>;
}

interface ScopeCustomer {
    id: string;
    name: string;
}

interface ScopeProject {
    id: string;
    name: string;
    customerId: string | null;
}

/* ─── Helpers ─────────────────────────────────────────── */

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
    product: { bg: '#dbeafe', text: '#1e40af', border: '#1e40af', label: 'Products & Features' },
    persona: { bg: '#fce7f3', text: '#9d174d', border: '#9d174d', label: 'Target Personas' },
    process: { bg: '#d1fae5', text: '#065f46', border: '#065f46', label: 'Processes & Workflows' },
    competitor: { bg: '#fee2e2', text: '#991b1b', border: '#991b1b', label: 'Competitors' },
    messaging: { bg: '#ede9fe', text: '#5b21b6', border: '#5b21b6', label: 'Messaging & Brand' },
    policy: { bg: '#fef3c7', text: '#92400e', border: '#92400e', label: 'Policies & Standards' },
    case_study: { bg: '#ccfbf1', text: '#115e59', border: '#115e59', label: 'Case Studies & Outcomes' },
    market: { bg: '#e0e7ff', text: '#3730a3', border: '#3730a3', label: 'Market & Industry' },
    pricing: { bg: '#fce7f3', text: '#831843', border: '#831843', label: 'Pricing & Packaging' },
    content_strategy: { bg: '#f5f3ff', text: '#6d28d9', border: '#6d28d9', label: 'Content Strategy' },
    metric: { bg: '#ecfdf5', text: '#047857', border: '#047857', label: 'Metrics & KPIs' },
    methodology: { bg: '#fff7ed', text: '#c2410c', border: '#c2410c', label: 'Methodologies & Frameworks' },
    integration: { bg: '#f0f9ff', text: '#0369a1', border: '#0369a1', label: 'Tools & Integrations' },
};

/* ─── Insight Types ───────────────────────────────────── */

const EXPECTED_TYPES = ['product', 'persona', 'process', 'competitor', 'messaging', 'policy', 'case_study', 'market', 'pricing', 'content_strategy', 'metric', 'methodology', 'integration'];

const ICON_OPTIONS = [
    { value: 'folder', label: 'Folder', icon: <FolderOpen size={16} /> },
    { value: 'building', label: 'Building', icon: <Building size={16} /> },
    { value: 'target', label: 'Target', icon: <Target size={16} /> },
    { value: 'cpu', label: 'CPU', icon: <Cpu size={16} /> },
    { value: 'zap', label: 'Zap', icon: <Zap size={16} /> },
    { value: 'book-open', label: 'Book', icon: <BookOpen size={16} /> },
    { value: 'shield', label: 'Shield', icon: <Shield size={16} /> },
    { value: 'file-text', label: 'File', icon: <FileText size={16} /> },
    { value: 'dna', label: 'DNA', icon: <Dna size={16} /> },
    { value: 'sparkles', label: 'Sparkles', icon: <Sparkles size={16} /> },
];

function getResourceIcon(icon: string, size = 18) {
    switch (icon) {
        case 'folder': return <FolderOpen size={size} />;
        case 'building': return <Building size={size} />;
        case 'target': return <Target size={size} />;
        case 'cpu': return <Cpu size={size} />;
        case 'zap': return <Zap size={size} />;
        case 'book-open': return <BookOpen size={size} />;
        case 'shield': return <Shield size={size} />;
        case 'file-text': return <FileText size={size} />;
        case 'dna': return <Dna size={size} />;
        case 'sparkles': return <Sparkles size={size} />;
        default: return <FolderOpen size={size} />;
    }
}

interface Insight {
    id: string;
    severity: 'critical' | 'warning' | 'tip';
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: { label: string; href?: string; onClick?: () => void };
}

/* ─── Main Component ──────────────────────────────────── */

export default function CompanyDNAPage() {
    const [overview, setOverview] = useState<DNAOverview | null>(null);
    const [resources, setResources] = useState<ResourceItem[]>([]);
    const [nodes, setNodes] = useState<NodeItem[]>([]);
    const [activeType, setActiveType] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
    const [processing, setProcessing] = useState(false);
    const [processEvents, setProcessEvents] = useState<ProcessEvent[]>([]);
    const [processResult, setProcessResult] = useState<ProcessEvent | null>(null);
    const [loading, setLoading] = useState(true);

    // Scope state
    const [scope, setScope] = useState<'company' | 'customer' | 'project'>('company');
    const [scopeCustomers, setScopeCustomers] = useState<ScopeCustomer[]>([]);
    const [scopeProjects, setScopeProjects] = useState<ScopeProject[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    // Upload modal state
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadGapLabel, setUploadGapLabel] = useState('');
    const [uploadDragOver, setUploadDragOver] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<{ name: string; status: 'uploading' | 'ocr' | 'done' | 'error'; progress: number }[]>([]);
    const [uploading, setUploading] = useState(false);
    const uploadFileRef = useRef<HTMLInputElement>(null);

    // Resource modal state
    const [resourceModalOpen, setResourceModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
    const [resName, setResName] = useState('');
    const [resDescription, setResDescription] = useState('');
    const [resIcon, setResIcon] = useState('folder');
    const [resNodeTypes, setResNodeTypes] = useState<string[]>([]);
    const [resSaving, setResSaving] = useState(false);

    /* ─── Data Loading ────────────────────────────────── */

    const loadData = useCallback(async () => {
        try {
            // Build scope query params
            const params = new URLSearchParams();
            if (scope === 'company') params.set('scope', 'company');
            else if (scope === 'customer' && selectedCustomerId) {
                params.set('scope', 'customer');
                params.set('customerId', selectedCustomerId);
            }
            else if (scope === 'project' && selectedProjectId) {
                params.set('scope', 'project');
                params.set('projectId', selectedProjectId);
            }
            const qs = params.toString() ? `?${params.toString()}` : '';

            const [ovRes, resRes, nodeRes] = await Promise.all([
                fetch(`/api/dna${qs}`),
                fetch(`/api/dna/resources${qs}`),
                fetch(`/api/dna/nodes${qs}`),
            ]);
            if (ovRes.ok) setOverview(await ovRes.json());
            if (resRes.ok) setResources(await resRes.json());
            if (nodeRes.ok) setNodes(await nodeRes.json());
        } catch (err) {
            console.error('[dna] Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }, [scope, selectedCustomerId, selectedProjectId]);

    useEffect(() => { loadData(); }, [loadData]);

    // Load customers and projects for scope dropdowns
    useEffect(() => {
        (async () => {
            try {
                const [custRes, projRes] = await Promise.all([
                    fetch('/api/customers'),
                    fetch('/api/projects'),
                ]);
                if (custRes.ok) setScopeCustomers(await custRes.json());
                if (projRes.ok) {
                    const data = await projRes.json();
                    setScopeProjects(data.projects || data || []);
                }
            } catch (err) {
                console.error('[dna] Failed to load scope data:', err);
            }
        })();
    }, []);

    /* ─── Filter & Search ─────────────────────────────── */

    const filteredNodes = nodes.filter(n => {
        if (activeType && n.type !== activeType) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return n.title.toLowerCase().includes(q) ||
                n.type.toLowerCase().includes(q) ||
                (n.summary || '').toLowerCase().includes(q);
        }
        return true;
    });

    /* ─── Unique types from data ──────────────────────── */

    const nodeTypes = Object.entries(overview?.nodesByType || {})
        .sort(([, a], [, b]) => b - a);

    /* ─── Compute Insights ────────────────────────────── */

    // Resolve scope label for context-aware messaging
    const scopeLabel = useMemo(() => {
        if (scope === 'customer' && selectedCustomerId) {
            const c = scopeCustomers.find(c => c.id === selectedCustomerId);
            return c ? c.name : 'this customer';
        }
        if (scope === 'project' && selectedProjectId) {
            const p = scopeProjects.find(p => p.id === selectedProjectId);
            return p ? p.name : 'this project';
        }
        return 'your company';
    }, [scope, selectedCustomerId, selectedProjectId, scopeCustomers, scopeProjects]);

    const scopedCustomerUrl = useMemo(() => {
        if (scope === 'customer' && selectedCustomerId) return `/customers/${selectedCustomerId}`;
        return null;
    }, [scope, selectedCustomerId]);

    // Per-category gap metadata for actionable recommendations
    const CATEGORY_GAP_INFO: Record<string, {
        label: string;
        gap: string;
        suggestion: string;
        action: { label: string; href?: string; onClick?: () => void };
    }> = {
        product: {
            label: 'Products & Features',
            gap: 'No product or feature knowledge',
            suggestion: `Upload product specifications, feature lists, or solution overviews for ${scopeLabel} so the AI can answer product-related questions accurately.`,
            action: { label: 'Upload Product Docs', onClick: () => openUploadModal('Products & Features') },
        },
        persona: {
            label: 'Target Personas',
            gap: 'No target persona context',
            suggestion: `Add buyer persona documents, ICP descriptions, or customer research for ${scopeLabel} to help the AI personalize outputs.`,
            action: { label: 'Add Persona Docs', onClick: () => openUploadModal('Target Personas') },
        },
        process: {
            label: 'Processes & Workflows',
            gap: 'No process documentation',
            suggestion: `Document internal processes, delivery workflows, or operational procedures for ${scopeLabel} so the AI understands how work gets done.`,
            action: { label: 'Document Processes', onClick: () => openUploadModal('Processes & Workflows') },
        },
        competitor: {
            label: 'Competitors',
            gap: 'No competitive intelligence',
            suggestion: `Attach competitor analysis, market positioning docs, or battlecards for ${scopeLabel} so the AI can differentiate effectively.`,
            action: { label: 'Add Competitor Analysis', onClick: () => openUploadModal('Competitors') },
        },
        messaging: {
            label: 'Messaging & Brand',
            gap: 'Missing brand context',
            suggestion: `Upload brand guidelines, tone-of-voice docs, or messaging frameworks for ${scopeLabel} to ensure consistent brand communication.`,
            action: { label: 'Add Brand Context', onClick: () => openUploadModal('Messaging & Brand') },
        },
        policy: {
            label: 'Policies & Standards',
            gap: 'No policy documentation',
            suggestion: `Add compliance docs, quality standards, SLAs, or internal policies for ${scopeLabel} so the AI respects organizational constraints.`,
            action: { label: 'Upload Policies', onClick: () => openUploadModal('Policies & Standards') },
        },
        case_study: {
            label: 'Case Studies & Outcomes',
            gap: 'No case study or outcome data',
            suggestion: `Upload client success stories, project outcomes, ROI reports, or testimonials for ${scopeLabel} so the AI can reference real results.`,
            action: { label: 'Add Case Studies', onClick: () => openUploadModal('Case Studies & Outcomes') },
        },
        market: {
            label: 'Market & Industry',
            gap: 'No market intelligence',
            suggestion: `Add market research, industry reports, TAM analysis, or trend data for ${scopeLabel} so the AI understands your market positioning.`,
            action: { label: 'Add Market Data', onClick: () => openUploadModal('Market & Industry') },
        },
        pricing: {
            label: 'Pricing & Packaging',
            gap: 'No pricing information',
            suggestion: `Upload pricing documents, rate cards, packaging details, or discount policies for ${scopeLabel} so the AI can reference pricing accurately.`,
            action: { label: 'Add Pricing Docs', onClick: () => openUploadModal('Pricing & Packaging') },
        },
        content_strategy: {
            label: 'Content Strategy',
            gap: 'No content strategy defined',
            suggestion: `Document content pillars, editorial calendars, channel strategies, or campaign history for ${scopeLabel} so the AI can create aligned content.`,
            action: { label: 'Define Content Strategy', onClick: () => openUploadModal('Content Strategy') },
        },
        metric: {
            label: 'Metrics & KPIs',
            gap: 'No metrics or KPI targets',
            suggestion: `Add KPI definitions, performance benchmarks, OKRs, or financial targets for ${scopeLabel} so the AI can reference measurable goals.`,
            action: { label: 'Add Metrics', onClick: () => openUploadModal('Metrics & KPIs') },
        },
        methodology: {
            label: 'Methodologies & Frameworks',
            gap: 'No methodologies documented',
            suggestion: `Upload frameworks, playbooks, best practices, or design systems for ${scopeLabel} so the AI can follow established approaches.`,
            action: { label: 'Add Methodologies', onClick: () => openUploadModal('Methodologies & Frameworks') },
        },
        integration: {
            label: 'Tools & Integrations',
            gap: 'No tool or integration documentation',
            suggestion: `Document your tech stack, tool configurations, API connections, or vendor relationships for ${scopeLabel} so the AI understands your ecosystem.`,
            action: { label: 'Add Integrations', onClick: () => openUploadModal('Tools & Integrations') },
        },
    };

    const insights = useMemo<Insight[]>(() => {
        if (nodes.length === 0) return [];
        const items: Insight[] = [];
        const byType = overview?.nodesByType || {};
        const coverage = overview?.coverageScore || 0;

        const isScoped = scope !== 'company';
        const entityLabel = isScoped ? scopeLabel : 'your company';

        // 1. Per-category gap cards — actionable and specific
        const missingTypes = EXPECTED_TYPES.filter(t => !byType[t] || byType[t] === 0);
        for (const type of missingTypes) {
            const info = CATEGORY_GAP_INFO[type];
            if (!info) continue;
            items.push({
                id: `gap-${type}`,
                severity: isScoped ? 'critical' : (missingTypes.length >= 3 ? 'critical' : 'warning'),
                icon: type === 'product' ? <Cpu size={18} /> :
                    type === 'persona' ? <Target size={18} /> :
                        type === 'process' ? <Zap size={18} /> :
                            type === 'competitor' ? <ShieldAlert size={18} /> :
                                type === 'messaging' ? <BookOpen size={18} /> :
                                    <FileText size={18} />,
                title: info.gap,
                description: info.suggestion,
                action: info.action,
            });
        }

        // 2. Weak categories (exists but very few nodes)
        const totalNodes = nodes.length;
        if (totalNodes > 5) {
            for (const type of EXPECTED_TYPES) {
                const count = byType[type] || 0;
                if (count > 0 && count <= 2 && !missingTypes.includes(type)) {
                    const info = CATEGORY_GAP_INFO[type];
                    if (!info) continue;
                    items.push({
                        id: `weak-${type}`,
                        severity: 'warning',
                        icon: <TrendingUp size={18} />,
                        title: `${info.label}: only ${count} node${count === 1 ? '' : 's'}`,
                        description: `${entityLabel} has limited ${info.label.toLowerCase()} knowledge. ${info.suggestion}`,
                        action: info.action,
                    });
                }
            }
        }

        // 3. Low coverage (overall)
        if (coverage < 0.4) {
            items.push({
                id: 'low-coverage',
                severity: 'critical',
                icon: <ShieldAlert size={18} />,
                title: `Coverage is only ${Math.round(coverage * 100)}%`,
                description: `The AI assistant has limited context about ${entityLabel}. Upload more documents to improve response quality.`,
                action: { label: 'Upload Documents', href: '/documents' },
            });
        } else if (coverage < 0.7) {
            items.push({
                id: 'medium-coverage',
                severity: 'warning',
                icon: <TrendingUp size={18} />,
                title: `Coverage at ${Math.round(coverage * 100)}% — room to improve`,
                description: `Good start for ${entityLabel}. Fill the gaps above to reach full coverage.`,
            });
        }

        // 4. Low-confidence nodes
        const lowConfNodes = nodes.filter(n => n.confidenceScore < 0.6);
        if (lowConfNodes.length > 0) {
            items.push({
                id: 'low-confidence',
                severity: 'tip',
                icon: <Lightbulb size={18} />,
                title: `${lowConfNodes.length} node${lowConfNodes.length === 1 ? '' : 's'} with low confidence`,
                description: 'These nodes were extracted with limited context. Upload more detailed documents about these topics to improve accuracy.',
                action: { label: 'Review Nodes', onClick: () => { setActiveType(null); setSearchQuery(''); } },
            });
        }

        // 5. Imbalance detection
        if (totalNodes > 5) {
            const productPct = (byType['product'] || 0) / totalNodes;
            if (productPct > 0.6) {
                items.push({
                    id: 'product-heavy',
                    severity: 'tip',
                    icon: <BookOpen size={18} />,
                    title: 'Knowledge is product-heavy',
                    description: `Most of ${entityLabel}'s DNA is about products. Balance it with process documentation, competitor analyses, and brand messaging.`,
                });
            }
        }

        // 6. All good
        if (totalNodes > 0 && coverage >= 0.7 && missingTypes.length === 0) {
            items.push({
                id: 'all-good',
                severity: 'tip',
                icon: <Sparkles size={18} />,
                title: isScoped ? `${scopeLabel} DNA looks great!` : 'Your Company DNA looks great!',
                description: 'Good coverage across all knowledge areas. Re-process periodically as you upload new documents.',
            });
        }

        return items;
    }, [nodes, overview, scope, scopeLabel, scopedCustomerUrl]);

    /* ─── Upload Modal ────────────────────────────────── */

    const openUploadModal = (gapLabel: string) => {
        setUploadGapLabel(gapLabel);
        setUploadFiles([]);
        setUploadModalOpen(true);
    };

    async function handleGapUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        setUploading(true);

        const queue = Array.from(files).map(f => ({ name: f.name, status: 'uploading' as const, progress: 0 }));
        setUploadFiles(queue);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadFiles(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading', progress: 30 } : item));

            try {
                const form = new FormData();
                form.append('file', file);
                const res = await fetch('/api/documents/upload', { method: 'POST', body: form });

                if (res.ok) {
                    const doc = await res.json();
                    setUploadFiles(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'ocr', progress: 60 } : item));

                    // Assign to the current project scope
                    const targetProjectId = selectedProjectId || null;
                    if (targetProjectId) {
                        await fetch(`/api/documents/${doc.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectId: targetProjectId }),
                        });
                    }

                    // Run OCR
                    try {
                        await fetch('/api/ocr', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ documentId: doc.id }),
                        });
                    } catch { /* OCR optional */ }

                    setUploadFiles(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done', progress: 100 } : item));
                } else {
                    setUploadFiles(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', progress: 100 } : item));
                }
            } catch {
                setUploadFiles(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', progress: 100 } : item));
            }
        }

        setUploading(false);
        if (uploadFileRef.current) uploadFileRef.current.value = '';
    }

    async function handleUploadDone() {
        setUploadModalOpen(false);
        setUploadFiles([]);
        // Re-process DNA with uploaded docs
        await handleProcess();
        loadData();
    }

    /* ─── Resource CRUD ────────────────────────────────── */

    function openResourceModal(resource?: ResourceItem) {
        if (resource) {
            setEditingResource(resource);
            setResName(resource.name);
            setResDescription(resource.description);
            setResIcon(resource.icon);
            setResNodeTypes(resource.nodeTypes || []);
        } else {
            setEditingResource(null);
            setResName('');
            setResDescription('');
            setResIcon('folder');
            setResNodeTypes([]);
        }
        setResourceModalOpen(true);
    }

    async function handleResourceSave() {
        if (!resName.trim()) return;
        setResSaving(true);
        try {
            if (editingResource) {
                // Update
                const res = await fetch(`/api/dna/resources/${editingResource.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: resName, description: resDescription, icon: resIcon, nodeTypes: resNodeTypes }),
                });
                if (res.ok) {
                    const updated = await res.json();
                    setResources(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
                }
            } else {
                // Create
                const res = await fetch('/api/dna/resources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: resName, description: resDescription, icon: resIcon, nodeTypes: resNodeTypes }),
                });
                if (res.ok) {
                    const created = await res.json();
                    setResources(prev => [...prev, { ...created, nodeCount: 0 }]);
                }
            }
        } catch (err) {
            console.error('[dna] Resource save failed:', err);
        } finally {
            setResSaving(false);
            setResourceModalOpen(false);
        }
    }

    async function handleResourceDelete(id: string) {
        try {
            const res = await fetch(`/api/dna/resources/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setResources(prev => prev.filter(r => r.id !== id));
            }
        } catch (err) {
            console.error('[dna] Resource delete failed:', err);
        }
    }

    function toggleResNodeType(type: string) {
        setResNodeTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    }

    /* ─── Process Documents ───────────────────────────── */

    const handleProcess = async () => {
        setProcessing(true);
        setProcessEvents([]);
        setProcessResult(null);

        try {
            const body: Record<string, string> = {};
            if (scope === 'customer' && selectedCustomerId) {
                body.scope = 'customer';
                body.customerId = selectedCustomerId;
            } else if (scope === 'project' && selectedProjectId) {
                body.scope = 'project';
                body.projectId = selectedProjectId;
            }
            const res = await fetch('/api/dna/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.body) throw new Error('No stream');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line) as ProcessEvent;
                        if (event.step === 'complete') {
                            setProcessResult(event);
                        } else {
                            setProcessEvents(prev => [...prev, event]);
                        }
                    } catch { /* skip malformed */ }
                }
            }
        } catch (err) {
            console.error('[dna] Processing error:', err);
        } finally {
            await loadData();
        }
    };

    const closeProcessing = () => {
        setProcessing(false);
        setProcessEvents([]);
        setProcessResult(null);
    };

    /* ─── Load Node Detail ────────────────────────────── */

    const openNodeDetail = async (nodeId: string) => {
        try {
            const res = await fetch(`/api/dna/nodes/${nodeId}`);
            if (res.ok) setSelectedNode(await res.json());
        } catch (err) {
            console.error('[dna] Failed to load node:', err);
        }
    };

    /* ─── Delete Node ─────────────────────────────────── */

    const deleteNode = async (nodeId: string) => {
        try {
            await fetch(`/api/dna/nodes/${nodeId}`, { method: 'DELETE' });
            setSelectedNode(null);
            await loadData();
        } catch (err) {
            console.error('[dna] Failed to delete node:', err);
        }
    };

    /* ─── Render ──────────────────────────────────────── */

    if (loading) {
        return (
            <div className="dna-page">
                <div className="dna-loading">
                    <Loader2 size={32} className="animate-spin" />
                    <p>Loading Company DNA...</p>
                </div>
            </div>
        );
    }

    const hasDNA = nodes.length > 0;
    const coveragePct = Math.round((overview?.coverageScore || 0) * 100);

    return (
        <div className="dna-page">
            {/* ── Standard Page Header ────────────────── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Dna size={20} strokeWidth={2} /></span>
                    <h1>Company DNA</h1>
                </div>
                <div className="assistant-page-workspace">
                    {hasDNA && (
                        <button
                            className="btn-brutalist btn-brutalist-outline"
                            onClick={handleProcess}
                            disabled={processing}
                        >
                            <RefreshCw size={14} /> Re-Process
                        </button>
                    )}
                </div>
            </div>

            {/* ── Scope Selector ────────────────────────── */}
            <div className="dna-scope-bar">
                <div className="dna-scope-tabs">
                    <button
                        className={`dna-scope-tab ${scope === 'company' ? 'active' : ''}`}
                        onClick={() => { setScope('company'); setSelectedCustomerId(null); setSelectedProjectId(null); }}
                    >
                        <Dna size={14} /> Company-Wide
                    </button>
                    <button
                        className={`dna-scope-tab ${scope === 'customer' ? 'active' : ''}`}
                        onClick={() => { setScope('customer'); setSelectedProjectId(null); }}
                    >
                        <Building2 size={14} /> By Customer
                    </button>
                    <button
                        className={`dna-scope-tab ${scope === 'project' ? 'active' : ''}`}
                        onClick={() => setScope('project')}
                    >
                        <FolderOpen size={14} /> By Project
                    </button>
                </div>

                {scope === 'customer' && (
                    <select
                        className="dna-scope-select"
                        value={selectedCustomerId || ''}
                        onChange={(e) => setSelectedCustomerId(e.target.value || null)}
                    >
                        <option value="">Select a customer...</option>
                        {scopeCustomers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                )}

                {scope === 'project' && (
                    <select
                        className="dna-scope-select"
                        value={selectedProjectId || ''}
                        onChange={(e) => setSelectedProjectId(e.target.value || null)}
                    >
                        <option value="">Select a project...</option>
                        {scopeProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* ── Hero Section ────────────────────────── */}
            {!hasDNA ? (
                /* Empty State — First Time */
                <div className="dna-hero dna-hero-empty">
                    <div className="dna-hero-content">
                        <div className="dna-hero-icon"><Dna size={48} strokeWidth={1.5} /></div>
                        <h2>Build Your Company&apos;s Intelligence</h2>
                        <p>
                            Company DNA extracts structured knowledge from your uploaded documents —
                            products, target personas, processes, competitors, and messaging — and
                            organizes it into a queryable knowledge graph that powers all AI assistants.
                        </p>
                        <div className="dna-hero-steps">
                            <div className="dna-step">
                                <span className="dna-step-num">1</span>
                                <span>Upload documents in <strong>Documents</strong></span>
                            </div>
                            <ChevronRight size={16} className="dna-step-arrow" />
                            <div className="dna-step">
                                <span className="dna-step-num">2</span>
                                <span>Click <strong>Process Documents</strong></span>
                            </div>
                            <ChevronRight size={16} className="dna-step-arrow" />
                            <div className="dna-step">
                                <span className="dna-step-num">3</span>
                                <span>AI extracts & organizes knowledge</span>
                            </div>
                        </div>
                        <button
                            className="btn-brutalist btn-brutalist-primary dna-hero-cta"
                            onClick={handleProcess}
                            disabled={processing}
                        >
                            {processing ? (
                                <><Loader2 size={16} className="animate-spin" /> Processing...</>
                            ) : (
                                <><Zap size={16} /> Process Documents Now</>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                /* Populated — Stats Bar */
                <div className="dna-stats-bar">
                    <div className="dna-stat dna-stat-coverage">
                        <div className="dna-stat-value">{coveragePct}%</div>
                        <div className="dna-stat-label">Coverage</div>
                        <div className="dna-stat-bar">
                            <div className="dna-stat-bar-fill" style={{ width: `${coveragePct}%` }} />
                        </div>
                    </div>
                    <div className="dna-stat">
                        <div className="dna-stat-value">{nodes.length}</div>
                        <div className="dna-stat-label">Knowledge Nodes</div>
                    </div>
                    {nodeTypes.slice(0, 4).map(([type, count]) => (
                        <div key={type} className="dna-stat dna-stat-type" onClick={() => setActiveType(activeType === type ? null : type)}>
                            <div className="dna-stat-value" style={{ color: TYPE_COLORS[type]?.text || '#0f172a' }}>
                                {count}
                            </div>
                            <div className="dna-stat-label">{TYPE_COLORS[type]?.label || type}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Resource Cards Grid ─────────────────── */}
            {hasDNA && resources.length > 0 && (
                <div className="dna-resources-section">
                    <div className="dna-resources-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FolderOpen size={16} />
                            <span>Knowledge Resources</span>
                        </div>
                        <button className="btn-brutalist btn-brutalist-outline btn-brutalist-sm" onClick={() => openResourceModal()}>
                            <Plus size={14} /> New Resource
                        </button>
                    </div>
                    <div className="dna-resources-grid">
                        {resources.map(r => (
                            <div key={r.id} className="dna-resource-card">
                                <div className="dna-resource-icon">
                                    {getResourceIcon(r.icon, 22)}
                                </div>
                                <div className="dna-resource-body">
                                    <div className="dna-resource-name">{r.name}</div>
                                    <div className="dna-resource-desc">{r.description}</div>
                                    <div className="dna-resource-meta">
                                        <span className="dna-resource-count">{r.nodeCount} nodes</span>
                                        {r.isDefault && (
                                            <span className="dna-resource-badge-default">DEFAULT</span>
                                        )}
                                    </div>
                                </div>
                                <div className="dna-resource-actions">
                                    <button className="dna-resource-action-btn" onClick={() => openResourceModal(r)} title="Edit">
                                        <Pencil size={14} />
                                    </button>
                                    {!r.isDefault ? (
                                        <button className="dna-resource-action-btn dna-resource-action-danger" onClick={() => handleResourceDelete(r.id)} title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    ) : (
                                        <button className="dna-resource-action-btn" disabled title="Cannot delete default">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Insights & Recommendations ─────────── */}
            {hasDNA && insights.length > 0 && (
                <div className="dna-insights">
                    <div className="dna-insights-header">
                        <Lightbulb size={16} />
                        <span>{scope !== 'company' ? `Knowledge Gaps — ${scopeLabel}` : 'Insights & Recommendations'}</span>
                    </div>
                    <div className="dna-insights-list">
                        {insights.map(insight => (
                            <div key={insight.id} className={`dna-insight dna-insight-${insight.severity}`}>
                                <div className="dna-insight-icon">{insight.icon}</div>
                                <div className="dna-insight-content">
                                    <div className="dna-insight-title">{insight.title}</div>
                                    <div className="dna-insight-desc">{insight.description}</div>
                                </div>
                                {insight.action && (
                                    <div className="dna-insight-action">
                                        {insight.action.href ? (
                                            <Link href={insight.action.href} className="btn-brutalist btn-brutalist-outline dna-insight-btn">
                                                {insight.action.label} <ArrowRight size={12} />
                                            </Link>
                                        ) : (
                                            <button
                                                className="btn-brutalist btn-brutalist-outline dna-insight-btn"
                                                onClick={insight.action.onClick}
                                            >
                                                {insight.action.label}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Filter & Search Bar ─────────────────── */}
            {hasDNA && (
                <div className="dna-toolbar">
                    <div className="dna-filter-tabs">
                        <button
                            className={`dna-filter-tab ${!activeType ? 'active' : ''}`}
                            onClick={() => setActiveType(null)}
                        >
                            All ({nodes.length})
                        </button>
                        {nodeTypes.map(([type, count]) => (
                            <button
                                key={type}
                                className={`dna-filter-tab ${activeType === type ? 'active' : ''}`}
                                onClick={() => setActiveType(activeType === type ? null : type)}
                                style={activeType === type ? {
                                    background: TYPE_COLORS[type]?.bg,
                                    color: TYPE_COLORS[type]?.text,
                                    borderColor: TYPE_COLORS[type]?.border,
                                } : {}}
                            >
                                {TYPE_COLORS[type]?.label || type} ({count})
                            </button>
                        ))}
                    </div>
                    <div className="dna-search">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search knowledge nodes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* ── Knowledge Nodes Grid ────────────────── */}
            {hasDNA && (
                <div className="dna-nodes-section">
                    {filteredNodes.length === 0 ? (
                        <div className="dna-no-results">
                            <Search size={24} />
                            <p>No nodes match your filter. Try adjusting your search or category.</p>
                        </div>
                    ) : (
                        <div className="dna-nodes-grid">
                            {filteredNodes.map(node => (
                                <div
                                    key={node.id}
                                    className="node-card"
                                    onClick={() => openNodeDetail(node.id)}
                                >
                                    <div className="node-card-top">
                                        <span
                                            className="node-type-dot"
                                            style={{ background: TYPE_COLORS[node.type]?.border || '#64748b' }}
                                        />
                                        <span className="node-type-label" style={{ color: TYPE_COLORS[node.type]?.text || '#64748b' }}>
                                            {TYPE_COLORS[node.type]?.label || node.type}
                                        </span>
                                        <span className="node-confidence-badge">
                                            {Math.round(node.confidenceScore * 100)}%
                                        </span>
                                    </div>
                                    <div className="node-title">{node.title}</div>
                                    {node.summary && (
                                        <div className="node-summary">
                                            {node.summary.replace(/\*\*/g, '').slice(0, 120)}
                                        </div>
                                    )}
                                    <div className="node-card-footer">
                                        <span className="node-sources">
                                            <FileText size={12} /> {node.sourceDocumentIds?.length || 0} sources
                                        </span>
                                        <span className="node-view-link">
                                            View <ArrowRight size={12} />
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Processing Modal ────────────────────── */}
            {processing && (
                <div className="processing-overlay">
                    <div className="processing-modal">
                        <div className="processing-header">
                            <h2><Zap size={20} style={{ marginRight: 8 }} /> Organizer Agent</h2>
                            {processResult && (
                                <button onClick={closeProcessing} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                        <div className="processing-body">
                            {processEvents.map((evt, i) => (
                                <div key={i} className="processing-item">
                                    <div className="status-icon">
                                        {evt.step === 'completed' && <Check size={16} color="#16a34a" />}
                                        {evt.step === 'processing' && <Loader2 size={16} className="animate-spin" color="#2563eb" />}
                                        {evt.step === 'error' && <X size={16} color="#dc2626" />}
                                        {!['completed', 'processing', 'error'].includes(evt.step) && <Circle size={16} color="#94a3b8" />}
                                    </div>
                                    <span className="doc-name">{evt.document || 'Processing...'}</span>
                                    <span className="doc-detail">{evt.detail || ''}</span>
                                </div>
                            ))}
                            {processEvents.length === 0 && !processResult && (
                                <div style={{ textAlign: 'center', padding: 40 }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                                    <p style={{ fontSize: 13, color: '#64748b' }}>Scanning documents...</p>
                                </div>
                            )}
                        </div>
                        {processResult && (
                            <div className="processing-footer">
                                <div className="processing-stats">
                                    <div className="processing-stat">
                                        <div className="processing-stat-value">{processResult.totalProcessed || 0}</div>
                                        <div className="processing-stat-label">Docs Processed</div>
                                    </div>
                                    <div className="processing-stat">
                                        <div className="processing-stat-value">{processResult.totalEntities || 0}</div>
                                        <div className="processing-stat-label">Entities</div>
                                    </div>
                                    <div className="processing-stat">
                                        <div className="processing-stat-value">{processResult.totalRelationships || 0}</div>
                                        <div className="processing-stat-label">Relationships</div>
                                    </div>
                                    <div className="processing-stat">
                                        <div className="processing-stat-value">{Math.round((processResult.coverageScore || 0) * 100)}%</div>
                                        <div className="processing-stat-label">Coverage</div>
                                    </div>
                                </div>
                                <button
                                    onClick={closeProcessing}
                                    className="btn-brutalist btn-brutalist-primary"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Node Detail Modal ───────────────────── */}
            {selectedNode && (
                <div className="node-detail-overlay" onClick={() => setSelectedNode(null)}>
                    <div className="node-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="node-detail-header">
                            <div>
                                <div className="node-detail-type">
                                    <span
                                        className="node-type-dot"
                                        style={{ background: TYPE_COLORS[selectedNode.type]?.border || '#64748b' }}
                                    />
                                    <span style={{ color: TYPE_COLORS[selectedNode.type]?.text }}>
                                        {TYPE_COLORS[selectedNode.type]?.label || selectedNode.type}
                                    </span>
                                    <span className="node-detail-conf">
                                        {Math.round(selectedNode.confidenceScore * 100)}% confidence
                                    </span>
                                </div>
                                <h2>{selectedNode.title}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedNode(null)}
                                className="node-detail-close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="node-detail-body">
                            {/* ── Content Fields ─── */}
                            <div className="node-detail-content">
                                <h3 className="detail-section-title">Extracted Knowledge</h3>
                                {Object.entries(selectedNode.content as Record<string, unknown>).map(([key, value]) => (
                                    <div key={key} className="node-field">
                                        <div className="node-field-label">{key.replace(/([A-Z])/g, ' $1')}</div>
                                        <div className="node-field-value">
                                            {Array.isArray(value) ? value.join(', ') : String(value || '—')}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ── Sidebar ─────────── */}
                            <div className="node-detail-sidebar">
                                {/* Relationships */}
                                <div>
                                    <h4 className="detail-section-title">
                                        Relationships ({selectedNode.edges?.length || 0})
                                    </h4>
                                    {(selectedNode.edges || []).map(edge => (
                                        <div key={edge.id} className="node-edge-item">
                                            <span className="node-edge-direction">
                                                {edge.direction === 'outgoing' ? '→' : '←'} {edge.relationType}
                                            </span>
                                            <span className="node-edge-title">{edge.node.title}</span>
                                            <span
                                                className="node-type-dot-sm"
                                                style={{ background: TYPE_COLORS[edge.node.type]?.border || '#64748b' }}
                                            />
                                        </div>
                                    ))}
                                    {(!selectedNode.edges || selectedNode.edges.length === 0) && (
                                        <div className="detail-empty">No relationships found</div>
                                    )}
                                </div>

                                {/* Source Documents */}
                                <div>
                                    <h4 className="detail-section-title">
                                        Source Documents ({selectedNode.sourceDocs?.length || 0})
                                    </h4>
                                    {(selectedNode.sourceDocs || []).map(doc => (
                                        <div key={doc.id} className="node-source-item">
                                            <FileText size={14} />
                                            <span style={{ flex: 1 }}>{doc.filename}</span>
                                            <span className="node-source-badge">{doc.source}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div style={{ marginTop: 'auto' }}>
                                    <button
                                        onClick={() => deleteNode(selectedNode.id)}
                                        className="btn-brutalist btn-brutalist-danger"
                                        style={{ width: '100%' }}
                                    >
                                        Archive Node
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Resource Create/Edit Modal ──────────── */}
            {resourceModalOpen && (
                <div className="dna-upload-overlay">
                    <div className="dna-upload-modal" style={{ maxWidth: 480 }}>
                        <div className="dna-upload-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FolderOpen size={18} />
                                <span>{editingResource ? 'Edit Resource' : 'New Resource'}</span>
                            </div>
                            <button className="dna-upload-close" onClick={() => setResourceModalOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dna-res-form">
                            <label className="dna-res-label">Name</label>
                            <input
                                className="dna-res-input"
                                value={resName}
                                onChange={e => setResName(e.target.value)}
                                placeholder="e.g. Sales Enablement"
                            />

                            <label className="dna-res-label">Description</label>
                            <textarea
                                className="dna-res-input dna-res-textarea"
                                value={resDescription}
                                onChange={e => setResDescription(e.target.value)}
                                placeholder="What kind of knowledge does this resource group?"
                                rows={2}
                            />

                            <label className="dna-res-label">Icon</label>
                            <div className="dna-res-icon-picker">
                                {ICON_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`dna-res-icon-option ${resIcon === opt.value ? 'active' : ''}`}
                                        onClick={() => setResIcon(opt.value)}
                                        title={opt.label}
                                    >
                                        {opt.icon}
                                    </button>
                                ))}
                            </div>

                            <label className="dna-res-label">Knowledge Types</label>
                            <div className="dna-res-type-grid">
                                {EXPECTED_TYPES.map(type => (
                                    <label key={type} className="dna-res-type-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={resNodeTypes.includes(type)}
                                            onChange={() => toggleResNodeType(type)}
                                        />
                                        <span style={{ background: TYPE_COLORS[type]?.bg, color: TYPE_COLORS[type]?.text, padding: '2px 8px', border: `1px solid ${TYPE_COLORS[type]?.border}`, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                                            {TYPE_COLORS[type]?.label || type}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="dna-upload-footer">
                            <button className="btn-brutalist btn-brutalist-outline" onClick={() => setResourceModalOpen(false)}>Cancel</button>
                            <button className="btn-brutalist btn-brutalist-primary" onClick={handleResourceSave} disabled={resSaving || !resName.trim()}>
                                {resSaving ? <><Loader2 size={14} className="spin" /> Saving...</> : editingResource ? 'Save Changes' : 'Create Resource'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Upload Modal ─────────────────────── */}
            {uploadModalOpen && (
                <div className="dna-upload-overlay">
                    <div className="dna-upload-modal">
                        <div className="dna-upload-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Upload size={18} />
                                <span>Upload Documents — {uploadGapLabel}</span>
                            </div>
                            <button className="dna-upload-close" onClick={() => { setUploadModalOpen(false); setUploadFiles([]); }}>
                                <X size={18} />
                            </button>
                        </div>

                        {scope !== 'company' && (
                            <div className="dna-upload-scope-badge">
                                <FolderOpen size={14} />
                                <span>Documents will be assigned to: <strong>{scopeLabel}</strong></span>
                            </div>
                        )}

                        <div
                            className={`dna-upload-dropzone ${uploadDragOver ? 'dna-upload-dropzone-active' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true); }}
                            onDragLeave={() => setUploadDragOver(false)}
                            onDrop={(e) => { e.preventDefault(); setUploadDragOver(false); handleGapUpload(e.dataTransfer.files); }}
                            onClick={() => uploadFileRef.current?.click()}
                        >
                            <input
                                ref={uploadFileRef}
                                type="file"
                                accept=".pdf,.docx,.doc,.md,.txt,.png,.jpg,.jpeg,.tiff,.bmp,.csv,.xlsx"
                                multiple
                                hidden
                                onChange={(e) => handleGapUpload(e.target.files)}
                            />
                            <Upload size={32} strokeWidth={1.5} />
                            <p style={{ fontWeight: 700, fontSize: 14, margin: '8px 0 4px' }}>
                                {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
                            </p>
                            <p style={{ fontSize: 12, opacity: 0.6 }}>
                                PDF, DOCX, MD, TXT, Images — up to 50 MB
                            </p>
                        </div>

                        {uploadFiles.length > 0 && (
                            <div className="dna-upload-progress-list">
                                {uploadFiles.map((f, i) => (
                                    <div key={i} className="dna-upload-progress-item">
                                        <FileText size={14} />
                                        <span className="dna-upload-filename">{f.name}</span>
                                        <span className={`dna-upload-status dna-upload-status-${f.status}`}>
                                            {f.status === 'uploading' && <><Loader2 size={12} className="spin" /> Uploading</>}
                                            {f.status === 'ocr' && <><Loader2 size={12} className="spin" /> Processing</>}
                                            {f.status === 'done' && <><Check size={12} /> Done</>}
                                            {f.status === 'error' && <><AlertTriangle size={12} /> Error</>}
                                        </span>
                                        <div className="dna-upload-bar">
                                            <div className="dna-upload-bar-fill" style={{ width: `${f.progress}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="dna-upload-footer">
                            <button
                                className="btn-brutalist btn-brutalist-outline"
                                onClick={() => { setUploadModalOpen(false); setUploadFiles([]); }}
                            >
                                Cancel
                            </button>
                            {uploadFiles.some(f => f.status === 'done') && !uploading && (
                                <button
                                    className="btn-brutalist btn-brutalist-primary"
                                    onClick={handleUploadDone}
                                >
                                    <RefreshCw size={14} /> Done — Process DNA
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
