'use client';

import React from 'react';
import type { ResultEnvelope, ArtifactRef, UIIntent } from '@/lib/skills/types';
import { ArtifactPreviewCard } from './ArtifactPreviewCard';
import { CompatibilityBadge } from './CompatibilityBadge';
import ReactMarkdown from 'react-markdown';
import { Download, Eye, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface RuntimeResultRendererProps {
    envelope: ResultEnvelope;
    className?: string;
}

/**
 * Discriminated renderer that switches on responseMode to render
 * skill execution results with type-aware presentation.
 */
export function RuntimeResultRenderer({ envelope, className = '' }: RuntimeResultRendererProps) {
    const { responseMode, status } = envelope;

    return (
        <div className={`runtime-result ${className}`} style={resultContainerStyle}>
            {/* Status & warnings banner */}
            {status === 'degraded' && envelope.degradationReport && (
                <div style={warningBannerStyle}>
                    <AlertTriangle size={14} />
                    <span>Degraded execution — {envelope.degradationReport.summary}</span>
                </div>
            )}
            {status === 'failed' && (
                <div style={errorBannerStyle}>
                    <AlertTriangle size={14} />
                    <span>Execution failed{envelope.warnings.length > 0 ? `: ${envelope.warnings[0]}` : ''}</span>
                </div>
            )}

            {/* Main content by response mode */}
            {responseMode === 'chat' && renderChat(envelope)}
            {responseMode === 'artifact_first' && renderArtifactFirst(envelope)}
            {responseMode === 'artifact_plus_chat' && renderArtifactPlusChat(envelope)}
            {responseMode === 'ui_rendered' && renderUIRendered(envelope)}
            {responseMode === 'action_result' && renderActionResult(envelope)}
            {responseMode === 'multi_output' && renderMultiOutput(envelope)}

            {/* Execution metadata footer */}
            <div style={metaFooterStyle}>
                <span style={{ opacity: 0.5 }}>
                    {envelope.executionMeta.modelUsed} · {envelope.executionMeta.durationMs}ms
                    {envelope.executionMeta.toolCalls > 0 && ` · ${envelope.executionMeta.toolCalls} tool calls`}
                    {envelope.executionMeta.artifactsProduced > 0 && ` · ${envelope.executionMeta.artifactsProduced} artifacts`}
                </span>
                {envelope.executionTrace && (
                    <CompatibilityBadge state={envelope.executionTrace.capabilityCheckResult} size="sm" />
                )}
            </div>
        </div>
    );
}

// ─── Response mode renderers ──────────────────────────

function renderChat(env: ResultEnvelope) {
    return (
        <div style={textBlockStyle}>
            {env.assistantMessage && (
                <ReactMarkdown>{env.assistantMessage}</ReactMarkdown>
            )}
            {env.citations.length > 0 && (
                <div style={citationBlockStyle}>
                    {env.citations.map((c, i) => (
                        <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" style={citationLinkStyle}>
                            <Info size={10} /> {c.title}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

function renderArtifactFirst(env: ResultEnvelope) {
    return (
        <div>
            {env.artifacts.length > 0 && (
                <div style={artifactGridStyle}>
                    {env.artifacts.map((artifact) => (
                        <ArtifactPreviewCard key={artifact.id} artifact={artifact} />
                    ))}
                </div>
            )}
            {env.assistantMessage && (
                <div style={{ ...textBlockStyle, marginTop: '12px', opacity: 0.8, fontSize: '13px' }}>
                    <ReactMarkdown>{env.assistantMessage}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}

function renderArtifactPlusChat(env: ResultEnvelope) {
    return (
        <div>
            {env.assistantMessage && (
                <div style={textBlockStyle}>
                    <ReactMarkdown>{env.assistantMessage}</ReactMarkdown>
                </div>
            )}
            {env.artifacts.length > 0 && (
                <div style={{ ...artifactGridStyle, marginTop: '12px' }}>
                    {env.artifacts.map((artifact) => (
                        <ArtifactPreviewCard key={artifact.id} artifact={artifact} />
                    ))}
                </div>
            )}
        </div>
    );
}

function renderUIRendered(env: ResultEnvelope) {
    return (
        <div>
            {/* UI intents rendered as structured cards */}
            {env.uiIntents.map((intent, i) => (
                <UIIntentCard key={i} intent={intent} artifacts={env.artifacts} />
            ))}
            {env.assistantMessage && (
                <div style={{ ...textBlockStyle, marginTop: '12px' }}>
                    <ReactMarkdown>{env.assistantMessage}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}

function renderActionResult(env: ResultEnvelope) {
    return (
        <div>
            {env.actionResults.map((result, i) => (
                <div key={i} style={actionCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {result.status === 'success' ? (
                            <CheckCircle2 size={16} color="#16C79A" />
                        ) : (
                            <AlertTriangle size={16} color="#E94560" />
                        )}
                        <span style={{ fontWeight: 600 }}>{result.actionName}</span>
                        <span style={statusBadgeStyle(result.status)}>{result.status}</span>
                    </div>
                    {result.detail && (
                        <p style={{ margin: '8px 0 0', fontSize: '13px', opacity: 0.7 }}>{result.detail}</p>
                    )}
                </div>
            ))}
            {env.assistantMessage && (
                <div style={{ ...textBlockStyle, marginTop: '12px' }}>
                    <ReactMarkdown>{env.assistantMessage}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}

function renderMultiOutput(env: ResultEnvelope) {
    return (
        <div>
            {env.assistantMessage && (
                <div style={textBlockStyle}>
                    <ReactMarkdown>{env.assistantMessage}</ReactMarkdown>
                </div>
            )}
            {env.artifacts.length > 0 && (
                <div style={{ ...artifactGridStyle, marginTop: '12px' }}>
                    {env.artifacts.map((artifact) => (
                        <ArtifactPreviewCard key={artifact.id} artifact={artifact} />
                    ))}
                </div>
            )}
            {env.actionResults.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                    {env.actionResults.map((result, i) => (
                        <div key={i} style={actionCardStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {result.status === 'success' ? (
                                    <CheckCircle2 size={16} color="#16C79A" />
                                ) : (
                                    <AlertTriangle size={16} color="#E94560" />
                                )}
                                <span style={{ fontWeight: 600 }}>{result.actionName}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── UI Intent Card ───────────────────────────────────

function UIIntentCard({ intent, artifacts }: { intent: UIIntent; artifacts: ArtifactRef[] }) {
    const linkedArtifact = intent.artifactId
        ? artifacts.find(a => a.id === intent.artifactId)
        : undefined;

    return (
        <div style={uiIntentCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {intent.intent === 'show_preview' && <Eye size={14} color="#16C79A" />}
                {intent.intent === 'show_download' && <Download size={14} color="#5C7AEA" />}
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>
                    {intent.intent.replace(/_/g, ' ')}
                </span>
            </div>
            {linkedArtifact && <ArtifactPreviewCard artifact={linkedArtifact} compact />}
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────

const resultContainerStyle: React.CSSProperties = {
    padding: '0',
    borderRadius: '10px',
};

const warningBannerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(245, 166, 35, 0.1)',
    border: '1px solid rgba(245, 166, 35, 0.3)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#F5A623',
    marginBottom: '12px',
};

const errorBannerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(233, 69, 96, 0.1)',
    border: '1px solid rgba(233, 69, 96, 0.3)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#E94560',
    marginBottom: '12px',
};

const textBlockStyle: React.CSSProperties = {
    fontSize: '14px',
    lineHeight: '1.65',
    color: '#E2E8F0',
};

const artifactGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '10px',
};

const actionCardStyle: React.CSSProperties = {
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    marginBottom: '8px',
};

const uiIntentCardStyle: React.CSSProperties = {
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    marginBottom: '8px',
};

const metaFooterStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    fontSize: '11px',
    color: '#64748B',
};

const citationBlockStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '12px',
};

const citationLinkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    background: 'rgba(92, 122, 234, 0.1)',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#5C7AEA',
    textDecoration: 'none',
};

function statusBadgeStyle(status: string): React.CSSProperties {
    const colors: Record<string, string> = {
        success: '#16C79A',
        error: '#E94560',
        skipped: '#94A3B8',
    };
    return {
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        background: `${colors[status] || '#94A3B8'}20`,
        color: colors[status] || '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    };
}
