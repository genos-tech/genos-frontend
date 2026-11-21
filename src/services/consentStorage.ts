/**
 * The stored analytics consent choice, in a module with no imports so `analytics.ts` (which
 * must not start the library without it) and `marketingConsentState.ts` (which imports
 * `analytics`) can both read it. One record for the whole product (MIP-1778 marketing pages,
 * MIP-1781 the app): `{ "choice": "accepted" | "rejected", "v": 1 }`, no identifier and no date.
 */

export const CONSENT_KEY = "genos-marketing-consent:v1";

export type ConsentChoice = "accepted" | "rejected";

/** The stored choice, or null when none was made (or storage is blocked). */
export const readConsent = (): ConsentChoice | null => {
    try {
        const raw = window.localStorage.getItem(CONSENT_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const { choice, v } = parsed as { choice?: unknown; v?: unknown };
            if (v === 1 && (choice === "accepted" || choice === "rejected")) return choice;
        }
    } catch {
        // Unreadable or blocked: treated as no choice, which loads nothing.
    }
    return null;
};

/** Records the choice. Blocked storage: it holds for this page only, and nothing loads next time. */
export const writeConsent = (choice: ConsentChoice): void => {
    try {
        window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, v: 1 }));
    } catch {
        // Private mode / blocked storage.
    }
};
