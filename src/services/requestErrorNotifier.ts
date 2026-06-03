/**
 * Transient request-error toast bus.
 *
 * A tiny non-React pub/sub so the axios interceptor (`services/api.ts`) and
 * the v3 socket user-action call sites can surface a one-off "that request
 * failed" toast without each call site owning snackbar state.
 *
 * Distinct from the *persistent* connection banners in
 * `ConnectionStatusSnackbar` (driven by `registerApiHealthListener` and the
 * WS-connected poll): those mean "the server / socket is unreachable" and
 * stay up for the duration of the outage. This bus is for a single failed
 * request while the app is otherwise online — a Django 5xx/4xx response, or
 * a rejected v3 socket emit.
 *
 * The host (`RequestErrorSnackbar`) subscribes and maps each kind to a
 * localized `t.app.snackbar.*` string, so this module stays free of React
 * and i18n.
 */

export type RequestErrorKind =
    | "serverError" // API 5xx
    | "permissionDenied" // API 403
    | "requestFailed" // API other 4xx
    | "actionFailed"; // v3 socket user-action emit failed (reaction / edit)

type RequestErrorListener = (kind: RequestErrorKind) => void;

const listeners = new Set<RequestErrorListener>();

// Collapse a burst of identical failures — e.g. a boot that fires five
// requests which all 500 — into one toast per kind. Without this the host
// would surface five identical messages back-to-back.
const DEDUP_WINDOW_MS = 4000;
const lastEmittedAt = new Map<RequestErrorKind, number>();

export const subscribeRequestErrors = (listener: RequestErrorListener): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const emitRequestError = (kind: RequestErrorKind): void => {
    const now = Date.now();
    const last = lastEmittedAt.get(kind);
    if (last !== undefined && now - last < DEDUP_WINDOW_MS) return;
    lastEmittedAt.set(kind, now);
    for (const listener of listeners) {
        try {
            listener(kind);
        } catch {
            /* a listener threw — non-fatal; keep notifying the rest */
        }
    }
};

/**
 * Surface a failed v3 socket *user action* (reaction / edit) as a toast.
 *
 * Connection loss is already shown by the persistent "WS lost" banner, so a
 * `DISCONNECTED` ChannelServiceError is skipped to avoid double-notifying;
 * server rejections (ack `ok:false`) and ack timeouts surface as
 * `actionFailed`. Duck-typed on `.code` so this module doesn't import the
 * channel layer.
 */
export const notifyActionError = (err: unknown): void => {
    if ((err as { code?: string } | null)?.code === "DISCONNECTED") return;
    emitRequestError("actionFailed");
};
