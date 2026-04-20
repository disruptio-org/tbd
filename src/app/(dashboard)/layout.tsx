'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LanguageProvider, useT } from '@/i18n/context';
import {
    Sun, Users, FolderOpen, FileOutput, Brain,
    Building2, CheckSquare, Settings, Bot, Compass,
    LogOut, Menu, Zap, Search, Bell, User,
} from 'lucide-react';
import './dashboard.css';
import ActionAssistantLauncher from '@/components/ActionAssistantLauncher';

/* ─── Icon Map ─────────────────────────────────────────────────── */
const ICON_PROPS = { size: 18, strokeWidth: 1.8 } as const;
const ICON_MAP: Record<string, ReactNode> = {
    sun: <Sun {...ICON_PROPS} />,
    users: <Users {...ICON_PROPS} />,
    folder: <FolderOpen {...ICON_PROPS} />,
    fileOutput: <FileOutput {...ICON_PROPS} />,
    brain: <Brain {...ICON_PROPS} />,
    building: <Building2 {...ICON_PROPS} />,
    check: <CheckSquare {...ICON_PROPS} />,
    settings: <Settings {...ICON_PROPS} />,
    bot: <Bot {...ICON_PROPS} />,
    zap: <Zap {...ICON_PROPS} />,
    compass: <Compass {...ICON_PROPS} />,
    logout: <LogOut {...ICON_PROPS} />,
};

/* ─── Navigation Config (V2: 5 primary + secondary) ──── */

interface NavItem {
    href: string;
    labelKey: string;
    icon: string;
    featureKey: string | null;
    adminOnly?: boolean;
}

interface NavGroup {
    key: string;
    labelKey: string | null;
    items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        key: 'primary',
        labelKey: null,
        items: [
            { href: '/today',        labelKey: 'nav.today',        icon: 'sun',        featureKey: null },
            { href: '/team',         labelKey: 'nav.team',         icon: 'users',      featureKey: 'ai_brain' },
            { href: '/projects',     labelKey: 'nav.projects',     icon: 'folder',     featureKey: 'projects_workspaces' },
            { href: '/deliverables', labelKey: 'nav.deliverables', icon: 'fileOutput',  featureKey: null },
            { href: '/knowledge',    labelKey: 'nav.knowledge',    icon: 'brain',      featureKey: null },
        ],
    },
    {
        key: 'secondary',
        labelKey: 'nav.more',
        items: [
            { href: '/customers',         labelKey: 'nav.customers',  icon: 'building', featureKey: 'projects_workspaces' },
            { href: '/boardroom',         labelKey: 'nav.boardroom',  icon: 'compass',  featureKey: null },
            { href: '/tasks',             labelKey: 'nav.tasks',      icon: 'check',    featureKey: 'tasks' },
            { href: '/settings',          labelKey: 'nav.settings',   icon: 'settings', featureKey: null },
            { href: '/settings/ai-brain', labelKey: 'nav.aiConfig',   icon: 'bot',      featureKey: 'ai_brain', adminOnly: true },
        ],
    },
];

/* Pages that require a specific feature — redirect if access denied */
const FEATURE_GUARDS: Record<string, string> = {
    '/documents': 'documents',
    '/company-dna': 'documents',
    '/search': 'search',
    '/marketing': 'marketing',
    '/product': 'product_assistant',
    '/sales': 'sales',
    '/projects': 'projects_workspaces',
    '/customers': 'projects_workspaces',
    '/tasks': 'tasks',
    '/skills': 'ai_brain',
    '/chat': 'chat',
    '/company-advisor': 'company_advisor',
    '/onboarding-assistant': 'onboarding_assistant',
    '/settings/ai-brain': 'ai_brain',
    '/company/profile': 'settings',
    '/settings/users': 'user_management',
    '/settings/access-groups': 'access_groups',
    '/settings/integrations': 'integrations',
    '/leads': 'leads',
    '/knowledge': 'documents',
    '/knowledge/documents': 'documents',
    '/knowledge/search': 'documents',
    '/deliverables': 'projects_workspaces',
    '/team': 'ai_brain',
};

/* ─── Page Header Config (per-route title + tabs) ───────────── */

interface PageHeaderTab {
    key: string;
    label: string;
    href?: string;
}

interface PageHeaderConfig {
    title: string;
    tabs?: PageHeaderTab[];
}

const PAGE_HEADERS: Record<string, PageHeaderConfig> = {
    '/today': { title: 'Today', tabs: [{ key: 'overview', label: 'Overview', href: '/today' }, { key: 'updates', label: 'Updates', href: '/today?tab=updates' }, { key: 'analytics', label: 'Analytics', href: '/today?tab=analytics' }] },
    '/today/brief': { title: 'Daily Brief' },
    '/team': { title: 'Team', tabs: [{ key: 'members', label: 'Members', href: '/team' }, { key: 'activity', label: 'Activity', href: '/team?tab=activity' }] },
    '/projects': { title: 'Projects' },
    '/deliverables': { title: 'Deliverables' },
    '/knowledge': { title: 'Knowledge', tabs: [
        { key: 'graph', label: 'Graph', href: '/knowledge' },
        { key: 'documents', label: 'Documents', href: '/knowledge/documents' },
        { key: 'search', label: 'Search', href: '/knowledge/search' },
    ] },
    '/knowledge/documents': { title: 'Knowledge', tabs: [
        { key: 'graph', label: 'Graph', href: '/knowledge' },
        { key: 'documents', label: 'Documents', href: '/knowledge/documents' },
        { key: 'search', label: 'Search', href: '/knowledge/search' },
    ] },
    '/knowledge/search': { title: 'Knowledge', tabs: [
        { key: 'graph', label: 'Graph', href: '/knowledge' },
        { key: 'documents', label: 'Documents', href: '/knowledge/documents' },
        { key: 'search', label: 'Search', href: '/knowledge/search' },
    ] },
    '/customers': { title: 'Customers' },
    '/tasks': { title: 'Tasks' },
    '/boardroom': { title: 'Boardroom' },
    '/settings': { title: 'Settings' },
    '/settings/profile': { title: 'Profile' },
    '/settings/ai-brain': { title: 'AI Team Config' },
};

function getPageHeader(pathname: string): PageHeaderConfig {
    // Exact match first, then prefix match
    if (PAGE_HEADERS[pathname]) return PAGE_HEADERS[pathname];
    const match = Object.keys(PAGE_HEADERS).find(k => pathname.startsWith(k + '/'));
    if (match) return PAGE_HEADERS[match];
    // Fallback: capitalize the first path segment
    const seg = pathname.split('/').filter(Boolean)[0] || 'Dashboard';
    return { title: seg.charAt(0).toUpperCase() + seg.slice(1) };
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function getInitials(name: string) {
    return name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

/** Check if a route matches a nav item href */
function isRouteActive(pathname: string, href: string) {
    const base = href.split('?')[0];
    if (pathname === base) return true;
    // Only match sub-routes if no other more-specific nav item matches
    if (pathname.startsWith(base + '/')) {
        // Check if any nav item is a more specific match
        const allHrefs = NAV_GROUPS.flatMap(g => g.items.map(i => i.href.split('?')[0]));
        const hasMoreSpecific = allHrefs.some(h => h !== base && h.startsWith(base + '/') && pathname.startsWith(h));
        return !hasMoreSpecific;
    }
    return false;
}

/** Check if any item in a group matches the current route */
function isGroupActive(pathname: string, items: NavItem[]) {
    return items.some((item) => isRouteActive(pathname, item.href));
}

/* ─── Component ───────────────────────────────────────────────── */

function DashboardLayoutInner({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    // Build full URL path including query string for tab matching
    const fullPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
    const avatarDropdownRef = useRef<HTMLDivElement>(null);
    const [enabledFeatures, setEnabledFeatures] = useState<string[] | null>(null);
    const [effectiveAccess, setEffectiveAccess] = useState<{ features?: Record<string, boolean>; role?: string; status?: string } | null>(null);
    const [user, setUser] = useState<{ name: string; email: string; avatarUrl: string | null; role?: string } | null>(null);
    const [onboardingChecked, setOnboardingChecked] = useState(false);
    const isMounted = useRef(false);
    const { t } = useT();

    // Track which groups are expanded (default: all expanded)
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        NAV_GROUPS.forEach((g) => { initial[g.key] = true; });
        return initial;
    });

    const toggleGroup = useCallback((key: string) => {
        setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // Persist collapsed state to localStorage
    useEffect(() => {
        const stored = localStorage.getItem('sidebar-collapsed');
        if (stored === 'true') setSidebarCollapsed(true);
        else setSidebarCollapsed(false);
        isMounted.current = true;
    }, []);

    const toggleCollapsed = useCallback(() => {
        setSidebarCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar-collapsed', String(next));
            return next;
        });
    }, []);

    // Close avatar dropdown on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(e.target as Node)) {
                setAvatarDropdownOpen(false);
            }
        }
        if (avatarDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [avatarDropdownOpen]);

    // Close dropdown on route change
    useEffect(() => {
        setAvatarDropdownOpen(false);
    }, [pathname]);

    // Auto-expand the group containing the active route
    useEffect(() => {
        NAV_GROUPS.forEach((group) => {
            if (isGroupActive(pathname, group.items)) {
                setOpenGroups((prev) => {
                    if (prev[group.key]) return prev;
                    return { ...prev, [group.key]: true };
                });
            }
        });
    }, [pathname]);

    useEffect(() => {
        // ── Onboarding gating ──
        fetch('/api/user/onboarding-status')
            .then((r) => r.json())
            .then((data) => {
                if (data.mustChangePassword) {
                    router.replace('/first-login');
                    return;
                }
                if (data.onboardingStatus && data.onboardingStatus !== 'COMPLETED') {
                    router.replace('/setup');
                    return;
                }
                setOnboardingChecked(true);
            })
            .catch(() => {
                setOnboardingChecked(true);
            });

        // Fetch enabled features
        fetch('/api/user/features')
            .then((r) => r.json())
            .then((data) => {
                const features: string[] = data.features ?? [];
                setEnabledFeatures(features);

                if (data.effectiveAccess) {
                    setEffectiveAccess(data.effectiveAccess);
                }

                const userRole = data.role || data.effectiveAccess?.role;

                // Redirect if current page requires a disabled feature
                const requiredFeature = Object.entries(FEATURE_GUARDS).find(
                    ([path]) => pathname === path || pathname.startsWith(path + '/')
                );
                if (requiredFeature) {
                    const [, featureKey] = requiredFeature;
                    if (!features.includes(featureKey)) {
                        router.replace('/today');
                        return;
                    }
                    if (userRole === 'MEMBER' && data.effectiveAccess?.features) {
                        if (!data.effectiveAccess.features[featureKey]) {
                            router.replace('/today');
                            return;
                        }
                    }
                }
            })
            .catch(() => {
                setEnabledFeatures(null);
            });

        // Fetch user profile for sidebar
        fetch('/api/user/profile')
            .then((r) => r.json())
            .then((data) => {
                if (data.profile) setUser(data.profile);
            })
            .catch(console.error);
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleLogout() {
        await supabase.auth.signOut();
        window.location.href = '/login';
    }

    /** Filter a group's items by feature flags */
    function getVisibleItems(items: NavItem[]) {
        return items.filter((item) => {
            if (item.adminOnly && user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') return false;

            if (item.featureKey) {
                if (enabledFeatures !== null && !enabledFeatures.includes(item.featureKey)) return false;

                if (user?.role === 'MEMBER' && effectiveAccess?.features) {
                    if (!effectiveAccess.features[item.featureKey]) return false;
                }
            }

            return true;
        });
    }

    // ── Block render until onboarding gating completes ──
    if (!onboardingChecked) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F0F14' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="dashboard-layout">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-brand">
                    <Link href="/today" onClick={() => setSidebarOpen(false)} className="sidebar-brand-logo">
                        {sidebarCollapsed ? (
                            <span className="sidebar-logo-letter">N</span>
                        ) : (
                            <img src="/logos/logo_black.png" alt="NOUSIO" className="sidebar-logo" />
                        )}
                    </Link>
                    <button
                        className="sidebar-collapse-btn"
                        onClick={toggleCollapsed}
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {sidebarCollapsed ? '›' : '‹'}
                    </button>
                </div>

                <nav className="sidebar-nav" aria-label="Main navigation">
                    {NAV_GROUPS.map((group) => {
                        const visibleItems = getVisibleItems(group.items);

                        if (visibleItems.length === 0) return null;

                        const isExpanded = openGroups[group.key] !== false;
                        const hasActiveItem = isGroupActive(pathname, visibleItems);

                        // Primary group: flat items, no section heading
                        if (!group.labelKey) {
                            return visibleItems.map((item) => {
                                const active = isRouteActive(pathname, item.href);
                                const label = item.labelKey.startsWith('__dynamic:')
                                    ? item.labelKey.replace('__dynamic:', '')
                                    : t(item.labelKey);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`sidebar-link sidebar-link-standalone ${active ? 'active' : ''}`}
                                        onClick={() => setSidebarOpen(false)}
                                        title={sidebarCollapsed ? label : undefined}
                                    >
                                        <span className="sidebar-link-icon">{ICON_MAP[item.icon]}</span>
                                        <span className="sidebar-link-text">{label}</span>
                                    </Link>
                                );
                            });
                        }

                        // Grouped section
                        return (
                            <div key={group.key} className={`sidebar-group ${hasActiveItem ? 'has-active' : ''}`}>
                                <button
                                    className="sidebar-group-label"
                                    onClick={() => !sidebarCollapsed && toggleGroup(group.key)}
                                    aria-expanded={isExpanded}
                                    aria-controls={`nav-group-${group.key}`}
                                >
                                    <span className="sidebar-group-label-text">{t(group.labelKey!)}</span>
                                    <span className={`sidebar-group-chevron ${isExpanded ? 'expanded' : ''}`}>
                                        ›
                                    </span>
                                </button>

                                <div
                                    id={`nav-group-${group.key}`}
                                    className={`sidebar-group-items ${isExpanded || sidebarCollapsed ? 'expanded' : 'collapsed'}`}
                                >
                                    {visibleItems.map((item) => {
                                        const active = isRouteActive(pathname, item.href);
                                        const label = item.labelKey.startsWith('__dynamic:')
                                            ? item.labelKey.replace('__dynamic:', '')
                                            : t(item.labelKey);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`sidebar-link ${active ? 'active' : ''}`}
                                                onClick={() => setSidebarOpen(false)}
                                                title={sidebarCollapsed ? label : undefined}
                                            >
                                                <span className="sidebar-link-icon">{ICON_MAP[item.icon]}</span>
                                                <span className="sidebar-link-text">{label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    {/* User profile card */}
                    {user && (
                        <Link href="/settings/profile" className="sidebar-user-profile" onClick={() => setSidebarOpen(false)}>
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="sidebar-user-avatar" />
                            ) : (
                                <div className="sidebar-user-avatar-placeholder">
                                    {getInitials(user.name || 'U')}
                                </div>
                            )}
                            <div className="sidebar-user-info">
                                <span className="sidebar-user-name" title={user.name}>{user.name}</span>
                                <span className="sidebar-user-email" title={user.email}>{user.email}</span>
                            </div>
                        </Link>
                    )}

                    {/* Logout */}
                    <button className="sidebar-logout-btn" onClick={handleLogout} title={sidebarCollapsed ? t('nav.logout') : undefined}>
                        <span className="sidebar-link-icon">{ICON_MAP.logout}</span>
                        <span className="sidebar-link-text">{t('nav.logout')}</span>
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className={`dashboard-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                {/* ─── Global App Header ─── */}
                {(() => {
                    const pageHeader = getPageHeader(pathname);
                    return (
                        <header className="app-header">
                            <div className="app-header-left">
                                <button
                                    className="sidebar-toggle-mobile"
                                    onClick={() => setSidebarOpen(!sidebarOpen)}
                                    aria-label="Toggle sidebar"
                                >
                                    <Menu size={20} strokeWidth={2} />
                                </button>
                                <h1 className="app-header-title">{pageHeader.title}</h1>
                                {pageHeader.tabs && (
                                    <nav className="app-header-tabs">
                                        {pageHeader.tabs.map((tab) => {
                                            const isActive = tab.href
                                                ? (tab.href.includes('?') ? fullPath === tab.href : pathname === tab.href && !searchParams.toString())
                                                : false;
                                            const isFirstDefault = !tab.href && tab === pageHeader.tabs![0];
                                            return tab.href ? (
                                                <Link
                                                    key={tab.key}
                                                    href={tab.href}
                                                    className={`app-header-tab ${isActive ? 'active' : ''}`}
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    {tab.label}
                                                </Link>
                                            ) : (
                                                <button
                                                    key={tab.key}
                                                    className={`app-header-tab ${isFirstDefault ? 'active' : ''}`}
                                                >
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </nav>
                                )}
                            </div>
                            <div className="app-header-right">
                                <div className="app-header-search">
                                    <Search size={14} className="app-header-search-icon" />
                                    <input className="app-header-search-input" placeholder="Search workspace..." readOnly />
                                </div>
                                <button className="app-header-bell"><Bell size={20} /></button>
                                <div className="app-header-avatar-wrapper" ref={avatarDropdownRef}>
                                    <button
                                        className="app-header-avatar"
                                        onClick={() => setAvatarDropdownOpen(prev => !prev)}
                                        aria-haspopup="true"
                                        aria-expanded={avatarDropdownOpen}
                                    >
                                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                    </button>
                                    {avatarDropdownOpen && (
                                        <div className="app-header-avatar-dropdown">
                                            <button
                                                className="avatar-dropdown-item"
                                                onClick={() => { setAvatarDropdownOpen(false); router.push('/settings/profile'); }}
                                            >
                                                <User size={15} /> Profile
                                            </button>
                                            <div className="avatar-dropdown-divider" />
                                            <button
                                                className="avatar-dropdown-item danger"
                                                onClick={() => { setAvatarDropdownOpen(false); handleLogout(); }}
                                            >
                                                <LogOut size={15} /> Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </header>
                    );
                })()}

                <div className="dashboard-content">{children}</div>

                {/* Action Assistant — Global FAB + Panel */}
                <ActionAssistantLauncher />
            </main>
        </div>
    );
}

// Wrap in LanguageProvider
export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <LanguageProvider>
            <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </LanguageProvider>
    );
}
