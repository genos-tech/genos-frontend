import { useCallback, useEffect, useRef } from "react";
import type { VirtuosoHandle } from "react-virtuoso";

import type { AllChatProps } from "../../../types/chat";
import { smoothScrollBehavior } from "../../../utils/motion";

/**
 * Show a non-pinned chat that reorders to the top (e.g. a new message) when the person is at (or
 * near) the top. Scrolled further down, the list stays where it is: the first chat also changes
 * when one turns read under "Only unread", which is no reason to move (MIP-2543).
 *
 * Returns the handler for Virtuoso's `atTopStateChange`.
 */
export const useShowReorderedChat = (
    virtuosoRef: React.RefObject<VirtuosoHandle | null> | undefined,
    chats: AllChatProps[]
) => {
    const atTopRef = useRef(true);
    const atTopStateChange = useCallback((atTop: boolean) => {
        atTopRef.current = atTop;
    }, []);
    const prevFirstKeyRef = useRef("");
    useEffect(() => {
        const first = chats.find((c) => !c.isPinned);
        if (!first) return;
        const key = `${first.chatId}-${first.chatType}`;
        const changed = prevFirstKeyRef.current !== "" && prevFirstKeyRef.current !== key;
        prevFirstKeyRef.current = key;
        if (changed && atTopRef.current) {
            requestAnimationFrame(() => {
                virtuosoRef?.current?.scrollTo({ top: 0, behavior: smoothScrollBehavior() });
            });
        }
        // Keyed to the list alone: the ref differs per tab and must not re-run this by itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chats]);
    return atTopStateChange;
};
