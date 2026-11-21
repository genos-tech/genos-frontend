import { ReactNode } from "react";

import { AnalyticsConsentPrompt } from "../../components/layout/AnalyticsConsentPrompt";

// The provider no longer holds state: it mounts the first-load prompt next to the app.
// The hook and its state live in analyticsPreferenceState.ts (MIP-1781).

export const AnalyticsPreferencesProvider = ({ children }: { children: ReactNode }) => (
    <>
        {children}
        <AnalyticsConsentPrompt />
    </>
);
