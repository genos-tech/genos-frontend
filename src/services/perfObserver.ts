// Dev-only long-task observer. Logs any main-thread task that exceeds
// `LONG_TASK_THRESHOLD_MS` to the console along with the time it started
// (relative to navigation). The PerformanceObserver "longtask" entry
// type surfaces frame-blocking work; together with the DevTools
// Performance tab it's the fastest way to find render hot spots.
//
// Phase 6.1 deliverable: ship the instrumentation, not an audit report.
// Audit = click the golden paths (open chat with 5k messages, switch
// projects with 1k tasks, expand a deep note tree) while watching the
// console for `[longtask]` entries. Each entry points at the slice of
// work that needs trimming.
//
// Production builds are no-ops: the bundle excludes this entirely via
// the `import.meta.env.DEV` guard at the call site in main.tsx.
const LONG_TASK_THRESHOLD_MS = 50;

let observer: PerformanceObserver | null = null;

export function startLongTaskObserver(): void {
    if (observer) return;
    if (typeof PerformanceObserver === "undefined") return;
    // Safari does not support the `longtask` entry type. We don't try to
    // polyfill — Chromium / Firefox cover the dev surface.
    const supported = PerformanceObserver.supportedEntryTypes?.includes("longtask");
    if (!supported) {
        // eslint-disable-next-line no-console
        console.info("[perf] longtask observer unsupported in this browser");
        return;
    }

    try {
        observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration < LONG_TASK_THRESHOLD_MS) continue;
                // eslint-disable-next-line no-console
                console.warn(
                    `[longtask] ${entry.duration.toFixed(1)}ms at +${entry.startTime.toFixed(
                        0
                    )}ms`,
                    entry
                );
            }
        });
        observer.observe({ type: "longtask", buffered: true });
        // eslint-disable-next-line no-console
        console.info("[perf] longtask observer active (threshold 50ms)");
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("[perf] failed to start longtask observer", error);
    }
}

export function stopLongTaskObserver(): void {
    if (!observer) return;
    observer.disconnect();
    observer = null;
}
