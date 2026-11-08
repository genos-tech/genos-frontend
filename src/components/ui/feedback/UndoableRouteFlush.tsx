import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { flushUndoables } from "../../../hooks/common/useUndoableAction";

/**
 * Null-rendering: a pending undoable delete (`useUndoableAction`) is committed
 * the moment the route changes. Leaving the page is a decision to move on, and
 * the keep-alive Homes never unmount, so an unmount cleanup would never fire.
 * Mount once, inside the Router (App, next to `ToastHost`).
 */
export const UndoableRouteFlush = () => {
    const { pathname } = useLocation();
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        flushUndoables("navigate");
    }, [pathname]);
    return null;
};
