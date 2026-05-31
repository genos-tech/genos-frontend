import { forwardRef, useEffect } from "react";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
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
        },
        ref
    ) => {
        const { mode } = useColorScheme();
        const { t } = useTranslation();
        const isDark = mode === "dark";
        const palette = isDark ? purplePalette.dark : purplePalette.light;
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
                                <Box
                                    key={`${itemKeyPrefix}-${item.itemId}`}
                                    sx={{
                                        px: 2,
                                        py: 0.75,
                                        cursor: "pointer",
                                        animation: "fadeSlideIn 0.3s ease-out forwards",
                                        animationDelay: `${Math.min(index * 0.05, 0.3)}s`,
                                        opacity: 0,
                                        borderRadius: "16px",
                                        mx: 0.5,
                                        background: isSelected
                                            ? isDark
                                                ? "rgba(139,92,246,0.08)"
                                                : "rgba(124,58,237,0.06)"
                                            : "transparent",
                                        outline: isSelected
                                            ? `2px solid ${isDark ? "rgba(139,92,246,0.3)" : "rgba(124,58,237,0.2)"}`
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
                                    onClick={() => handleItemClick(item.itemId)}
                                >
                                    <InboxBubble
                                        inboxItem={item}
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useCM={useCM}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                    />
                                </Box>
                            );
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            px: 3,
                            animation: "fadeIn 0.5s ease-out",
                            "@keyframes fadeIn": {
                                from: { opacity: 0 },
                                to: { opacity: 1 },
                            },
                        }}
                    >
                        {/* Empty State Illustration */}
                        <Box
                            sx={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isDark
                                    ? "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(139,92,246,0.08) 100%)"
                                    : "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.04) 100%)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(139,92,246,0.15)"
                                    : "rgba(124,58,237,0.1)",
                                mb: 2.5,
                                position: "relative",
                                "&::before": {
                                    content: '""',
                                    position: "absolute",
                                    inset: -8,
                                    borderRadius: "50%",
                                    border: "1px dashed",
                                    borderColor: isDark
                                        ? "rgba(139,92,246,0.15)"
                                        : "rgba(124,58,237,0.12)",
                                    animation: "rotate 20s linear infinite",
                                },
                                "@keyframes rotate": {
                                    from: { transform: "rotate(0deg)" },
                                    to: { transform: "rotate(360deg)" },
                                },
                            }}
                        >
                            {isRequest ? (
                                <CheckCircleOutlineRoundedIcon
                                    sx={{
                                        fontSize: 36,
                                        color: palette.accentSoft,
                                        opacity: 0.8,
                                    }}
                                />
                            ) : (
                                <InboxRoundedIcon
                                    sx={{
                                        fontSize: 36,
                                        color: palette.accentSoft,
                                        opacity: 0.8,
                                    }}
                                />
                            )}
                        </Box>

                        <Typography
                            level="title-md"
                            sx={{
                                fontWeight: 600,
                                color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                                mb: 0.5,
                                textAlign: "center",
                            }}
                        >
                            {resolvedEmptyTitle}
                        </Typography>
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                textAlign: "center",
                                maxWidth: 200,
                            }}
                        >
                            {resolvedEmptySubtitle}
                        </Typography>
                    </Box>
                )}
            </Box>
        );
    }
);

InboxSection.displayName = "InboxSection";
