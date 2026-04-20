'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import './setup.css';

export default function SetupLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const supabase = createClient();
    const [ready, setReady] = useState(false);

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

                if (data.mustChangePassword) {
                    router.replace('/first-login');
                    return;
                }
                if (data.onboardingStatus === 'COMPLETED') {
                    router.replace('/dashboard');
                    return;
                }
            } catch {
                // Stay on setup
            }
            setReady(true);
        }
        check();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!ready) {
        return (
            <div className="setup-loading">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="setup-layout">
            <header className="setup-header">
                <img src="/logos/logo_white.png" alt="Nousio" className="setup-logo" />
            </header>
            <main className="setup-main">{children}</main>
        </div>
    );
}
