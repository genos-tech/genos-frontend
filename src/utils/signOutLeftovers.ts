/**
 * Browser storage that outlives a sign-out unless it is cleared (MIP-2255).
 *
 * Shared by the normal sign-out (`useSignOut`) and the forced one
 * (`AuthContext.forceSignOut`) so the two cannot drift: a shared or stolen
 * laptop must not show the last person's AI questions.
 *
 * `signInEmail` is NOT here: it is only ever written when the person ticked
 * "remember my email" on the sign-in form, so keeping it is their opt-in.
 */
import { DatabaseUtils } from "../db/utils/database";
import {
    stopKeepingUnsavedBodies,
    UNSAVED_TASK_BODY_PREFIX,
} from "../features/tasks/services/unsavedTaskBody";

// Exact keys: the chat thread memory (which thread the person had open), and
// the per-browser device id that ties a push subscription to this device.
const EXACT_KEYS = ["chatThreadMemory", "genos.deviceId"];

// Prefixes: per-team history buckets, and the Spotlight conversation
// ("spotlight:session:v1:<teamId>", up to 10 AI turns per team).
const KEY_PREFIXES = ["genos.history.v1.", "spotlight:session:v1:", UNSAVED_TASK_BODY_PREFIX];

export const clearSignOutLocalStorage = (): void => {
    stopKeepingUnsavedBodies();
    try {
        const doomed: string[] = [...EXACT_KEYS];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && KEY_PREFIXES.some((p) => k.startsWith(p))) doomed.push(k);
        }
        doomed.forEach((k) => localStorage.removeItem(k));
    } catch {
        // Storage may be unavailable in some embedded contexts.
    }
};

/**
 * Local storage plus the IndexedDB cache (team stores and every per-document
 * Yjs database). Never throws: a wipe that cannot finish must not keep
 * someone signed in on a screen that says they are not.
 */
export const clearSignOutLeftovers = async (): Promise<void> => {
    clearSignOutLocalStorage();
    try {
        await DatabaseUtils.wipeLocalCache();
    } catch (error) {
        console.error("Could not clear the local cache on sign-out:", error);
    }
};
