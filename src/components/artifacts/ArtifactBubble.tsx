'use client';

import React from 'react';
import {
    Sparkles, CheckCircle2, CircleDot, Loader, Eye,
    RefreshCw, Download, Printer, MoreHorizontal,
} from 'lucide-react';
import './artifacts.css';

// ─── Types ───────────────────────────────────────────────

export type BubbleState = 'collecting' | 'ready' | 'generating' | 'generated';

export interface ArtifactMeta {
    audience?: string;
    goal?: string;
    contentType?: string;
    platform?: string;
    topic?: string;
}

export interface ArtifactBubbleProps {
    agentName: string;
    agentRole: string;
    state: BubbleState;
    metadata: ArtifactMeta;
    missingFields: string[];
    progressIndex: number;
    currentVersion?: { label: string; title: string; summary: string };
    onGenerate: () => void;
    onView: () => void;
    onRegenerate: () => void;
    onExport: () => void;
}

const progressStages = [
    'Loading company context',
    'Building draft structure',
    'Rendering output',
];

// ─── Component ───────────────────────────────────────────

export function ArtifactBubble({
    agentName,
    agentRole,
    state,
    metadata,
    missingFields,
    progressIndex,
    currentVersion,
    onGenerate,
    onView,
    onRegenerate,
    onExport,
}: ArtifactBubbleProps) {
    const message = {
        collecting: `Need ${missingFields.join(' and ')} before I can generate the draft.`,
        ready: `Perfect — I have enough to produce a first-pass ${metadata.contentType || 'wireframe'}.`,
        generating: 'Generating the draft inline so the thread stays clean.',
        generated: 'Your first draft is ready.',
    }[state];

    const helperText = {
        collecting: `Need ${missingFields.length} more input${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`,
        ready: `Ready to generate ${metadata.contentType || 'wireframe'}`,
        generating: progressStages[progressIndex] ?? progressStages[0],
        generated: 'Draft generated. Open view to inspect and iterate.',
    }[state];

    const canGenerate = state === 'ready';

    return (
        <div className="artifact-bubble">
            {/* Header */}
            <div className="ab-header">
                <div>
                    <div className="ab-agent-row">
                        <div className="ab-agent-icon">
                            <Sparkles size={14} />
                        </div>
                        <div>
                            <div className="ab-agent-name">{agentName}</div>
                            <div className="ab-agent-role">{agentRole}</div>
                        </div>
                    </div>
                    <div className="ab-message">{message}</div>
                </div>
                <div className={`ab-status-chip ${state}`}>
                    {state === 'collecting' && <CircleDot size={12} />}
                    {state === 'ready' && <CheckCircle2 size={12} />}
                    {state === 'generating' && <Loader size={12} className="ab-spin" />}
                    {state === 'generated' && <Sparkles size={12} />}
                    <span>
                        {state === 'collecting' && 'Collecting inputs'}
                        {state === 'ready' && 'Ready to generate'}
                        {state === 'generating' && 'Generating'}
                        {state === 'generated' && 'Generated'}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div className="ab-body">
                {/* Metadata chips */}
                <div className="ab-meta-row">
                    {metadata.audience && <span className="ab-meta-chip">Audience: {metadata.audience}</span>}
                    {metadata.goal && <span className="ab-meta-chip">Goal: {metadata.goal}</span>}
                    {metadata.contentType && <span className="ab-meta-chip">Type: {metadata.contentType}</span>}
                    {metadata.platform && <span className="ab-meta-chip">Platform: {metadata.platform}</span>}
                    <span className="ab-meta-chip">
                        Version: {state === 'generated' && currentVersion ? currentVersion.label : 'Draft pending'}
                    </span>
                </div>

                {/* Generating progress */}
                {state === 'generating' && (
                    <div className="ab-progress">
                        {progressStages.map((stage, idx) => {
                            const done = idx < progressIndex;
                            const active = idx === progressIndex;
                            return (
                                <div key={stage} className="ab-progress-step">
                                    <div className={`ab-progress-icon ${done ? 'done' : active ? 'active' : 'pending'}`}>
                                        {done ? <CheckCircle2 size={12} /> : active ? <Loader size={12} className="ab-spin" /> : <CircleDot size={12} />}
                                    </div>
                                    <span>{stage}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Generated output card */}
                {state === 'generated' && currentVersion && (
                    <div className="ab-output-card">
                        <div className="ab-output-card-header">
                            <div>
                                <div className="ab-output-title">{currentVersion.title}</div>
                                <div className="ab-output-subtitle">{currentVersion.summary}</div>
                            </div>
                            <span className="ab-output-badge">{currentVersion.label}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Action row */}
            <div className="ab-action-row">
                {state !== 'generated' ? (
                    <button
                        className={`ab-btn ${canGenerate ? 'primary' : ''}`}
                        onClick={onGenerate}
                        disabled={state !== 'ready'}
                    >
                        {state === 'generating' ? (
                            <Loader size={13} className="ab-spin" />
                        ) : (
                            <Sparkles size={13} />
                        )}
                        {state === 'generating' ? 'Generating…' : 'Generate draft'}
                    </button>
                ) : (
                    <>
                        <button className="ab-btn primary" onClick={onView}>
                            <Eye size={13} /> View
                        </button>
                        <button className="ab-btn" onClick={onRegenerate}>
                            <RefreshCw size={13} /> Regenerate
                        </button>
                        <button className="ab-btn" onClick={onExport}>
                            <Download size={13} /> Export
                        </button>
                        <button className="ab-btn" onClick={() => window.print()}>
                            <Printer size={13} /> Print
                        </button>
                        <button className="ab-btn">
                            <MoreHorizontal size={13} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
