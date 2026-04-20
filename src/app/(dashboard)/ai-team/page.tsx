'use client';

import { useState, useEffect,useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import {
    Bot, Brain, Building2, Coins, Megaphone, GraduationCap,
    Target, Package, Sparkles, Rocket, ChevronRight, Zap,
} from 'lucide-react';
import './ai-team-list.css';

// ─── Types ────────────────────────────────────────────

interface BrainMember {
    id: string;
    brainType: string;
    name: string;
    description: string | null;
    status: string;
    isEnabled: boolean;
    configJson?: any;
}

// ─── Avatar helper ────────────────────────────────────

const AVATAR_COLORS = [
    '#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706',
    '#dc2626', '#4f46e5', '#0d9488', '#be185d', '#65a30d',
];

function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const BRAIN_ICONS: Record<string, React.ReactNode> = {
    'COMPANY': <Building2 size={20} />,
    'MARKETING': <Megaphone size={20} />,
    'SALES': <Coins size={20} />,
    'PRODUCT_ASSISTANT': <Package size={20} />,
    'ONBOARDING': <GraduationCap size={20} />,
    'COMPANY_ADVISOR': <Building2 size={20} />,
    'LEAD_DISCOVERY': <Target size={20} />,
};

// ─── Component ────────────────────────────────────────

export default function AITeamListPage() {
    const router = useRouter();
    const { showToast } = useUIFeedback();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<BrainMember[]>([]);

    const loadMembers = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/brains');
            const data = await res.json();
            setMembers(data.brains || []);
        } catch {
            showToast('Error loading AI Team', 'error');
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => { loadMembers(); }, [loadMembers]);

    if (loading) {
        return (
            <div className="atl-loading">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            {/* ── Standard Nousio Fixed Page Header ── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Bot size={20} strokeWidth={2} /></span>
                    <h1>AI Team</h1>
                </div>
            </div>

            <div className="atl-page">
                <div className="atl-grid">
                    {members.map(member => {
                        const displayName = member.configJson?.identity?.displayName || member.name;
                        const avatarUrl = member.configJson?.identity?.avatarUrl || null;
                        const initials = getInitials(displayName);
                        const color = getAvatarColor(displayName);
                        const isActive = member.status === 'ACTIVE' && member.isEnabled;
                        const roleLabel = member.description
                            || member.brainType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                        return (
                            <button
                                key={member.id}
                                className="atl-member-card"
                                onClick={() => router.push(`/ai-team/${member.id}`)}
                            >
                                <div className="atl-member-avatar" style={{ background: avatarUrl ? 'transparent' : color }}>
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                    ) : (
                                        initials
                                    )}
                                    <span className={`atl-member-dot ${isActive ? 'active' : 'inactive'}`} />
                                </div>
                                <div className="atl-member-info">
                                    <div className="atl-member-name">{displayName}</div>
                                    <div className="atl-member-role">{roleLabel}</div>
                                </div>
                                <div className="atl-member-type-icon">
                                    {BRAIN_ICONS[member.brainType] || <Brain size={20} />}
                                </div>
                                <ChevronRight size={14} className="atl-member-arrow" />
                            </button>
                        );
                    })}
                </div>

                {members.length === 0 && (
                    <div className="atl-empty">
                        <Bot size={40} style={{ opacity: 0.15 }} />
                        <h3>No AI team members yet</h3>
                        <p>Configure your AI team in Settings → AI Team.</p>
                        <button className="btn btn-primary" onClick={() => router.push('/settings/ai-brain')}>
                            <Sparkles size={14} /> Setup AI Team
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
