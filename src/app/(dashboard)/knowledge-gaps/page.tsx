'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader, X, Lightbulb, Hourglass, Check, Eye } from 'lucide-react';
import { TableShell, TableToolbar, StatusBadge, RowActionMenu, TableEmptyState, TableLoadingState } from '@/components/table';
import '@/components/table/table.css';
import './knowledge-gaps.css';
import { useUIFeedback } from '@/components/UIFeedback';

// ─── Types ────────────────────────────────────────────

interface KnowledgeGap {
    id: string;
    topic: string;
    exampleQuestions: string[];
    suggestion: string | null;
    frequency: number;
    groundingRate: number;
    score: number;
    status: 'open' | 'resolved' | 'ignored';
    lastSeenAt: string;
    createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'error' | 'success' | 'neutral' }> = {
    open: { label: 'Aberta', variant: 'error' },
    resolved: { label: 'Resolvida', variant: 'success' },
    ignored: { label: 'Ignorada', variant: 'neutral' },
};

export default function KnowledgeGapsPage() {
    const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [selectedGap, setSelectedGap] = useState<KnowledgeGap | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved' | 'ignored'>('all');
    const { showToast, showConfirm } = useUIFeedback();

    const loadGaps = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/knowledge-gaps');
            if (res.ok) {
                const data = await res.json();
                setGaps(data.gaps || []);
            }
        } catch {
            showToast('Erro ao carregar lacunas', 'error');
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => { loadGaps(); }, [loadGaps]);

    async function handleAnalyze() {
        setAnalyzing(true);
        try {
            const res = await fetch('/api/knowledge-gaps/analyze', { method: 'POST' });
            const data = await res.json();
            if (res.ok) { showToast(data.message || 'Análise concluída', 'success'); loadGaps(); }
            else { showToast(data.error || 'Erro na análise', 'error'); }
        } catch { showToast('Erro de conexão', 'error'); }
        setAnalyzing(false);
    }

    async function updateStatus(id: string, status: 'resolved' | 'ignored' | 'open') {
        try {
            const res = await fetch(`/api/knowledge-gaps/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                setGaps(prev => prev.map(g => g.id === id ? { ...g, status } : g));
                if (selectedGap?.id === id) setSelectedGap(prev => prev ? { ...prev, status } : null);
                showToast('Estado atualizado', 'success');
            } else { showToast('Erro ao atualizar estado', 'error'); }
        } catch { showToast('Erro de conexão', 'error'); }
    }

    function handleResolve(gap: KnowledgeGap) {
        showConfirm(`Marcar "${gap.topic}" como resolvida?`, () => updateStatus(gap.id, 'resolved'));
    }

    function handleIgnore(gap: KnowledgeGap) {
        updateStatus(gap.id, 'ignored');
    }

    const filteredGaps = statusFilter === 'all' ? gaps : gaps.filter(g => g.status === statusFilter);

    // ─── Stats ────────────────────────────────────────
    const totalGaps = gaps.length;
    const openGaps = gaps.filter(g => g.status === 'open').length;
    const resolvedGaps = gaps.filter(g => g.status === 'resolved').length;
    const avgFailureRate = gaps.length > 0
        ? Math.round(gaps.reduce((s, g) => s + g.groundingRate, 0) / gaps.length * 100)
        : 0;

    return (
        <div className="kg-page">
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Lightbulb size={20} strokeWidth={2} /></span>
                    <h1>Knowledge Insights</h1>
                </div>
                <div className="assistant-page-workspace">
                    <button className="btn btn-primary" onClick={handleAnalyze} disabled={analyzing}>
                        {analyzing ? <><Loader size={14} /> A analisar…</> : <><Search size={14} /> Analisar Agora</>}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="kg-stats">
                <div className="kg-stat-card">
                    <span className="kg-stat-value">{totalGaps}</span>
                    <span className="kg-stat-label">Total de lacunas</span>
                </div>
                <div className="kg-stat-card kg-stat-danger">
                    <span className="kg-stat-value">{openGaps}</span>
                    <span className="kg-stat-label">Em aberto</span>
                </div>
                <div className="kg-stat-card kg-stat-success">
                    <span className="kg-stat-value">{resolvedGaps}</span>
                    <span className="kg-stat-label">Resolvidas</span>
                </div>
                <div className="kg-stat-card kg-stat-warning">
                    <span className="kg-stat-value">{avgFailureRate}%</span>
                    <span className="kg-stat-label">Taxa media de falha</span>
                </div>
            </div>

            {/* Table */}
            <TableShell>
                <TableToolbar
                    filters={
                        <>
                            {(['all', 'open', 'resolved', 'ignored'] as const).map(f => (
                                <button
                                    key={f}
                                    className={`nousio-toolbar-filter ${statusFilter === f ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(f)}
                                >
                                    {f === 'all' ? 'Todas' : STATUS_LABELS[f]?.label}
                                    {` (${f === 'all' ? totalGaps : gaps.filter(g => g.status === f).length})`}
                                </button>
                            ))}
                        </>
                    }
                    resultCount={`${filteredGaps.length} resultado${filteredGaps.length !== 1 ? 's' : ''}`}
                />
                {loading ? (
                    <TableLoadingState rows={5} columns={6} />
                ) : filteredGaps.length === 0 ? (
                    <TableEmptyState
                        icon={<Search size={36} strokeWidth={1.5} />}
                        title="Nenhuma lacuna detetada"
                        description={
                            statusFilter === 'all'
                                ? 'Clica em "Analisar Agora" para detetar lacunas nas conversas do assistente.'
                                : `Nenhuma lacuna com o estado "${STATUS_LABELS[statusFilter]?.label || statusFilter}".`
                        }
                        action={statusFilter === 'all' ? (
                            <button className="btn btn-primary" onClick={handleAnalyze} disabled={analyzing}>
                                {analyzing ? <><Hourglass size={14} strokeWidth={2} /> A analisar…</> : <><Search size={14} strokeWidth={2} /> Analisar Agora</>}
                            </button>
                        ) : undefined}
                    />
                ) : (
                    <table className="nousio-table">
                        <thead>
                            <tr>
                                <th style={{ width: '25%' }}>Tópico</th>
                                <th style={{ width: '25%' }}>Exemplos</th>
                                <th className="align-center" style={{ width: '8%' }}>Freq.</th>
                                <th className="align-center" style={{ width: '10%' }}>Falhas</th>
                                <th style={{ width: '12%' }}>Última vez</th>
                                <th style={{ width: '10%' }}>Estado</th>
                                <th className="align-right" style={{ width: '10%' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGaps.map(gap => (
                                <tr key={gap.id} className="clickable" onClick={() => setSelectedGap(gap)}>
                                    <td>
                                        <div className="nousio-cell-stack">
                                            <span className="cell-line-1">{gap.topic}</span>
                                            <span className="cell-line-2">{Math.round(gap.score * 100)}pts score</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="kg-questions-preview">
                                            {(gap.exampleQuestions || []).slice(0, 2).map((q, i) => (
                                                <div key={i} className="kg-question-pill">"{q.substring(0, 55)}{q.length > 55 ? '…' : ''}"</div>
                                            ))}
                                            {(gap.exampleQuestions || []).length > 2 && (
                                                <span className="kg-more">+{gap.exampleQuestions.length - 2} mais</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="align-center"><strong>{gap.frequency}</strong></td>
                                    <td className="align-center">
                                        <StatusBadge variant={gap.groundingRate >= 0.8 ? 'error' : gap.groundingRate >= 0.5 ? 'warning' : 'success'}>
                                            {Math.round(gap.groundingRate * 100)}%
                                        </StatusBadge>
                                    </td>
                                    <td className="cell-muted">{new Date(gap.lastSeenAt).toLocaleDateString('pt-PT')}</td>
                                    <td>
                                        <StatusBadge variant={STATUS_LABELS[gap.status]?.variant || 'neutral'}>
                                            {STATUS_LABELS[gap.status]?.label}
                                        </StatusBadge>
                                    </td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <RowActionMenu
                                            primaryAction={{
                                                icon: <Eye size={14} strokeWidth={2} />,
                                                title: 'Ver detalhes',
                                                onClick: () => setSelectedGap(gap),
                                            }}
                                            items={
                                                gap.status === 'open'
                                                    ? [
                                                        { label: 'Resolver', icon: <Check size={14} />, onClick: () => handleResolve(gap) },
                                                        { label: 'Ignorar', icon: <X size={14} />, onClick: () => handleIgnore(gap) },
                                                    ]
                                                    : [{ label: 'Reabrir', icon: <Search size={14} />, onClick: () => updateStatus(gap.id, 'open') }]
                                            }
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </TableShell>

            {/* Detail Modal */}
            {selectedGap && (
                <div className="kg-modal-overlay" onClick={() => setSelectedGap(null)}>
                    <div className="kg-modal" onClick={e => e.stopPropagation()}>
                        <div className="kg-modal-header">
                            <div>
                                <h2 className="kg-modal-title">{selectedGap.topic}</h2>
                                <StatusBadge variant={STATUS_LABELS[selectedGap.status]?.variant || 'neutral'}>
                                    {STATUS_LABELS[selectedGap.status]?.label}
                                </StatusBadge>
                            </div>
                            <button className="kg-modal-close" onClick={() => setSelectedGap(null)}><X size={16} strokeWidth={2} /></button>
                        </div>

                        <div className="kg-modal-body">
                            <div className="kg-modal-stats">
                                <div className="kg-modal-stat">
                                    <span className="kg-modal-stat-val">{selectedGap.frequency}</span>
                                    <span className="kg-modal-stat-label">perguntas</span>
                                </div>
                                <div className="kg-modal-stat">
                                    <span className="kg-modal-stat-val">{Math.round(selectedGap.groundingRate * 100)}%</span>
                                    <span className="kg-modal-stat-label">taxa de falha</span>
                                </div>
                                <div className="kg-modal-stat">
                                    <span className="kg-modal-stat-val">{Math.round(selectedGap.score * 100)}pts</span>
                                    <span className="kg-modal-stat-label">score</span>
                                </div>
                            </div>

                            <div className="kg-modal-section">
                                <div className="kg-modal-section-label">Perguntas sem resposta</div>
                                <div className="kg-question-list">
                                    {(selectedGap.exampleQuestions || []).map((q, i) => (
                                        <div key={i} className="kg-question-item">
                                            <span className="kg-question-num">{i + 1}</span>
                                            <span>{q}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedGap.suggestion && (
                                <div className="kg-modal-section">
                                    <div className="kg-modal-section-label"><Lightbulb size={14} strokeWidth={2} /> Recomendação</div>
                                    <div className="kg-suggestion-card">{selectedGap.suggestion}</div>
                                </div>
                            )}

                            <p className="kg-last-seen">
                                Último registo: {new Date(selectedGap.lastSeenAt).toLocaleString('pt-PT')}
                            </p>
                        </div>

                        <div className="kg-modal-footer">
                            {selectedGap.status === 'open' && (
                                <>
                                    <button className="btn btn-primary" onClick={() => handleResolve(selectedGap)}>✓ Marcar Resolvida</button>
                                    <button className="btn btn-secondary" onClick={() => { handleIgnore(selectedGap); setSelectedGap(null); }}>Ignorar</button>
                                </>
                            )}
                            {selectedGap.status !== 'open' && (
                                <button className="btn btn-secondary" onClick={() => updateStatus(selectedGap.id, 'open')}>Reabrir</button>
                            )}
                            <button className="btn btn-ghost" onClick={() => setSelectedGap(null)}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
