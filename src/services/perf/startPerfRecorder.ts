import { classifyNavigation } from "./classifyNavigation";
import { PerfRecorderCore, type PerfSample } from "./perfRecorderCore";

/**
 * Browser wiring for the real-session timing recorder (MIP-957): feeds
 * `PerfRecorderCore` from the browser's own performance observers, and ships
 * the finished samples to `POST /client-perf/`, which writes them to the API
 * logs (one `perf.client` line each). No user id, no content, no URLs: only
 * the numbers in `PerfSample` and four coarse facts about the device.
 *
 * Never throws and never blocks: every callback is wrapped, sending is
 * fire-and-forget, and an unsupported browser (Safari/Firefox have no
 * `longtask`) just records less.
 */

/** Share of sessions that record. 1 = all; the user base is still small. */
export const PERF_SAMPLE_RATE = 1;
export const FLUSH_EVERY_MS = 120_000;
export const FLUSH_AT_QUEUE = 10;
export const MAX_QUEUE = 50;

const INPUT_EVENTS = ["pointerdown", "keydown"] as const;
const EVENT_TIMING_NAMES = new Set(["click", "pointerdown", "pointerup", "keydown", "mousedown"]);
const API_INITIATORS = new Set(["fetch", "xmlhttprequest"]);

export interface PerfContext {
    cores: number;
    homes_mounted: number;
    viewport_w: number;
    build: string;
}

export interface PerfRecorderOptions {
    /** Current access token, or null when signed out. */
    getToken: () => string | null;
    /** How many of Chat / Tasks / Notes are mounted (0-3). */
    getHomesMounted: () => number;
    /** `VITE_API_BASE_URL` (includes `/api/v2`). */
    apiBase: string;
    /** The user's analytics opt-out. */
    isEnabled: () => boolean;
}

export interface PerfRecorder {
    navigated: (path: string) => void;
    stop: () => void;
}

/** The entry script's content hash identifies the build without any config. */
export const detectBuildId = (doc: Document = document): string => {
    const src = doc.querySelector<HTMLScriptElement>(
        'script[type="module"][src*="/assets/"]'
    )?.src;
    const m = src ? /\/assets\/index-([A-Za-z0-9_-]+)\.js/.exec(src) : null;
    return (m?.[1] ?? "").slice(0, 40);
};

export const buildPayload = (samples: PerfSample[], ctx: PerfContext) => ({ samples, ctx });

export const sendPerfSamples = (
    apiBase: string,
    token: string,
    samples: PerfSample[],
    ctx: PerfContext
): void => {
    try {
        void fetch(`${apiBase}/client-perf/`, {
            method: "POST",
            keepalive: true,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(buildPayload(samples, ctx)),
        }).catch(() => {});
    } catch {
        // Never let telemetry surface as an error.
    }
};

const safe = <A extends unknown[]>(fn: (...args: A) => void) => {
    return (...args: A) => {
        try {
            fn(...args);
        } catch {
            // Telemetry must not break the app.
        }
    };
};

export const startPerfRecorder = (opts: PerfRecorderOptions): PerfRecorder => {
    const noop: PerfRecorder = { navigated: () => {}, stop: () => {} };
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return noop;
    if (Math.random() >= PERF_SAMPLE_RATE) return noop;

    const queue: PerfSample[] = [];
    let lastFlush = performance.now();
    let timer: number | null = null;
    let stopped = false;

    const context = (): PerfContext => ({
        cores: Math.round(navigator.hardwareConcurrency || 0),
        homes_mounted: opts.getHomesMounted(),
        viewport_w: Math.round(window.innerWidth),
        build: detectBuildId(),
    });

    const flush = () => {
        if (queue.length === 0) return;
        const token = opts.getToken();
        if (!opts.isEnabled() || !token) {
            queue.length = 0;
            return;
        }
        const batch = queue.splice(0, queue.length);
        lastFlush = performance.now();
        sendPerfSamples(opts.apiBase, token, batch, context());
    };

    const core = new PerfRecorderCore(
        (sample) => {
            if (queue.length >= MAX_QUEUE) queue.shift();
            queue.push(sample);
            if (queue.length >= FLUSH_AT_QUEUE) flush();
        },
        performance.now(),
        classifyNavigation
    );

    const schedule = () => {
        if (stopped) return;
        if (timer !== null) window.clearTimeout(timer);
        const due = core.nextDueAt();
        const wait = due === null ? 60_000 : Math.max(250, due - performance.now() + 50);
        timer = window.setTimeout(
            safe(() => {
                timer = null;
                const now = performance.now();
                core.tick(now);
                if (queue.length > 0 && now - lastFlush >= FLUSH_EVERY_MS) flush();
                schedule();
            }),
            wait
        );
    };

    const observers: PerformanceObserver[] = [];
    const observe = (
        type: string,
        onEntry: (e: PerformanceEntry) => void,
        extra: Record<string, unknown> = {}
    ) => {
        try {
            if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
            const o = new PerformanceObserver(
                safe((list: PerformanceObserverEntryList) => {
                    for (const e of list.getEntries()) onEntry(e);
                })
            );
            o.observe({ type, ...extra } as PerformanceObserverInit);
            observers.push(o);
        } catch {
            // Entry type not supported here.
        }
    };

    observe("longtask", (e) => core.longTask(e.startTime, e.duration));
    observe("resource", (e) => {
        const r = e as PerformanceResourceTiming;
        if (!API_INITIATORS.has(r.initiatorType)) return;
        if (!r.name.startsWith(opts.apiBase)) return;
        // Our own upload is not "the app's" traffic.
        if (r.name.includes("/client-perf/")) return;
        core.request(r.startTime, r.responseEnd || r.startTime + r.duration);
    });
    observe(
        "event",
        (e) => {
            if (EVENT_TIMING_NAMES.has(e.name)) core.paint(e.startTime, e.duration);
        },
        { durationThreshold: 16 }
    );

    const onInput = safe((ev: Event) => core.input(ev.timeStamp || performance.now()));
    for (const name of INPUT_EVENTS) {
        window.addEventListener(name, onInput, { capture: true, passive: true });
    }
    const onVisibility = safe(() => {
        const visible = document.visibilityState === "visible";
        core.setVisible(visible, performance.now());
        if (!visible) flush();
    });
    document.addEventListener("visibilitychange", onVisibility);
    const onPageHide = safe(() => flush());
    window.addEventListener("pagehide", onPageHide);

    core.setVisible(document.visibilityState === "visible", performance.now());
    schedule();

    return {
        navigated: safe((path: string) => {
            core.navigated(path, performance.now());
            schedule();
        }),
        stop: () => {
            stopped = true;
            if (timer !== null) window.clearTimeout(timer);
            for (const o of observers) o.disconnect();
            for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput, true);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pagehide", onPageHide);
        },
    };
};
