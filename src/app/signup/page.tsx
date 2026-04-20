'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { t, DEFAULT_LOCALE } from '@/i18n';
import { Mail } from 'lucide-react';
import '../login/login.css';

export default function SignupPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const lang = DEFAULT_LOCALE;

    const supabase = createClient();

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
        });

        if (error) {
            setError(t(lang, 'signup.signupFailed'));
            setLoading(false);
            return;
        }

        setSuccess(true);
        setLoading(false);
    }

    async function handleGoogleSignup() {
        setError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/api/auth/callback` },
        });
        if (error) setError(error.message);
    }

    if (success) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-brand">
                        <img src="/logos/logo_black.png" alt="NOUSIO" className="auth-logo" />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h3><Mail size={18} strokeWidth={2} /> Check your email</h3>
                        <p className="text-secondary" style={{ marginTop: 'var(--space-sm)' }}>
                            We sent a confirmation link to <strong>{email}</strong>.
                        </p>
                    </div>
                    <div className="auth-footer">
                        <Link href="/login">{t(lang, 'login.signIn')}</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-brand">
                    <img src="/logos/logo_black.png" alt="NOUSIO" className="auth-logo" />
                    <p>{t(lang, 'signup.title')}</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <button className="google-btn" onClick={handleGoogleSignup} type="button">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t(lang, 'signup.signUpWithGoogle')}
                </button>

                <div className="auth-divider">{t(lang, 'common.or')}</div>

                <form onSubmit={handleSignup}>
                    <div className="form-group">
                        <label className="label" htmlFor="signup-name">
                            {t(lang, 'signup.nameLabel')}
                        </label>
                        <input
                            id="signup-name"
                            className="input"
                            type="text"
                            placeholder={t(lang, 'signup.namePlaceholder')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label" htmlFor="signup-email">
                            {t(lang, 'signup.emailLabel')}
                        </label>
                        <input
                            id="signup-email"
                            className="input"
                            type="email"
                            placeholder={t(lang, 'signup.emailPlaceholder')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label" htmlFor="signup-password">
                            {t(lang, 'signup.passwordLabel')}
                        </label>
                        <input
                            id="signup-password"
                            className="input"
                            type="password"
                            placeholder={t(lang, 'signup.passwordPlaceholder')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={6}
                            required
                        />
                    </div>

                    <button
                        className="btn btn-primary w-full"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? t(lang, 'signup.signingUp') : t(lang, 'signup.signUp')}
                    </button>
                </form>

                <div className="auth-footer">
                    {t(lang, 'signup.hasAccount')}{' '}
                    <Link href="/login">{t(lang, 'signup.signIn')}</Link>
                </div>
            </div>
        </div>
    );
}
