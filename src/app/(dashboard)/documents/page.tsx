'use client';
import { useUIFeedback } from '@/components/UIFeedback';
import { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, FileText, Settings, Clock, Eye, ExternalLink, RefreshCw, AlertCircle, Check, FileUp, BookOpen, Shield, CheckSquare, Tag, Star, ShieldCheck, X, Filter, Users } from 'lucide-react';
import DocumentViewerModal from './[id]/DocumentViewerModal';
import { TableShell, StatusBadge, RowActionMenu, TableEmptyState, TableLoadingState } from '@/components/table';
import '@/components/table/table.css';
import '../company-dna/company-dna.css';
import './documents.css';

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
    folderId: string | null;
    knowledgeCategory: string | null;
    useAsKnowledgeSource: boolean;
    knowledgePriority: string | null;
    projectId: string | null;
    createdAt: string;
    source?: 'upload' | 'google_drive' | 'notion';
    externalUrl?: string;
}

interface UploadProgress {
    file: string;
    status: 'uploading' | 'ocr' | 'done' | 'error';
    progress: number;
}

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<DocItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);
    const { showConfirm, showToast } = useUIFeedback();

    // Knowledge settings modal
    const [knowledgeDoc, setKnowledgeDoc] = useState<DocItem | null>(null);
    const [knCategory, setKnCategory] = useState('');
    const [knPriority, setKnPriority] = useState('normal');
    const [knCurated, setKnCurated] = useState(false);

    // Document viewer
    const [viewerDoc, setViewerDoc] = useState<{ id: string; filename: string; mimeType: string } | null>(null);

    // Source tab filter
    const [sourceFilter, setSourceFilter] = useState<'all' | 'upload' | 'google_drive' | 'notion'>('all');

    // Customer / Project filters
    const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: string; name: string; customerId: string | null }[]>([]);
    const [filterCustomer, setFilterCustomer] = useState('');
    const [filterProject, setFilterProject] = useState('');

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<'category' | 'priority' | null>(null);
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkPriority, setBulkPriority] = useState('normal');

    // Load data on mount
    useEffect(() => {
        // Fetch native documents
        fetch('/api/documents/upload').then((r) => r.json())
            .then((docs) => {
                const native = (Array.isArray(docs) ? docs : []).map((d: DocItem) => ({
                    ...d,
                    source: 'upload' as const,
                    ocrStatus: d.ocrStatus || (d.ocrProcessed ? 'PROCESSED' : 'PENDING'),
                    ocrError: d.ocrError || null,
                    version: d.version || 1,
                    hash: d.hash || null,
                    projectId: d.projectId || null,
                }));
                setDocuments(native);
            })
            .catch(console.error)
            .finally(() => setLoading(false));

        // Fetch external documents (Google Drive, Notion, etc.)
        fetch('/api/integrations').then(r => r.json()).then(async (data) => {
            const integrations = data.integrations || [];
            for (const integration of integrations) {
                if (integration.isActive) {
                    const providerSource = integration.provider === 'NOTION' ? 'notion' as const : 'google_drive' as const;
                    try {
                        const res = await fetch(`/api/integrations/${integration.id}/documents`);
                        const docData = await res.json();
                        const extDocs: DocItem[] = (docData.documents || []).map((d: { id: string; filename: string; mimeType: string; size: number; syncStatus: string; externalUrl: string; createdAt: string }) => ({
                            id: `ext-${d.id}`,
                            filename: d.filename,
                            mimeType: d.mimeType,
                            size: d.size || 0,
                            ocrProcessed: d.syncStatus === 'SYNCED',
                            folderId: null,
                            projectId: null,
                            knowledgeCategory: null,
                            useAsKnowledgeSource: false,
                            knowledgePriority: null,
                            createdAt: d.createdAt,
                            source: providerSource,
                            externalUrl: d.externalUrl,
                        }));
                        setDocuments(prev => {
                            const existingIds = new Set(prev.map(d => d.id));
                            const newDocs = extDocs.filter(d => !existingIds.has(d.id));
                            return [...prev, ...newDocs];
                        });
                    } catch { /* silent */ }
                }
            }
        }).catch(() => {});

        // Fetch customers and projects for filters
        fetch('/api/customers').then(r => r.json())
            .then(data => setCustomers(Array.isArray(data) ? data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) : []))
            .catch(() => {});

        fetch('/api/projects').then(r => r.json())
            .then(data => {
                const projs = data.projects || data || [];
                setProjects(Array.isArray(projs) ? projs.map((p: { id: string; name: string; customerId: string | null }) => ({ id: p.id, name: p.name, customerId: p.customerId || null })) : []);
            })
            .catch(() => {});
    }, []);

    // ─── Bulk Upload ─────────────────────────────────
    async function handleUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        setUploading(true);

        const queue: UploadProgress[] = Array.from(files).map((f) => ({
            file: f.name, status: 'uploading' as const, progress: 0,
        }));
        setUploadQueue(queue);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading', progress: 30 } : item));

            try {
                const form = new FormData();
                form.append('file', file);
                const res = await fetch('/api/documents/upload', { method: 'POST', body: form });

                if (res.ok) {
                    const doc = await res.json();
                    // Check for version bump
                    if (doc.version && doc.version > 1) {
                        // Version update — replace the existing doc in state
                        setDocuments((prev) => {
                            const existing = prev.find(d => d.id === doc.id);
                            if (existing) {
                                return prev.map(d => d.id === doc.id ? { ...doc, source: 'upload' as const } : d);
                            }
                            return [{ ...doc, source: 'upload' as const }, ...prev];
                        });
                        showToast(`Document updated to version ${doc.version}`, 'success');
                    } else {
                        setDocuments((prev) => [{ ...doc, source: 'upload' as const }, ...prev]);
                    }
                    setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'ocr', progress: 60 } : item));

                    try {
                        const ocrRes = await fetch('/api/ocr', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ documentId: doc.id }),
                        });
                        if (ocrRes.ok) {
                            setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ocrProcessed: true } : d)));
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

    // ─── Reprocess document ──────────────────────────
    async function handleReprocess(doc: DocItem) {
        // Optimistically update UI to show processing
        setDocuments((prev) => prev.map((d) =>
            d.id === doc.id ? { ...d, ocrStatus: 'PROCESSING', ocrError: null } : d
        ));
        try {
            const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: 'POST' });
            if (res.ok) {
                // Refresh the document state
                setDocuments((prev) => prev.map((d) =>
                    d.id === doc.id ? { ...d, ocrProcessed: true, ocrStatus: 'PROCESSED', ocrError: null } : d
                ));
                showToast('Document reprocessed successfully', 'success');
            } else {
                const errData = await res.json().catch(() => ({}));
                setDocuments((prev) => prev.map((d) =>
                    d.id === doc.id ? { ...d, ocrStatus: 'ERROR', ocrError: errData.detail || errData.error || 'Reprocessing failed' } : d
                ));
                showToast('Reprocessing failed', 'error');
            }
        } catch {
            setDocuments((prev) => prev.map((d) =>
                d.id === doc.id ? { ...d, ocrStatus: 'ERROR', ocrError: 'Network error' } : d
            ));
            showToast('Reprocessing failed', 'error');
        }
    }

    // Compute projects visible in selected customer scope
    const filteredProjects = filterCustomer
        ? projects.filter(p => p.customerId === filterCustomer)
        : projects;

    // Build set of project IDs matching the selected customer
    const customerProjectIds = filterCustomer
        ? new Set(projects.filter(p => p.customerId === filterCustomer).map(p => p.id))
        : null;

    // Filter documents by source tab, then customer, then project
    let filteredDocs = sourceFilter === 'all'
        ? documents
        : sourceFilter === 'upload'
            ? documents.filter(d => d.source === 'upload' || (!d.source))
            : documents.filter(d => d.source === sourceFilter);

    if (filterProject) {
        filteredDocs = filteredDocs.filter(d => d.projectId === filterProject);
    } else if (customerProjectIds) {
        // If customer selected but no project, show docs belonging to any of the customer's projects
        filteredDocs = filteredDocs.filter(d => d.projectId && customerProjectIds.has(d.projectId));
    }

    // ─── Bulk selection helpers ──────────────────────
    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function toggleSelectAll() {
        if (selectedIds.size === filteredDocs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredDocs.map(d => d.id)));
        }
    }

    // Only native uploads can be bulk-processed
    const selectedNativeDocs = filteredDocs.filter(d => selectedIds.has(d.id) && d.source !== 'google_drive' && d.source !== 'notion');

    async function handleBulkReprocess() {
        if (selectedNativeDocs.length === 0) return;
        showConfirm(`Reprocess ${selectedNativeDocs.length} document(s)? This uses AI credits.`, async () => {
            for (const doc of selectedNativeDocs) {
                handleReprocess(doc);
            }
            showToast(`Reprocessing ${selectedNativeDocs.length} documents`, 'success');
            setSelectedIds(new Set());
        });
    }

    async function handleBulkCurated() {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        let updated = 0;
        for (const id of ids) {
            try {
                const res = await fetch(`/api/documents/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ useAsKnowledgeSource: true }),
                });
                if (res.ok) {
                    setDocuments(prev => prev.map(d => d.id === id ? { ...d, useAsKnowledgeSource: true } : d));
                    updated++;
                }
            } catch { /* skip */ }
        }
        showToast(`${updated} document(s) marked as curated`, 'success');
        setSelectedIds(new Set());
    }

    async function handleBulkSettingsSave() {
        if (selectedIds.size === 0 || !bulkAction) return;
        const ids = Array.from(selectedIds);
        let updated = 0;
        for (const id of ids) {
            const body: Record<string, unknown> = {};
            if (bulkAction === 'category') body.knowledgeCategory = bulkCategory || null;
            if (bulkAction === 'priority') body.knowledgePriority = bulkPriority;
            try {
                const res = await fetch(`/api/documents/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (res.ok) {
                    const data = await res.json();
                    setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...data } : d));
                    updated++;
                }
            } catch { /* skip */ }
        }
        showToast(`${updated} document(s) updated`, 'success');
        setBulkAction(null);
        setSelectedIds(new Set());
    }

    async function handleBulkDelete() {
        if (selectedIds.size === 0) return;
        showConfirm(`Delete ${selectedIds.size} document(s)? This cannot be undone.`, async () => {
            const ids = Array.from(selectedIds);
            let deleted = 0;
            for (const id of ids) {
                try {
                    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        setDocuments(prev => prev.filter(d => d.id !== id));
                        deleted++;
                    }
                } catch { /* skip */ }
            }
            showToast(`${deleted} document(s) deleted`, 'success');
            setSelectedIds(new Set());
        });
    }

    // ─── Delete document ─────────────────────────────
    function handleDelete(id: string) {
        showConfirm('Are you sure you want to delete this document?', async () => {
            try {
                await fetch(`/api/documents/${id}`, { method: 'DELETE' });
                setDocuments((prev) => prev.filter((d) => d.id !== id));
                showToast('Document deleted', 'success');
            } catch { showToast('Error deleting', 'error'); }
        });
    }

    // ─── Helpers ──────────────────────────────────────
    function formatSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }


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
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    knowledgeCategory: knCategory || null,
                    knowledgePriority: knPriority,
                    useAsKnowledgeSource: knCurated,
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setDocuments((prev) => prev.map((d) =>
                    d.id === updated.id
                        ? { ...d, knowledgeCategory: updated.knowledgeCategory, useAsKnowledgeSource: updated.useAsKnowledgeSource, knowledgePriority: updated.knowledgePriority }
                        : d
                ));
                showToast('Knowledge settings updated', 'success');
            } else { showToast('Error updating', 'error'); }
        } catch { showToast('Error updating', 'error'); }
        setKnowledgeDoc(null);
    }

    return (
        <div
            className={`docs-window ${dragOver ? 'docs-window-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            style={{ display: 'block' }}
        >
            {/* ── Standard Page Header ── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><FileText size={20} strokeWidth={2} /></span>
                    <h1>Documents</h1>
                </div>
                <div className="assistant-page-workspace">
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff,.bmp"
                        multiple
                        hidden
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                    <button
                        className="btn-brutalist btn-brutalist-primary"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? 'Uploading…' : <><Upload size={14} strokeWidth={2} /> Upload</>}
                    </button>
                </div>
            </div>

            {/* Window-level drag overlay */}
            {dragOver && (
                <div className="docs-drag-overlay">
                    <div className="docs-drag-overlay-inner">
                        <div style={{ fontSize: 48, marginBottom: 12 }}><Upload size={48} strokeWidth={2} /></div>
                        <p style={{ fontWeight: 600, fontSize: 16 }}>Drop to upload</p>
                        <p style={{ fontSize: 13, opacity: 0.7 }}>PDF, DOCX, PNG, JPG — up to 50MB</p>
                    </div>
                </div>
            )}

            {/* Source filter tabs */}
            <div className="docs-source-tabs">
                <button
                    className={`docs-source-tab ${sourceFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('all')}
                >
                    All Sources ({documents.length})
                </button>
                <button
                    className={`docs-source-tab ${sourceFilter === 'upload' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('upload')}
                >
                    <FileUp size={13} strokeWidth={2} /> Uploads ({documents.filter(d => d.source !== 'google_drive').length})
                </button>
                <button
                    className={`docs-source-tab ${sourceFilter === 'google_drive' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('google_drive')}
                >
                    <img src="/logos/google-drive.svg" alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }} />
                    Google Drive ({documents.filter(d => d.source === 'google_drive').length})
                </button>
                <button
                    className={`docs-source-tab ${sourceFilter === 'notion' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('notion')}
                >
                    <img src="/logos/notion.svg" alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }} />
                    Notion ({documents.filter(d => d.source === 'notion').length})
                </button>
            </div>

            {/* ── Filter Bar ── */}
            <div className="docs-filter-bar">
                <div className="docs-filter-group">
                    <Users size={13} strokeWidth={2} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                    <select
                        className="docs-filter-select"
                        value={filterCustomer}
                        onChange={(e) => {
                            setFilterCustomer(e.target.value);
                            setFilterProject('');
                            setSelectedIds(new Set());
                        }}
                    >
                        <option value="">All Customers</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div className="docs-filter-group">
                    <Filter size={13} strokeWidth={2} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                    <select
                        className="docs-filter-select"
                        value={filterProject}
                        onChange={(e) => {
                            setFilterProject(e.target.value);
                            setSelectedIds(new Set());
                        }}
                    >
                        <option value="">All Projects</option>
                        {filteredProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
                {(filterCustomer || filterProject) && (
                    <button
                        className="docs-filter-clear"
                        onClick={() => { setFilterCustomer(''); setFilterProject(''); setSelectedIds(new Set()); }}
                    >
                        <X size={12} strokeWidth={2} /> Clear Filters
                    </button>
                )}
                <span className="docs-count-label" style={{ margin: 0, marginLeft: 'auto' }}>
                    {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Bulk upload progress */}
            {uploadQueue.length > 0 && (
                <div className="upload-progress-panel">
                    <h4 className="upload-progress-title">
                        <Upload size={14} strokeWidth={2} /> Upload in progress ({uploadQueue.filter((q) => q.status === 'done').length}/{uploadQueue.length})
                    </h4>
                    {uploadQueue.map((item, idx) => (
                        <div key={idx} className="upload-progress-item">
                            <div className="upload-progress-info">
                                <span className="upload-filename">{item.file}</span>
                                <span className={`upload-status ${item.status}`}>
                                    {item.status === 'uploading' && 'Uploading...'}
                                    {item.status === 'ocr' && 'OCR...'}
                                    {item.status === 'done' && 'Done'}
                                    {item.status === 'error' && 'Error'}
                                </span>
                            </div>
                            <div className="upload-progress-bar">
                                <div className={`upload-progress-fill ${item.status}`} style={{ width: `${item.progress}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Documents Table ── */}
            {loading ? (
                <TableShell>
                    <table className="nousio-table">
                    <thead><tr>
                        <th>File</th><th>Size</th><th>OCR</th><th>Knowledge</th><th>Date</th><th>Actions</th>
                    </tr></thead>
                    <tbody><tr><td colSpan={6} style={{ padding: 0 }}>
                        <TableLoadingState rows={5} columns={5} />
                    </td></tr></tbody>
                    </table>
                </TableShell>
            ) : documents.length > 0 ? (
                <>
                {/* ── Bulk Action Bar ── */}
                {selectedIds.size > 0 && (
                    <div className="docs-bulk-bar">
                        <div className="docs-bulk-bar-left">
                            <CheckSquare size={14} strokeWidth={2} />
                            <span className="docs-bulk-count">{selectedIds.size} selected</span>
                            <button className="docs-bulk-action" onClick={() => setSelectedIds(new Set())}>
                                <X size={12} strokeWidth={2} /> Clear
                            </button>
                        </div>
                        <div className="docs-bulk-bar-right">
                            {selectedNativeDocs.length > 0 && (
                                <button className="docs-bulk-action docs-bulk-action--primary" onClick={handleBulkReprocess}>
                                    <RefreshCw size={12} strokeWidth={2} /> Reprocess
                                </button>
                            )}
                            <button className="docs-bulk-action" onClick={() => { setBulkAction('category'); setBulkCategory(''); }}>
                                <Tag size={12} strokeWidth={2} /> Category
                            </button>
                            <button className="docs-bulk-action" onClick={() => { setBulkAction('priority'); setBulkPriority('normal'); }}>
                                <Star size={12} strokeWidth={2} /> Priority
                            </button>
                            <button className="docs-bulk-action docs-bulk-action--success" onClick={handleBulkCurated}>
                                <ShieldCheck size={12} strokeWidth={2} /> Mark Curated
                            </button>
                            <button className="docs-bulk-action docs-bulk-action--danger" onClick={handleBulkDelete}>
                                <Trash2 size={12} strokeWidth={2} /> Delete
                            </button>
                        </div>
                    </div>
                )}

                <TableShell>
                    <table className="nousio-table">
                    <thead>
                        <tr>
                            <th style={{ width: '3%', padding: '12px 8px', textAlign: 'center' }}>
                                <input
                                    type="checkbox"
                                    className="row-checkbox"
                                    checked={filteredDocs.length > 0 && selectedIds.size === filteredDocs.length}
                                    onChange={toggleSelectAll}
                                    title="Select all"
                                />
                            </th>
                            <th style={{ width: '3%' }}></th>
                            <th style={{ width: '27%' }}>File</th>
                            <th style={{ width: '8%' }}>Size</th>
                            <th style={{ width: '13%' }}>OCR</th>
                            <th style={{ width: '10%' }}>Knowledge</th>
                            <th style={{ width: '7%' }}>Version</th>
                            <th style={{ width: '10%' }}>Date</th>
                            <th style={{ width: '19%' }} className="align-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDocs.map((doc) => (
                            <tr key={doc.id} className={selectedIds.has(doc.id) ? 'selected' : ''}>
                                <td style={{ width: 28, padding: '8px 8px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        className="row-checkbox"
                                        checked={selectedIds.has(doc.id)}
                                        onChange={() => toggleSelect(doc.id)}
                                    />
                                </td>
                                <td style={{ width: 28, padding: '8px 4px' }}>
                                    {doc.source === 'google_drive' ? (
                                        <img src="/logos/google-drive.svg" alt="Drive" style={{ width: 16, height: 16 }} title="Google Drive" />
                                    ) : doc.source === 'notion' ? (
                                        <img src="/logos/notion.svg" alt="Notion" style={{ width: 16, height: 16 }} title="Notion" />
                                    ) : (
                                        <FileText size={14} style={{ color: '#64748b' }} />
                                    )}
                                </td>
                                <td className="cell-primary">
                                    {doc.source === 'google_drive' && doc.externalUrl ? (
                                        <a href={doc.externalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {doc.filename}
                                            <ExternalLink size={10} style={{ color: '#94a3b8' }} />
                                        </a>
                                    ) : doc.filename}
                                </td>
                                <td>{formatSize(doc.size)}</td>
                                <td>
                                    {(doc.ocrStatus === 'PROCESSED' || (doc.ocrProcessed && doc.ocrStatus !== 'ERROR')) ? (
                                        <StatusBadge variant="success"><Check size={10} strokeWidth={3} /> Processed</StatusBadge>
                                    ) : doc.ocrStatus === 'ERROR' ? (
                                        <div className="docs-error-status">
                                            <StatusBadge variant="error"><AlertCircle size={10} strokeWidth={2} /> Error</StatusBadge>
                                            {doc.ocrError && (
                                                <div className="docs-error-tooltip">{doc.ocrError}</div>
                                            )}
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
                                    ) : (
                                        <span className="text-muted">—</span>
                                    )}
                                </td>
                                <td>
                                    <StatusBadge variant="neutral">v{doc.version || 1}</StatusBadge>
                                </td>
                                <td className="cell-muted">
                                    {new Date(doc.createdAt).toLocaleDateString('en-US')}
                                </td>
                                <td>
                                    <RowActionMenu
                                        primaryAction={{
                                            icon: doc.source === 'google_drive'
                                                ? <ExternalLink size={14} strokeWidth={2} />
                                                : <Eye size={14} strokeWidth={2} />,
                                            title: doc.source === 'google_drive'
                                                ? 'Open in Google Drive'
                                                : 'Open document',
                                            onClick: () => {
                                                if (doc.source === 'google_drive' && doc.externalUrl) {
                                                    window.open(doc.externalUrl, '_blank');
                                                } else {
                                                    setViewerDoc({ id: doc.id, filename: doc.filename, mimeType: doc.mimeType });
                                                }
                                            },
                                        }}
                                        items={[
                                            ...((doc.source !== 'google_drive' && doc.source !== 'notion' && (doc.ocrStatus === 'ERROR' || doc.ocrStatus === 'PROCESSED' || doc.ocrStatus === 'PENDING')) ? [{
                                                label: 'Reprocess',
                                                icon: <RefreshCw size={14} strokeWidth={2} />,
                                                onClick: () => handleReprocess(doc),
                                            }] : []),
                                            {
                                                label: 'Knowledge Settings',
                                                icon: <Settings size={14} strokeWidth={2} />,
                                                onClick: () => openKnowledgeSettings(doc),
                                            },
                                            {
                                                label: 'Delete',
                                                icon: <Trash2 size={14} strokeWidth={2} />,
                                                onClick: () => handleDelete(doc.id),
                                                danger: true,
                                            },
                                        ]}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </TableShell>
                </>
            ) : (
                !uploading && (
                    <TableEmptyState
                        icon={<FileText size={32} strokeWidth={2} />}
                        title="No documents yet"
                        description="Drag files here or click Upload"
                        action={
                            <button className="btn-brutalist btn-brutalist-primary" onClick={() => fileRef.current?.click()}>
                                <Upload size={14} strokeWidth={2} /> Upload Document
                            </button>
                        }
                    />
                )
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
                                <label className="label" htmlFor="kn-category">Category</label>
                                <select id="kn-category" className="input" value={knCategory} onChange={(e) => setKnCategory(e.target.value)}>
                                    {KNOWLEDGE_CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                                <span className="form-hint">Helps the assistant find this document for relevant questions</span>
                            </div>

                            <div className="form-group">
                                <label className="label" htmlFor="kn-priority">Priority</label>
                                <select id="kn-priority" className="input" value={knPriority} onChange={(e) => setKnPriority(e.target.value)}>
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
                                        <span className="form-hint">Marked as authoritative source — receives maximum priority in assistant responses</span>
                                    </span>
                                </label>
                            </div>
                        </div>
                        <div className="class-modal-footer">
                            <button type="button" className="btn-brutalist btn-brutalist-outline" onClick={() => setKnowledgeDoc(null)}>Cancel</button>
                            <button type="button" className="btn-brutalist btn-brutalist-primary" onClick={handleKnowledgeSave}><Check size={14} strokeWidth={2} /> Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Document Viewer Modal ─── */}
            {viewerDoc && (
                <DocumentViewerModal
                    documentId={viewerDoc.id}
                    filename={viewerDoc.filename}
                    mimeType={viewerDoc.mimeType}
                    onClose={() => setViewerDoc(null)}
                />
            )}

            {/* ─── Bulk Settings Modal (Category / Priority) ─── */}
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
                                    <label className="label" htmlFor="bulk-category">Category</label>
                                    <select id="bulk-category" className="input" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                                        {KNOWLEDGE_CATEGORIES.map((cat) => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {bulkAction === 'priority' && (
                                <div className="form-group">
                                    <label className="label" htmlFor="bulk-priority">Priority</label>
                                    <select id="bulk-priority" className="input" value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)}>
                                        <option value="normal">Normal</option>
                                        <option value="preferred">Preferred</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="class-modal-footer">
                            <button type="button" className="btn-brutalist btn-brutalist-outline" onClick={() => setBulkAction(null)}>Cancel</button>
                            <button type="button" className="btn-brutalist btn-brutalist-primary" onClick={handleBulkSettingsSave}>
                                <Check size={14} strokeWidth={2} /> Apply to {selectedIds.size}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
