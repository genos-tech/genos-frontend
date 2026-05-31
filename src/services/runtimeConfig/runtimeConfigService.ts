/**
 * Runtime configuration service.
 *
 * Single source of truth for:
 *   - Per-chat-type v3 rollout thresholds (`use_new_chat.{dm,gm,mdm,pm}`)
 *   - Panic switch (global kill switch)
 *   - Any future feature-flag rollout config
 *
 * Lifecycle:
 *   - Server returns thresholds in basis-of-10000 (0 = off, 10000 = 100%).
 *   - Client computes a stable per-user bucket via `sha256(userId|flagName) % 10000`.
 *   - The flag is enabled iff `bucket < threshold`.
 *
 * Why client-side bucketing: stable per user across polls (the bucket
 * value never changes for a given user even if the threshold moves),
 * so users don't flap in and out of the canary mid-session when the
 * server adjusts the rollout percentage.
 *
 * Polling: every 60s when started. A network failure leaves the cached
 * config in place — fail-closed in the sense that thresholds don't
 * silently jump back to defaults when the rollout endpoint is flaky.
 * `isLoaded=false` until the FIRST successful fetch resolves, so
 * consumers can render an "unknown" state during boot.
 *
 * Subscribe pattern: `useSyncExternalStore(subscribe, getSnapshot)`.
 * Listeners fire when either (a) the config payload changes or (b)
 * the bucket map is recomputed (e.g. after user-id change).
 */

import { authApi } from "../api";

export interface UseNewChatThresholds {
    dm: number;
    gm: number;
    mdm: number;
    pm: number;
}

export interface RuntimeConfig {
    version: number;
    use_new_chat: UseNewChatThresholds;
    panic_switch: boolean;
}

export type RuntimeFlagName =
    | "use_new_chat.dm"
    | "use_new_chat.gm"
    | "use_new_chat.mdm"
    | "use_new_chat.pm";

const DEFAULT_CONFIG: RuntimeConfig = {
    version: 1,
    use_new_chat: { dm: 0, gm: 0, mdm: 0, pm: 0 },
    panic_switch: false,
};

const POLL_INTERVAL_MS = 60_000;
const BUCKETS_RANGE = 10_000;

/**
 * Compute `sha256(userId|flagName) % 10000` using the Web Crypto API.
 * Returns the bucket as an unsigned int in `[0, 10000)`.
 *
 * The pipe separator prevents collisions like
 * `sha256("u-a", "bc")` vs `sha256("u-ab", "c")` from landing in the
 * same bucket (otherwise rare aliasing).
 */
async function sha256Bucket(userId: string, flagName: string): Promise<number> {
    const enc = new TextEncoder();
    const data = enc.encode(`${userId}|${flagName}`);
    const hash = await crypto.subtle.digest("SHA-256", data);
    // First 4 bytes interpreted big-endian as an unsigned 32-bit int.
    // Plenty of entropy for a 10000-bucket decision.
    const view = new DataView(hash);
    const n = view.getUint32(0, false);
    return n % BUCKETS_RANGE;
}

class RuntimeConfigService {
    private _accessToken: string | null = null;
    private _userId: string | null = null;
    private _config: RuntimeConfig = DEFAULT_CONFIG;
    private _isLoaded = false;
    private _buckets = new Map<RuntimeFlagName, number>();
    private _pollTimer: ReturnType<typeof setInterval> | null = null;
    private _listeners = new Set<() => void>();
    private _inflightFetch: Promise<void> | null = null;
    private _snapshotRef: { config: RuntimeConfig; isLoaded: boolean } = {
        config: DEFAULT_CONFIG,
        isLoaded: false,
    };

    subscribe = (fn: () => void): (() => void) => {
        this._listeners.add(fn);
        return () => {
            this._listeners.delete(fn);
        };
    };

    /**
     * Returns a STABLE snapshot reference between notifications — important
     * for `useSyncExternalStore` to avoid infinite re-render loops. A new
     * object is only allocated when the underlying state changes (in
     * `_notify`).
     */
    getSnapshot = (): { config: RuntimeConfig; isLoaded: boolean } => this._snapshotRef;

    private _notify() {
        this._snapshotRef = { config: this._config, isLoaded: this._isLoaded };
        for (const fn of this._listeners) fn();
    }

    setAccessToken(token: string | null) {
        this._accessToken = token;
    }

    /**
     * Update the user-id used for bucketing. Clears the cached bucket
     * map (since buckets are per-user) and recomputes when a new user
     * is provided. Idempotent for the same id.
     */
    setUserId(userId: string | null) {
        if (userId === this._userId) return;
        this._userId = userId;
        this._buckets.clear();
        if (userId) {
            void this._recomputeBuckets();
        } else {
            this._notify();
        }
    }

    /**
     * Begin polling. Fires an immediate fetch then schedules every 60s.
     * Idempotent — repeated calls before `stop()` are no-ops.
     */
    start(): void {
        if (this._pollTimer !== null) return;
        void this._fetch();
        this._pollTimer = setInterval(() => {
            void this._fetch();
        }, POLL_INTERVAL_MS);
    }

    stop(): void {
        if (this._pollTimer !== null) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        this._inflightFetch = null;
    }

    /**
     * Whether the named flag is currently enabled for the cached user.
     *
     * Returns `false` if:
     *   - No user id has been set (no bucket → fail closed).
     *   - The config hasn't been fetched yet (`isLoaded=false`).
     *   - The bucket hasn't been computed yet (`_recomputeBuckets` is in flight).
     *   - The threshold is 0.
     * Returns `true` if:
     *   - Threshold is `>= BUCKETS_RANGE` (full rollout).
     *   - Otherwise `bucket < threshold`.
     *
     * The panic switch is checked here so a global kill short-circuits
     * every named flag.
     */
    isEnabled(flagName: RuntimeFlagName): boolean {
        if (this._config.panic_switch === true) return false;
        if (!this._userId || !this._isLoaded) return false;
        const threshold = this._thresholdFor(flagName);
        if (threshold <= 0) return false;
        if (threshold >= BUCKETS_RANGE) return true;
        const bucket = this._buckets.get(flagName);
        if (bucket === undefined) return false;
        return bucket < threshold;
    }

    /**
     * Exposes the current bucket for a flag (for debug panel / tests).
     * `undefined` if not yet computed.
     */
    bucketFor(flagName: RuntimeFlagName): number | undefined {
        return this._buckets.get(flagName);
    }

    private _thresholdFor(flagName: RuntimeFlagName): number {
        const [ns, key] = flagName.split(".") as ["use_new_chat", keyof UseNewChatThresholds];
        const branch = this._config[ns];
        if (!branch) return 0;
        const v = branch[key];
        return typeof v === "number" ? v : 0;
    }

    private async _fetch(): Promise<void> {
        if (!this._accessToken) return;
        if (this._inflightFetch) return this._inflightFetch;
        this._inflightFetch = (async () => {
            try {
                const api = authApi(this._accessToken);
                if (!api) return;
                const res = await api.get<RuntimeConfig>("/api/runtime-config/");
                const next = this._normalize(res.data);
                const changed = JSON.stringify(this._config) !== JSON.stringify(next);
                this._config = next;
                this._isLoaded = true;
                if (this._userId) {
                    await this._recomputeBuckets();
                } else if (changed) {
                    this._notify();
                } else {
                    // First fetch with no user yet — still flip
                    // isLoaded so consumers can render.
                    this._notify();
                }
            } catch {
                // Silent — keep cached config. `isLoaded` stays at its
                // current value (false on initial failure, true on
                // post-success failures).
            } finally {
                this._inflightFetch = null;
            }
        })();
        return this._inflightFetch;
    }

    /**
     * Defensive normalization so a malformed server payload doesn't
     * poison the cache. Unknown fields are dropped, missing fields
     * fall back to defaults, types are coerced or rejected.
     */
    private _normalize(raw: unknown): RuntimeConfig {
        const obj = (raw ?? {}) as Record<string, unknown>;
        const useNewChatRaw = (obj.use_new_chat ?? {}) as Record<string, unknown>;
        const coerceInt = (v: unknown, fallback = 0): number => {
            const n = typeof v === "number" ? v : Number(v);
            if (!Number.isFinite(n)) return fallback;
            return Math.max(0, Math.min(BUCKETS_RANGE, Math.trunc(n)));
        };
        return {
            version: typeof obj.version === "number" ? obj.version : 1,
            use_new_chat: {
                dm: coerceInt(useNewChatRaw.dm),
                gm: coerceInt(useNewChatRaw.gm),
                mdm: coerceInt(useNewChatRaw.mdm),
                pm: coerceInt(useNewChatRaw.pm),
            },
            panic_switch: obj.panic_switch === true,
        };
    }

    private async _recomputeBuckets(): Promise<void> {
        if (!this._userId) return;
        const flagNames: RuntimeFlagName[] = [
            "use_new_chat.dm",
            "use_new_chat.gm",
            "use_new_chat.mdm",
            "use_new_chat.pm",
        ];
        const userId = this._userId;
        const next = new Map<RuntimeFlagName, number>();
        for (const name of flagNames) {
            next.set(name, await sha256Bucket(userId, name));
        }
        // A user-id change while we were computing means these buckets
        // are stale — drop them silently.
        if (this._userId !== userId) return;
        this._buckets = next;
        this._notify();
    }

    /**
     * Internal: reset to factory state. Tests only.
     */
    _resetForTests() {
        this.stop();
        this._accessToken = null;
        this._userId = null;
        this._config = DEFAULT_CONFIG;
        this._isLoaded = false;
        this._buckets.clear();
        this._inflightFetch = null;
        this._snapshotRef = { config: DEFAULT_CONFIG, isLoaded: false };
        this._listeners.clear();
    }
}

export const runtimeConfigService = new RuntimeConfigService();
