import { forwardRef, useEffect } from "react";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { Clickable } from "../../../components/ui/Clickable";
import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { useTranslation } from "../../../i18n";
import { InboxSectionProps } from "../types/inboxTypes";
import { InboxBubble } from "./InboxBubble";

type InboxSectionExtendedProps = InboxSectionProps & {
    emptyTitle?: string;
    emptySubtitle?: string;
    isRequest?: boolean;
    selectedItemId?: number;
};

export const InboxSection = forwardRef<VirtuosoHandle, InboxSectionExtendedProps>(
    (
        {
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
        },
        ref
    ) => {
        const { mode } = useColorScheme();
        const { t } = useTranslation();
        const isDark = mode === "dark";
        const navigate = useNavigate();
        const basePath = isRequest ? "/workspace/inbox/requests" : "/workspace/inbox/activities";
        const resolvedEmptyTitle = emptyTitle ?? t.inbox.section.defaultEmptyTitle;
        const resolvedEmptySubtitle = emptySubtitle ?? t.inbox.section.defaultEmptySubtitle;

        // Scroll to selected item when it changes
        useEffect(() => {
            if (selectedItemId && ref && typeof ref !== "function" && ref.current) {
                const itemIndex = items.findIndex((item) => item.itemId === selectedItemId);
                if (itemIndex !== -1) {
                    ref.current.scrollToIndex({
                        index: itemIndex,
                        align: "center",
                        behavior: "smooth",
                    });
                }
            }
        }, [selectedItemId, items, ref]);

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
                        ref={ref}
                        atBottomThreshold={128}
                        atTopThreshold={64}
                        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                        initialTopMostItemIndex={0}
                        style={{ height: "100%" }}
                        totalCount={items.length}
                        itemContent={(index) => {
                            const item = items[index];
                            const isSelected = selectedItemId === item.itemId;
                            return (
                                <Clickable
                                    key={`${itemKeyPrefix}-${item.itemId}`}
                                    sx={{
                                        // Narrower gutters on a phone so the
                                        // card keeps its readable width.
                                        px: { xs: 1, md: 2 },
                                        py: 0.75,
                                        cursor: "pointer",
                                        animation: "fadeSlideIn 0.3s ease-out forwards",
                                        animationDelay: `${Math.min(index * 0.05, 0.3)}s`,
                                        opacity: 0,
                                        borderRadius: "16px",
                                        mx: 0.5,
                                        background: isSelected
                                            ? isDark
                                                ? "rgba(var(--gp-brandalt-500-rgb), 0.08)"
                                                : "rgba(var(--gp-brand-700-rgb), 0.06)"
                                            : "transparent",
                                        outline: isSelected
                                            ? `2px solid ${isDark ? "rgba(var(--gp-brandalt-500-rgb), 0.3)" : "rgba(var(--gp-brand-700-rgb), 0.2)"}`
                                            : "none",
                                        outlineOffset: "-2px",
                                        transition: "background 0.2s ease, outline 0.2s ease",
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
                    <EmptyState
                        body={resolvedEmptySubtitle}
                        data-empty="inbox"
                        icon={isRequest ? <CheckCircleOutlineRoundedIcon /> : <InboxRoundedIcon />}
                        title={resolvedEmptyTitle}
                        fill
                    />
                )}
            </Box>
        );
    }
);

InboxSection.displayName = "InboxSection";
