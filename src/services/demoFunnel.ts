import { analytics, ANALYTICS_EVENTS } from "./analytics";

/**
 * The demo funnel: `demo_started` → `demo_completed`.
 *
 * The demo exists to make one thing happen — a visitor asks Genos a question
 * about a workspace they've never seen and gets a cited answer drawn from
 * "three months" of history. Everything else (the seeding, the backdating, the
 * starter prompts) is scaffolding for that moment. So `demo_completed` marks
 * **the first answered ask**, not arrival in the workspace: a visitor who signs
 * in, scrolls a chat and leaves has not experienced the demo, and counting them
 * as converted would make the funnel report ~100% and measure nothing.
 *
 * Deliberate choices:
 *
 * - **Only the FIRST answered ask completes the funnel.** A second question is
 *   engagement, not conversion; counting both would inflate the completion rate
 *   above the start rate for the visitors who like it most, which is exactly
 *   backwards. `completed` is latched in sessionStorage.
 * - **Only demo sessions emit.** A real signed-up user asking a question is not
 *   a demo conversion. `markDemoStarted` is what arms the session, so an ask
 *   from a normal account finds no armed funnel and emits nothing.
 * - **sessionStorage, not localStorage.** The funnel is per-visit. A visitor who
 *   comes back tomorrow is a new funnel entry, and `localStorage` would silently
 *   suppress their `demo_completed` forever. It also means a fresh tab is a
 *   fresh funnel, which matches how someone actually tries a demo twice.
 * - **No user content in properties.** Same rule `useAnalyticsPageviews`
 *   follows for `?token=` and entity ids: the question text, the answer, and
 *   the cited titles never leave the browser. What ships is shape — did it
 *   happen, how long did it take, was it a starter prompt or something they
 *   typed themselves.
 *
 * Every write is try/caught: sessionStorage throws in some private-browsing
 * modes, and analytics must never be the reason a signin or an ask fails.
 */

const STARTED_KEY = "genos-demo-funnel:started";
const COMPLETED_KEY = "genos-demo-funnel:completed";

/**
 * Where the visitor's question came from. Shape, not content.
 *
 * `retry` is kept as its own value rather than folded into `typed`: a demo
 * that only converts on the second attempt converted, but the first attempt
 * failing is itself the finding, and it would be invisible if retries looked
 * like ordinary asks. Mirrors `SpotlightAskOrigin` without importing it — a
 * service must not depend on a feature.
 */
export type DemoAskOrigin = "starter" | "typed" | "retry";

const readSession = (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
        return window.sessionStorage.getItem(key);
    } catch {
        return null;
    }
};

const writeSession = (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(key, value);
    } catch {
        // Private mode / quota. The funnel degrades to "start only" rather
        // than breaking the flow it is measuring.
    }
};

/**
 * Arms the funnel and emits `demo_started`.
 *
 * Called on a SUCCESSFUL demo signin only — a visitor who hit the rate limit
 * never got a workspace, so they didn't enter the funnel. Those are reported
 * separately via {@link trackDemoSignInFailed} so a spike in drop-off can be
 * told apart from a spike in 429s, which are two completely different problems.
 */
export const markDemoStarted = (lang: string | undefined): void => {
    writeSession(STARTED_KEY, String(Date.now()));
    analytics.capture(ANALYTICS_EVENTS.DEMO_STARTED, {
        // Which content table seeded the workspace. `undefined` means the
        // client sent no preference and let the API's Accept-Language chain
        // decide, which is itself worth being able to see in the data.
        lang: lang ?? "server_default",
    });
};

/**
 * Why a demo signin never produced a workspace. Kept as four distinct values
 * because they need different responses: `rate_limited` is the throttle doing
 * its job (10/hour/IP), `network` is the visitor's connection, `error` is the
 * API failing to seed, and `unexpected` is a bug on our side of the call.
 */
export type DemoStartFailure = "rate_limited" | "network" | "error" | "unexpected";

/**
 * A demo signin that never produced a workspace. Not a funnel entry — it is
 * the reason a funnel entry is missing, which is why it gets its own event
 * name instead of a `failed: true` property on `demo_started`.
 */
export const trackDemoSignInFailed = (reason: DemoStartFailure): void => {
    analytics.capture(ANALYTICS_EVENTS.DEMO_START_FAILED, { reason });
};

/** True when this visit is a demo visit that has not yet converted. */
const isPendingDemo = (): boolean =>
    readSession(STARTED_KEY) !== null && readSession(COMPLETED_KEY) === null;

/**
 * Emits `demo_completed` for the first answered ask of a demo visit.
 *
 * No-ops for a non-demo session, and after the first call. Returns whether it
 * emitted, so tests can assert the latch rather than reaching into storage.
 */
export const markDemoCompleted = (opts: {
    origin: DemoAskOrigin;
    elapsedMs?: number;
    sourceCount?: number;
}): boolean => {
    if (!isPendingDemo()) return false;
    writeSession(COMPLETED_KEY, String(Date.now()));

    const startedAt = Number(readSession(STARTED_KEY));
    // Time from "workspace seeded" to "first answer on screen" — the number
    // that says whether the demo actually lands in ~5 minutes.
    const timeToFirstAnswerMs =
        Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : undefined;

    analytics.capture(ANALYTICS_EVENTS.DEMO_COMPLETED, {
        // Did they take a suggested question or write their own? This is the
        // measurement the starter prompts were added to enable.
        ask_origin: opts.origin,
        // How long the agent took, as reported by the stream itself.
        ...(typeof opts.elapsedMs === "number" ? { answer_elapsed_ms: opts.elapsedMs } : {}),
        // How many citations the answer carried. Zero is the interesting case:
        // it means retrieval found nothing, which is the demo failing while
        // still technically "completing".
        ...(typeof opts.sourceCount === "number" ? { source_count: opts.sourceCount } : {}),
        ...(timeToFirstAnswerMs !== undefined
            ? { time_to_first_answer_ms: timeToFirstAnswerMs }
            : {}),
    });
    return true;
};

/** Test seam: forget this visit's funnel state. */
export const resetDemoFunnel = (): void => {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.removeItem(STARTED_KEY);
        window.sessionStorage.removeItem(COMPLETED_KEY);
    } catch {
        /* nothing to clear */
    }
};
