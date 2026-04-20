'use client';

import React from 'react';
import type { ArtifactRef } from '@/lib/skills/types';
import {
    FileText, FileSpreadsheet, Presentation, Image, Archive,
    BarChart3, Download, Eye, File,
} from 'lucide-react';

// Icon and color mapping for artifact types
const ARTIFACT_UI: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    presentation: { icon: Presentation, color: '#E94560', label: 'Presentation' },
    document: { icon: FileText, color: '#5C7AEA', label: 'Document' },
    spreadsheet: { icon: FileSpreadsheet, color: '#16C79A', label: 'Spreadsheet' },
    pdf: { icon: FileText, color: '#F5A623', label: 'PDF' },
    image: { icon: Image, color: '#7C3AED', label: 'Image' },
    zip: { icon: Archive, color: '#94A3B8', label: 'Archive' },
    chart: { icon: BarChart3, color: '#14B8A6', label: 'Chart' },
    structured_ui: { icon: File, color: '#EC4899', label: 'UI Object' },
};

interface ArtifactPreviewCardProps {
    artifact: ArtifactRef;
    compact?: boolean;
    onPreview?: (artifact: ArtifactRef) => void;
}

/**
 * Card component for rendering artifact results with type-aware icon,
 * download button, and optional preview.
 */
export function ArtifactPreviewCard({ artifact, compact = false, onPreview }: ArtifactPreviewCardProps) {
    const ui = ARTIFACT_UI[artifact.type] || { icon: File, color: '#94A3B8', label: artifact.type };
    const IconComponent = ui.icon;

    const handleDownload = async () => {
        if (artifact.downloadUrl) {
            window.open(artifact.downloadUrl, '_blank');
        } else {
            // Fetch download URL from API
            try {
                const res = await fetch(`/api/skills/artifacts/${artifact.id}`);
                const data = await res.json();
                if (data.artifact?.downloadUrl) {
                    window.open(data.artifact.downloadUrl, '_blank');
                }
            } catch (err) {
                console.error('Failed to get artifact download URL', err);
            }
        }
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (compact) {
        return (
            <div style={compactStyle}>
                <IconComponent size={14} color={ui.color} />
                <span style={{ fontSize: '12px', color: '#CBD5E1', flex: 1 }}>
                    {artifact.filename}
                </span>
                <button onClick={handleDownload} style={compactBtnStyle} title="Download">
                    <Download size={12} />
                </button>
            </div>
        );
    }

    return (
        <div style={cardStyle}>
            {/* Preview area */}
            <div style={{ ...previewAreaStyle, borderColor: `${ui.color}30` }}>
                {artifact.type === 'image' && artifact.previewUrl ? (
                    <img
                        src={artifact.previewUrl}
                        alt={artifact.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }}
                    />
                ) : (
                    <IconComponent size={36} color={ui.color} strokeWidth={1.5} />
                )}
            </div>

            {/* Info area */}
            <div style={infoAreaStyle}>
                <div style={{ marginBottom: '4px' }}>
                    <span style={typeBadgeStyle(ui.color)}>{ui.label}</span>
                </div>
                <p style={filenameStyle} title={artifact.filename}>
                    {artifact.filename}
                </p>
                {artifact.sizeBytes && (
                    <span style={sizeStyle}>{formatSize(artifact.sizeBytes)}</span>
                )}
            </div>

            {/* Action bar */}
            <div style={actionBarStyle}>
                {onPreview && (
                    <button onClick={() => onPreview(artifact)} style={actionBtnStyle} title="Preview">
                        <Eye size={13} /> Preview
                    </button>
                )}
                <button onClick={handleDownload} style={{ ...actionBtnStyle, ...downloadBtnStyle }} title="Download">
                    <Download size={13} /> Download
                </button>
            </div>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────

const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    overflow: 'hidden',
    transition: 'border-color 0.2s, transform 0.15s',
};

const previewAreaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
};

const infoAreaStyle: React.CSSProperties = {
    padding: '10px 12px 6px',
};

const filenameStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: '#E2E8F0',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const sizeStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#64748B',
};

function typeBadgeStyle(color: string): React.CSSProperties {
    return {
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        background: `${color}15`,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    };
}

const actionBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
};

const actionBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    fontSize: '11px',
    fontWeight: 500,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    background: 'transparent',
    color: '#CBD5E1',
    cursor: 'pointer',
    transition: 'background 0.15s',
};

const downloadBtnStyle: React.CSSProperties = {
    background: 'rgba(22, 199, 154, 0.1)',
    borderColor: 'rgba(22, 199, 154, 0.3)',
    color: '#16C79A',
    flex: 1,
    justifyContent: 'center',
};

const compactStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '6px',
};

const compactBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: '4px',
    background: 'rgba(22, 199, 154, 0.15)',
    color: '#16C79A',
    cursor: 'pointer',
};
