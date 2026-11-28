import { useEffect, useRef } from "react";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";

import { Clickable } from "../../../components/ui/Clickable";
import { DataState } from "../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../i18n";
import { useSyncFailure } from "../../../services/syncStatus";
import { focusRing, g } from "../../../theme/tokens";
import { smoothScrollBehavior } from "../../../utils/motion";
import { useInboxListPosition } from "../hooks/useInboxListPosition";
import { InboxSectionProps } from "../types/inboxTypes";
import { InboxBubble } from "./InboxBubble";

type InboxSectionExtendedProps = InboxSectionProps & {
    emptyTitle?: string;
    emptySubtitle?: string;
    isRequest?: boolean;
    selectedItemId?: number;
};

export const InboxSection = ({
    items,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
    useTEM,
    itemKeyPrefix,
    emptyTitle,
    emptySubtitle,
    isRequest = false,
    selectedItemId,
    onItemChanged,
}: InboxSectionExtendedProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const navigate = useNavigate();
    // A failed inbox load with nothing cached must not read as "all caught up" (MIP-1298).
    const sync = useSyncFailure("inbox");
    const basePath = isRequest ? "/workspace/inbox/requests" : "/workspace/inbox/activities";
    const resolvedEmptyTitle = emptyTitle ?? t.inbox.section.defaultEmptyTitle;
    const resolvedEmptySubtitle = emptySubtitle ?? t.inbox.section.defaultEmptySubtitle;

    const { virtuosoRef, atTopStateChange, firstItemIndex } = useInboxListPosition(items);

    // Scroll to the selected item once per selection, not on every change of the list (a
    // card turning read would re-centre it, MIP-2543). `items` is a dependency so a deep
    // link that lands before the list has loaded still scrolls when the item arrives.
    const scrolledToRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (!selectedItemId) {
            scrolledToRef.current = undefined;
            return;
        }
        if (scrolledToRef.current === selectedItemId || !virtuosoRef.current) return;
        const itemIndex = items.findIndex((item) => item.itemId === selectedItemId);
        if (itemIndex === -1) return;
        scrolledToRef.current = selectedItemId;
        virtuosoRef.current.scrollToIndex({
            index: itemIndex,
            align: "center",
            behavior: smoothScrollBehavior(),
        });
    }, [selectedItemId, items, virtuosoRef]);

    const selectedIndex = items.findIndex((item) => item.itemId === selectedItemId);

    const handleItemClick = (itemId: number) => {
        navigate(`${basePath}/${itemId}`);
    };

    return (
        <Box
            sx={{
                height: "100%",
                width: "100%",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {items.length > 0 ? (
                <Virtuoso
                    ref={virtuosoRef}
                    atBottomThreshold={128}
                    atTopStateChange={atTopStateChange}
                    atTopThreshold={64}
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    computeItemKey={(_, item) => item.itemId}
                    data={items}
                    firstItemIndex={firstItemIndex}
                    // Mount-only: a list that opens on a linked card starts there. A
                    // `scrollToIndex` before Virtuoso has measured its rows is lost.
                    initialTopMostItemIndex={
                        selectedIndex > 0 ? { index: selectedIndex, align: "center" } : 0
                    }
                    style={{ height: "100%" }}
                    itemContent={(virtualIndex, item) => {
                        const index = virtualIndex - firstItemIndex;
                        const isSelected = selectedItemId === item.itemId;
                        return (
                            <Clickable
                                key={`${itemKeyPrefix}-${item.itemId}`}
                                sx={{
                                    // The row is a plain block that only does focus, hover
                                    // and the keyboard: the card inside it draws its own
                                    // padding and its hairline divider, so nothing floats.
                                    cursor: "pointer",
                                    borderRadius: 0,
                                    animation: "fadeSlideIn 0.3s ease-out forwards",
                                    animationDelay: `${Math.min(index * 0.05, 0.3)}s`,
                                    opacity: 0,
                                    // Entering is decoration: a reader who asked for less motion
                                    // sees the row at once.
                                    "@media (prefers-reduced-motion: reduce)": {
                                        animation: "none",
                                        opacity: 1,
                                    },
                                    transition: `background-color ${g.motion.fast} ${g.ease}`,
                                    "&:hover": { bgcolor: g.hover },
                                    "&:focus-visible": {
                                        ...focusRing,
                                        outlineOffset: "-2px",
                                    },
                                    "@keyframes fadeSlideIn": {
                                        from: {
                                            opacity: 0,
                                            transform: "translateY(8px)",
                                        },
                                        to: {
                                            opacity: 1,
                                            transform: "translateY(0)",
                                        },
                                    },
                                }}
                                onActivate={() => handleItemClick(item.itemId)}
                            >
                                <InboxBubble
                                    inboxItem={item}
                                    myself={myself}
                                    selected={isSelected}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useCM={useCM}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                    onItemChanged={onItemChanged}
                                />
                            </Clickable>
                        );
                    }}
                />
            ) : (
                <DataState
                    error={sync.failed}
                    hasData={false}
                    loading={sync.retrying}
                    skeleton={<SkeletonRows count={5} twoLines />}
                    empty={{
                        body: resolvedEmptySubtitle,
                        "data-empty": "inbox",
                        icon: isRequest ? <CheckCircleOutlineRoundedIcon /> : <InboxRoundedIcon />,
                        title: resolvedEmptyTitle,
                    }}
                    errorState={{
                        "data-error": "inbox",
                        onRetry: sync.retry,
                        title: t.common.feedback.sync.inboxFailed,
                    }}
                    fill
                />
            )}
        </Box>
    );
};
