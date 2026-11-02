import type { HocuspocusProvider } from "@hocuspocus/provider";

/**
 * Why the collab server refused a document it could not check (MIP-921).
 *
 * On open, genos-collab asks the api whether this user may have the
 * document. While the api swaps deployments that question gets a 502; collab
 * asks again for a few seconds and then refuses with this reason, where any
 * other refusal arrives as Hocuspocus' own `permission-denied`. The literal
 * is genos-collab's (`ACCESS_CHECK_UNAVAILABLE` in `access.js`): change them
 * together. An older collab never sends it, and then nothing here runs.
 */
export const ACCESS_CHECK_UNAVAILABLE = "access-check-unavailable";

/**
 * How long to wait before each reconnect after a refusal for that reason,
 * one entry per attempt. The wait before the first is 1 s, and it doubles;
 * after the last the editor stays in the state a refusal always left it in.
 * With collab's own 3 s of asking per attempt, this covers about 45 s.
 */
export const RECONNECT_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 16000];

export type CollabReconnect = {
    /**
     * True from a refusal that is being retried until the connection is up
     * again or the retries run out. The editor must not seed its offline copy
     * while this holds: see `useCollaborativeBlockNote`.
     */
    readonly pending: boolean;
    /**
     * The provider reported `authenticationFailed`. Schedules a reconnect
     * when the reason is `ACCESS_CHECK_UNAVAILABLE` and attempts are left;
     * otherwise the refusal is final and `pending` is false afterwards.
     */
    refused(reason: string): void;
    /** Authenticated or synced: forget the attempts made so far. */
    settle(): void;
    /** The provider is going away (unmount, another document): no more attempts. */
    cancel(): void;
};

/**
 * Reconnects `provider` after a refusal with `ACCESS_CHECK_UNAVAILABLE`.
 *
 * `provider.connect()` alone does not do it. On a refusal the provider
 * detaches itself but leaves its websocket open, and Hocuspocus ignores a
 * second authentication for the same document on a socket it already
 * refused one on: `connect()` re-sends it, nothing answers, and after the
 * server's idle timeout (30 s) the socket closes with 4401, which the
 * provider takes as final and never retries. So the refused socket is
 * closed straight away (before that timeout can fire in the middle of a
 * wait) and `connect()` opens a new one when the wait is over.
 */
export function createCollabReconnect(
    // A function because the provider's own callbacks need this object, so
    // it is made first.
    getProvider: () => Pick<HocuspocusProvider, "connect" | "configuration">,
    delaysMs: readonly number[] = RECONNECT_DELAYS_MS
): CollabReconnect {
    let attempts = 0;
    let pending = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearTimer = () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
    };

    return {
        get pending() {
            return pending;
        },
        refused(reason) {
            clearTimer();
            if (reason !== ACCESS_CHECK_UNAVAILABLE || cancelled) {
                pending = false;
                return;
            }
            const exhausted = attempts >= delaysMs.length;
            // Before the socket closes, so its close event already finds the
            // wait in place.
            pending = !exhausted;
            getProvider().configuration.websocketProvider.disconnect();
            if (exhausted) return;
            const delay = delaysMs[attempts++];
            timer = setTimeout(() => {
                timer = undefined;
                if (cancelled) return;
                getProvider()
                    .connect()
                    .catch(() => {
                        // A failed attempt surfaces as another refusal or a
                        // close event; there is nobody to tell here.
                    });
            }, delay);
        },
        settle() {
            clearTimer();
            pending = false;
            attempts = 0;
        },
        cancel() {
            cancelled = true;
            clearTimer();
            pending = false;
        },
    };
}
