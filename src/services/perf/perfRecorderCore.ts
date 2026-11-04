import type { PerfNavigationKind } from "./classifyNavigation";

/**
 * Timing logic for the real-session recorder (MIP-957), with no browser APIs
 * in it: the wiring feeds it events and a clock, so the rules can be tested
 * with a synthetic timeline.
 *
 * For each navigation-type interaction it produces ONE sample:
 *
 *  - `paint_ms`   click → next paint (the Event Timing duration of the click),
 *                 null when the browser reported none (under 16 ms, or no
 *                 Event Timing support).
 *  - `settle_ms`  click → the end of the last long task or API response that
 *                 started inside the window. null when nothing happened.
 *  - `content_ms` the same, but a request flagged `background` (GitHub, the
 *                 presence heartbeat, runtime config: nothing a click waits
 *                 for) does not count, so it says when the content was ready
 *                 rather than when the last bit of traffic ended. Long tasks
 *                 always count. `settle_ms` is unchanged, so builds recorded
 *                 before this field stay comparable. null when nothing but
 *                 background traffic happened.
 *  - `blocked_ms` long-task time inside the window; `longest_ms` the worst one.
 *  - `requests`   API requests started inside the window.
 *
 * Plus an `idle_minute` sample for every full minute with no input, so the
 * once-a-minute refresh churn (MIP-960) is measured too.
 *
 * The window is fixed (`WINDOW_MS`) and the sample is finalized a little later
 * (`FINALIZE_AFTER_MS`) so slow responses to requests started inside it are
 * counted. A new interaction closes the previous window early.
 */

export type PerfKind = PerfNavigationKind | "idle_minute";

export interface PerfSample {
    kind: PerfKind;
    paint_ms: number | null;
    settle_ms: number | null;
    content_ms: number | null;
    blocked_ms: number;
    longest_ms: number;
    requests: number;
    window_ms: number;
}

export const WINDOW_MS = 3000;
export const FINALIZE_AFTER_MS = 5000;
export const IDLE_WINDOW_MS = 60_000;
/** A route change this soon after an input event is attributed to it. */
export const RECENT_INPUT_MS = 2500;

const KEEP_MS = IDLE_WINDOW_MS + FINALIZE_AFTER_MS + 5000;
const MAX_MS = 600_000;

interface Span {
    start: number;
    end: number;
}

interface RequestSpan extends Span {
    /** Traffic no click waits for: kept in `requests` and `settle_ms`, left out of `content_ms`. */
    background: boolean;
}

interface Open {
    kind: PerfNavigationKind;
    t0: number;
    /** Set when a later interaction closed this window early. */
    closedAt: number | null;
}

const clampInt = (n: number): number => Math.max(0, Math.min(MAX_MS, Math.round(n)));

export class PerfRecorderCore {
    private longTasks: Span[] = [];
    private requests: RequestSpan[] = [];
    private paints: { t: number; d: number }[] = [];
    private lastInputAt = -Infinity;
    private open: Open[] = [];
    private lastPath: string | null = null;

    private idleStart: number;
    private idleDirty = false;
    private visible = true;

    constructor(
        private readonly emit: (sample: PerfSample) => void,
        now: number,
        private readonly classify: (prev: string | null, next: string) => PerfNavigationKind | null
    ) {
        this.idleStart = now;
    }

    input(t: number): void {
        this.lastInputAt = t;
        this.idleDirty = true;
    }

    longTask(start: number, duration: number): void {
        this.longTasks.push({ start, end: start + duration });
    }

    request(start: number, end: number, background = false): void {
        this.requests.push({ start, end, background });
    }

    paint(t: number, duration: number): void {
        this.paints.push({ t, d: duration });
    }

    /**
     * The tab was hidden or shown. Hidden time is not measured (browsers
     * throttle a hidden tab), so a minute that touched it is skipped, and the
     * next minute starts when the tab is shown again.
     */
    setVisible(visible: boolean, now: number): void {
        const wasVisible = this.visible;
        this.visible = visible;
        if (!visible) {
            this.idleDirty = true;
        } else if (!wasVisible) {
            this.idleStart = now;
            this.idleDirty = false;
        }
    }

    /** The router moved to `nextPath` at time `now`. */
    navigated(nextPath: string, now: number): void {
        const prev = this.lastPath;
        this.lastPath = nextPath;
        const kind = this.classify(prev, nextPath);
        if (!kind) return;
        if (now - this.lastInputAt > RECENT_INPUT_MS) return;

        const t0 = this.lastInputAt;
        for (const o of this.open) if (o.closedAt === null) o.closedAt = t0;
        this.open.push({ kind, t0, closedAt: null });
        this.idleDirty = true;
    }

    /** When `tick` next has something to do, or null. */
    nextDueAt(): number | null {
        const dues = this.open.map((o) => o.t0 + FINALIZE_AFTER_MS);
        dues.push(this.idleStart + IDLE_WINDOW_MS);
        return Math.min(...dues);
    }

    tick(now: number): void {
        const still: Open[] = [];
        for (const o of this.open) {
            if (now >= o.t0 + FINALIZE_AFTER_MS) this.emit(this.finalize(o));
            else still.push(o);
        }
        this.open = still;

        if (now >= this.idleStart + IDLE_WINDOW_MS) {
            const start = this.idleStart;
            const quiet =
                !this.idleDirty &&
                this.visible &&
                this.open.length === 0 &&
                this.lastInputAt < start;
            if (quiet) this.emit(this.idleSample(start, start + IDLE_WINDOW_MS));
            this.idleStart = now;
            this.idleDirty = !this.visible;
        }

        const cutoff = now - KEEP_MS;
        this.longTasks = this.longTasks.filter((s) => s.end >= cutoff);
        this.requests = this.requests.filter((s) => s.end >= cutoff);
        this.paints = this.paints.filter((p) => p.t >= cutoff);
    }

    private finalize(o: Open): PerfSample {
        const windowEnd = Math.min(o.t0 + WINDOW_MS, o.closedAt ?? Infinity);
        const tasks = this.longTasks.filter((s) => s.start >= o.t0 && s.start < windowEnd);
        const reqs = this.requests.filter((s) => s.start >= o.t0 && s.start < windowEnd);

        const blocked = tasks.reduce((sum, s) => sum + (Math.min(s.end, windowEnd) - s.start), 0);
        const longest = tasks.reduce((m, s) => Math.max(m, s.end - s.start), 0);
        const ends = [...tasks.map((s) => s.end), ...reqs.map((s) => s.end)];
        const contentEnds = [
            ...tasks.map((s) => s.end),
            ...reqs.filter((s) => !s.background).map((s) => s.end),
        ];

        const events = this.paints.filter((p) => p.t >= o.t0 - 100 && p.t <= o.t0 + 1000);
        const paint = events.length ? Math.max(...events.map((p) => p.d)) : null;

        return {
            kind: o.kind,
            paint_ms: paint === null ? null : clampInt(paint),
            settle_ms: ends.length ? clampInt(Math.max(...ends) - o.t0) : null,
            content_ms: contentEnds.length ? clampInt(Math.max(...contentEnds) - o.t0) : null,
            blocked_ms: clampInt(blocked),
            longest_ms: clampInt(longest),
            requests: reqs.length,
            window_ms: clampInt(windowEnd - o.t0),
        };
    }

    private idleSample(start: number, end: number): PerfSample {
        const tasks = this.longTasks.filter((s) => s.start >= start && s.start < end);
        const reqs = this.requests.filter((s) => s.start >= start && s.start < end);
        return {
            kind: "idle_minute",
            paint_ms: null,
            settle_ms: null,
            content_ms: null,
            blocked_ms: clampInt(
                tasks.reduce((sum, s) => sum + (Math.min(s.end, end) - s.start), 0)
            ),
            longest_ms: clampInt(tasks.reduce((m, s) => Math.max(m, s.end - s.start), 0)),
            requests: reqs.length,
            window_ms: clampInt(end - start),
        };
    }
}
