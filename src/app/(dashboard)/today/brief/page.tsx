'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Play, Pause, Volume2, RefreshCw,
    Headphones, Loader2, X,
    AlertTriangle, TrendingUp, TrendingDown, Minus,
    FolderKanban, Zap, Target, Clock, ShieldCheck,
} from 'lucide-react';
import './brief-newsletter.css';

interface BriefData {
    id: string;
    briefText: string;
    audioUrl?: string | null;
    audioDuration?: number | null;
    generatedAt: string;
    sections: {
        overdueTasks?: Array<{ id: string; title: string; boardId?: string; projectId?: string; projectName?: string; dueDate?: string }>;
        todayFocus?: Array<{ id: string; title: string; boardId?: string; projectId?: string; priority?: string; projectName?: string }>;
        velocity?: {
            activeProjects: number;
            tasksCompletedThisWeek: number;
            tasksCompletedLastWeek: number;
            trend: 'up' | 'down' | 'stable';
            knowledgeCoverage: number;
        };
        projectSummaries?: Array<{
            id?: string;
            name: string;
            customer?: string;
            progress: number;
            totalTasks: number;
            completedTasks: number;
        }>;
        pendingReviews?: {
            tasks?: Array<{ id: string; title: string; type: string; initiativeTitle?: string | null; projectName?: string | null }>;
            plans?: Array<{ id: string; title: string; status?: string; projectName?: string | null }>;
            totalCount?: number;
        };
    };
}

interface SkillInsight {
    scheduleId: string;
    runId: string;
    skillName: string;
    skillIcon: string | null;
    skillKey: string | null;
    outputTitle: string | null;
    outputPreview: string;
    outputText: string;
    generatedAt: string;
    isNew: boolean;
    timezone: string;
    runAtTime: string;
}

export default function DailyBriefPage() {
    const [brief, setBrief] = useState<BriefData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState(false);
    const [skillInsights, setSkillInsights] = useState<SkillInsight[]>([]);
    const [viewingInsight, setViewingInsight] = useState<SkillInsight | null>(null);

    // Audio
    const [audioLoading, setAudioLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetchBrief();
        // Fetch skill insights for brief sidebar (with includeInBrief filter)
        fetch('/api/skills/today?filter=brief')
            .then(r => r.ok ? r.json() : { insights: [] })
            .then(d => setSkillInsights(d.insights || []))
            .catch(() => {});
    }, []);

    async function fetchBrief() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/daily-brief');
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || data.details || 'Failed to load brief');
                return;
            }
            setBrief(data.brief);
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    }

    async function regenerate() {
        setRegenerating(true);
        try {
            await fetch('/api/daily-brief', { method: 'POST' });
            await fetchBrief();
        } catch (e) {
            console.error(e);
        } finally {
            setRegenerating(false);
        }
    }

    async function generateAudio() {
        if (!brief) return;
        if (brief.audioUrl) { playAudio(brief.audioUrl); return; }
        setAudioLoading(true);
        try {
            const res = await fetch('/api/daily-brief/audio', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setBrief(prev => prev ? { ...prev, audioUrl: data.audioUrl, audioDuration: data.duration } : prev);
                playAudio(data.audioUrl);
            }
        } catch (e) { console.error(e); }
        finally { setAudioLoading(false); }
    }

    function playAudio(url: string) {
        if (!audioRef.current) {
            audioRef.current = new Audio(url);
            audioRef.current.addEventListener('timeupdate', () => {
                if (audioRef.current) { setAudioProgress(audioRef.current.currentTime); setAudioDuration(audioRef.current.duration || 0); }
            });
            audioRef.current.addEventListener('ended', () => { setIsPlaying(false); setAudioProgress(0); });
            audioRef.current.addEventListener('loadedmetadata', () => { if (audioRef.current) setAudioDuration(audioRef.current.duration); });
        } else if (audioRef.current.src !== url) { audioRef.current.src = url; }
        audioRef.current.play();
        setIsPlaying(true);
    }

    function togglePlayPause() {
        if (!audioRef.current) { generateAudio(); return; }
        if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
        else { audioRef.current.play(); setIsPlaying(true); }
    }

    function seekAudio(e: React.MouseEvent<HTMLDivElement>) {
        if (!audioRef.current || !audioDuration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioDuration;
    }

    function fmt(s: number): string { return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Waveform bars for the audio player
    const WaveformBars = useCallback(() => {
        const bars = 48;
        return (
            <div className="nl-waveform">
                {Array.from({ length: bars }).map((_, i) => {
                    const progress = audioDuration > 0 ? audioProgress / audioDuration : 0;
                    const barFraction = i / bars;
                    const isActive = barFraction <= progress;
                    // Generate a pseudo-random height for each bar
                    const h = 20 + Math.sin(i * 1.3) * 14 + Math.cos(i * 0.7) * 10;
                    return (
                        <div
                            key={i}
                            className={`nl-waveform-bar ${isActive ? 'active' : ''} ${isPlaying && isActive ? 'playing' : ''}`}
                            style={{ height: `${h}%` }}
                        />
                    );
                })}
            </div>
        );
    }, [audioProgress, audioDuration, isPlaying]);

    // Loading
    if (loading) {
        return (
            <div className="nl-brief">
                <div className="nl-loading">
                    <Loader2 size={20} className="nl-spin" />
                    <span>Preparing your brief...</span>
                </div>
            </div>
        );
    }

    // Error
    if (error || !brief) {
        return (
            <div className="nl-brief">
                <div className="nl-masthead">
                    <Link href="/today" className="nl-back"><ArrowLeft size={16} /> Back</Link>
                    <div className="nl-masthead-title">NOUSIO DAILY BRIEF</div>
                    <div />
                </div>
                <div className="nl-error">
                    <AlertTriangle size={20} />
                    <p>{error || 'No brief available'}</p>
                    <button onClick={fetchBrief} className="nl-btn-retry">Retry</button>
                </div>
            </div>
        );
    }

    const sections = brief.sections;
    const velocity = sections.velocity;
    const projects = sections.projectSummaries || [];
    const overdue = sections.overdueTasks || [];
    const focus = sections.todayFocus || [];
    const pendingReviews = sections.pendingReviews;
    const generatedTime = new Date(brief.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // Calculate edition number (days since a reference date)
    const refDate = new Date('2026-01-01');
    const editionNum = Math.floor((now.getTime() - refDate.getTime()) / 86400000);

    return (
        <div className="nl-brief">
            {/* ── Masthead ── */}
            <header className="nl-masthead">
                <Link href="/today" className="nl-back"><ArrowLeft size={16} /> Back to Today</Link>
                <div className="nl-masthead-center">
                    <div className="nl-masthead-title">NOUSIO DAILY BRIEF</div>
                </div>
                <button className="nl-regen" onClick={regenerate} disabled={regenerating}>
                    <RefreshCw size={13} className={regenerating ? 'nl-spin' : ''} />
                    {regenerating ? 'Refreshing...' : 'Refresh'}
                </button>
            </header>

            {/* ── Dateline ── */}
            <div className="nl-dateline">
                <div className="nl-dateline-rule" />
                <div className="nl-dateline-content">
                    <span className="nl-dateline-date">{dateStr}</span>
                    <span className="nl-dateline-sep">·</span>
                    <span className="nl-dateline-time">Generated {generatedTime}</span>
                    <span className="nl-dateline-sep">·</span>
                    <span className="nl-dateline-edition">No. {String(editionNum).padStart(3, '0')}</span>
                </div>
                <div className="nl-dateline-rule" />
            </div>

            {/* ── Audio Player (Editorial Style) ── */}
            <div className="nl-audio">
                <button
                    className="nl-audio-play"
                    onClick={brief.audioUrl ? togglePlayPause : generateAudio}
                    disabled={audioLoading}
                >
                    {audioLoading ? <Loader2 size={18} className="nl-spin" />
                        : isPlaying ? <Pause size={18} />
                        : <Play size={18} style={{ marginLeft: 2 }} />}
                </button>
                <div className="nl-audio-meta">
                    <div className="nl-audio-label">
                        <Headphones size={12} />
                        <span>{isPlaying ? 'Playing' : brief.audioUrl ? 'Listen' : 'Generate Audio'}</span>
                    </div>
                    {audioDuration > 0 && (
                        <div className="nl-audio-time">{fmt(audioProgress)} / {fmt(audioDuration)}</div>
                    )}
                </div>
                <div className="nl-audio-wave-wrap" onClick={seekAudio}>
                    <WaveformBars />
                </div>
                {isPlaying && <Volume2 size={14} className="nl-audio-vol" />}
            </div>

            {/* ── Two-Column Editorial Layout ── */}
            <div className="nl-editorial">
                {/* ── Main Column ── */}
                <article className="nl-main">
                    <div className="nl-section-label"><Zap size={12} /> AI-GENERATED BRIEF</div>
                    <div className="nl-prose" dangerouslySetInnerHTML={{ __html: markdownToHtml(brief.briefText) }} />
                </article>

                {/* ── Sidebar ── */}
                <aside className="nl-sidebar">
                    {/* Quick Stats */}
                    <div className="nl-sidebar-section">
                        <div className="nl-sidebar-label">QUICK STATS</div>
                        <div className="nl-stats-stack">
                            <div className="nl-stat-row">
                                <span className="nl-stat-name"><FolderKanban size={13} /> Active Projects</span>
                                <span className="nl-stat-val">{velocity?.activeProjects || 0}</span>
                            </div>
                            <div className="nl-stat-row">
                                <span className="nl-stat-name"><Target size={13} /> Tasks This Week</span>
                                <span className="nl-stat-val">{velocity?.tasksCompletedThisWeek || 0}</span>
                            </div>
                            <div className="nl-stat-row">
                                <span className="nl-stat-name">
                                    {velocity?.trend === 'up' ? <TrendingUp size={13} className="nl-trend-up" />
                                        : velocity?.trend === 'down' ? <TrendingDown size={13} className="nl-trend-down" />
                                        : <Minus size={13} />}
                                    Velocity
                                </span>
                                <span className={`nl-stat-val ${velocity?.trend === 'up' ? 'nl-trend-up' : velocity?.trend === 'down' ? 'nl-trend-down' : ''}`}>
                                    {velocity?.trend === 'up' ? '↑ Up' : velocity?.trend === 'down' ? '↓ Down' : '→ Stable'}
                                </span>
                            </div>
                            <div className="nl-stat-row">
                                <span className="nl-stat-name"><AlertTriangle size={13} className={overdue.length > 0 ? 'nl-trend-down' : ''} /> Overdue</span>
                                <span className={`nl-stat-val ${overdue.length > 0 ? 'nl-trend-down' : ''}`}>{overdue.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Today's Focus */}
                    {focus.length > 0 && (
                        <div className="nl-sidebar-section">
                            <div className="nl-sidebar-label">TODAY&apos;S FOCUS</div>
                            <div className="nl-focus-stack">
                                {focus.slice(0, 5).map((t, i) => (
                                    <Link
                                        key={t.id}
                                        href={t.boardId ? `/tasks?boardId=${t.boardId}` : t.projectId ? `/projects/${t.projectId}` : '/tasks'}
                                        className="nl-focus-row nl-focus-link"
                                    >
                                        <span className="nl-focus-num">{i + 1}</span>
                                        <div className="nl-focus-detail">
                                            <span className="nl-focus-name">{t.title}</span>
                                            {t.projectName && <span className="nl-focus-meta">{t.projectName}</span>}
                                        </div>
                                        {t.priority && (
                                            <span className={`nl-priority nl-priority-${t.priority}`}>{t.priority}</span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Overdue */}
                    {overdue.length > 0 && (
                        <div className="nl-sidebar-section">
                            <div className="nl-sidebar-label nl-label-warn">OVERDUE ITEMS</div>
                            <div className="nl-focus-stack">
                                {overdue.map((t) => (
                                    <Link
                                        key={t.id}
                                        href={t.boardId ? `/tasks?boardId=${t.boardId}` : t.projectId ? `/projects/${t.projectId}` : '/tasks'}
                                        className="nl-focus-row nl-overdue-row nl-focus-link"
                                    >
                                        <span className="nl-overdue-dot" />
                                        <div className="nl-focus-detail">
                                            <span className="nl-focus-name">{t.title}</span>
                                            {t.projectName && <span className="nl-focus-meta">{t.projectName}</span>}
                                        </div>
                                        {t.dueDate && (
                                            <span className="nl-overdue-date">{new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending Reviews */}
                    {pendingReviews && (pendingReviews.totalCount || 0) > 0 && (
                        <div className="nl-sidebar-section">
                            <div className="nl-sidebar-label nl-label-action">
                                <ShieldCheck size={12} /> PENDING REVIEWS
                            </div>
                            <div className="nl-focus-stack">
                                {(pendingReviews.tasks || []).map((t) => (
                                    <Link
                                        key={t.id}
                                        href="/boardroom"
                                        className="nl-focus-row nl-action-row nl-focus-link"
                                    >
                                        <span className="nl-action-dot" />
                                        <div className="nl-focus-detail">
                                            <span className="nl-focus-name">{t.title}</span>
                                            {t.initiativeTitle && <span className="nl-focus-meta">{t.initiativeTitle}</span>}
                                        </div>
                                        <span className="nl-action-type">{t.type}</span>
                                    </Link>
                                ))}
                                {(pendingReviews.plans || []).map((p) => (
                                    <Link
                                        key={p.id}
                                        href="/boardroom"
                                        className="nl-focus-row nl-action-row nl-focus-link"
                                    >
                                        <span className="nl-action-dot nl-action-plan" />
                                        <div className="nl-focus-detail">
                                            <span className="nl-focus-name">{p.title}</span>
                                            {p.projectName && <span className="nl-focus-meta">{p.projectName}</span>}
                                        </div>
                                        <span className="nl-action-type">Validate Plan</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skill Insights */}
                    {skillInsights.length > 0 && (
                        <div className="nl-sidebar-section">
                            <div className="nl-sidebar-label nl-label-insight">
                                <Zap size={12} /> AI SKILL INSIGHTS
                            </div>
                            <div className="nl-focus-stack">
                                {skillInsights.map((insight) => {
                                    const ago = Math.round((Date.now() - new Date(insight.generatedAt).getTime()) / 60_000);
                                    const freshness = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
                                    return (
                                        <div
                                            key={insight.runId}
                                            className="nl-focus-row nl-insight-row"
                                            onClick={() => setViewingInsight(insight)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter') setViewingInsight(insight); }}
                                        >
                                            <span className="nl-insight-dot" />
                                            <div className="nl-focus-detail">
                                                <span className="nl-focus-name">
                                                    {insight.skillName}
                                                    {insight.isNew && <span className="nl-insight-new">NEW</span>}
                                                </span>
                                                <span className="nl-focus-meta">{insight.outputPreview.substring(0, 80)}...</span>
                                            </div>
                                            <span className="nl-insight-time">{freshness}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* ── Project Health (full-width below) ── */}
            {projects.length > 0 && (
                <section className="nl-projects-section">
                    <div className="nl-section-rule" />
                    <div className="nl-section-label"><FolderKanban size={12} /> PROJECT HEALTH</div>
                    <div className="nl-projects-grid">
                        {projects.map((p, i) => (
                            <Link key={i} href={p.id ? `/projects/${p.id}` : '/projects'} className="nl-project-card nl-project-link">
                                <div className="nl-project-head">
                                    <span className="nl-project-name">{p.name}</span>
                                    <span className="nl-project-pct">{p.progress}%</span>
                                </div>
                                {p.customer && <span className="nl-project-client">{p.customer}</span>}
                                <div className="nl-project-bar-track">
                                    <div
                                        className="nl-project-bar-fill"
                                        style={{ width: `${Math.max(p.progress, 2)}%` }}
                                    />
                                </div>
                                <span className="nl-project-tasks">{p.completedTasks}/{p.totalTasks} tasks completed</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Footer ── */}
            <footer className="nl-footer">
                <div className="nl-footer-rule" />
                <div className="nl-footer-content">
                    <span className="nl-footer-brand">nousio</span>
                    <span className="nl-footer-tagline">Your AI Operating System · by Disruptio</span>
                </div>
            </footer>

            {/* ── Skill Insight Viewer Modal ──────────── */}
            {viewingInsight && (
                <div className="nl-insight-overlay" onClick={() => setViewingInsight(null)}>
                    <div className="nl-insight-modal" onClick={e => e.stopPropagation()}>
                        <div className="nl-insight-modal-header">
                            <div>
                                <span className="nl-insight-modal-badge">AI GENERATED</span>
                                <span className="nl-insight-modal-date">
                                    {new Date(viewingInsight.generatedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                            </div>
                            <button className="nl-insight-modal-close" onClick={() => setViewingInsight(null)}><X size={18} /></button>
                        </div>
                        {viewingInsight.outputTitle && (
                            <h1 className="nl-insight-modal-title">{viewingInsight.outputTitle}</h1>
                        )}
                        <div className="nl-insight-modal-divider" />
                        <div className="nl-prose" dangerouslySetInnerHTML={{ __html: markdownToHtml(viewingInsight.outputText || '') }} />
                        <div className="nl-insight-modal-footer">
                            <span>Generated by Nousio AI — {viewingInsight.skillName}</span>
                            <span>⏱ Scheduled Run</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function markdownToHtml(md: string): string {
    // Process headings first (before other replacements)
    let html = md
        // H1: # heading
        .replace(/^# (.+)$/gm, '<h2 class="nl-heading-1">$1</h2>')
        // H2: ## heading
        .replace(/^## (.+)$/gm, '<h3 class="nl-heading-2">$1</h3>')
        // H3: ### heading
        .replace(/^### (.+)$/gm, '<h4 class="nl-heading-3">$1</h4>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Numbered lists
        .replace(/^(\d+)\.\s(.*)$/gm, '<li class="nl-li-num">$2</li>')
        // Bullet lists
        .replace(/^- (.*)$/gm, '<li class="nl-li-bullet">$1</li>')
        // Paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');

    // Clean up empty paragraphs around block elements
    html = html
        .replace(/<p><h([234])/g, '<h$1')
        .replace(/<\/h([234])><\/p>/g, '</h$1>')
        .replace(/<p><li/g, '<li')
        .replace(/<\/li><\/p>/g, '</li>');

    return html;
}
