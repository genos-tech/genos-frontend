import { useSyncExternalStore } from "react";

import { analytics } from "./analytics";
import { writeConsent } from "./consentStorage";
import {
    consentNeeded,
    marketingAnalyticsAllowed,
    readConsent,
    type ConsentChoice,
} from "./marketingConsentState";
import { clearFirstTouchUtm, rememberFirstTouchUtm } from "./marketingFunnel";

export { consentNeeded, marketingAnalyticsAllowed, readConsent };
export type { ConsentChoice };

/** The consent banner's controller: record the choice, apply it, tell the page (MIP-1778). */
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((listener) => listener());

/**
 * Records the choice and applies it at once: "accepted" starts analytics on this page, "rejected"
 * turns it off and deletes what the library stored (and the campaign values kept for the session).
 *
 * `where` is the surface the choice was made on. A marketing page (default) starts the library
 * with the stricter marketing options and counts first-touch campaign values; the app (MIP-1781:
 * the first-load prompt and the Settings switch) starts the app's own configuration. Either way
 * it is the same stored record, so a choice made on one surface holds on the other.
 */
export const chooseConsent = (
    choice: ConsentChoice,
    where: "marketing" | "app" = "marketing"
): void => {
    writeConsent(choice);
    analytics.persistEnabled(choice === "accepted");
    if (choice === "accepted") {
        if (where === "marketing") {
            rememberFirstTouchUtm();
            analytics.startWithConsent();
        } else {
            analytics.init();
        }
    } else {
        clearFirstTouchUtm();
        analytics.forgetStoredIdentifiers();
    }
    notify();
};

/** A change from this page (the stored preference written elsewhere is read on mount). */
const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/**
 * The choice, live, for the banner and the footer. `state` is what is in force: "accepted" /
 * "rejected" as chosen, or "none" before a choice; `allowed` is whether analytics may run now.
 */
export const useMarketingConsent = (): {
    state: ConsentChoice | "none";
    allowed: boolean;
    needed: boolean;
    /** Accepted and not switched off in Settings, whether or not a key was built in (the switch). */
    enabled: boolean;
} => {
    const snapshot = useSyncExternalStore(
        subscribe,
        () => `${readConsent() ?? "none"}|${analytics.readStoredEnabled()}`
    );
    const [choice, stored] = snapshot.split("|");
    return {
        state: choice as ConsentChoice | "none",
        allowed: marketingAnalyticsAllowed(),
        needed: consentNeeded(),
        enabled: choice === "accepted" && stored === "true",
    };
};

/** The same live choice, under the name the app uses (MIP-1781). */
export const useAnalyticsConsent = useMarketingConsent;
