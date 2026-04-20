'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirect standalone document view to search page.
 * The document viewer now opens as a modal from the search results.
 */
export default function DocumentRedirectPage() {
    const params = useParams();
    const router = useRouter();
    const documentId = params.id;

    useEffect(() => {
        // Redirect to search — the document viewer is now a modal
        router.replace(`/search?doc=${documentId}`);
    }, [documentId, router]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" />
        </div>
    );
}
