import { useRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { useScrollToBottomOnNewItem } from "./inboxHooks";

export const useInboxScroll = (inboxItems: any[]) => {
    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    useScrollToBottomOnNewItem(virtuosoRef as React.RefObject<VirtuosoHandle>, inboxItems);

    return virtuosoRef;
};
