import { smoothScrollBehavior } from "../../utils/motion";

/**
 * Open the "Connect an AI app" panel (if it is on screen) and bring it into view. A
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
