/**
 * The "self-echo" — a `userStatus` presence broadcast that carries the
 * CURRENT user's own userId.
 *
 * Every device beats its `myself` on the heartbeat; the sockets server
 * rebroadcasts each beat `to=team_id`, and a user's other open sessions are in
 * that same room — so each device receives its own beat back. That echo is the
 * only live signal a second device gets that the user changed their presence
 * (appear-offline), custom status, or notification pause on ANOTHER device.
 *
 * `handleWsMessage` dispatches this window event whenever a `userStatus` names
 * the current user; `useSelfEchoReconcile` listens and, on a real divergence,
 * re-fetches the AUTHORITATIVE server value and adopts it. The echo is only a
 * "something changed elsewhere" trigger — never a value to copy blindly (the
 * echoed string can be a stale beat from a device that hasn't caught up yet;
 * only the server is authoritative, so we read it rather than trust the wire).
 */

export const SELF_ECHO_EVENT = "presence:self-echo";

/** The subset of the echoed `user` payload the reconciler compares against.
 *  Shapes match `UserProps` exactly (this is a slice of the beat's `user`):
 *  `isOfflineForced` rides the wire as the string "true"/"false", since that
 *  is how the heartbeat reads it from localStorage. */
export interface SelfEchoDetail {
    userId: string;
    isOfflineForced?: string;
    customStatus?: string;
    isNotificationsPaused?: boolean;
}

/** Dispatch a self-echo on `window`. No-op outside a browser (SSR / tests). */
export const dispatchSelfEcho = (detail: SelfEchoDetail): void => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<SelfEchoDetail>(SELF_ECHO_EVENT, { detail }));
};
