import { useEffect, useRef } from "react";

import { APP_NAVIGATE_EVENT } from "../../services/appNavigate";

/** Answer `requestAppNavigate`. Installed once; `navigate` goes through a ref
 *  because its identity changes with the location, and a listener that was
 *  torn down and re-added on every route change would be a window with none. */
export const useAppNavigateRequests = (navigate: (path: string) => void): void => {
    const latest = useRef(navigate);
    latest.current = navigate;

    useEffect(() => {
        const onRequest = (event: Event) => {
            const path = (event as CustomEvent<unknown>).detail;
            if (typeof path === "string" && path.startsWith("/")) latest.current(path);
        };
        window.addEventListener(APP_NAVIGATE_EVENT, onRequest);
        return () => window.removeEventListener(APP_NAVIGATE_EVENT, onRequest);
    }, []);
};
