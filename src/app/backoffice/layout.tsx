'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { t, DEFAULT_LOCALE } from '@/i18n';
import { Building2, BarChart3, ArrowLeft, LogOut } from 'lucide-react';
import './backoffice.css';

const I = { size: 16, strokeWidth: 2 } as const;
const NAV_ITEMS = [
    { href: '/backoffice', icon: <Building2 {...I} />, labelKey: 'backoffice.companies' },
    { href: '/backoffice/analytics', icon: <BarChart3 {...I} />, labelKey: 'backoffice.analytics' },
];

export default function BackofficeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const lang = DEFAULT_LOCALE;
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is SUPER_ADMIN via API
        fetch('/api/backoffice/analytics')
            .then((r) => {
                if (r.status === 403 || r.status === 401) {
                    router.replace('/');
                    return;
                }
                setAuthorized(true);
            })
            .catch(() => router.replace('/'))
            .finally(() => setLoading(false));
    }, [router]);

    async function handleLogout() {
        await supabase.auth.signOut();
        window.location.href = '/login';
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center" style={{ minHeight: '100vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!authorized) return null;

    return (
        <div className="bo-layout">
            {/* Sidebar */}
            <aside className="bo-sidebar">
                <div className="bo-sidebar-brand">
                    <img src="/logos/logo_dark.png" alt="NOUSIO" className="sidebar-logo" />
                    <span className="bo-admin-badge">Admin</span>
                </div>

                <nav className="bo-sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`bo-sidebar-link ${pathname === item.href ||
                                (item.href !== '/backoffice' && pathname.startsWith(item.href))
                                ? 'active'
                                : ''
                                }`}
                        >
                            <span className="bo-sidebar-link-icon">{item.icon}</span>
                            {t(lang, item.labelKey)}
                        </Link>
                    ))}

                    <div className="bo-section-label">
                        {t(lang, 'backoffice.platform')}
                    </div>
                    <Link href="/" className="bo-sidebar-link">
                        <span className="bo-sidebar-link-icon"><ArrowLeft size={16} strokeWidth={2} /></span>
                        {t(lang, 'nav.backToDashboard')}
                    </Link>
                </nav>

                <div className="bo-sidebar-footer">
                    <button
                        className="btn btn-ghost w-full"
                        onClick={handleLogout}
                        style={{ justifyContent: 'flex-start' }}
                    >
                        <LogOut size={16} strokeWidth={2} /> {t(lang, 'nav.logout')}
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="bo-main">
                <header className="bo-header">
                    <span className="bo-header-title">
                        Backoffice — {NAV_ITEMS.find((i) => pathname.startsWith(i.href))?.labelKey ? t(lang, NAV_ITEMS.find((i) => pathname.startsWith(i.href))!.labelKey) : t(lang, 'backoffice.admin')}
                    </span>
                </header>
                <div className="bo-content">{children}</div>
            </main>
        </div>
    );
}
