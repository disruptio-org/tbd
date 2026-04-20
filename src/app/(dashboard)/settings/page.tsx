'use client';

import { useRouter } from 'next/navigation';
import {
    Brain, Plug, Users, Shield, User, ChevronRight,
} from 'lucide-react';
import './settings.css';

interface SettingsCard {
    title: string;
    description: string;
    icon: React.ReactNode;
    href: string;
    accent: string;
}

const SETTINGS_CARDS: SettingsCard[] = [
    {
        title: 'Integrations',
        description: 'Connect external services, webhooks, and OAuth applications.',
        icon: <Plug size={22} />,
        href: '/settings/integrations',
        accent: '#06b6d4',
    },
    {
        title: 'User Management',
        description: 'Invite team members, assign roles, and manage accounts.',
        icon: <Users size={22} />,
        href: '/settings/users',
        accent: '#f59e0b',
    },
    {
        title: 'Access Groups',
        description: 'Control feature access and permissions per user group.',
        icon: <Shield size={22} />,
        href: '/settings/access-groups',
        accent: '#ef4444',
    },
];

export default function SettingsHubPage() {
    const router = useRouter();

    return (
        <div className="settings-hub">
            <div className="settings-hub-intro">
                <p className="settings-hub-subtitle">
                    Configure your workspace, team, and personal preferences.
                </p>
            </div>

            <div className="settings-hub-grid">
                {SETTINGS_CARDS.map((card) => (
                    <button
                        key={card.href}
                        className="settings-hub-card"
                        onClick={() => router.push(card.href)}
                    >
                        <div className="settings-hub-card-icon" style={{ color: card.accent }}>
                            {card.icon}
                        </div>
                        <div className="settings-hub-card-body">
                            <h3>{card.title}</h3>
                            <p>{card.description}</p>
                        </div>
                        <ChevronRight size={16} className="settings-hub-card-arrow" />
                    </button>
                ))}
            </div>
        </div>
    );
}
