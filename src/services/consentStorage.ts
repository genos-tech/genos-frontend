/**
 * The stored analytics consent choice, in a module with no imports so `analytics.ts` (which
 * must not start the library without it) and `marketingConsentState.ts` (which imports
 * `analytics`) can both read it. One record for the whole product (MIP-1778 marketing pages,
 * MIP-1781 the app): `{ "choice": "accepted" | "rejected", "v": 1 }`, no identifier and no date.
 */

export const CONSENT_KEY = "genos-marketing-consent:v1";

export type ConsentChoice = "accepted" | "rejected";

// The choice of this page load, kept only while the browser would not store it (private mode,
// full or blocked storage): "Accept" must still do what it says on this page, and the choice is
// asked again at the next load. Never set while storage works, so it cannot outlive a stored one.
let unstored: ConsentChoice | null = null;

/** The stored choice, or null when none was made (or storage is blocked and nothing was chosen here). */
export const readConsent = (): ConsentChoice | null => {
    try {
        const raw = window.localStorage.getItem(CONSENT_KEY);
        if (!raw) return unstored;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const { choice, v } = parsed as { choice?: unknown; v?: unknown };
            if (v === 1 && (choice === "accepted" || choice === "rejected")) return choice;
        }
    } catch {
        // Unreadable or blocked: no stored choice, so nothing loads unless it was chosen on this page.
    }
    return unstored;
};

/** Records the choice. Blocked storage: it holds for this page only, and is asked again next load. */
export const writeConsent = (choice: ConsentChoice): void => {
    try {
        window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, v: 1 }));
        unstored = null;
    } catch {
        unstored = choice;
    }
};
