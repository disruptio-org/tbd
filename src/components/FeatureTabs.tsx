'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Search, Bot, Tags } from 'lucide-react';
import type { ReactNode } from 'react';

const ICON_PROPS = { size: 16, strokeWidth: 2 } as const;

const FEATURE_TABS: { href: string; icon: ReactNode; label: string }[] = [
    { href: '/documents', icon: <FileText {...ICON_PROPS} />, label: 'Documentos' },
    { href: '/search', icon: <Search {...ICON_PROPS} />, label: 'Pesquisa Inteligente' },
    { href: '/chat', icon: <Bot {...ICON_PROPS} />, label: 'Chat IA' },
    { href: '/classifications', icon: <Tags {...ICON_PROPS} />, label: 'Classificação' },
];

export default function FeatureTabs() {
    const pathname = usePathname();

    return (
        <div className="feature-tabs">
            {FEATURE_TABS.map((ft) => (
                <Link
                    key={ft.href}
                    href={ft.href}
                    className={`feature-tab ${pathname === ft.href ? 'active' : ''}`}
                >
                    <span className="feature-tab-icon">{ft.icon}</span>
                    {ft.label}
                </Link>
            ))}
        </div>
    );
}
