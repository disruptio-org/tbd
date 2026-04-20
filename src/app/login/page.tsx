'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Mail, Lock } from 'lucide-react';
import { t, DEFAULT_LOCALE } from '@/i18n';
import './login.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const lang = DEFAULT_LOCALE;

    const supabase = createClient();

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(t(lang, 'login.invalidCredentials'));
            setLoading(false);
            return;
        }

        window.location.href = '/';
    }

    async function handleGoogleLogin() {
        setError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/api/auth/callback` },
        });
        if (error) setError(t(lang, 'login.errorOccurred'));
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                {/* ── Top Bar ── */}
                <div className="auth-topbar">
                    <span className="auth-topbar-brand">NOUSIO</span>
                    <span className="auth-topbar-label">Login / Register</span>
                </div>

                {/* ── Main Content ── */}
                <div className="auth-body">
                    {/* Left: Hero Typography */}
                    <div className="auth-hero">
                        <h1 className="auth-hero-title">
                            LOG IN TO<br />NOUSIO
                        </h1>
                        <p className="auth-hero-sub">
                            ACCESS YOUR<br />INTELLIGENT<br />WORKSPACE
                        </p>
                    </div>

                    {/* Right: Form */}
                    <div className="auth-form-col">
                        {error && <div className="auth-error">{error}</div>}

                        <form onSubmit={handleLogin} className="auth-form">
                            <div className="auth-field">
                                <div className="auth-field-icon"><Mail size={18} strokeWidth={2} /></div>
                                <div className="auth-field-content">
                                    <label htmlFor="login-email" className="auth-field-label">EMAIL ADDRESS</label>
                                    <input
                                        id="login-email"
                                        className="auth-input"
                                        type="email"
                                        placeholder={t(lang, 'login.emailPlaceholder')}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="auth-field">
                                <div className="auth-field-icon"><Lock size={18} strokeWidth={2} /></div>
                                <div className="auth-field-content">
                                    <label htmlFor="login-password" className="auth-field-label">PASSWORD</label>
                                    <input
                                        id="login-password"
                                        className="auth-input"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                className="auth-submit"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? t(lang, 'login.signingIn') : 'SIGN IN'}
                            </button>
                        </form>

                        <div className="auth-divider">
                            <span>OR</span>
                        </div>

                        <button className="google-btn" onClick={handleGoogleLogin} type="button">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Sign In with Google
                        </button>

                        <div className="auth-footer">
                            {t(lang, 'login.noAccount')}{' '}
                            <Link href="/signup"><strong>Sign Up</strong></Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
