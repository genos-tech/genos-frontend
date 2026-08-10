/**
 * A local presence/status edit (appear-offline toggle, custom-status change)
 * updates `myself` + localStorage synchronously, but the value only reaches
 * other users — and the user's own other devices — on the next presence
 * heartbeat, up to 60s later.
 *
 * Dispatching this event lets the edit site ask `useWebSocket` for an immediate
 * beat, so the change propagates in <1s instead of ≤60s. It mirrors the
 * `PAUSE_CHANGED_EVENT` wiring for notification pause (see snoozeMirror.ts). The
 * beat reads the just-written localStorage values, so firing this AFTER the
 * localStorage writes is what carries the fresh state.
 */

export const PRESENCE_CHANGED_EVENT = "presence:changed";

/** Ask the heartbeat to beat now. No-op outside a browser (SSR / tests). */
export const announcePresenceChange = (): void => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(PRESENCE_CHANGED_EVENT));
};
