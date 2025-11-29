import { useEffect } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { InboxItemProps } from "../../../types/common";

export const useScrollToBottomOnNewItem = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    inbox: InboxItemProps[]
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null) {
            return;
        } else {
            setTimeout(() => {
                virtuoso.scrollToIndex({
                    index: 0,
                    behavior: "auto",
                });
            }, 300); // wait 300ms
        }
    }, [inbox]);
};
