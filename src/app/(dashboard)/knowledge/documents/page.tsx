'use client';

import DocumentsPage from '@/app/(dashboard)/documents/page';

/**
 * /knowledge/documents
 * 
 * Renders the full documents management view (upload, browse, filter)
 * inside the Knowledge section, keeping the sidebar highlight on Knowledge.
 */
export default function KnowledgeDocumentsPage() {
    return <DocumentsPage />;
}
