'use client';

import { UIFeedbackProvider } from '@/components/UIFeedback';

export function Providers({ children }: { children: React.ReactNode }) {
    return <UIFeedbackProvider>{children}</UIFeedbackProvider>;
}
