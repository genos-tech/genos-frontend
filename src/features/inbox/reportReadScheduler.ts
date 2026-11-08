// When does an Inbox item count as "looked at"? (MIP-1292)
//
// A report counts once its card has been ON SCREEN for DWELL_MS: the tab visible and the card
// at least half in view. Not on list load (a list can mount 100 cards), not on a click, and a
// scroll past never counts. genos-api folds "N unchanged since your last report" only over a
// previous report the member opened, so this is what starts that.
//
// One IntersectionObserver and ONE timer serve every watched card, however many a list
// renders: a card is only a map entry, and only cards that are on screen are ever due. The
// timer is armed for the earliest due card and re-armed after each firing. Nothing here is React
// state, so a card coming into view re-renders nothing.
//
// "At least half in view" would never be true for a card taller than twice the viewport (a
// long report on a phone), so a card that fills half the viewport counts too.
//
// Once per item: `claimed` holds every key that was sent and succeeded or is in flight. A card
// that Virtuoso unmounts and remounts, or the same report shown twice, sends nothing again. A
// failed send releases its key, and the card is tried again the next time it ENTERS the view
// (it is not re-armed while it stays there).

/** How long a card must stay on screen. */
export const DWELL_MS = 2000;

type Watch = {
    key: string;
    /** Resolves true when the server took it. Never throws. */
    send: () => Promise<boolean>;
    onScreen: boolean;
    /** When the clock started, or null while off screen, hidden, or already fired. */
    since: number | null;
};

const watches = new Map<Element, Watch>();
const claimed = new Set<string>();
let observer: IntersectionObserver | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const tabHidden = (): boolean => typeof document !== "undefined" && document.hidden;

const isOnScreen = (entry: IntersectionObserverEntry): boolean => {
    if (!entry.isIntersecting) return false;
    if (entry.intersectionRatio >= 0.5) return true;
    const viewport = entry.rootBounds?.height ?? 0;
    return viewport > 0 && entry.intersectionRect.height >= viewport * 0.5;
};

const arm = () => {
    if (timer !== null) {
        clearTimeout(timer);
        timer = null;
    }
    if (tabHidden()) return;
    let earliest: number | null = null;
    for (const w of watches.values()) {
        if (w.since !== null && (earliest === null || w.since < earliest)) earliest = w.since;
    }
    if (earliest === null) return;
    timer = setTimeout(fire, Math.max(0, earliest + DWELL_MS - Date.now()));
};

const fire = () => {
    timer = null;
    const now = Date.now();
    for (const [el, w] of [...watches]) {
        if (w.since === null || now - w.since < DWELL_MS) continue;
        // Fired: it stays "on screen" but is not due again until it leaves and re-enters.
        w.since = null;
        if (claimed.has(w.key)) continue;
        claimed.add(w.key);
        void w.send().then((ok) => {
            if (ok) stop(el);
            else claimed.delete(w.key);
        });
    }
    arm();
};

const onEntries = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
        const w = watches.get(entry.target);
        if (!w) continue;
        const on = isOnScreen(entry);
        if (on && !w.onScreen) {
            w.onScreen = true;
            w.since = tabHidden() ? null : Date.now();
        } else if (!on) {
            w.onScreen = false;
            w.since = null;
        }
    }
    arm();
};

// A hidden tab restarts every clock: time away is not time reading. On return the cards that
// are still on screen start again from now.
const onVisibility = () => {
    const now = Date.now();
    for (const w of watches.values()) w.since = !tabHidden() && w.onScreen ? now : null;
    arm();
};

const stop = (el: Element) => {
    if (!watches.delete(el)) return;
    observer?.unobserve(el);
    if (watches.size > 0) return;
    observer?.disconnect();
    observer = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    document.removeEventListener("visibilitychange", onVisibility);
};

/**
 * Watch a card. Returns the cleanup (unmount, or the card stopped being eligible).
 * `key` identifies the item for the "once" rule: member, team and item.
 */
export const watchUntilRead = (
    el: Element,
    key: string,
    send: () => Promise<boolean>
): (() => void) => {
    if (claimed.has(key) || typeof IntersectionObserver === "undefined") return () => {};
    if (watches.size === 0) {
        observer = new IntersectionObserver(onEntries, { threshold: [0, 0.25, 0.5, 0.75, 1] });
        document.addEventListener("visibilitychange", onVisibility);
    }
    watches.set(el, { key, send, onScreen: false, since: null });
    observer?.observe(el);
    return () => stop(el);
};

/** Forget everything (a test, or the member signing out). */
export const resetReportReadScheduler = () => {
    for (const el of [...watches.keys()]) stop(el);
    claimed.clear();
};
