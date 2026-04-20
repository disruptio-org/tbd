'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIFeedback } from '@/components/UIFeedback';
import { useT } from '@/i18n/context';
import {
    Building2, Package, Target, Settings, Compass, Lightbulb, FileText,
    Upload, Search, CheckCircle, XCircle, Clock, Eye, RefreshCw, AlertCircle,
    Check, Trash2, BookOpen, Shield, ShieldCheck, Tag, Star, X, CheckSquare,
} from 'lucide-react';
import DocumentViewerModal from '../../documents/[id]/DocumentViewerModal';
import { TableShell, StatusBadge, RowActionMenu, TableEmptyState, TableLoadingState } from '@/components/table';
import '@/components/table/table.css';
import '@/app/(dashboard)/documents/documents.css';
import './profile.css';

// ─── Knowledge Categories ─────────────────────────

const KNOWLEDGE_CATEGORIES = [
    { value: '', label: '— No category —' },
    { value: 'company', label: 'Company' },
    { value: 'product', label: 'Product' },
    { value: 'process', label: 'Process' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'hr', label: 'HR' },
    { value: 'policy', label: 'Policy' },
    { value: 'finance', label: 'Finance' },
    { value: 'operations', label: 'Operations' },
];

// ─── Types ─────────────────────────────────────────

interface CompanyProfile {
    id?: string;
    companyName: string;
    description: string;
    industry: string;
    website: string;
    foundedYear: string;
    productsServices: string;
    mainOfferings: string;
    valueProposition: string;
    targetCustomers: string;
    targetIndustries: string;
    markets: string;
    departments: string;
    internalTools: string;
    keyProcesses: string;
    competitors: string;
    strategicGoals: string;
    brandTone: string;
}

const EMPTY_PROFILE: CompanyProfile = {
    companyName: '', description: '', industry: '', website: '', foundedYear: '',
    productsServices: '', mainOfferings: '', valueProposition: '',
    targetCustomers: '', targetIndustries: '', markets: '',
    departments: '', internalTools: '', keyProcesses: '',
    competitors: '', strategicGoals: '', brandTone: '',
};

interface DocItem {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    ocrProcessed: boolean;
    ocrStatus: string;
    ocrError: string | null;
    version: number;
    hash: string | null;
    projectId: string | null;
    knowledgeCategory: string | null;
    useAsKnowledgeSource: boolean;
    knowledgePriority: string | null;
    createdAt: string;
}

interface UploadProgress {
    file: string;
    status: 'uploading' | 'ocr' | 'done' | 'error';
    progress: number;
}

// ─── Sections config ──────────────────────────────

interface FieldConfig {
    key: string;
    labelKey: string;
    type: 'input' | 'textarea';
    required: boolean;
    fullWidth: boolean;
    placeholderKey?: string;
}

interface SectionConfig {
    id: string;
    icon: React.ReactNode;
    titleKey: string;
    fields: FieldConfig[];
}

const SECTIONS: SectionConfig[] = [
    {
        id: 'overview',
        icon: <Building2 size={18} />,
        titleKey: 'companyProfile.companyOverview',
        fields: [
            { key: 'companyName', labelKey: 'companyProfile.companyName', type: 'input', required: true, fullWidth: false },
            { key: 'industry', labelKey: 'companyProfile.industry', type: 'input', required: false, fullWidth: false },
            { key: 'website', labelKey: 'companyProfile.website', type: 'input', required: false, fullWidth: false },
            { key: 'foundedYear', labelKey: 'companyProfile.foundedYear', type: 'input', required: false, fullWidth: false },
            { key: 'description', labelKey: 'companyProfile.description', type: 'textarea', required: true, fullWidth: true, placeholderKey: 'companyProfile.descriptionPlaceholder' },
        ],
    },
    {
        id: 'products',
        icon: <Package size={18} />,
        titleKey: 'companyProfile.productsAndServices',
        fields: [
            { key: 'productsServices', labelKey: 'companyProfile.productsServices', type: 'textarea', required: false, fullWidth: true, placeholderKey: 'companyProfile.productsServicesPlaceholder' },
            { key: 'mainOfferings', labelKey: 'companyProfile.mainOfferings', type: 'textarea', required: false, fullWidth: true, placeholderKey: 'companyProfile.mainOfferingsPlaceholder' },
            { key: 'valueProposition', labelKey: 'companyProfile.valueProposition', type: 'textarea', required: false, fullWidth: true, placeholderKey: 'companyProfile.valuePropositionPlaceholder' },
        ],
    },
    {
        id: 'market',
        icon: <Target size={18} />,
        titleKey: 'companyProfile.targetMarket',
        fields: [
            { key: 'targetCustomers', labelKey: 'companyProfile.targetCustomers', type: 'textarea', required: false, fullWidth: true, placeholderKey: 'companyProfile.targetCustomersPlaceholder' },
            { key: 'targetIndustries', labelKey: 'companyProfile.targetIndustries', type: 'textarea', required: false, fullWidth: false, placeholderKey: 'companyProfile.targetIndustriesPlaceholder' },
            { key: 'markets', labelKey: 'companyProfile.markets', type: 'textarea', required: false, fullWidth: false, placeholderKey: 'companyProfile.marketsPlaceholder' },
        ],
    },
    {
        id: 'operations',
        icon: <Settings size={18} />,
        titleKey: 'companyProfile.internalOperations',
        fields: [
            { key: 'departments', labelKey: 'companyProfile.departments', type: 'textarea', required: false, fullWidth: false, placeholderKey: 'companyProfile.departmentsPlaceholder' },
            { key: 'internalTools', labelKey: 'companyProfile.internalTools', type: 'textarea', required: false, fullWidth: false, placeholderKey: 'companyProfile.internalToolsPlaceholder' },
            { key: 'keyProcesses', labelKey: 'companyProfile.keyProcesses', type: 'textarea', required: false, fullWidth: true, placeholderKey: 'companyProfile.keyProcessesPlaceholder' },
        ],
    },
    {
        id: 'strategy',
        icon: <Compass size={18} />,
        titleKey: 'companyProfile.strategy',
        fields: [
            { key: 'competitors', labelKey: 'companyProfile.competitors', type: 'textarea', required: false, fullWidth: false, placeholderKey: 'companyProfile.competitorsPlaceholder' },
            { key: 'strategicGoals', labelKey: 'companyProfile.strategicGoals', type: 'textarea', required: false, fullWidth: false, placeholderKey: 'companyProfile.strategicGoalsPlaceholder' },
            { key: 'brandTone', labelKey: 'companyProfile.brandTone', type: 'input', required: false, fullWidth: true, placeholderKey: 'companyProfile.brandTonePlaceholder' },
        ],
    },
];

// ─── Component ─────────────────────────────────────

export default function CompanyProfilePage() {
    const { showToast, showConfirm } = useUIFeedback();
    const { t } = useT();

    // Tab state
    const [activeTab, setActiveTab] = useState<'profile' | 'documents'>('profile');

    // Profile state
    const [form, setForm] = useState<CompanyProfile>(EMPTY_PROFILE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasProfile, setHasProfile] = useState(false);
    const [completionScore, setCompletionScore] = useState(0);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview']));

    // Documents state
    const [documents, setDocuments] = useState<DocItem[]>([]);
    const [docsLoading, setDocsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Knowledge settings modal
    const [knowledgeDoc, setKnowledgeDoc] = useState<DocItem | null>(null);
    const [knCategory, setKnCategory] = useState('');
    const [knPriority, setKnPriority] = useState('normal');
    const [knCurated, setKnCurated] = useState(false);

    // Document viewer
    const [viewerDoc, setViewerDoc] = useState<{ id: string; filename: string; mimeType: string } | null>(null);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<'category' | 'priority' | null>(null);
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkPriority, setBulkPriority] = useState('normal');

    // ─── Load Profile ─────────────────────────────────
    useEffect(() => {
        loadProfile();
        loadCompletion();
        loadDocuments();
    }, []);

    async function loadProfile() {
        try {
            const res = await fetch('/api/company/profile');
            const data = await res.json();
            if (data.profile) {
                setHasProfile(true);
                setForm({
                    companyName: data.profile.companyName ?? '', description: data.profile.description ?? '',
                    industry: data.profile.industry ?? '', website: data.profile.website ?? '',
                    foundedYear: data.profile.foundedYear ? String(data.profile.foundedYear) : '',
                    productsServices: data.profile.productsServices ?? '', mainOfferings: data.profile.mainOfferings ?? '',
                    valueProposition: data.profile.valueProposition ?? '', targetCustomers: data.profile.targetCustomers ?? '',
                    targetIndustries: data.profile.targetIndustries ?? '', markets: data.profile.markets ?? '',
                    departments: data.profile.departments ?? '', internalTools: data.profile.internalTools ?? '',
                    keyProcesses: data.profile.keyProcesses ?? '', competitors: data.profile.competitors ?? '',
                    strategicGoals: data.profile.strategicGoals ?? '', brandTone: data.profile.brandTone ?? '',
                });
            }
        } catch { console.error('Failed to load profile'); }
        setLoading(false);
    }

    async function loadCompletion() {
        try {
            const res = await fetch('/api/company/profile/completion');
            const data = await res.json();
            setCompletionScore(data.completionScore ?? 0);
        } catch { console.error('Failed to load completion'); }
    }

    async function loadDocuments() {
        try {
            const res = await fetch('/api/documents/upload');
            const docs = await res.json();
            // Filter to company-only docs (no projectId)
            const companyDocs = (Array.isArray(docs) ? docs : [])
                .filter((d: DocItem) => !d.projectId)
                .map((d: DocItem) => ({
                    ...d,
                    ocrStatus: d.ocrStatus || (d.ocrProcessed ? 'PROCESSED' : 'PENDING'),
                    ocrError: d.ocrError || null,
                    version: d.version || 1,
                    hash: d.hash || null,
                    knowledgeCategory: d.knowledgeCategory || null,
                    useAsKnowledgeSource: d.useAsKnowledgeSource || false,
                    knowledgePriority: d.knowledgePriority || null,
                }));
            setDocuments(companyDocs);
        } catch { console.error('Failed to load documents'); }
        setDocsLoading(false);
    }

    // ─── Save Profile ─────────────────────────────────
    async function handleSave() {
        if (!form.companyName.trim()) { showToast(t('companyProfile.nameRequired'), 'error'); return; }
        if (!form.description.trim()) { showToast(t('companyProfile.descriptionRequired'), 'error'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/company/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, foundedYear: form.foundedYear ? Number(form.foundedYear) : null }),
            });
            if (res.ok) {
                setHasProfile(true);
                showToast(t('companyProfile.savedSuccess'), 'success');
                await loadCompletion();
            } else {
                const err = await res.json();
                showToast(err.error || t('companyProfile.saveFailed'), 'error');
            }
        } catch { showToast(t('companyProfile.connectionError'), 'error'); }
        setSaving(false);
    }

    // ─── Upload ───────────────────────────────────────
    async function handleUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        setUploading(true);
        const queue: UploadProgress[] = Array.from(files).map((f) => ({ file: f.name, status: 'uploading' as const, progress: 0 }));
        setUploadQueue(queue);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading', progress: 30 } : item));
            try {
                const formData = new FormData();
                formData.append('file', file);
                // No projectId = company-level document
                const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });

                if (res.ok) {
                    const doc = await res.json();
                    if (doc.version && doc.version > 1) {
                        setDocuments((prev) => {
                            const existing = prev.find(d => d.id === doc.id);
                            if (existing) return prev.map(d => d.id === doc.id ? { ...doc } : d);
                            return [doc, ...prev];
                        });
                        showToast(`Document updated to version ${doc.version}`, 'success');
                    } else {
                        setDocuments((prev) => [doc, ...prev]);
                    }
                    setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'ocr', progress: 60 } : item));

                    try {
                        const ocrRes = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: doc.id }) });
                        if (ocrRes.ok) {
                            setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, ocrProcessed: true, ocrStatus: 'PROCESSED' } : d));
                        }
                    } catch { /* OCR is optional */ }

                    setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'done', progress: 100 } : item));
                } else if (res.status === 409) {
                    const errData = await res.json().catch(() => ({}));
                    showToast(errData.detail || 'This file already exists', 'error');
                    setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'error', progress: 100 } : item));
                } else {
                    setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'error', progress: 100 } : item));
                }
            } catch {
                setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'error', progress: 100 } : item));
            }
        }
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
        setTimeout(() => setUploadQueue([]), 3000);
    }

    // ─── Reprocess ────────────────────────────────────
    async function handleReprocess(doc: DocItem) {
        setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, ocrStatus: 'PROCESSING', ocrError: null } : d));
        try {
            const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: 'POST' });
            if (res.ok) {
                setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, ocrProcessed: true, ocrStatus: 'PROCESSED', ocrError: null } : d));
                showToast('Document reprocessed successfully', 'success');
            } else {
                const errData = await res.json().catch(() => ({}));
                setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, ocrStatus: 'ERROR', ocrError: errData.detail || 'Reprocessing failed' } : d));
                showToast('Reprocessing failed', 'error');
            }
        } catch {
            setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, ocrStatus: 'ERROR', ocrError: 'Network error' } : d));
            showToast('Reprocessing failed', 'error');
        }
    }

    // ─── Bulk selection ───────────────────────────────
    function toggleSelect(id: string) {
        setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    }
    function toggleSelectAll() {
        if (selectedIds.size === documents.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(documents.map(d => d.id)));
    }

    async function handleBulkReprocess() {
        const selected = documents.filter(d => selectedIds.has(d.id));
        showConfirm(`Reprocess ${selected.length} document(s)?`, async () => {
            for (const doc of selected) handleReprocess(doc);
            showToast(`Reprocessing ${selected.length} documents`, 'success');
            setSelectedIds(new Set());
        });
    }

    async function handleBulkCurated() {
        const ids = Array.from(selectedIds);
        let updated = 0;
        for (const id of ids) {
            try {
                const res = await fetch(`/api/documents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ useAsKnowledgeSource: true }) });
                if (res.ok) { setDocuments(prev => prev.map(d => d.id === id ? { ...d, useAsKnowledgeSource: true } : d)); updated++; }
            } catch { /* skip */ }
        }
        showToast(`${updated} document(s) marked as curated`, 'success');
        setSelectedIds(new Set());
    }

    async function handleBulkSettingsSave() {
        if (!bulkAction) return;
        const ids = Array.from(selectedIds);
        let updated = 0;
        for (const id of ids) {
            const body: Record<string, unknown> = {};
            if (bulkAction === 'category') body.knowledgeCategory = bulkCategory || null;
            if (bulkAction === 'priority') body.knowledgePriority = bulkPriority;
            try {
                const res = await fetch(`/api/documents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (res.ok) { const data = await res.json(); setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...data } : d)); updated++; }
            } catch { /* skip */ }
        }
        showToast(`${updated} document(s) updated`, 'success');
        setBulkAction(null);
        setSelectedIds(new Set());
    }

    async function handleBulkDelete() {
        showConfirm(`Delete ${selectedIds.size} document(s)? This cannot be undone.`, async () => {
            const ids = Array.from(selectedIds);
            let deleted = 0;
            for (const id of ids) {
                try { const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' }); if (res.ok) { setDocuments(prev => prev.filter(d => d.id !== id)); deleted++; } } catch { /* skip */ }
            }
            showToast(`${deleted} document(s) deleted`, 'success');
            setSelectedIds(new Set());
        });
    }

    function handleDelete(id: string) {
        showConfirm('Are you sure you want to delete this document?', async () => {
            try { await fetch(`/api/documents/${id}`, { method: 'DELETE' }); setDocuments(prev => prev.filter(d => d.id !== id)); showToast('Document deleted', 'success'); }
            catch { showToast('Error deleting', 'error'); }
        });
    }

    // ─── Knowledge settings ───────────────────────────
    function openKnowledgeSettings(doc: DocItem) {
        setKnowledgeDoc(doc);
        setKnCategory(doc.knowledgeCategory || '');
        setKnPriority(doc.knowledgePriority || 'normal');
        setKnCurated(doc.useAsKnowledgeSource || false);
    }

    async function handleKnowledgeSave() {
        if (!knowledgeDoc) return;
        try {
            const res = await fetch(`/api/documents/${knowledgeDoc.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ knowledgeCategory: knCategory || null, knowledgePriority: knPriority, useAsKnowledgeSource: knCurated }),
            });
            if (res.ok) {
                const updated = await res.json();
                setDocuments(prev => prev.map(d => d.id === updated.id ? { ...d, knowledgeCategory: updated.knowledgeCategory, useAsKnowledgeSource: updated.useAsKnowledgeSource, knowledgePriority: updated.knowledgePriority } : d));
                showToast('Knowledge settings updated', 'success');
            } else showToast('Error updating', 'error');
        } catch { showToast('Error updating', 'error'); }
        setKnowledgeDoc(null);
    }

    // ─── Helpers ──────────────────────────────────────
    function toggleSection(id: string) { setOpenSections(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
    function expandAll() { setOpenSections(new Set(SECTIONS.map(s => s.id))); }
    function handleChange(key: keyof CompanyProfile, value: string) { setForm(prev => ({ ...prev, [key]: value })); }
    function formatSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

    // ─── Loading ─────────────────────────────────────
    if (loading) {
        return (<div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xxl)' }}><div className="spinner" /></div>);
    }

    // ─── Empty state ─────────────────────────────────
    if (!hasProfile) {
        return (
            <div className="profile-page">
                <div className="assistant-page-header">
                    <div className="assistant-page-title">
                        <span className="assistant-page-icon"><Building2 size={20} strokeWidth={2} /></span>
                        <h1>{t('companyProfile.pageTitle')}</h1>
                    </div>
                </div>
                <div className="profile-empty">
                    <div className="profile-empty-icon"><Building2 size={48} /></div>
                    <h3>{t('companyProfile.emptyTitle')}</h3>
                    <p>{t('companyProfile.emptyDescription')}</p>
                    <button className="btn btn-primary" onClick={() => { setHasProfile(true); expandAll(); }}>
                        {t('companyProfile.createProfile')}
                    </button>
                </div>
            </div>
        );
    }

    // ─── Full Page ────────────────────────────────────
    return (
        <div
            className={`profile-page ${dragOver && activeTab === 'documents' ? 'docs-window-dragging' : ''}`}
            onDragOver={(e) => { if (activeTab === 'documents') { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
            onDrop={(e) => { if (activeTab === 'documents') { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); } }}
        >
            {/* Drag overlay */}
            {dragOver && activeTab === 'documents' && (
                <div className="docs-drag-overlay">
                    <div className="docs-drag-overlay-inner">
                        <div style={{ fontSize: 48, marginBottom: 12 }}><Upload size={40} strokeWidth={1.5} /></div>
                        <p style={{ fontWeight: 600, fontSize: 16 }}>Drop to upload company documents</p>
                        <p style={{ fontSize: 13, opacity: 0.7 }}>PDF, DOCX, PNG, JPG — up to 50MB</p>
                    </div>
                </div>
            )}

            {/* ── Page Header ── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Building2 size={20} strokeWidth={2} /></span>
                    <h1>{t('companyProfile.pageTitle')}</h1>
                </div>
                <div className="assistant-page-workspace">
                    <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff,.bmp,.xlsx,.xls,.csv,.txt,.md" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
                    {activeTab === 'profile' && (
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? t('companyProfile.saving') : t('companyProfile.saveProfile')}
                        </button>
                    )}
                    {activeTab === 'documents' && (
                        <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                            {uploading ? 'Uploading…' : <><Upload size={14} strokeWidth={2} /> Upload</>}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div className="docs-source-tabs">
                <button className={`docs-source-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                    <Building2 size={13} strokeWidth={2} /> Profile
                </button>
                <button className={`docs-source-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
                    <FileText size={13} strokeWidth={2} /> Documents ({documents.length})
                </button>
            </div>

            {/* ═══ PROFILE TAB ═══ */}
            {activeTab === 'profile' && (
                <>
                    {/* Completion bar */}
                    <div className="profile-completion">
                        <span className="profile-completion-label">{t('companyProfile.profileComplete')}</span>
                        <div className="profile-completion-bar-wrap">
                            <div className="profile-completion-bar-fill" style={{ width: `${completionScore}%` }} />
                        </div>
                        <span className="profile-completion-pct">{completionScore}%</span>
                    </div>

                    {/* Sections */}
                    {SECTIONS.map((section) => {
                        const isOpen = openSections.has(section.id);
                        return (
                            <div key={section.id} className="profile-section">
                                <div className={`profile-section-header ${isOpen ? 'open' : ''}`} onClick={() => toggleSection(section.id)}>
                                    <span className="profile-section-icon">{section.icon}</span>
                                    <span className="profile-section-title">{t(section.titleKey)}</span>
                                    <span className={`profile-section-chevron ${isOpen ? 'open' : ''}`}>▼</span>
                                </div>
                                {isOpen && (
                                    <div className="profile-section-body">
                                        {section.fields.map((field) => (
                                            <div key={field.key} className={`profile-field ${field.fullWidth ? 'full-width' : ''}`}>
                                                <label htmlFor={field.key}>
                                                    {t(field.labelKey)}
                                                    {field.required && <span style={{ color: 'var(--color-accent-red)', marginLeft: 4 }}>*</span>}
                                                </label>
                                                {field.type === 'textarea' ? (
                                                    <textarea id={field.key} value={form[field.key as keyof CompanyProfile]} onChange={(e) => handleChange(field.key as keyof CompanyProfile, e.target.value)} placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined} maxLength={5000} />
                                                ) : (
                                                    <input id={field.key} type={field.key === 'foundedYear' ? 'number' : 'text'} value={form[field.key as keyof CompanyProfile]} onChange={(e) => handleChange(field.key as keyof CompanyProfile, e.target.value)} placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined} min={field.key === 'foundedYear' ? 1800 : undefined} max={field.key === 'foundedYear' ? new Date().getFullYear() : undefined} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Footer actions */}
                    <div className="profile-actions">
                        <span className="profile-save-hint">
                            {completionScore < 100
                                ? <><Lightbulb size={14} /> {t('companyProfile.fieldsRemaining', { count: String(Math.ceil(17 * (1 - completionScore / 100))) })}</>
                                : t('companyProfile.profileCompleteMsg')}
                        </span>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? t('companyProfile.saving') : t('companyProfile.saveProfile')}
                        </button>
                    </div>
                </>
            )}

            {/* ═══ DOCUMENTS TAB ═══ */}
            {activeTab === 'documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <p className="docs-count-label">
                        {documents.length} company document{documents.length !== 1 ? 's' : ''}
                    </p>

                    {/* Upload progress */}
                    {uploadQueue.length > 0 && (
                        <div className="upload-progress-panel">
                            <h4 className="upload-progress-title">
                                <Upload size={14} strokeWidth={2} /> Upload in progress ({uploadQueue.filter(q => q.status === 'done').length}/{uploadQueue.length})
                            </h4>
                            {uploadQueue.map((item, idx) => (
                                <div key={idx} className="upload-progress-item">
                                    <div className="upload-progress-info">
                                        <span className="upload-filename">{item.file}</span>
                                        <span className={`upload-status ${item.status}`}>
                                            {item.status === 'uploading' && <><Upload size={12} strokeWidth={2} /> Uploading...</>}
                                            {item.status === 'ocr' && <><Search size={12} strokeWidth={2} /> OCR...</>}
                                            {item.status === 'done' && <><CheckCircle size={12} strokeWidth={2} /> Done</>}
                                            {item.status === 'error' && <><XCircle size={12} strokeWidth={2} /> Error</>}
                                        </span>
                                    </div>
                                    <div className="upload-progress-bar">
                                        <div className={`upload-progress-fill ${item.status}`} style={{ width: `${item.progress}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Bulk Action Bar */}
                    {selectedIds.size > 0 && (
                        <div className="docs-bulk-bar">
                            <div className="docs-bulk-bar-left">
                                <CheckSquare size={14} strokeWidth={2} />
                                <span className="docs-bulk-count">{selectedIds.size} selected</span>
                                <button className="docs-bulk-action" onClick={() => setSelectedIds(new Set())}><X size={12} strokeWidth={2} /> Clear</button>
                            </div>
                            <div className="docs-bulk-bar-right">
                                <button className="docs-bulk-action docs-bulk-action--primary" onClick={handleBulkReprocess}><RefreshCw size={12} strokeWidth={2} /> Reprocess</button>
                                <button className="docs-bulk-action" onClick={() => { setBulkAction('category'); setBulkCategory(''); }}><Tag size={12} strokeWidth={2} /> Category</button>
                                <button className="docs-bulk-action" onClick={() => { setBulkAction('priority'); setBulkPriority('normal'); }}><Star size={12} strokeWidth={2} /> Priority</button>
                                <button className="docs-bulk-action docs-bulk-action--success" onClick={handleBulkCurated}><ShieldCheck size={12} strokeWidth={2} /> Mark Curated</button>
                                <button className="docs-bulk-action docs-bulk-action--danger" onClick={handleBulkDelete}><Trash2 size={12} strokeWidth={2} /> Delete</button>
                            </div>
                        </div>
                    )}

                    {/* Documents Table */}
                    {docsLoading ? (
                        <TableShell>
                            <table className="nousio-table">
                            <thead><tr><th>File</th><th>Size</th><th>OCR</th><th>Knowledge</th><th>Date</th><th>Actions</th></tr></thead>
                            <tbody><tr><td colSpan={6} style={{ padding: 0 }}><TableLoadingState rows={5} columns={5} /></td></tr></tbody>
                            </table>
                        </TableShell>
                    ) : documents.length > 0 ? (
                        <TableShell>
                            <table className="nousio-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '3%', padding: '12px 8px', textAlign: 'center' }}>
                                        <input type="checkbox" className="row-checkbox" checked={documents.length > 0 && selectedIds.size === documents.length} onChange={toggleSelectAll} title="Select all" />
                                    </th>
                                    <th style={{ width: '3%' }}></th>
                                    <th style={{ width: '30%' }}>File</th>
                                    <th style={{ width: '8%' }}>Size</th>
                                    <th style={{ width: '13%' }}>OCR</th>
                                    <th style={{ width: '10%' }}>Knowledge</th>
                                    <th style={{ width: '7%' }}>Version</th>
                                    <th style={{ width: '10%' }}>Date</th>
                                    <th style={{ width: '16%' }} className="align-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc.id} className={selectedIds.has(doc.id) ? 'selected' : ''}>
                                        <td style={{ width: 28, padding: '8px 8px', textAlign: 'center' }}>
                                            <input type="checkbox" className="row-checkbox" checked={selectedIds.has(doc.id)} onChange={() => toggleSelect(doc.id)} />
                                        </td>
                                        <td style={{ width: 28, padding: '8px 4px' }}><FileText size={14} style={{ color: '#64748b' }} /></td>
                                        <td className="cell-primary">{doc.filename}</td>
                                        <td>{formatSize(doc.size)}</td>
                                        <td>
                                            {(doc.ocrStatus === 'PROCESSED' || (doc.ocrProcessed && doc.ocrStatus !== 'ERROR')) ? (
                                                <StatusBadge variant="success"><Check size={10} strokeWidth={3} /> Processed</StatusBadge>
                                            ) : doc.ocrStatus === 'ERROR' ? (
                                                <div className="docs-error-status">
                                                    <StatusBadge variant="error"><AlertCircle size={10} strokeWidth={2} /> Error</StatusBadge>
                                                    {doc.ocrError && <div className="docs-error-tooltip">{doc.ocrError}</div>}
                                                </div>
                                            ) : doc.ocrStatus === 'PROCESSING' ? (
                                                <StatusBadge variant="warning"><Clock size={10} strokeWidth={2} /> Processing…</StatusBadge>
                                            ) : (
                                                <StatusBadge variant="neutral"><Clock size={10} strokeWidth={2} /> Pending</StatusBadge>
                                            )}
                                        </td>
                                        <td>
                                            {doc.useAsKnowledgeSource ? (
                                                <StatusBadge variant="success"><Shield size={10} strokeWidth={2} /> Curated</StatusBadge>
                                            ) : doc.knowledgeCategory ? (
                                                <StatusBadge variant="neutral">{doc.knowledgeCategory}</StatusBadge>
                                            ) : <span className="text-muted">—</span>}
                                        </td>
                                        <td><StatusBadge variant="neutral">v{doc.version || 1}</StatusBadge></td>
                                        <td className="cell-muted">{new Date(doc.createdAt).toLocaleDateString('en-US')}</td>
                                        <td>
                                            <RowActionMenu
                                                primaryAction={{ icon: <Eye size={14} strokeWidth={2} />, title: 'Open', onClick: () => setViewerDoc({ id: doc.id, filename: doc.filename, mimeType: doc.mimeType }) }}
                                                items={[
                                                    ...((doc.ocrStatus === 'ERROR' || doc.ocrStatus === 'PROCESSED' || doc.ocrStatus === 'PENDING') ? [{ label: 'Reprocess', icon: <RefreshCw size={14} strokeWidth={2} />, onClick: () => handleReprocess(doc) }] : []),
                                                    { label: 'Knowledge Settings', icon: <Settings size={14} strokeWidth={2} />, onClick: () => openKnowledgeSettings(doc) },
                                                    { label: 'Delete', icon: <Trash2 size={14} strokeWidth={2} />, onClick: () => handleDelete(doc.id), danger: true },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            </table>
                        </TableShell>
                    ) : (
                        !uploading && (
                            <TableEmptyState
                                icon={<FileText size={32} strokeWidth={2} />}
                                title="No company documents"
                                description="Upload company-level knowledge — policies, brand guides, org charts, processes"
                                action={
                                    <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                                        <Upload size={14} strokeWidth={2} /> Upload Document
                                    </button>
                                }
                            />
                        )
                    )}
                </div>
            )}

            {/* ─── Knowledge Settings Modal ─── */}
            {knowledgeDoc && (
                <div className="class-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setKnowledgeDoc(null); }}>
                    <div className="class-modal" style={{ width: 'min(480px, 95vw)' }}>
                        <div className="class-modal-header">
                            <h3><BookOpen size={16} strokeWidth={2} /> Knowledge Settings</h3>
                            <button className="class-modal-close" onClick={() => setKnowledgeDoc(null)}>✕</button>
                        </div>
                        <div className="class-modal-body">
                            <p className="text-secondary" style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-small)' }}>
                                <FileText size={14} strokeWidth={2} /> <strong>{knowledgeDoc.filename}</strong>
                            </p>
                            <div className="form-group">
                                <label className="label" htmlFor="kn-category-cp">Category</label>
                                <select id="kn-category-cp" className="input" value={knCategory} onChange={(e) => setKnCategory(e.target.value)}>
                                    {KNOWLEDGE_CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                                </select>
                                <span className="form-hint">Helps the assistant find this document for relevant questions</span>
                            </div>
                            <div className="form-group">
                                <label className="label" htmlFor="kn-priority-cp">Priority</label>
                                <select id="kn-priority-cp" className="input" value={knPriority} onChange={(e) => setKnPriority(e.target.value)}>
                                    <option value="normal">Normal</option>
                                    <option value="preferred">Preferred</option>
                                    <option value="critical">Critical</option>
                                </select>
                                <span className="form-hint">Higher priority documents are favored in responses</span>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-sm)' }}>
                                <label className="kn-toggle-label">
                                    <input type="checkbox" checked={knCurated} onChange={(e) => setKnCurated(e.target.checked)} className="kn-checkbox" />
                                    <span className="kn-toggle-text">
                                        <strong>Curated knowledge source</strong>
                                        <span className="form-hint">Marked as authoritative — receives maximum priority</span>
                                    </span>
                                </label>
                            </div>
                        </div>
                        <div className="class-modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setKnowledgeDoc(null)}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={handleKnowledgeSave}><Check size={14} strokeWidth={2} /> Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Document Viewer Modal ─── */}
            {viewerDoc && (
                <DocumentViewerModal documentId={viewerDoc.id} filename={viewerDoc.filename} mimeType={viewerDoc.mimeType} onClose={() => setViewerDoc(null)} />
            )}

            {/* ─── Bulk Settings Modal ─── */}
            {bulkAction && (
                <div className="class-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setBulkAction(null); }}>
                    <div className="class-modal" style={{ width: 'min(420px, 95vw)' }}>
                        <div className="class-modal-header">
                            <h3>
                                {bulkAction === 'category' && <><Tag size={16} strokeWidth={2} /> Set Category</>}
                                {bulkAction === 'priority' && <><Star size={16} strokeWidth={2} /> Set Priority</>}
                            </h3>
                            <button className="class-modal-close" onClick={() => setBulkAction(null)}>✕</button>
                        </div>
                        <div className="class-modal-body">
                            <p className="text-secondary" style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-small)' }}>
                                Applying to <strong>{selectedIds.size} document(s)</strong>
                            </p>
                            {bulkAction === 'category' && (
                                <div className="form-group">
                                    <label className="label" htmlFor="bulk-cat-cp">Category</label>
                                    <select id="bulk-cat-cp" className="input" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                                        {KNOWLEDGE_CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                                    </select>
                                </div>
                            )}
                            {bulkAction === 'priority' && (
                                <div className="form-group">
                                    <label className="label" htmlFor="bulk-pri-cp">Priority</label>
                                    <select id="bulk-pri-cp" className="input" value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)}>
                                        <option value="normal">Normal</option>
                                        <option value="preferred">Preferred</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="class-modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setBulkAction(null)}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={handleBulkSettingsSave}>
                                <Check size={14} strokeWidth={2} /> Apply to {selectedIds.size}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
