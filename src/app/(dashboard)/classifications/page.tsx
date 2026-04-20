'use client';

import { useState, useEffect } from 'react';
import { useUIFeedback } from '@/components/UIFeedback';
import {
    Tag, ClipboardList, BarChart3, FolderOpen, FileText, AlertTriangle,
    RefreshCw, Rocket, Mic, Square, Sparkles, X, Download, Save, Home, Check,
} from 'lucide-react';

import './classifications.css';

// ─── Types ───────────────────────────────────────────

interface FieldDef {
    name: string;
    type: string;
    description: string;
}

interface ClassificationType {
    id: string;
    name: string;
    description: string | null;
    aiPrompt: string;
    fieldDefinitions: FieldDef[];
    createdAt: string;
}

interface ClassificationResult {
    id: string;
    documentId: string;
    classificationTypeId: string;
    extractedFields: Record<string, unknown>;
    confidence: number | null;
    status: string;
    createdAt: string;
    document?: { id: string; filename: string; mimeType: string };
    error?: string;
}

interface DocItem {
    id: string;
    filename: string;
    mimeType: string;
    ocrProcessed: boolean;
    folderId: string | null;
}

interface Folder {
    id: string;
    name: string;
    parentId: string | null;
}

// ─── Component ───────────────────────────────────────

export default function ClassificationsPage() {
    const [tab, setTab] = useState<'types' | 'classify' | 'history'>('types');
    const [types, setTypes] = useState<ClassificationType[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast, showConfirm } = useUIFeedback();

    // Create/Edit type modal
    const [showCreate, setShowCreate] = useState(false);
    const [editingType, setEditingType] = useState<ClassificationType | null>(null);
    const [createForm, setCreateForm] = useState({ name: '', description: '', aiPrompt: '' });
    const [createFields, setCreateFields] = useState<FieldDef[]>([]);
    const [creating, setCreating] = useState(false);
    const [suggesting, setSuggesting] = useState(false);

    // Speech-to-text for AI prompt
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);

    // AI refine prompt
    const [refining, setRefining] = useState(false);

    // Classify tab — batch mode
    const [documents, setDocuments] = useState<DocItem[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState('');
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
    const [classifying, setClassifying] = useState(false);
    const [classifyProgress, setClassifyProgress] = useState(0);
    const [batchResults, setBatchResults] = useState<ClassificationResult[]>([]);
    const [showResults, setShowResults] = useState(false);

    // Folders
    const [folders, setFolders] = useState<Folder[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

    // Detail modal
    const [detailResult, setDetailResult] = useState<ClassificationResult | null>(null);
    const [editedDetailFields, setEditedDetailFields] = useState<Record<string, string>>({});
    const [savingDetail, setSavingDetail] = useState(false);

    // History tab
    interface HistoryRun {
        batchId: string;
        classificationTypeId: string;
        classificationTypeName: string;
        fieldDefinitions: FieldDef[];
        documentCount: number;
        resultIds: string[];
        avgConfidence: number | null;
        createdAt: string;
    }
    const [historyRuns, setHistoryRuns] = useState<HistoryRun[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedRun, setSelectedRun] = useState<HistoryRun | null>(null);
    const [historyResults, setHistoryResults] = useState<ClassificationResult[]>([]);

    // ─── Load data ───────────────────────────────────

    useEffect(() => {
        loadTypes();
        loadDocuments();
        loadFolders();
    }, []);

    async function loadTypes() {
        try {
            const res = await fetch('/api/classifications');
            const data = await res.json();
            setTypes(Array.isArray(data) ? data : []);
        } catch {
            console.error('Failed to load types');
        }
        setLoading(false);
    }

    async function loadDocuments() {
        try {
            const res = await fetch('/api/documents/upload');
            const data = await res.json();
            setDocuments(Array.isArray(data) ? data : []);
        } catch {
            console.error('Failed to load docs');
        }
    }

    async function loadFolders() {
        try {
            const res = await fetch('/api/documents/folders');
            const data = await res.json();
            setFolders(Array.isArray(data) ? data : []);
        } catch {
            console.error('Failed to load folders');
        }
    }

    async function loadRuns() {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/classifications/history');
            const data = await res.json();
            setHistoryRuns(Array.isArray(data.runs) ? data.runs : []);
        } catch {
            console.error('Failed to load history runs');
        }
        setHistoryLoading(false);
    }

    async function loadRunResults(run: HistoryRun) {
        setSelectedRun(run);
        setHistoryResults([]);
        try {
            // Fetch detailed results for this run
            const res = await fetch(`/api/classifications/${run.classificationTypeId}`);
            const data = await res.json();
            if (data.results) {
                const runResultIds = new Set(run.resultIds);
                const filtered = data.results.filter((r: ClassificationResult) => runResultIds.has(r.id));
                setHistoryResults(filtered);
            }
        } catch {
            console.error('Failed to load run results');
        }
    }

    useEffect(() => {
        if (tab === 'history') loadRuns();
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Create Type ─────────────────────────────────

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!createForm.name || !createForm.aiPrompt) return;
        setCreating(true);

        try {
            if (editingType) {
                // Update existing type
                const res = await fetch(`/api/classifications/${editingType.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...createForm,
                        fieldDefinitions: createFields,
                    }),
                });

                if (res.ok) {
                    const updated = await res.json();
                    setTypes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                    closeFormModal();
                    showToast('Tipo de classificação atualizado!', 'success');
                } else {
                    showToast('Falha ao atualizar tipo', 'error');
                }
            } else {
                // Create new type
                const res = await fetch('/api/classifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...createForm,
                        fieldDefinitions: createFields,
                    }),
                });

                if (res.ok) {
                    const created = await res.json();
                    setTypes((prev) => [created, ...prev]);
                    closeFormModal();
                    showToast('Tipo de classificação criado com sucesso!', 'success');
                } else {
                    showToast('Falha ao criar tipo de classificação', 'error');
                }
            }
        } catch {
            showToast('Erro de conexão', 'error');
        }
        setCreating(false);
    }

    function openEditModal(t: ClassificationType) {
        setEditingType(t);
        setCreateForm({ name: t.name, description: t.description || '', aiPrompt: t.aiPrompt });
        setCreateFields(Array.isArray(t.fieldDefinitions) ? [...t.fieldDefinitions] : []);
        setShowCreate(true);
    }

    function closeFormModal() {
        setShowCreate(false);
        setEditingType(null);
        setCreateForm({ name: '', description: '', aiPrompt: '' });
        setCreateFields([]);
    }

    async function handleSuggestFields() {
        if (!createForm.aiPrompt) {
            showToast('Defina o prompt AI antes de sugerir campos', 'warning');
            return;
        }
        setSuggesting(true);

        try {
            const res = await fetch('/api/classifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: createForm.name || 'temp',
                    aiPrompt: createForm.aiPrompt,
                    fieldDefinitions: [],
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.fieldDefinitions) && data.fieldDefinitions.length > 0) {
                    setCreateFields(data.fieldDefinitions);
                    // Delete the temp type that was created
                    await fetch(`/api/classifications/${data.id}`, { method: 'DELETE' });
                    showToast(`${data.fieldDefinitions.length} campos sugeridos pela IA!`, 'success');
                } else {
                    showToast('A IA não sugeriu campos. Defina manualmente.', 'warning');
                }
            }
        } catch {
            showToast('Erro ao sugerir campos', 'error');
        }
        setSuggesting(false);
    }

    function addField() {
        setCreateFields((prev) => [...prev, { name: '', type: 'string', description: '' }]);
    }

    function updateField(idx: number, key: keyof FieldDef, value: string) {
        setCreateFields((prev) =>
            prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f))
        );
    }

    function removeField(idx: number) {
        setCreateFields((prev) => prev.filter((_, i) => i !== idx));
    }

    // ─── Speech-to-Text ──────────────────────────────

    function startListening() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast('O seu navegador não suporta reconhecimento de voz', 'error');
            return;
        }

        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'pt-PT';

        let finalTranscript = '';

        rec.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interim = transcript;
                }
            }
            setCreateForm((f) => ({
                ...f,
                aiPrompt: (finalTranscript + interim).trim(),
            }));
        };

        rec.onerror = (event: any) => {
            console.error('Speech error:', event.error);
            setIsListening(false);
        };

        rec.onend = () => {
            setIsListening(false);
        };

        rec.start();
        setRecognition(rec);
        setIsListening(true);
    }

    function stopListening() {
        if (recognition) {
            recognition.stop();
            setRecognition(null);
        }
        setIsListening(false);
    }

    // ─── Refine Prompt with AI ───────────────────────

    async function handleRefinePrompt() {
        if (!createForm.aiPrompt.trim()) {
            showToast('Escreva primeiro um prompt para refinar', 'warning');
            return;
        }
        setRefining(true);

        try {
            const res = await fetch('/api/classifications/refine-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: createForm.aiPrompt }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.refined) {
                    setCreateForm((f) => ({ ...f, aiPrompt: data.refined }));
                    showToast('Prompt refinado com IA!', 'success');
                }
            } else {
                showToast('Erro ao refinar prompt', 'error');
            }
        } catch {
            showToast('Erro de conexão', 'error');
        }
        setRefining(false);
    }

    // ─── Delete Type ─────────────────────────────────

    function handleDeleteType(id: string, name: string) {
        showConfirm(`Eliminar tipo "${name}" e todos os resultados associados?`, async () => {
            try {
                await fetch(`/api/classifications/${id}`, { method: 'DELETE' });
                setTypes((prev) => prev.filter((t) => t.id !== id));
                showToast('Tipo eliminado', 'success');
            } catch {
                showToast('Falha ao eliminar', 'error');
            }
        });
    }

    // ─── Batch Classify ──────────────────────────────

    function toggleDocSelection(docId: string) {
        setSelectedDocIds((prev) => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId);
            else next.add(docId);
            return next;
        });
    }

    function toggleSelectAll() {
        const visibleOcrDocs = ocrDocsInFolder;
        if (visibleOcrDocs.every((d) => selectedDocIds.has(d.id)) && visibleOcrDocs.length > 0) {
            // Deselect only the visible ones
            setSelectedDocIds((prev) => {
                const next = new Set(prev);
                visibleOcrDocs.forEach((d) => next.delete(d.id));
                return next;
            });
        } else {
            // Add all visible docs to selection
            setSelectedDocIds((prev) => {
                const next = new Set(prev);
                visibleOcrDocs.forEach((d) => next.add(d.id));
                return next;
            });
        }
    }

    async function handleBatchClassify() {
        if (!selectedTypeId || selectedDocIds.size === 0) {
            showToast('Selecione um tipo e pelo menos um documento', 'warning');
            return;
        }
        setClassifying(true);
        setClassifyProgress(0);
        setBatchResults([]);
        setShowResults(false);

        try {
            const docIds = Array.from(selectedDocIds);
            // Simulate progress while waiting
            const progressInterval = setInterval(() => {
                setClassifyProgress((prev) => Math.min(prev + 100 / (docIds.length * 3), 95));
            }, 1000);

            const res = await fetch('/api/classifications/classify-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    classificationTypeId: selectedTypeId,
                    documentIds: docIds,
                }),
            });

            clearInterval(progressInterval);
            setClassifyProgress(100);

            if (res.ok) {
                const data = await res.json();
                setBatchResults(data.results || []);
                setShowResults(true);
                showToast(`${data.results?.length || 0} documento(s) classificado(s)!`, 'success');
            } else {
                const err = await res.json();
                showToast(err.error || 'Falha na classificação em lote', 'error');
            }
        } catch {
            showToast('Erro de conexão', 'error');
        }
        setClassifying(false);
    }

    // ─── Export ───────────────────────────────────────

    async function handleExportExcel() {
        const resultIds = batchResults.filter((r) => r.id).map((r) => r.id).join(',');
        if (!resultIds) {
            showToast('Nenhum resultado para exportar', 'warning');
            return;
        }
        window.open(`/api/classifications/export-excel?resultIds=${resultIds}`, '_blank');
    }

    async function handleExportImages() {
        const resultIds = batchResults.filter((r) => r.id).map((r) => r.id).join(',');
        if (!resultIds) {
            showToast('Nenhum resultado para exportar', 'warning');
            return;
        }

        try {
            const res = await fetch(`/api/classifications/export-images?resultIds=${resultIds}`);
            const data = await res.json();
            if (data.downloads) {
                for (const dl of data.downloads) {
                    const link = document.createElement('a');
                    link.href = dl.downloadUrl;
                    link.download = dl.filename;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    // Small delay between downloads
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
                showToast(`${data.downloads.length} ficheiro(s) a descarregar`, 'success');
            }
        } catch {
            showToast('Erro ao exportar ficheiros', 'error');
        }
    }

    // ─── Open Detail Modal ─────────────────────────────

    function openDetailModal(result: ClassificationResult) {
        setDetailResult(result);
        const fields = result.extractedFields || {};
        const editable: Record<string, string> = {};
        for (const [k, v] of Object.entries(fields)) {
            editable[k] = v !== null && v !== undefined ? String(v) : '';
        }
        setEditedDetailFields(editable);
    }

    function navigateDetail(direction: -1 | 1) {
        if (!detailResult) return;
        const navigable = batchResults.filter((r) => r.status !== 'failed');
        const idx = navigable.findIndex((r) => r.id === detailResult.id);
        if (idx < 0) return;
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= navigable.length) return;
        openDetailModal(navigable[nextIdx]);
    }

    function getDetailIndex(): { current: number; total: number } {
        const navigable = batchResults.filter((r) => r.status !== 'failed');
        const idx = navigable.findIndex((r) => r.id === detailResult?.id);
        return { current: idx + 1, total: navigable.length };
    }

    // ─── Save Corrected Fields ───────────────────────────

    async function handleSaveDetailFields() {
        if (!detailResult) return;
        setSavingDetail(true);
        try {
            await fetch(`/api/classifications/results/${detailResult.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extractedFields: editedDetailFields }),
            });
            // Update the result in batchResults too
            setBatchResults((prev) =>
                prev.map((r) =>
                    r.id === detailResult.id
                        ? { ...r, extractedFields: { ...editedDetailFields } }
                        : r
                )
            );
            setDetailResult((prev) =>
                prev ? { ...prev, extractedFields: { ...editedDetailFields } } : null
            );
            showToast('Dados atualizados com sucesso!', 'success');
        } catch {
            showToast('Erro ao guardar alterações', 'error');
        }
        setSavingDetail(false);
    }

    // ─── Computed ────────────────────────────────────

    const selectedType = types.find((t) => t.id === selectedTypeId);
    const ocrDocs = documents.filter((d) => d.ocrProcessed);
    const ocrDocsInFolder = ocrDocs.filter((d) =>
        currentFolderId === null ? d.folderId === null || d.folderId === undefined : d.folderId === currentFolderId
    );
    const foldersInCurrent = folders.filter((f) =>
        currentFolderId === null ? f.parentId === null || f.parentId === undefined : f.parentId === currentFolderId
    );

    function getBreadcrumbs(): Array<{ id: string | null; name: string }> {
        const crumbs: Array<{ id: string | null; name: string }> = [{ id: null, name: 'Todos' }];
        if (currentFolderId === null) return crumbs;
        const chain: Folder[] = [];
        let fid: string | null = currentFolderId;
        while (fid) {
            const f = folders.find((x) => x.id === fid);
            if (!f) break;
            chain.unshift(f);
            fid = f.parentId;
        }
        for (const c of chain) crumbs.push({ id: c.id, name: c.name });
        return crumbs;
    }

    const allVisibleChecked = ocrDocsInFolder.length > 0 && ocrDocsInFolder.every((d) => selectedDocIds.has(d.id));
    const totalResults = batchResults.length;
    const completedResults = batchResults.filter((r) => r.status === 'completed');
    const avgConfidence = completedResults.length > 0
        ? completedResults.reduce((sum: number, r: ClassificationResult) => sum + (r.confidence ?? 0), 0) / completedResults.length
        : 0;

    const fieldDefs: FieldDef[] = selectedType && Array.isArray(selectedType.fieldDefinitions)
        ? selectedType.fieldDefinitions
        : [];

    // ─── Render ──────────────────────────────────────

    if (loading) {
        return (
            <div className="flex justify-center" style={{ padding: 'var(--space-xxl)' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Tag size={20} strokeWidth={2} /></span>
                    <h1>Data Extraction</h1>
                </div>
            </div>

            {/* Tabs */}
            <div className="class-tabs">
                <button
                    className={`class-tab ${tab === 'types' ? 'active' : ''}`}
                    onClick={() => setTab('types')}
                >
                    <Tag size={14} /> Tipos de Classificação
                </button>
                <button
                    className={`class-tab ${tab === 'classify' ? 'active' : ''}`}
                    onClick={() => setTab('classify')}
                >
                    <ClipboardList size={14} /> Classificar Documento
                </button>
                <button
                    className={`class-tab ${tab === 'history' ? 'active' : ''}`}
                    onClick={() => setTab('history')}
                >
                    <BarChart3 size={14} /> Histórico
                </button>
            </div>

            {/* ═══ TAB: Types ═══ */}
            {
                tab === 'types' && (
                    <div>
                        <div className="flex justify-between items-center mb-md">
                            <span className="text-muted">
                                {types.length} tipo{types.length !== 1 ? 's' : ''} definido{types.length !== 1 ? 's' : ''}
                            </span>
                            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                                + Novo Tipo
                            </button>
                        </div>

                        {types.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><Tag size={32} /></div>
                                <h3>Sem tipos de classificação</h3>
                                <p className="text-secondary mt-xs">
                                    Crie o primeiro tipo para começar a classificar documentos
                                </p>
                                <button className="btn btn-primary mt-md" onClick={() => setShowCreate(true)}>
                                    + Criar Primeiro Tipo
                                </button>
                            </div>
                        ) : (
                            <div className="class-types-grid">
                                {types.map((t) => (
                                    <div key={t.id} className="class-type-card">
                                        <h3><Tag size={16} /> {t.name}</h3>
                                        <p className="type-prompt">{t.aiPrompt}</p>
                                        <div className="type-fields">
                                            {Array.isArray(t.fieldDefinitions) &&
                                                t.fieldDefinitions.map((f, i) => (
                                                    <span key={i} className="field-badge">
                                                        {f.name}
                                                    </span>
                                                ))}
                                            {(!Array.isArray(t.fieldDefinitions) || t.fieldDefinitions.length === 0) && (
                                                <span className="text-muted" style={{ fontSize: 12 }}>
                                                    Sem campos definidos
                                                </span>
                                            )}
                                        </div>
                                        <div className="type-actions">
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => openEditModal(t)}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{ color: 'var(--color-state-error)' }}
                                                onClick={() => handleDeleteType(t.id, t.name)}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {/* ═══ TAB: Classify (Batch) ═══ */}
            {
                tab === 'classify' && (
                    <div className="classify-flow">
                        {!showResults ? (
                            <>
                                {/* Step 1: Select Type */}
                                <div className="classify-step">
                                    <h3>
                                        <span className="step-number">1</span>
                                        Selecionar Tipo de Classificação
                                    </h3>
                                    {types.length === 0 ? (
                                        <p className="text-secondary">
                                            Nenhum tipo definido.{' '}
                                            <button className="btn btn-ghost btn-sm" onClick={() => setTab('types')}>
                                                Criar tipo →
                                            </button>
                                        </p>
                                    ) : (
                                        <select
                                            className="select"
                                            value={selectedTypeId}
                                            onChange={(e) => setSelectedTypeId(e.target.value)}
                                        >
                                            <option value="">Selecione um tipo...</option>
                                            {types.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name} ({Array.isArray(t.fieldDefinitions) ? t.fieldDefinitions.length : 0} campos)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {selectedType && Array.isArray(selectedType.fieldDefinitions) && (
                                        <div className="type-fields mt-sm">
                                            <span className="text-muted" style={{ fontSize: 12, marginRight: 8 }}>
                                                Campos:
                                            </span>
                                            {selectedType.fieldDefinitions.map((f, i) => (
                                                <span key={i} className="field-badge">{f.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Select Documents (multi) */}
                                <div className="classify-step">
                                    <h3>
                                        <span className="step-number">2</span>
                                        Selecionar Documentos
                                        {selectedDocIds.size > 0 && (
                                            <span className="doc-count-badge">{selectedDocIds.size}</span>
                                        )}
                                    </h3>

                                    {ocrDocs.length === 0 && folders.length === 0 ? (
                                        <p className="text-secondary">
                                            Nenhum documento com OCR disponível. Faça upload e execute OCR na página Documentos.
                                        </p>
                                    ) : (
                                        <>
                                            {/* Breadcrumbs */}
                                            {currentFolderId !== null && (
                                                <div className="folder-breadcrumbs">
                                                    {getBreadcrumbs().map((crumb, i, arr) => (
                                                        <span key={crumb.id ?? 'root'}>
                                                            <button
                                                                className={`breadcrumb-btn ${i === arr.length - 1 ? 'active' : ''}`}
                                                                onClick={() => setCurrentFolderId(crumb.id)}
                                                            >
                                                                {i === 0 ? <Home size={12} strokeWidth={2} /> : ''} {crumb.name}
                                                            </button>
                                                            {i < arr.length - 1 && <span className="breadcrumb-sep">/</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="batch-select-header">
                                                <label className="batch-check-all">
                                                    <input
                                                        type="checkbox"
                                                        checked={allVisibleChecked}
                                                        onChange={toggleSelectAll}
                                                    />
                                                    <span>Selecionar todos ({ocrDocsInFolder.length})</span>
                                                </label>
                                                {selectedDocIds.size > 0 && (
                                                    <span className="text-muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
                                                        {selectedDocIds.size} selecionado{selectedDocIds.size !== 1 ? 's' : ''} no total
                                                    </span>
                                                )}
                                            </div>
                                            <div className="batch-doc-list">
                                                {/* Folder items */}
                                                {foldersInCurrent.map((folder) => {
                                                    const docsInThisFolder = ocrDocs.filter((d) => d.folderId === folder.id).length;
                                                    return (
                                                        <div
                                                            key={folder.id}
                                                            className="batch-doc-item batch-folder-item"
                                                            onClick={() => setCurrentFolderId(folder.id)}
                                                        >
                                                            <span className="batch-doc-icon"><FolderOpen size={16} strokeWidth={2} /></span>
                                                            <span className="batch-doc-name">{folder.name}</span>
                                                            <span className="batch-doc-type">{docsInThisFolder} doc{docsInThisFolder !== 1 ? 's' : ''}</span>
                                                        </div>
                                                    );
                                                })}
                                                {/* Document items */}
                                                {ocrDocsInFolder.map((d) => (
                                                    <label key={d.id} className={`batch-doc-item ${selectedDocIds.has(d.id) ? 'selected' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedDocIds.has(d.id)}
                                                            onChange={() => toggleDocSelection(d.id)}
                                                        />
                                                        <span className="batch-doc-icon"><FileText size={16} strokeWidth={2} /></span>
                                                        <span className="batch-doc-name">{d.filename}</span>
                                                        <span className="batch-doc-type">{d.mimeType.split('/')[1]?.toUpperCase()}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {documents.filter((d) => !d.ocrProcessed).length > 0 && (
                                        <p className="text-muted mt-xs" style={{ fontSize: 12 }}>
                                            <AlertTriangle size={14} strokeWidth={2} /> {documents.filter((d) => !d.ocrProcessed).length} documento(s) sem OCR não aparecem.
                                        </p>
                                    )}
                                </div>

                                {/* Step 3: Classify */}
                                <div className="classify-step">
                                    <h3>
                                        <span className="step-number">3</span>
                                        Executar Classificação
                                    </h3>
                                    <button
                                        className="btn btn-primary btn-classify-batch"
                                        disabled={!selectedTypeId || selectedDocIds.size === 0 || classifying}
                                        onClick={handleBatchClassify}
                                    >
                                        {classifying
                                            ? <><RefreshCw size={14} strokeWidth={2} className="spin" /> A classificar... ({Math.round(classifyProgress)}%)</>
                                            : <><Rocket size={14} strokeWidth={2} /> Classificar {selectedDocIds.size} Documento{selectedDocIds.size !== 1 ? 's' : ''}</>}
                                    </button>
                                    {classifying && (
                                        <div className="progress-bar-container">
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: `${classifyProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* ═══ Results View ═══ */
                            <div className="batch-results-view">
                                <div className="results-header">
                                    <div>
                                        <span className="results-label">RESULTADOS</span>
                                        <h2 className="results-title">Processamento concluído.</h2>
                                        <p className="text-secondary">
                                            Reveja os documentos extraídos e resolva eventuais exceções.
                                        </p>
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            setShowResults(false);
                                            setBatchResults([]);
                                            setSelectedDocIds(new Set());
                                            setClassifyProgress(0);
                                        }}
                                    >
                                        Novo Upload
                                    </button>
                                </div>

                                {/* Summary Cards */}
                                <div className="results-summary results-summary-2">
                                    <div className="stat-card">
                                        <span className="stat-label">TOTAL DOCUMENTOS</span>
                                        <span className="stat-value">{totalResults}</span>
                                    </div>
                                    <div className="stat-card">
                                        <span className="stat-label">MÉDIA DE CONFIANÇA</span>
                                        <span className="stat-value">{Math.round(avgConfidence * 100)}%</span>
                                    </div>
                                </div>

                                {/* Export Bar */}
                                <div className="export-bar">
                                    <button className="btn btn-export" onClick={handleExportExcel}>
                                        <Download size={14} strokeWidth={2} /> Excel
                                    </button>
                                    <button className="btn btn-export" onClick={handleExportImages}>
                                        <Download size={14} strokeWidth={2} /> PDFs
                                    </button>
                                </div>

                                {/* Results Table */}
                                <div className="results-table-wrapper">
                                    <table className="results-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Documento</th>
                                                {fieldDefs.map((f) => (
                                                    <th key={f.name}>{f.name}</th>
                                                ))}
                                                <th>Confiança</th>
                                                <th>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batchResults.map((r, idx) => (
                                                <tr
                                                    key={r.id || idx}
                                                    className={`results-row ${r.status === 'failed' ? 'row-failed' : ''}`}
                                                    onClick={() => r.status !== 'failed' && openDetailModal(r)}
                                                >
                                                    <td>{idx + 1}</td>
                                                    <td className="doc-cell">
                                                        <span className="doc-cell-name">
                                                            {r.document?.filename || r.documentId.slice(0, 8)}
                                                        </span>
                                                    </td>
                                                    {fieldDefs.map((f) => {
                                                        const val = r.extractedFields?.[f.name];
                                                        return (
                                                            <td key={f.name}>
                                                                {val !== null && val !== undefined ? String(val) : '—'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td>
                                                        {r.confidence !== null && r.confidence !== undefined
                                                            ? <span className={`confidence-pill ${(r.confidence) < 0.5 ? 'low' : (r.confidence) < 0.8 ? 'mid' : 'high'}`}>
                                                                {Math.round(r.confidence * 100)}%
                                                            </span>
                                                            : '—'}
                                                    </td>
                                                    <td>
                                                        <span className={`history-status ${r.status}`}>
                                                            {r.status === 'completed' ? '✓ OK' : r.status === 'failed' ? '✕ Falhou' : r.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* ═══ TAB: History ═══ */}
            {
                tab === 'history' && (
                    <div>
                        {historyLoading ? (
                            <div className="flex justify-center" style={{ padding: 'var(--space-xl)' }}>
                                <div className="spinner" />
                            </div>
                        ) : !selectedRun ? (
                            /* ─── Runs List ─── */
                            historyRuns.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><BarChart3 size={32} strokeWidth={1.5} /></div>
                                    <h3>Sem classificações</h3>
                                    <p className="text-secondary mt-xs">
                                        Execute a primeira classificação na aba &quot;Classificar Documento&quot;
                                    </p>
                                </div>
                            ) : (
                                <div className="history-wrapper">
                                    <table className="history-table">
                                        <thead>
                                            <tr>
                                                <th>Tipo</th>
                                                <th>Documentos</th>
                                                <th>Confiança Média</th>
                                                <th>Data</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyRuns.map((run) => (
                                                <tr
                                                    key={run.batchId}
                                                    className="results-row"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => loadRunResults(run)}
                                                >
                                                    <td style={{ fontWeight: 600 }}>
                                                        <Tag size={14} strokeWidth={2} /> {run.classificationTypeName}
                                                    </td>
                                                    <td>
                                                        {run.documentCount} documento{run.documentCount !== 1 ? 's' : ''}
                                                    </td>
                                                    <td>
                                                        {run.avgConfidence !== null
                                                            ? <span className={`confidence-pill ${run.avgConfidence < 0.5 ? 'low' : run.avgConfidence < 0.8 ? 'mid' : 'high'}`}>
                                                                {Math.round(run.avgConfidence * 100)}%
                                                            </span>
                                                            : '—'}
                                                    </td>
                                                    <td className="text-muted">
                                                        {new Date(run.createdAt).toLocaleString('pt-PT')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        ) : (
                            /* ─── Run Detail Table View ─── */
                            <div className="batch-results-view">
                                <div className="results-header">
                                    <div>
                                        <span className="results-label">RESULTADOS</span>
                                        <h2 className="results-title">
                                            {selectedRun.classificationTypeName}
                                        </h2>
                                        <p className="text-secondary">
                                            {new Date(selectedRun.createdAt).toLocaleString('pt-PT')} — {selectedRun.documentCount} documento{selectedRun.documentCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => { setSelectedRun(null); setHistoryResults([]); }}
                                    >
                                        ← Voltar
                                    </button>
                                </div>

                                {/* Summary Cards */}
                                <div className="results-summary results-summary-2">
                                    <div className="stat-card">
                                        <span className="stat-label">TOTAL DOCUMENTOS</span>
                                        <span className="stat-value">{historyResults.length}</span>
                                    </div>
                                    <div className="stat-card">
                                        <span className="stat-label">MÉDIA DE CONFIANÇA</span>
                                        <span className="stat-value">
                                            {selectedRun.avgConfidence !== null
                                                ? `${Math.round(selectedRun.avgConfidence * 100)}%`
                                                : '—'}
                                        </span>
                                    </div>
                                </div>

                                {historyResults.length === 0 ? (
                                    <div className="flex justify-center" style={{ padding: 'var(--space-xl)' }}>
                                        <div className="spinner" />
                                    </div>
                                ) : (
                                    <div className="results-table-wrapper">
                                        <table className="results-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Documento</th>
                                                    {selectedRun.fieldDefinitions.map((f) => (
                                                        <th key={f.name}>{f.name}</th>
                                                    ))}
                                                    <th>Confiança</th>
                                                    <th>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyResults.map((r, idx) => (
                                                    <tr
                                                        key={r.id || idx}
                                                        className={`results-row ${r.status === 'failed' ? 'row-failed' : ''}`}
                                                        onClick={() => r.status !== 'failed' && openDetailModal(r)}
                                                    >
                                                        <td>{idx + 1}</td>
                                                        <td className="doc-cell">
                                                            <FileText size={14} strokeWidth={2} /> {r.document?.filename || r.documentId?.slice(0, 8) || '—'}
                                                        </td>
                                                        {selectedRun.fieldDefinitions.map((f) => {
                                                            const val = r.extractedFields?.[f.name];
                                                            return (
                                                                <td key={f.name}>
                                                                    {val !== null && val !== undefined ? String(val) : '—'}
                                                                </td>
                                                            );
                                                        })}
                                                        <td>
                                                            {r.confidence !== null && r.confidence !== undefined
                                                                ? <span className={`confidence-pill ${r.confidence < 0.5 ? 'low' : r.confidence < 0.8 ? 'mid' : 'high'}`}>
                                                                    {Math.round(r.confidence * 100)}%
                                                                </span>
                                                                : '—'}
                                                        </td>
                                                        <td>
                                                            <span className={`history-status ${r.status}`}>
                                                                {r.status === 'completed' ? '✓ OK' : r.status === 'failed' ? '✕ Falhou' : r.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            }

            {/* ═══ Create/Edit Type Modal ═══ */}
            {
                showCreate && (
                    <div className="class-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeFormModal(); }}>
                        <div className="class-modal">
                            <div className="class-modal-header">
                                <h3>{editingType ? 'Editar Tipo de Classificação' : 'Novo Tipo de Classificação'}</h3>
                                <button className="class-modal-close" onClick={() => closeFormModal()} aria-label="Fechar"><X size={16} strokeWidth={2} /></button>
                            </div>

                            <form onSubmit={handleCreate}>
                                <div className="class-modal-body">
                                    <div className="form-group">
                                        <label className="label" htmlFor="type-name">Nome *</label>
                                        <input
                                            id="type-name"
                                            className="input"
                                            type="text"
                                            placeholder="Ex: Fatura, Contrato, Recibo..."
                                            value={createForm.name}
                                            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="label" htmlFor="type-desc">Descrição</label>
                                        <input
                                            id="type-desc"
                                            className="input"
                                            type="text"
                                            placeholder="Descrição opcional do tipo"
                                            value={createForm.description}
                                            onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="label" htmlFor="type-prompt">Prompt de IA *</label>
                                        <div className="prompt-textarea-wrapper">
                                            <textarea
                                                id="type-prompt"
                                                className="input"
                                                placeholder="Descreva o que pretende extrair... Ex: Extrair dados de faturas de fornecedores portugueses, incluindo NIF, valores com IVA e datas de vencimento."
                                                value={createForm.aiPrompt}
                                                onChange={(e) => setCreateForm((f) => ({ ...f, aiPrompt: e.target.value }))}
                                                rows={3}
                                                required
                                            />
                                            <div className="prompt-actions">
                                                {!isListening ? (
                                                    <button
                                                        type="button"
                                                        className="prompt-action-btn mic-btn"
                                                        onClick={startListening}
                                                        title="Iniciar ditado por voz"
                                                    >
                                                        <Mic size={14} strokeWidth={2} /> Ditar
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="prompt-action-btn mic-btn listening"
                                                        onClick={stopListening}
                                                        title="Parar ditado"
                                                    >
                                                        <Square size={14} strokeWidth={2} /> Parar
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="prompt-action-btn refine-btn"
                                                    onClick={handleRefinePrompt}
                                                    disabled={refining || !createForm.aiPrompt.trim()}
                                                    title="Refinar prompt com IA"
                                                >
                                                    {refining ? <><RefreshCw size={14} strokeWidth={2} className="spin" /> A refinar...</> : <><Sparkles size={14} strokeWidth={2} /> Refinar com IA</>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fields Editor */}
                                    <div className="fields-editor">
                                        <div className="fields-editor-header">
                                            <label className="label">
                                                Campos a extrair ({createFields.length})
                                            </label>
                                            <div className="fields-editor-actions">
                                                <button
                                                    type="button"
                                                    className="suggest-btn"
                                                    onClick={handleSuggestFields}
                                                    disabled={suggesting}
                                                >
                                                    {suggesting ? <><RefreshCw size={14} strokeWidth={2} className="spin" /> A sugerir...</> : <><Sparkles size={14} strokeWidth={2} /> Sugerir com IA</>}
                                                </button>
                                                <button type="button" className="add-field-btn" onClick={addField}>
                                                    + Campo
                                                </button>
                                            </div>
                                        </div>

                                        {createFields.length > 0 ? (
                                            <div className="fields-list">
                                                {createFields.map((f, idx) => (
                                                    <div key={idx} className="field-row">
                                                        <input
                                                            placeholder="Nome do campo"
                                                            value={f.name}
                                                            onChange={(e) => updateField(idx, 'name', e.target.value)}
                                                        />
                                                        <select
                                                            value={f.type}
                                                            onChange={(e) => updateField(idx, 'type', e.target.value)}
                                                        >
                                                            <option value="string">Texto</option>
                                                            <option value="number">Número</option>
                                                            <option value="date">Data</option>
                                                            <option value="boolean">Sim/Não</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            className="btn-remove"
                                                            onClick={() => removeField(idx)}
                                                        >
                                                            <X size={14} strokeWidth={2} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="fields-empty">
                                                Sem campos definidos. Use &quot;✨ Sugerir com IA&quot; ou &quot;+ Campo&quot; para adicionar.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="class-modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => closeFormModal()}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={creating}>
                                        {creating ? (editingType ? 'A guardar…' : 'A criar…') : (editingType ? 'Guardar Alterações' : 'Criar Tipo')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* ═══ Detail Modal ═══ */}
            {
                detailResult && (
                    <div className="detail-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetailResult(null); }}>
                        <div className="detail-modal">
                            <div className="detail-modal-header">
                                <div className="detail-nav">
                                    <button
                                        className="detail-nav-btn"
                                        onClick={() => navigateDetail(-1)}
                                        disabled={getDetailIndex().current <= 1}
                                        title="Documento anterior"
                                    >
                                        ←
                                    </button>
                                    <span className="detail-nav-counter">
                                        {getDetailIndex().current} / {getDetailIndex().total}
                                    </span>
                                    <button
                                        className="detail-nav-btn"
                                        onClick={() => navigateDetail(1)}
                                        disabled={getDetailIndex().current >= getDetailIndex().total}
                                        title="Próximo documento"
                                    >
                                        →
                                    </button>
                                </div>
                                <h3>
                                    {selectedType?.name || 'Documento'} — {detailResult.document?.filename || detailResult.documentId.slice(0, 8)}
                                </h3>
                                <button className="class-modal-close" onClick={() => setDetailResult(null)} aria-label="Fechar"><X size={16} strokeWidth={2} /></button>
                            </div>
                            <div className="detail-modal-body">
                                {/* Left: Document Viewer */}
                                <div className="detail-doc-viewer">
                                    {detailResult.document && (
                                        detailResult.document.mimeType === 'application/pdf' ||
                                        detailResult.document.mimeType.startsWith('image/')
                                    ) ? (
                                        <iframe
                                            src={`/api/documents/${detailResult.document.id}/download`}
                                            title={detailResult.document.filename}
                                        />
                                    ) : (
                                        <div className="doc-placeholder">
                                            <div style={{ fontSize: 64, marginBottom: 12 }}><FileText size={48} strokeWidth={1.5} /></div>
                                            <p>{detailResult.document?.filename || 'Documento'}</p>
                                            <p className="text-muted mt-xs">Pré-visualização não disponível</p>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Extracted Fields Panel */}
                                <div className="detail-fields-panel">
                                    <h3>
                                        {selectedType?.name || 'Documento'} — {detailResult.document?.filename?.replace(/\.[^.]+$/, '') || ''}
                                    </h3>

                                    <div className="detail-section-label">INFORMAÇÃO GERAL</div>

                                    {Object.entries(editedDetailFields).map(([key, value]) => (
                                        <div key={key} className="detail-field-row">
                                            <span className="detail-field-label">{key}</span>
                                            <input
                                                className="detail-field-input"
                                                value={value}
                                                onChange={(e) =>
                                                    setEditedDetailFields((prev) => ({
                                                        ...prev,
                                                        [key]: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    ))}

                                    {detailResult.confidence !== null && detailResult.confidence !== undefined && (
                                        <div className="detail-field-row">
                                            <span className="detail-field-label">Confiança</span>
                                            <span className="detail-field-value">
                                                <span className={`confidence-pill ${detailResult.confidence < 0.5 ? 'low' : detailResult.confidence < 0.8 ? 'mid' : 'high'}`}>
                                                    {Math.round(detailResult.confidence * 100)}%
                                                </span>
                                            </span>
                                        </div>
                                    )}

                                    <div className="detail-save-row">
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleSaveDetailFields}
                                            disabled={savingDetail}
                                        >
                                            {savingDetail ? <><RefreshCw size={14} strokeWidth={2} className="spin" /> A guardar...</> : <><Save size={14} strokeWidth={2} /> Guardar Alterações</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
