import { useEffect, useRef } from "react";

/**
 * A window event that asks the app to open Settings on a tab (MIP-1613: the Agent
 * Activity "Connect Claude" button lands on Settings → Developer, where the existing
 * "Connect an AI app" panel lives). The desktop sidebar and the phone account sheet
 * each own a SettingsModal, so each listens; whichever is mounted answers.
 */
export const OPEN_SETTINGS_EVENT = "genos:open-settings";

export type OpenSettingsDetail = { tab?: string };

export const requestOpenSettings = (tab?: string): void => {
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
        return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
    }, []);
};
