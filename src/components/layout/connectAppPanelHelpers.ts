import { parseServerTime } from "../../features/tasks/utils/relativeAge";
import { smoothScrollBehavior } from "../../utils/motion";

/**
 * Open the "Connect your AI" panel (if it is on screen) and bring it into view. A
 * no-op when it is not mounted, so any surface can point at it. The API-keys block
 * sits in a sibling component, hence an event rather than shared state.
 */
export const openConnectAppPanel = () => {
    window.dispatchEvent(new Event(OPEN_EVENT));
    window.requestAnimationFrame(() => {
        document
            .getElementById(CONNECT_APP_PANEL_ID)
            ?.scrollIntoView?.({ block: "start", behavior: smoothScrollBehavior() });
    });
};

/** The panel's anchor, and the window event that opens it (see `openConnectAppPanel`). */
export const CONNECT_APP_PANEL_ID = "connect-ai-app";

export const OPEN_EVENT = "genos:open-connect-app";

/**
 * The panel's "Plan & Usage" link asks the Settings modal (which owns the tab) to switch
 * to that tab. A window event, like `OPEN_EVENT`: the panel does not know its host.
 */
export const OPEN_PLAN_EVENT = "genos:open-settings-plan-usage";

export const openPlanUsage = () => window.dispatchEvent(new Event(OPEN_PLAN_EVENT));

/**
 * The most recent `lastUsedAt` among the connections, as the string the API sent, or
 * `null` when none has ever been used (or none parses). "Agent activity seen" reads
 * this: it is the last time any connected app called Genos, which is the one thing the
 * server already records (no new table).
 */
export const latestActivity = (
    connections: ReadonlyArray<{ lastUsedAt: string | null }>
): string | null => {
    let best: { at: string; ms: number } | null = null;
    for (const c of connections) {
        if (!c.lastUsedAt) continue;
        const ms = parseServerTime(c.lastUsedAt);
        if (ms !== null && (!best || ms > best.ms)) best = { at: c.lastUsedAt, ms };
    }
    return best?.at ?? null;
};
