'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { t, DEFAULT_LOCALE } from '@/i18n';
import { ShieldCheck } from 'lucide-react';
import './first-login.css';

export default function FirstLoginPage() {
    const router = useRouter();
    const supabase = createClient();
    const lang = DEFAULT_LOCALE;

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    // Check if user actually needs to change password
    useEffect(() => {
        async function check() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/login');
                return;
            }

            try {
                const res = await fetch('/api/user/onboarding-status');
                const data = await res.json();
                if (!data.mustChangePassword) {
                    if (data.onboardingStatus && data.onboardingStatus !== 'COMPLETED') {
                        router.replace('/setup');
                    } else {
                        router.replace('/dashboard');
                    }
                    return;
                }
                // Fetch language from company if available
            } catch {
                // If API fails, stay on page
            }
            setChecking(false);
        }
        check();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError(t(lang, 'firstLogin.minLength'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t(lang, 'firstLogin.mismatch'));
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/complete-first-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || t(lang, 'firstLogin.errorChanging'));
                setLoading(false);
                return;
            }

            router.replace('/setup');
        } catch {
            setError(t(lang, 'firstLogin.connectionError'));
            setLoading(false);
        }
    }

    if (checking) {
        return (
            <div className="first-login-page">
                <div className="first-login-card">
                    <div className="spinner" style={{ margin: '40px auto' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="first-login-page">
            <div className="first-login-card">
                <div className="first-login-brand">
                    <img src="/logos/logo_black.png" alt="Nousio" className="first-login-logo" />
                </div>

                <div className="first-login-header">
                    <div className="first-login-icon"><ShieldCheck size={32} strokeWidth={2} /></div>
                    <h1>{t(lang, 'firstLogin.welcome')}</h1>
                    <p>{t(lang, 'firstLogin.securityMessage')}</p>
                </div>

                {error && <div className="first-login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="label" htmlFor="new-password">
                            {t(lang, 'firstLogin.newPassword')}
                        </label>
                        <input
                            id="new-password"
                            className="input"
                            type="password"
                            placeholder={t(lang, 'firstLogin.newPasswordPlaceholder')}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="label" htmlFor="confirm-password">
                            {t(lang, 'firstLogin.confirmPassword')}
                        </label>
                        <input
                            id="confirm-password"
                            className="input"
                            type="password"
                            placeholder={t(lang, 'firstLogin.confirmPasswordPlaceholder')}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        className="btn btn-primary first-login-submit"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? t(lang, 'firstLogin.saving') : t(lang, 'firstLogin.submit')}
                    </button>
                </form>

                <div className="first-login-footer">
                    <p>{t(lang, 'firstLogin.footer')}</p>
                </div>
            </div>
        </div>
    );
}
