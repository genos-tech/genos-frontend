import { useEffect, useRef } from "react";

import { parseInternalUrl } from "../../utils/parseInternalUrl";

const TODO_PATH = /^\/workspace\/todo(\/|$)/;

type Target = { localDate: string; itemId?: number } | null;

type UseTodoRouteProps = {
    pathname: string;
    // Undefined until signed in and the chat list holds the self-DM.
    selfDmId: string | undefined;
    // Must REPLACE the to-do URL in history, or Back would land on it and bounce.
    openSelfDm: (chatId: string) => void;
};

/**
 * `/workspace/todo` and `/workspace/todo/<date>/item/<id>` have no page of their own: the to-do
 * list lives in the self-DM. On every navigation to either form (MIP-2593), open that DM with the
 * pane showing; the dated form also focuses its item. A pasted link opens the page, not the
 * preview modal, which is reserved for clicked links.
 */
export const useTodoRoute = ({ pathname, selfDmId, openSelfDm }: UseTodoRouteProps) => {
    const handledRef = useRef<string | null>(null);
    const pendingRef = useRef<{ target: Target } | null>(null);
    useEffect(() => {
        if (!TODO_PATH.test(pathname)) {
            handledRef.current = null;
            const pending = pendingRef.current;
            pendingRef.current = null;
            if (!pending) return;
            // A pane already mounted is told only now, with the chat page on screen: a hidden
            // list cannot scroll.
            if (pathname.startsWith("/workspace/chat/")) {
                window.dispatchEvent(new CustomEvent("openTodoPane", { detail: pending.target }));
            } else {
                sessionStorage.removeItem("todoDeepLinkTarget");
            }
            return;
        }
        if (selfDmId === undefined || handledRef.current === pathname) return;
        handledRef.current = pathname;

        const route = parseInternalUrl(pathname);
        const target: Target =
            route.kind === "todo" && route.localDate
                ? { itemId: route.itemId, localDate: route.localDate }
                : null;
        localStorage.setItem("isToDoVisible", "true");
        // sessionStorage reaches a pane that mounts later.
        if (target) sessionStorage.setItem("todoDeepLinkTarget", JSON.stringify(target));
        else sessionStorage.removeItem("todoDeepLinkTarget");
        pendingRef.current = { target };
        openSelfDm(selfDmId);
        // `openSelfDm` is new on every render of its caller; a navigation is what re-runs this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, selfDmId]);
};
