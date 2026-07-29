const DEVICE_ID_KEY = "genos.deviceId";

/**
 * Stable per-browser id, used to tie a push subscription to the presence
 * heartbeat of the same device.
 *
 * The server suppresses push only for devices reporting a visible tab, so
 * this is what lets "I'm reading on my laptop" silence the laptop without
 * silencing the phone. Persisted in localStorage: it must survive reloads
 * (a per-session id would make every reload look like a new device and
 * leave orphaned subscriptions that never get suppressed).
 *
 * Not an identifier of the *user* — it's per browser profile, carries no
 * personal data, and is cleared whenever site data is.
 */
export const getDeviceId = (): string => {
    if (typeof localStorage === "undefined") return "";
    try {
        const existing = localStorage.getItem(DEVICE_ID_KEY);
        if (existing) return existing;
        const generated =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(DEVICE_ID_KEY, generated);
        return generated;
    } catch {
        // Private mode / storage disabled: fall back to no id, which the
        // server treats as a legacy device (any-visible-tab suppression).
        return "";
    }
};
