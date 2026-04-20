'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Headphones, Loader2, ChevronRight, Zap, AlertTriangle } from 'lucide-react';

interface BriefData {
    id: string;
    briefText: string;
    audioUrl?: string | null;
    generatedAt: string;
    sections: Record<string, unknown>;
}

export default function DailyBriefCard() {
    const [brief, setBrief] = useState<BriefData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/daily-brief')
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json();
                    setError(data.error || data.details || 'Failed to load');
                    return;
                }
                const data = await res.json();
                setBrief(data.brief);
            })
            .catch(() => setError('Network error'))
            .finally(() => setLoading(false));
    }, []);

    // Loading
    if (loading) {
        return (
            <div className="brief-card brief-card-loading">
                <Loader2 size={18} className="brief-spinner" />
                <span>Preparing your daily brief...</span>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <Link href="/today/brief" className="brief-card brief-card-link">
                <div className="brief-card-icon"><AlertTriangle size={18} /></div>
                <div className="brief-card-body">
                    <div className="brief-card-title">Daily Brief</div>
                    <div className="brief-card-sub">{error}</div>
                </div>
                <ChevronRight size={16} className="brief-card-chevron" />
            </Link>
        );
    }

    if (!brief) return null;

    // Extract preview text (first 150 chars)
    const previewText = brief.briefText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .substring(0, 150)
        .trim() + '...';

    const sections = brief.sections as Record<string, unknown>;
    const projects = (sections.projectSummaries as unknown[])?.length || 0;
    const overdue = (sections.overdueTasks as unknown[])?.length || 0;

    return (
        <Link href="/today/brief" className="brief-card brief-card-link" style={{ textDecoration: 'none' }}>
            <div className="brief-card-icon">
                <Headphones size={18} />
            </div>
            <div className="brief-card-body">
                <div className="brief-card-title">
                    <Zap size={12} style={{ color: '#00daf3' }} />
                    Daily Brief Ready
                    {brief.audioUrl && <span className="brief-card-audio-badge">🎙️ Audio</span>}
                </div>
                <div className="brief-card-sub">{previewText}</div>
                <div className="brief-card-meta">
                    {projects > 0 && <span>{projects} projects</span>}
                    {overdue > 0 && <span className="brief-card-overdue">{overdue} overdue</span>}
                </div>
            </div>
            <ChevronRight size={16} className="brief-card-chevron" />
        </Link>
    );
}
