'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Redirect /team/[memberId] → /ai-team/[memberId]
 * This bridges V2 Team navigation to the existing AI member workspace
 * until it is fully migrated into /team/[memberId] directly.
 */
export default function TeamMemberRedirect() {
    const params = useParams();
    const router = useRouter();
    const memberId = params.memberId as string;

    useEffect(() => {
        router.replace(`/ai-team/${memberId}`);
    }, [memberId, router]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
        }}>
            <div className="spinner" />
        </div>
    );
}
