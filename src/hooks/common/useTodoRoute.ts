import { useEffect, useRef } from "react";

import { parseInternalUrl } from "../../utils/parseInternalUrl";

const TODO_PATH = /^\/workspace\/todo(\/|$)/;

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
    useEffect(() => {
        if (!TODO_PATH.test(pathname)) {
            handledRef.current = null;
            return;
        }
        if (selfDmId === undefined || handledRef.current === pathname) return;
        handledRef.current = pathname;

        const route = parseInternalUrl(pathname);
        const target =
            route.kind === "todo" ? { itemId: route.itemId, localDate: route.localDate } : null;
        localStorage.setItem("isToDoVisible", "true");
        // sessionStorage reaches a pane that mounts later, the event one already mounted.
        if (target) sessionStorage.setItem("todoDeepLinkTarget", JSON.stringify(target));
        else sessionStorage.removeItem("todoDeepLinkTarget");
        window.dispatchEvent(new CustomEvent("openTodoPane", { detail: target }));
        openSelfDm(selfDmId);
        // `openSelfDm` is new on every render of its caller; a navigation is what re-runs this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, selfDmId]);
};
