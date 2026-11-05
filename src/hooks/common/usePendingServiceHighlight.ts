import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
    getServiceSwitchTarget,
    subscribeServiceSwitch,
    switchServiceOf,
} from "../../services/serviceSwitch/serviceSwitchStore";

/**
 * Moves the rail / tab bar highlight the moment a service is clicked (MIP-965).
 *
 * The highlight is derived from the URL, and a navigation is a transition: the
 * route does not change in React until the switch has committed, so the
 * highlight used to stay on the OLD service for the whole switch, right next
 * to the new "Loading data…" page. Here the click records a local "pending"
 * path and the highlight follows it at once.
 *
 * Local component state on purpose, not the shared switch store: the rail
 * re-renders inside the transition anyway, and putting this in the store
 * would make every highlight consumer subscribe to it.
 *
 * The pending path is dropped when
 *  - the route changes (the URL caught up: it is the truth again), or
 *  - the loader ends (a click that never produced a navigation: another click
 *    or shortcut took over, Back/Forward left, the failsafe fired), so the
 *    highlight can never stay on a service that is not shown.
 */
export const usePendingServiceHighlight = () => {
    const { pathname } = useLocation();
    const [pendingPath, setPendingPath] = useState<string | null>(null);

    useEffect(() => {
        setPendingPath(null);
    }, [pathname]);

    useEffect(
        () =>
            subscribeServiceSwitch(() => {
                if (getServiceSwitchTarget() === null) setPendingPath(null);
            }),
        []
    );

    /** Call right BEFORE `switchService` for a click on `path`. A click on the
     *  service the route is already in (or on a path outside the five) moves
     *  nothing, and clears an earlier pending click, so A, B, A lands on A. */
    const markPending = useCallback(
        (path: string) => {
            const to = switchServiceOf(path);
            setPendingPath(to !== null && to !== switchServiceOf(pathname) ? path : null);
        },
        [pathname]
    );

    return { highlightPath: pendingPath ?? pathname, markPending };
};
