'use client';

import { useState, useEffect, useCallback, createElement } from 'react';
import type { ContentType } from '@/components/AIAssistantChat';
import {
    Briefcase, Globe, PenLine, Mail, CalendarDays, Rocket, Tag,
    ClipboardList, Settings, Wrench, User, CheckSquare, Puzzle,
    Target, Map, Package, Plug, Microscope, Phone, FileText,
    RefreshCw, Shield, BarChart3, Search, BookOpen, HelpCircle,
    Cog, Users, TrendingUp, Crosshair, Zap, Building2, Dna,
    type LucideIcon,
} from 'lucide-react';

// ─── Icon Registry ────────────────────────────────────
// Maps DB icon name → Lucide component

const ICON_REGISTRY: Record<string, LucideIcon> = {
    'briefcase':      Briefcase,
    'globe':          Globe,
    'pen-line':       PenLine,
    'mail':           Mail,
    'calendar-days':  CalendarDays,
    'rocket':         Rocket,
    'tag':            Tag,
    'clipboard-list': ClipboardList,
    'settings':       Settings,
    'wrench':         Wrench,
    'user':           User,
    'check-square':   CheckSquare,
    'puzzle':         Puzzle,
    'target':         Target,
    'map':            Map,
    'package':        Package,
    'plug':           Plug,
    'microscope':     Microscope,
    'phone':          Phone,
    'file-text':      FileText,
    'refresh-cw':     RefreshCw,
    'shield':         Shield,
    'bar-chart-3':    BarChart3,
    'search':         Search,
    'book-open':      BookOpen,
    'help-circle':    HelpCircle,
    'cog':            Cog,
    'users':          Users,
    'trending-up':    TrendingUp,
    'crosshair':      Crosshair,
    'zap':            Zap,
    'building-2':     Building2,
    'dna':            Dna,
};

const ICON_PROPS = { size: 16, strokeWidth: 2 } as const;

function iconForName(name: string | null): React.ReactNode {
    const Component = name ? ICON_REGISTRY[name] : null;
    return Component ? createElement(Component, ICON_PROPS) : createElement(Zap, ICON_PROPS);
}

// ─── DB Skill shape ───────────────────────────────────

interface DBSkill {
    key: string;
    name: string;
    icon: string | null;
    status: string;
    outputActions: string[];
    // Runtime metadata
    importMode?: string | null;
    runtimeCategory?: string | null;
    responseMode?: string | null;
    compatibilityState?: string | null;
}

// ─── Assistant type mapping ───────────────────────────
// Maps the AIAssistantChat assistantType to the DB brainType

const ASSISTANT_TYPE_MAP: Record<string, string> = {
    MARKETING: 'MARKETING',
    SALES: 'SALES',
    PRODUCT: 'PRODUCT_ASSISTANT',
    ONBOARDING: 'ONBOARDING',
    COMPANY_ADVISOR: 'COMPANY_ADVISOR',
    COMPANY: 'COMPANY',
    GENERAL_AI: 'GENERAL_AI',
};

// ─── Company DNA default skills ───────────────────────
const COMPANY_DEFAULT_SKILLS: ContentType[] = [
    { value: 'STRATEGIC_ADVICE', label: 'Strategic Advice', icon: iconForName('target') },
    { value: 'BRAND_VOICE_CHECK', label: 'Brand Voice Check', icon: iconForName('pen-line') },
    { value: 'TEAM_GUIDANCE', label: 'Team Guidance', icon: iconForName('users') },
    { value: 'COMPANY_BRIEF', label: 'Company Brief', icon: iconForName('briefcase') },
];

// ─── Hook ─────────────────────────────────────────────

/**
 * Fetches skills from the DB for a given assistant type
 * and returns them as ContentType[] ready for AIAssistantChat.
 *
 * @param assistantType - The AIAssistantChat assistantType (e.g. 'MARKETING', 'PRODUCT')
 * @returns { skills, loading, reload }
 */
export function useAssistantSkills(assistantType: string) {
    const [skills, setSkills] = useState<ContentType[]>([]);
    const [loading, setLoading] = useState(true);

    const dbType = ASSISTANT_TYPE_MAP[assistantType] || assistantType;

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/ai/skills?assistantType=${dbType}`);
            const data = await res.json();
            const dbSkills: DBSkill[] = data.skills || [];

            const mapped: ContentType[] = dbSkills
                .filter(s => s.status === 'ACTIVE')
                .map(s => ({
                    value: s.key.toUpperCase(),
                    label: s.name,
                    icon: iconForName(s.icon),
                    outputActions: s.outputActions,
                    // Runtime metadata for type-aware rendering
                    importMode: s.importMode || 'LEGACY',
                    runtimeCategory: s.runtimeCategory || 'content-generation',
                    responseMode: s.responseMode || 'chat',
                    compatibilityState: s.compatibilityState || 'UNKNOWN',
                }));

            setSkills(mapped.length > 0 ? mapped : (dbType === 'COMPANY' ? COMPANY_DEFAULT_SKILLS : []));
        } catch {
            console.error('[useAssistantSkills] Failed to load skills for', dbType);
            // Skills will stay empty — fallback handled by each page
        }
        setLoading(false);
    }, [dbType]);

    useEffect(() => { load(); }, [load]);

    return { skills, loading, reload: load };
}

/**
 * Helper: resolve a skill label from a key value.
 */
export function skillLabel(skills: ContentType[], value: string): string {
    return skills.find(s => s.value === value)?.label || value;
}
