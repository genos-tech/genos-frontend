import { useEffect, useRef } from "react";

import { getMyProfile } from "../../features/admin/services/getMyProfile";
import { getNotificationPreferences } from "../../services/notifications/notificationApi";
import { NotificationManager } from "../../services/notifications/notificationManager";
import { UserProps } from "../../types/admin";
import { SELF_ECHO_EVENT, SelfEchoDetail } from "./selfEchoEvent";

/** How long to wait after a self-echo before re-fetching authority. Absorbs
 *  the read-after-write race: the beat that triggered the echo can outrun the
 *  originating device's own PUT reaching the server, so a GET fired instantly
 *  might read the OLD value. A short debounce lets the write land first, and
 *  coalesces a burst of beats into one fetch. */
const RECONCILE_DEBOUNCE_MS = 800;

/**
 * Keeps THIS device's own presence-ish state (`isOfflineForced`, `customStatus`)
 * and notification pause in sync when the user changes them on ANOTHER device.
 *
 * The trigger is the "self-echo" (see `selfEchoEvent.ts`): a `userStatus`
 * broadcast naming the current user, which arrives whenever any of the user's
 * devices beats. On a real divergence between the echoed value and what this
 * device currently holds, we re-fetch the AUTHORITATIVE server value and adopt
 * it — we never copy the echoed value directly.
 *
 * Why re-fetch instead of adopting the echo? The local presence editors
 * (`persistPresence` / `persistCustomStatus`) update `myself` + localStorage but
 * NOT the team-members store, and a beat can carry a stale value from a device
 * that hasn't caught up. Blindly adopting would let an old beat clobber a fresh
 * local edit and ping-pong between devices (last-writer-wins, no tiebreak). The
 * server is the single source of truth, so a divergence just means "ask the
 * server" — which is self-healing and converges in a beat or two. This is the
 * same discipline as the pause hydrate; contrast `useReconcileMyselfAvatar`,
 * which CAN adopt directly because avatar uploads write store + `myself` atomically.
 */
export const useSelfEchoReconcile = (
    myself: UserProps,
    setMyself: (me: UserProps) => void,
    accessToken: string | null,
    manager: NotificationManager
): void => {
    // Read live values off refs so the window listener stays mounted for the
    // socket's lifetime without re-subscribing on every `myself` change.
    const myselfRef = useRef(myself);
    myselfRef.current = myself;
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const onSelfEcho = (e: Event) => {
            const detail = (e as CustomEvent<SelfEchoDetail>).detail;
            const me = myselfRef.current;
            if (!detail || !me.userId || detail.userId !== me.userId) return;

            // Compare the echo to what this device holds. `isOfflineForced` is a
            // string ("true"/"false") on both sides; treat missing as "false".
            const localForced = me.isOfflineForced === "true";
            const echoForced = detail.isOfflineForced === "true";
            const localStatus = me.customStatus ?? "";
            const echoStatus = detail.customStatus ?? "";
            // Normalise expiry to "" so null/absent/"" all compare equal — only
            // a real ISO-vs-ISO (or set-vs-cleared) difference counts as drift.
            const localExpiry = me.customStatusExpiry ?? "";
            const echoExpiry = detail.customStatusExpiry ?? "";
            const localPaused = manager.getIsSnoozedNow();
            const echoPaused = detail.isNotificationsPaused === true;

            const presenceDiverged =
                echoForced !== localForced ||
                echoStatus !== localStatus ||
                echoExpiry !== localExpiry;
            const pauseDiverged = echoPaused !== localPaused;
            if (!presenceDiverged && !pauseDiverged) return;

            // Debounce: coalesce a burst and let the originating PUT land first.
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                const token = tokenRef.current;
                if (!token) return;

                if (presenceDiverged) {
                    void (async () => {
                        const profile = await getMyProfile(token);
                        if (!profile) return;
                        const cur = myselfRef.current;
                        // Only write if the server value actually differs from
                        // what we now hold — avoids a needless render and a
                        // redundant heartbeat, and defends against a fetch that
                        // resolved after the user re-edited locally.
                        const nextForced = profile.isOfflineForced ? "true" : "false";
                        const nextStatus = profile.customStatus ?? "";
                        const nextExpiry = profile.customStatusExpiry ?? null;
                        const forcedChanged = (cur.isOfflineForced ?? "false") !== nextForced;
                        const statusChanged = (cur.customStatus ?? "") !== nextStatus;
                        const expiryChanged = (cur.customStatusExpiry ?? null) !== nextExpiry;
                        if (!forcedChanged && !statusChanged && !expiryChanged) return;
                        localStorage.setItem("isOfflineForced", nextForced);
                        localStorage.setItem("customStatus", nextStatus);
                        // Mirror the expiry key the heartbeat reads. Empty string
                        // means "no expiry" — `sendHeartBeat` treats "" as absent.
                        localStorage.setItem("customStatusExpiry", nextExpiry ?? "");
                        setMyself({
                            ...cur,
                            isOfflineForced: nextForced,
                            customStatus: nextStatus,
                            customStatusExpiry: nextExpiry,
                        });
                    })();
                }

                if (pauseDiverged) {
                    void (async () => {
                        const prefs = await getNotificationPreferences(token);
                        // hydratePreferences cascades to the pause hook (badge +
                        // gate), the localStorage mirror, and the next beat — so
                        // the whole chain converges from this one call.
                        manager.hydratePreferences(prefs);
                    })();
                }
            }, RECONCILE_DEBOUNCE_MS);
        };

        window.addEventListener(SELF_ECHO_EVENT, onSelfEcho);
        return () => {
            window.removeEventListener(SELF_ECHO_EVENT, onSelfEcho);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [manager, setMyself]);
};
