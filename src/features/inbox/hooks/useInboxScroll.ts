import { useRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import type { InboxItemProps } from "../../../types/common";
import { useScrollToBottomOnNewItem } from "./inboxHooks";

export const useInboxScroll = (inboxItems: InboxItemProps[]) => {
    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    useScrollToBottomOnNewItem(virtuosoRef as React.RefObject<VirtuosoHandle>, inboxItems);

    return virtuosoRef;
};
