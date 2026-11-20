import { useSyncExternalStore } from "react";

import { analytics } from "./analytics";
import {
    CONSENT_KEY,
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
 * Records the visitor's choice and applies it at once: "accepted" starts analytics on this
 * page, "rejected" turns it off and deletes what the library stored (and the campaign values
 * kept for the session).
 */
export const chooseConsent = (choice: ConsentChoice): void => {
    try {
        window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, v: 1 }));
    } catch {
        // Blocked storage: the choice holds for this page only, and nothing loads next time.
    }
    analytics.persistEnabled(choice === "accepted");
    if (choice === "accepted") {
        rememberFirstTouchUtm();
        analytics.startWithConsent();
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
} => {
    const snapshot = useSyncExternalStore(
        subscribe,
        () => `${readConsent() ?? "none"}|${analytics.readStoredEnabled()}`
    );
    const [choice] = snapshot.split("|");
    return {
        state: choice as ConsentChoice | "none",
        allowed: marketingAnalyticsAllowed(),
        needed: consentNeeded(),
    };
};
