import { useEffect, useRef } from "react";

/**
 * A window event that asks the app to open Settings on a tab (MIP-1613: the Agent
 * Activity "Connect Claude" button lands on Settings → Developer, where the existing
 * "Connect an AI app" panel lives). The desktop sidebar and the phone account sheet
 * each own a SettingsModal, so each listens; whichever is mounted answers.
 */
export const OPEN_SETTINGS_EVENT = "genos:open-settings";

export type OpenSettingsDetail = { tab?: string };

// Nothing listens until the sidebar or the phone account sheet has mounted. A request made
// before that (a `?settings=` link opened in a fresh tab) waits here and is delivered to the
// first listener (MIP-2323).
let listeners = 0;
let pending: { tab?: string } | null = null;

export const requestOpenSettings = (tab?: string): void => {
    if (listeners === 0) pending = { tab };
    window.dispatchEvent(
        new CustomEvent<OpenSettingsDetail>(OPEN_SETTINGS_EVENT, { detail: { tab } })
    );
};

/** Calls `onOpen` with the requested tab for each request. The latest callback is used. */
export const useOpenSettingsRequest = (onOpen: (tab: string | undefined) => void): void => {
    const latest = useRef(onOpen);
    latest.current = onOpen;
    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<OpenSettingsDetail>).detail;
            latest.current(detail?.tab);
        };
        window.addEventListener(OPEN_SETTINGS_EVENT, handler);
        listeners += 1;
        if (pending) {
            // Cleared on the next tick, not now: the sidebar and the phone sheet mount in the
            // same commit and both must hear it, as both hear a live event.
            latest.current(pending.tab);
            setTimeout(() => {
                pending = null;
            }, 0);
        }
        return () => {
            listeners -= 1;
            if (listeners === 0) pending = null;
            window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
        };
    }, []);
};
