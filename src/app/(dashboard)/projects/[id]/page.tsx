'use client';
import { useUIFeedback } from '@/components/UIFeedback';
import { useState, useRef, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import {
    Upload, ArrowLeft, CheckSquare, Search, CheckCircle, XCircle,
    FileText, Sparkles, Bot, Clock, Eye, RefreshCw, AlertCircle,
    Check, Settings, Trash2, BookOpen, Shield, ShieldCheck, Tag, Star, X,
    Layers, LayoutList, ExternalLink, Zap, Loader2, FolderKanban, Plus,
} from 'lucide-react';
import DocumentViewerModal from '../../documents/[id]/DocumentViewerModal';
import { TableShell, StatusBadge, RowActionMenu, TableEmptyState, TableLoadingState } from '@/components/table';
import '@/components/table/table.css';
import '../projects.css';
import '@/app/(dashboard)/documents/documents.css';
import '@/app/(dashboard)/company-dna/company-dna.css';

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

interface Project {
    id: string;
    name: string;
    description: string | null;
    contextText: string | null;
}

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

export default function ProjectDetailsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = use(paramsPromise);
    const router = useRouter();
    const { showToast, showConfirm } = useUIFeedback();

    const [project, setProject] = useState<Project | null>(null);
    const [documents, setDocuments] = useState<DocItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingProject, setDeletingProject] = useState(false);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [generatingContext, setGeneratingContext] = useState(false);
    const [viewerDoc, setViewerDoc] = useState<{ id: string; filename: string; mimeType: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Tab navigation
    const [activeTab, setActiveTab] = useState<'documents' | 'tasks' | 'context'>('documents');

    // Task boards state
    const [taskBoards, setTaskBoards] = useState<{ id: string; name: string; description: string | null; taskCount?: number }[]>([]);
    const [loadingBoards, setLoadingBoards] = useState(false);
    const [showCreateBoard, setShowCreateBoard] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [newBoardDesc, setNewBoardDesc] = useState('');
    const [creatingBoard, setCreatingBoard] = useState(false);

    // Knowledge settings modal
    const [knowledgeDoc, setKnowledgeDoc] = useState<DocItem | null>(null);
    const [knCategory, setKnCategory] = useState('');
    const [knPriority, setKnPriority] = useState('normal');
    const [knCurated, setKnCurated] = useState(false);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<'category' | 'priority' | null>(null);
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkPriority, setBulkPriority] = useState('normal');

    useEffect(() => {
        Promise.all([
            fetch(`/api/projects/${params.id}`).then(r => r.json()),
            fetch(`/api/documents/upload?projectId=${params.id}`).then(r => r.json())
        ])
        .then(([projRes, docsRes]) => {
            if (projRes.project) setProject(projRes.project);
            const docs = (Array.isArray(docsRes) ? docsRes : []).map((d: DocItem) => ({
                ...d,
                ocrStatus: d.ocrStatus || (d.ocrProcessed ? 'PROCESSED' : 'PENDING'),
                ocrError: d.ocrError || null,
                version: d.version || 1,
                hash: d.hash || null,
                knowledgeCategory: d.knowledgeCategory || null,
                useAsKnowledgeSource: d.useAsKnowledgeSource || false,
                knowledgePriority: d.knowledgePriority || null,
            }));
            setDocuments(docs);
        })
        .catch(console.error)
        .finally(() => setLoading(false));

        // Fetch task boards for this project
        setLoadingBoards(true);
        fetch(`/api/tasks/boards?projectId=${params.id}`)
            .then(r => r.json())
            .then(data => {
                setTaskBoards(Array.isArray(data.boards) ? data.boards : []);
            })
            .catch(() => {})
            .finally(() => setLoadingBoards(false));
    }, [params.id]);

    // ─── Upload ──────────────────────────────────────
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
                form.append('projectId', params.id);
                const res = await fetch('/api/documents/upload', { method: 'POST', body: form });

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
                        const ocrRes = await fetch('/api/ocr', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ documentId: doc.id }),
                        });
                        if (ocrRes.ok) {
                            setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ocrProcessed: true, ocrStatus: 'PROCESSED' } : d)));
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
                setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, ocrStatus: 'ERROR', ocrError: errData.detail || errData.error || 'Reprocessing failed' } : d));
                showToast('Reprocessing failed', 'error');
            }
        } catch {
            setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, ocrStatus: 'ERROR', ocrError: 'Network error' } : d));
            showToast('Reprocessing failed', 'error');
        }
    }

    // ─── Bulk selection ───────────────────────────────
    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function toggleSelectAll() {
        if (selectedIds.size === documents.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(documents.map(d => d.id)));
        }
    }

    async function handleBulkReprocess() {
        if (selectedIds.size === 0) return;
        const selected = documents.filter(d => selectedIds.has(d.id));
        showConfirm(`Reprocess ${selected.length} document(s)? This uses AI credits.`, async () => {
            for (const doc of selected) { handleReprocess(doc); }
            showToast(`Reprocessing ${selected.length} documents`, 'success');
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

    // ─── Single delete ────────────────────────────────
    function handleDelete(id: string) {
        showConfirm('Are you sure you want to delete this document?', async () => {
            try {
                await fetch(`/api/documents/${id}`, { method: 'DELETE' });
                setDocuments((prev) => prev.filter((d) => d.id !== id));
                showToast('Document deleted', 'success');
            } catch {
                showToast('Error deleting', 'error');
            }
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

    // ─── Generate context ─────────────────────────────
    async function handleGenerateContext() {
        if (!documents.some(d => d.ocrStatus === 'PROCESSED' || d.ocrProcessed)) {
            showToast('Please wait for at least one document to finish processing (OCR) before generating context.', 'error');
            return;
        }
        setGeneratingContext(true);
        try {
            const res = await fetch(`/api/projects/${params.id}/generate-context`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Failed to generate context', 'error');
            } else {
                setProject(data.project);
                showToast('Project context successfully updated from documents!', 'success');
            }
        } catch {
            showToast('Error generating context', 'error');
        } finally {
            setGeneratingContext(false);
        }
    }

    // ─── Delete Project ───────────────────────────────
    function handleDeleteProject() {
        if (!project) return;
        showConfirm(
            `Delete "${project.name}"? This will permanently remove the project and all associated data. This cannot be undone.`,
            async () => {
                setDeletingProject(true);
                try {
                    const res = await fetch(`/api/projects/${params.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast(`"${project.name}" has been deleted`, 'success');
                        router.push('/projects');
                    } else {
                        showToast('Failed to delete project', 'error');
                    }
                } catch {
                    showToast('Error deleting project', 'error');
                } finally {
                    setDeletingProject(false);
                }
            }
        );
    }

    // ─── Helpers ──────────────────────────────────────
    function formatSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async function handleCreateBoard() {
        if (!newBoardName.trim()) return;
        setCreatingBoard(true);
        try {
            const res = await fetch('/api/tasks/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newBoardName.trim(),
                    description: newBoardDesc.trim() || null,
                    projectId: params.id,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setTaskBoards(prev => [{ ...data.board, taskCount: 0 }, ...prev]);
                showToast('Board created successfully', 'success');
                setNewBoardName('');
                setNewBoardDesc('');
                setShowCreateBoard(false);
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.error || 'Failed to create board', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setCreatingBoard(false);
    }

    if (loading) {
        return (
            <div className="pj-root">
                <div className="pj-loading">
                    <Loader2 size={24} className="pj-spin" />
                    <span>Loading project...</span>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="pj-root">
                <div className="pj-empty">
                    <FolderKanban size={48} strokeWidth={1.2} className="pj-empty-icon" />
                    <h3>Project not found</h3>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`pj-root docs-window ${dragOver ? 'docs-window-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            style={{ display: 'block' }}
        >
            {dragOver && (
                <div className="docs-drag-overlay">
                    <div className="docs-drag-overlay-inner">
                        <div style={{ fontSize: 48, marginBottom: 12 }}><Upload size={40} strokeWidth={1.5} /></div>
                        <p style={{ fontWeight: 600, fontSize: 16 }}>Drop to upload to {project.name}</p>
                        <p style={{ fontSize: 13, opacity: 0.7 }}>PDF, DOCX, PNG, JPG — up to 50MB</p>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <header className="pjd-header">
                <button className="pjd-back" onClick={() => router.push('/projects')}>
                    <ArrowLeft size={14} /> Back to Projects
                </button>
                <div className="pjd-header-row">
                    <div className="pjd-header-left">
                        <h1 className="pjd-title">{project.name}</h1>
                        <p className="pjd-desc">{project.description || 'Manage your project context and documents'}</p>
                    </div>
                    <div className="pjd-header-actions">
                        <button
                            className="pjd-delete-btn"
                            onClick={handleDeleteProject}
                            disabled={deletingProject}
                            title="Delete this project"
                        >
                            {deletingProject ? <Loader2 size={14} className="pj-spin" /> : <Trash2 size={14} />}
                            {deletingProject ? 'Deleting...' : 'Delete'}
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff,.bmp"
                            multiple
                            hidden
                            onChange={(e) => handleUpload(e.target.files)}
                        />
                        {activeTab === 'documents' && (
                            <button className="pjd-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                                <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Tab Navigation ── */}
            <nav className="pjd-tabs">
                <button className={`pjd-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
                    <FileText size={13} /> Documents <span className="pjd-tab-count">{documents.length}</span>
                </button>
                <button className={`pjd-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
                    <CheckSquare size={13} /> Tasks <span className="pjd-tab-count">{taskBoards.reduce((sum, b) => sum + (b.taskCount || 0), 0)}</span>
                </button>
                <button className={`pjd-tab ${activeTab === 'context' ? 'active' : ''}`} onClick={() => setActiveTab('context')}>
                    <Layers size={13} /> Context
                </button>
            </nav>

            {/* ═══ DOCUMENTS TAB ═══ */}
            {activeTab === 'documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

                    {/* Document count */}
                    <p className="docs-count-label">
                        {documents.length} document{documents.length !== 1 ? 's' : ''}
                    </p>

                    {/* Upload progress */}
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
                                <button className="docs-bulk-action docs-bulk-action--primary" onClick={handleBulkReprocess}>
                                    <RefreshCw size={12} strokeWidth={2} /> Reprocess
                                </button>
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
                        <TableShell>
                            <table className="nousio-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '3%', padding: '12px 8px', textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            className="row-checkbox"
                                            checked={documents.length > 0 && selectedIds.size === documents.length}
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
                                {documents.map((doc) => (
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
                                            <FileText size={14} style={{ color: '#64748b' }} />
                                        </td>
                                        <td className="cell-primary">{doc.filename}</td>
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
                                                    icon: <Eye size={14} strokeWidth={2} />,
                                                    title: 'Open document',
                                                    onClick: () => setViewerDoc({ id: doc.id, filename: doc.filename, mimeType: doc.mimeType }),
                                                }}
                                                items={[
                                                    ...((doc.ocrStatus === 'ERROR' || doc.ocrStatus === 'PROCESSED' || doc.ocrStatus === 'PENDING') ? [{
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
                    ) : (
                        !uploading && (
                            <TableEmptyState
                                icon={<FileText size={32} strokeWidth={2} />}
                                title="No project documents"
                                description="Drag files here or click Upload to attach knowledge to this project"
                                action={
                                    <button className="btn-brutalist btn-brutalist-primary" onClick={() => fileRef.current?.click()}>
                                        <Upload size={14} strokeWidth={2} /> Upload Document
                                    </button>
                                }
                            />
                        )
                    )}
            </div>
            )}

            {/* ═══ TASKS TAB ═══ */}
            {activeTab === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

                {/* Create board header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p className="docs-count-label">
                        {taskBoards.length} board{taskBoards.length !== 1 ? 's' : ''}
                    </p>
                    <button
                        className="pjd-upload-btn"
                        onClick={() => setShowCreateBoard(true)}
                    >
                        <Plus size={14} /> New Board
                    </button>
                </div>

                {loadingBoards ? (
                    <div className="flex justify-center" style={{ padding: 'var(--space-xxl)' }}>
                        <div className="spinner" />
                    </div>
                ) : taskBoards.length > 0 ? (
                    <TableShell>
                        <table className="nousio-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}></th>
                                <th style={{ width: '40%' }}>Board Name</th>
                                <th style={{ width: '35%' }}>Description</th>
                                <th style={{ width: '20%' }} className="align-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {taskBoards.map((board) => (
                                <tr key={board.id}>
                                    <td style={{ padding: '8px 8px' }}>
                                        <LayoutList size={14} style={{ color: '#64748b' }} />
                                    </td>
                                    <td className="cell-primary">{board.name}</td>
                                    <td className="cell-muted">{board.description || '—'}</td>
                                    <td className="align-right">
                                        <a
                                            href={`/tasks?boardId=${board.id}`}
                                            className="btn-brutalist btn-brutalist-outline"
                                            style={{ fontSize: '11px', padding: '6px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <ExternalLink size={12} strokeWidth={2} /> Open Board
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        </table>
                    </TableShell>
                ) : (
                    <TableEmptyState
                        icon={<CheckSquare size={32} strokeWidth={2} />}
                        title="No task boards yet"
                        description="Create a task board to organize work for this project"
                        action={
                            <button
                                className="pjd-upload-btn"
                                onClick={() => setShowCreateBoard(true)}
                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Plus size={14} strokeWidth={2} /> Create Board
                            </button>
                        }
                    />
                )}

                {/* ── Create Board Modal ── */}
                {showCreateBoard && (
                    <div className="class-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateBoard(false); setNewBoardName(''); setNewBoardDesc(''); } }}>
                        <div className="class-modal" style={{ width: 'min(520px, 95vw)' }}>
                            <div className="class-modal-header">
                                <h3><LayoutList size={16} strokeWidth={2} /> Create Board</h3>
                                <button className="class-modal-close" onClick={() => { setShowCreateBoard(false); setNewBoardName(''); setNewBoardDesc(''); }}>✕</button>
                            </div>
                            <div className="class-modal-body">
                                <p className="text-secondary" style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-small)' }}>
                                    This board will be linked to <strong>{project?.name || 'this project'}</strong>
                                </p>

                                <div className="form-group">
                                    <label className="label" htmlFor="board-name-input">Board Name *</label>
                                    <input
                                        id="board-name-input"
                                        className="input"
                                        type="text"
                                        placeholder="e.g. Product Launch, Q2 Ops..."
                                        value={newBoardName}
                                        onChange={e => setNewBoardName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateBoard(); }}
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="label" htmlFor="board-desc-input">Description</label>
                                    <textarea
                                        id="board-desc-input"
                                        className="input"
                                        placeholder="Brief board description (optional)"
                                        value={newBoardDesc}
                                        onChange={e => setNewBoardDesc(e.target.value)}
                                        rows={3}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                            <div className="class-modal-footer">
                                <button type="button" className="btn-brutalist btn-brutalist-outline" onClick={() => { setShowCreateBoard(false); setNewBoardName(''); setNewBoardDesc(''); }}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn-brutalist btn-brutalist-primary"
                                    onClick={handleCreateBoard}
                                    disabled={!newBoardName.trim() || creatingBoard}
                                >
                                    {creatingBoard ? <Loader2 size={14} className="pj-spin" /> : <Plus size={14} />}
                                    {creatingBoard ? 'Creating...' : 'Create Board'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* ═══ CONTEXT TAB — Newsletter Style ═══ */}
            {activeTab === 'context' && (
            <div className="pjd-context-newsletter">
                {/* Masthead */}
                <div className="pjd-ctx-masthead">
                    <div className="pjd-ctx-masthead-label">NOUSIO PROJECT CONTEXT</div>
                </div>

                {/* Dateline */}
                <div className="pjd-ctx-dateline">
                    <div className="pjd-ctx-dateline-rule" />
                    <div className="pjd-ctx-dateline-content">
                        <span className="pjd-ctx-dateline-project">{project.name}</span>
                        <span className="pjd-ctx-dateline-sep">·</span>
                        <span className="pjd-ctx-dateline-docs">{documents.length} source documents</span>
                    </div>
                    <div className="pjd-ctx-dateline-rule" />
                </div>

                {/* Generate CTA */}
                <div className="pjd-ctx-generate">
                    <button
                        className="pjd-ctx-generate-btn"
                        onClick={handleGenerateContext}
                        disabled={generatingContext || documents.length === 0}
                    >
                        {generatingContext ? (
                            <><Loader2 size={14} className="pj-spin" /> Analyzing documents...</>
                        ) : (
                            <><Sparkles size={14} /> {project.contextText ? 'Regenerate Context' : 'Generate via AI'}</>
                        )}
                    </button>
                </div>

                {/* Content */}
                {project.contextText ? (
                    <article className="pjd-ctx-article">
                        <div className="pjd-ctx-section-label"><Zap size={12} /> AI-GENERATED CONTEXT</div>
                        <div className="pjd-ctx-prose">
                            <ReactMarkdown>{project.contextText}</ReactMarkdown>
                        </div>
                    </article>
                ) : (
                    <div className="pjd-ctx-empty">
                        <Layers size={40} strokeWidth={1.2} />
                        <h3>No context generated yet</h3>
                        <p>Upload documents to this project, then click &ldquo;Generate via AI&rdquo; to create a comprehensive project context that all AI assistants will use.</p>
                    </div>
                )}

                {/* Footer */}
                <footer className="pjd-ctx-footer">
                    <div className="pjd-ctx-footer-rule" />
                    <div className="pjd-ctx-footer-content">
                        <span className="pjd-ctx-footer-brand">nousio</span>
                        <span className="pjd-ctx-footer-tagline">AI-Powered Project Intelligence</span>
                    </div>
                </footer>
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
                                <label className="label" htmlFor="kn-category-proj">Category</label>
                                <select id="kn-category-proj" className="input" value={knCategory} onChange={(e) => setKnCategory(e.target.value)}>
                                    {KNOWLEDGE_CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                                <span className="form-hint">Helps the assistant find this document for relevant questions</span>
                            </div>

                            <div className="form-group">
                                <label className="label" htmlFor="kn-priority-proj">Priority</label>
                                <select id="kn-priority-proj" className="input" value={knPriority} onChange={(e) => setKnPriority(e.target.value)}>
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
                                    <label className="label" htmlFor="bulk-category-proj">Category</label>
                                    <select id="bulk-category-proj" className="input" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                                        {KNOWLEDGE_CATEGORIES.map((cat) => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {bulkAction === 'priority' && (
                                <div className="form-group">
                                    <label className="label" htmlFor="bulk-priority-proj">Priority</label>
                                    <select id="bulk-priority-proj" className="input" value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)}>
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
