'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Legacy /leads route — redirects to /sales?tab=leads
 */
export default function LeadsRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'leads');
        router.replace(`/sales?${params.toString()}`);
    }, [router, searchParams]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--color-text-tertiary)' }}>
            Redirecting to Sales Assistant…
        </div>
    );
}
