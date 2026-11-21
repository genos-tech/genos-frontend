import { ReactNode } from "react";

import { AnalyticsConsentPrompt } from "../../components/layout/AnalyticsConsentPrompt";
import { chooseConsent, useAnalyticsConsent } from "../../services/marketingConsent";

/**
 * The "Share usage data" switch in Settings > Privacy (MIP-1781).
 *
 * It shows the REAL state: on only after "Accept" (here or on a marketing page) and while
 * analytics has not been switched off since. Before 2026-11 it defaulted to on and the
 * provider wrote `{ enabled: true }` for every signed-in user on mount; that default is gone,
 * because writing a value there would look like a decision nobody made. The state is the
 * stored consent choice (`services/consentStorage`, shared with the marketing banner) plus
 * the preference key `genos-analytics-preferences:v1`, which only an explicit choice writes.
 *
 * Turning the switch on is "Accept", turning it off is "Reject": both go through
 * `chooseConsent(choice, "app")`, so the library starts or stops at once and what it stored
 * in this browser is deleted on "off".
 *
 * The provider no longer holds state: it mounts the first-load prompt next to the app.
 */

export interface AnalyticsPreferences {
    enabled: boolean;
}

interface AnalyticsPreferencesValue extends AnalyticsPreferences {
    setEnabled: (v: boolean) => void;
}

const setEnabled = (v: boolean): void => chooseConsent(v ? "accepted" : "rejected", "app");

export const AnalyticsPreferencesProvider = ({ children }: { children: ReactNode }) => (
    <>
        {children}
        <AnalyticsConsentPrompt />
    </>
);

export const useAnalyticsPreferences = (): AnalyticsPreferencesValue => {
    const { enabled } = useAnalyticsConsent();
    return { enabled, setEnabled };
};
