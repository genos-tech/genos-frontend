/**
 * The "Loading data…" page shown right after the user clicks another service
 * (MIP-965).
 *
 * Why it exists: react-router wraps every navigation in `startTransition`
 * (`BrowserRouter` in main.tsx, no options), so after a click on the rail the
 * OLD screen stays up, with no feedback at all, while React renders the new
 * one in the background. Rendering the switch (AppBody, the outgoing Home's
 * hide render, the incoming Home's catch-up render) is the long part, and the
 * commit plus the browser's layout of the newly shown screen can't be split
 * up or painted in between. That is the "page gets stuck" moment.
 *
 * The rule this module enforces: the loader must be COMMITTED AND PAINTED
 * before the expensive render starts. So `switchService`
 *   1. shows the loader as an urgent (non-transition) update,
 *   2. waits for a painted frame (`requestAnimationFrame`, then `setTimeout 0`),
 *   3. only then calls `navigate`.
 *
 * It hides again when the Home that was asked for reports (through
 * `ServiceSwitchReady`) that it is active and committed, one frame later.
 *
 * State lives in a module store read with `useSyncExternalStore` by the loader
 * alone: the Homes' markers WRITE to it but never subscribe, so a click does
 * not re-render anything but the loader.
 */

import { serviceOf } from "../perf/classifyNavigation";

/** The five services the rail, the tab bar and the shortcuts switch between. */
export type SwitchService = "inbox" | "chat" | "tasks" | "notes" | "genos";

// An allow-list on purpose: `serviceOf` returns ANY segment under /workspace
// (`integrations`, `plans`, ...), and a loader aimed at one of those has no
// ready marker, so it would sit there until the failsafe.
const SWITCH_SERVICES: ReadonlySet<string> = new Set<SwitchService>([
    "inbox",
    "chat",
    "tasks",
    "notes",
    "genos",
]);

/** The service a path belongs to, or null when it is not one of the five. */
export const switchServiceOf = (path: string): SwitchService | null => {
    const service = serviceOf(path.split(/[?#]/, 1)[0]);
    return service !== null && SWITCH_SERVICES.has(service) ? (service as SwitchService) : null;
};

/** If no frame has been painted by then, go ahead anyway. `requestAnimationFrame`
 *  does not fire in a hidden tab, and a click there must still navigate. */
export const PAINT_FALLBACK_MS = 100;

/** The loader never stays up longer than this, whatever happens (a Home that
 *  threw lands on an error screen and never reports ready). */
export const FAILSAFE_MS = 10_000;

type Timer = ReturnType<typeof setTimeout>;

// ---- state -----------------------------------------------------------------

/** The service the loader is waiting for; non-null = the loader is shown. */
let target: SwitchService | null = null;
/** The service whose Home is active and committed, as the Homes' markers
 *  report it. This (not the URL) is what is on screen: `history.push` writes
 *  the URL at once, while the screen only follows once the transition commits. */
let onScreen: SwitchService | null = null;
/** Cancels the frame wait of a switch that has not navigated yet. */
let cancelPendingNavigation: (() => void) | null = null;
/** Cancels the one-frame wait before the loader hides. */
let cancelPendingHide: (() => void) | null = null;
let failsafeTimer: Timer | null = null;

const listeners = new Set<() => void>();

export const subscribeServiceSwitch = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** The service being switched to, or null when the loader is not shown. */
export const getServiceSwitchTarget = (): SwitchService | null => target;

// ---- frames ----------------------------------------------------------------

/**
 * Runs `callback` once a frame has been painted. Returns a cancel function.
 *
 * `settle` waits `rAF` -> `setTimeout(0)`: the rAF callback runs BEFORE the
 * frame is painted, the timer task runs after it. Without `settle` the rAF
 * callback itself is enough ("one frame later").
 *
 * A fallback timer races the frame so a tab that is not painting (hidden:
 * `requestAnimationFrame` never fires) does not wait forever. Whichever
 * finishes first runs the callback exactly once and cancels the other.
 */
const afterFrame = (callback: () => void, settle: boolean): (() => void) => {
    let finished = false;
    let frameId: number | null = null;
    let settleTimer: Timer | null = null;
    let fallbackTimer: Timer | null = null;

    const stop = () => {
        finished = true;
        if (frameId !== null) cancelAnimationFrame(frameId);
        if (settleTimer !== null) clearTimeout(settleTimer);
        if (fallbackTimer !== null) clearTimeout(fallbackTimer);
        frameId = settleTimer = fallbackTimer = null;
    };
    const finish = () => {
        if (finished) return;
        stop();
        callback();
    };

    fallbackTimer = setTimeout(finish, PAINT_FALLBACK_MS);
    frameId = requestAnimationFrame(() => {
        frameId = null;
        if (finished) return;
        if (settle) settleTimer = setTimeout(finish, 0);
        else finish();
    });
    return stop;
};

// ---- show / hide -----------------------------------------------------------

const emit = () => listeners.forEach((listener) => listener());

const clearFailsafe = () => {
    if (failsafeTimer !== null) clearTimeout(failsafeTimer);
    failsafeTimer = null;
};

const cancelHide = () => {
    cancelPendingHide?.();
    cancelPendingHide = null;
};

const cancelNavigation = () => {
    cancelPendingNavigation?.();
    cancelPendingNavigation = null;
};

const show = (service: SwitchService) => {
    cancelHide();
    clearFailsafe();
    failsafeTimer = setTimeout(hide, FAILSAFE_MS);
    if (target === service) return;
    target = service;
    emit();
};

function hide() {
    cancelHide();
    clearFailsafe();
    if (target === null) return;
    target = null;
    emit();
}

// ---- the public API --------------------------------------------------------

/**
 * Switch to `path`, showing the "Loading data…" page first when `path` is in a
 * DIFFERENT service from the one on screen.
 *
 * Navigates straight through (as `navigate(path)` did) when the path is in the
 * service already on screen or in none of the five services. A switch that is
 * still waiting for its frame is dropped by a newer call, so a quick A -> B -> C
 * navigates to C only.
 *
 * `afterNavigate` runs right after the navigation, in the same tick, wherever
 * that tick ends up (a frame later for a real switch): for callers that did
 * `navigate(...)` and then started something that relies on the route.
 */
export const switchService = (
    navigate: (to: string) => unknown,
    path: string,
    afterNavigate?: () => void
): void => {
    const to = switchServiceOf(path);
    cancelNavigation();

    const go = () => {
        navigate(path);
        afterNavigate?.();
    };

    if (to === null || to === onScreen) {
        // Nothing to switch. A switch to somewhere else that was under way is
        // abandoned: what is on screen stays, so its loader must not linger.
        if (target !== null && target !== to) hide();
        go();
        return;
    }

    show(to);
    cancelPendingNavigation = afterFrame(() => {
        cancelPendingNavigation = null;
        go();
    }, true);
};

/**
 * A Home reports that it is the one on screen (active and committed).
 * Called from `ServiceSwitchReady`'s effect, so after the commit that made
 * it active. If the loader is waiting for exactly this service it hides one
 * frame later; a Home that is not the target (an older click that lost to a
 * newer one) leaves the loader alone.
 */
export const reportServiceActive = (service: SwitchService): void => {
    onScreen = service;
    if (target !== service) return;
    cancelHide();
    cancelPendingHide = afterFrame(() => {
        cancelPendingHide = null;
        // Checked when the frame arrives, not when it was scheduled: a click on
        // another service in between has re-targeted the loader.
        if (target === service) hide();
    }, false);
};

/** A Home reports that it is no longer the one on screen. */
export const reportServiceInactive = (service: SwitchService): void => {
    if (onScreen === service) onScreen = null;
};

/**
 * Back / Forward changes the URL before any code of ours runs, so the loader
 * cannot be shown BEFORE the render starts, only alongside it: best effort.
 * Same comparison as `switchService`.
 */
const handlePopState = () => {
    cancelNavigation();
    const next = switchServiceOf(window.location.pathname);
    if (next !== null && next !== onScreen) show(next);
    else if (target !== null && target !== next) hide();
};

/** Listens for Back / Forward; returns the unlisten function. */
export const listenForServicePopState = (): (() => void) => {
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
};

/** Back to the initial state, with every timer and frame cancelled. For tests. */
export const resetServiceSwitchForTests = (): void => {
    cancelNavigation();
    cancelHide();
    clearFailsafe();
    target = null;
    onScreen = null;
    listeners.clear();
};
