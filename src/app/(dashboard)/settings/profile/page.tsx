'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIFeedback } from '@/components/UIFeedback';
import { useT } from '@/i18n/context';
import type { Locale } from '@/i18n';
import { User, Settings, Lock, Globe, Clock } from 'lucide-react';
import '../settings.css';

// ─── Timezone options ──────────────────────────────────
const TIMEZONE_OPTIONS = [
    { value: 'Europe/Lisbon', label: '🇵🇹 Lisbon (WET)' },
    { value: 'America/Sao_Paulo', label: '🇧🇷 São Paulo (BRT)' },
    { value: 'Atlantic/Azores', label: '🇵🇹 Azores (AZOT)' },
    { value: 'Europe/London', label: '🇬🇧 London (GMT)' },
    { value: 'Europe/Madrid', label: '🇪🇸 Madrid (CET)' },
    { value: 'Europe/Paris', label: '🇫🇷 Paris (CET)' },
    { value: 'Europe/Berlin', label: '🇩🇪 Berlin (CET)' },
    { value: 'America/New_York', label: '🇺🇸 New York (EST)' },
    { value: 'America/Chicago', label: '🇺🇸 Chicago (CST)' },
    { value: 'America/Los_Angeles', label: '🇺🇸 Los Angeles (PST)' },
    { value: 'Asia/Dubai', label: '🇦🇪 Dubai (GST)' },
    { value: 'Asia/Tokyo', label: '🇯🇵 Tokyo (JST)' },
];

// ─── Language options ──────────────────────────────────
const LANGUAGE_OPTIONS = [
    { value: 'en', label: '🇬🇧 English' },
    { value: 'pt-PT', label: '🇵🇹 Português' },
    { value: 'fr', label: '🇫🇷 Français' },
];

interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    timezone: string;
    language?: string;
    role: string;
    createdAt: string;
}

export default function SettingsPage() {
    const { showToast } = useUIFeedback();
    const { t, locale, setLocale } = useT();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [timezone, setTimezone] = useState('Europe/Lisbon');
    const [language, setLanguage] = useState('en');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    // ─── Load profile ─────────────────────────────────
    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        try {
            const res = await fetch('/api/user/profile');
            const data = await res.json();
            if (data.profile) {
                const p = data.profile as UserProfile;
                setProfile(p);
                setName(p.name || '');
                setTimezone(p.timezone || 'Europe/Lisbon');
                setLanguage(p.language || locale || 'en');
                setAvatarUrl(p.avatarUrl);
                setAvatarPreview(p.avatarUrl);
            }
        } catch {
            showToast(t('settings.loadError'), 'error');
        }
        setLoading(false);
    }

    // ─── Save profile ─────────────────────────────────
    async function handleSave() {
        if (!name.trim()) {
            showToast(t('settings.nameRequired'), 'error');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    timezone,
                    language,
                    avatarUrl,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setProfile(data.profile);
                // Update the app locale immediately
                if (['en', 'pt-PT', 'fr'].includes(language)) {
                    setLocale(language as Locale);
                }
                showToast(t('settings.savedSuccess'), 'success');
            } else {
                const err = await res.json();
                showToast(err.error || t('settings.saveFailed'), 'error');
            }
        } catch {
            showToast(t('settings.connectionError'), 'error');
        }
        setSaving(false);
    }

    // ─── Avatar file pick ─────────────────────────────
    function handleAvatarClick() {
        fileInputRef.current?.click();
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setAvatarPreview(reader.result as string);
            setAvatarUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    }

    function handleRemoveAvatar() {
        setAvatarUrl(null);
        setAvatarPreview(null);
    }

    // ─── Helpers ──────────────────────────────────────
    function getInitials(n: string) {
        return n
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    function formatDate(d: string) {
        return new Date(d).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'fr' ? 'fr-FR' : 'pt-PT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    function roleLabel(r: string) {
        const map: Record<string, string> = {
            MEMBER: t('settings.roleMember'),
            ADMIN: t('settings.roleAdmin'),
            SUPER_ADMIN: t('settings.roleSuperAdmin'),
        };
        return map[r] || r;
    }

    // ─── Loading state ────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                <div className="spinner" />
            </div>
        );
    }

    const displayName = profile?.name || name || 'Profile';

    return (
        <>
            {/* ── Fixed header: user name + save ── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    {avatarPreview ? (
                        <img src={avatarPreview} alt={displayName} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #0f172a' }} />
                    ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: 14, border: '2px solid #0f172a' }}>
                            {getInitials(displayName)}
                        </div>
                    )}
                    <h1>{displayName}</h1>
                </div>
                <div className="assistant-page-workspace">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? t('settings.saving') : t('settings.saveChanges')}
                    </button>
                </div>
            </div>

            <div className="settings-page">
                {/* ── Avatar section ── */}
                <div className="settings-avatar-section">
                    <div className="settings-avatar-wrapper">
                        {avatarPreview ? (
                            <img
                                src={avatarPreview}
                                alt="Avatar"
                                className="settings-avatar"
                            />
                        ) : (
                            <div className="settings-avatar-placeholder">
                                {getInitials(displayName)}
                            </div>
                        )}
                    </div>

                    <div className="settings-avatar-info">
                        <h3>{t('settings.profilePhoto')}</h3>
                        <p>{t('settings.photoFormats')}</p>
                        <div className="settings-avatar-actions">
                            <button
                                className="settings-avatar-btn"
                                onClick={handleAvatarClick}
                            >
                                {t('settings.changePhoto')}
                            </button>
                            {avatarPreview && (
                                <button
                                    className="settings-avatar-btn remove"
                                    onClick={handleRemoveAvatar}
                                >
                                    {t('settings.removePhoto')}
                                </button>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </div>
                </div>

                {/* ── Personal info card ── */}
                <div className="settings-card">
                    <div className="settings-card-title">
                        <span className="settings-card-title-icon"><User size={16} strokeWidth={2} /></span>
                        {t('settings.personalInfo')}
                    </div>

                    <div className="settings-fields">
                        <div className="settings-field">
                            <label htmlFor="settings-name">
                                {t('settings.fullName')} <span className="required">*</span>
                            </label>
                            <input
                                id="settings-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('settings.namePlaceholder')}
                            />
                        </div>

                        <div className="settings-field">
                            <label htmlFor="settings-email">{t('settings.email')}</label>
                            <input
                                id="settings-email"
                                type="email"
                                value={profile?.email || ''}
                                readOnly
                            />
                            <span className="field-hint">
                                {t('settings.emailHint')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Preferences card ── */}
                <div className="settings-card">
                    <div className="settings-card-title">
                        <span className="settings-card-title-icon"><Settings size={16} strokeWidth={2} /></span>
                        {t('settings.preferences')}
                    </div>

                    <div className="settings-fields">
                        <div className="settings-field">
                            <label htmlFor="settings-language">
                                <Globe size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                {t('settings.language')}
                            </label>
                            <select
                                id="settings-language"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                            >
                                {LANGUAGE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="settings-field">
                            <label htmlFor="settings-timezone">
                                <Clock size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                {t('settings.timezone')}
                            </label>
                            <select
                                id="settings-timezone"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                            >
                                {TIMEZONE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* ── Account info card ── */}
                <div className="settings-card">
                    <div className="settings-card-title">
                        <span className="settings-card-title-icon"><Lock size={16} strokeWidth={2} /></span>
                        {t('settings.account')}
                    </div>

                    <div className="settings-fields">
                        <div className="settings-field">
                            <label>{t('settings.role')}</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                                <span className="settings-account-badge">
                                    {roleLabel(profile?.role || 'MEMBER')}
                                </span>
                            </div>
                        </div>

                        <div className="settings-field">
                            <label>{t('settings.memberSince')}</label>
                            <p className="settings-member-since">
                                {profile?.createdAt ? formatDate(profile.createdAt) : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Footer actions ── */}
                <div className="settings-actions">
                    <span className="settings-save-hint">
                        {t('settings.saveHint')}
                    </span>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? t('settings.saving') : t('settings.saveChanges')}
                    </button>
                </div>
            </div>
        </>
    );
}
