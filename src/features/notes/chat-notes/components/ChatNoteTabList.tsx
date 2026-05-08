import { useCallback, useEffect, useRef, useState } from "react";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { Box, IconButton, Tab, TabList, Tooltip, Typography, useColorScheme } from "@mui/joy";

import { ChatNoteProps } from "../../../../types/notes";

interface ChatNoteTabListProps {
    tabItems: ChatNoteProps[];
    onCloseTab: (tabIndex: number, closingNoteId: number) => Promise<void>;
}

export const ChatNoteTabList = ({ tabItems, onCloseTab }: ChatNoteTabListProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const scrollStateRef = useRef({ left: false, right: false });
    const rafIdRef = useRef<number>(0);
    // Track the last tab's identity to detect when a new tab is added
    const getLastTabKey = (items: ChatNoteProps[]) =>
        items.length > 0
            ? `${items[items.length - 1].noteType}-${items[items.length - 1].noteId}`
            : "";
    const prevLastTabKeyRef = useRef<string>(getLastTabKey(tabItems));

    const checkScrollability = useCallback(() => {
        const el = scrollContainerRef.current;
        if (el) {
            const newCanScrollLeft = el.scrollLeft > 0;
            const newCanScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;

            // Only update state if values actually changed to prevent infinite loops
            if (scrollStateRef.current.left !== newCanScrollLeft) {
                scrollStateRef.current.left = newCanScrollLeft;
                setCanScrollLeft(newCanScrollLeft);
            }
            if (scrollStateRef.current.right !== newCanScrollRight) {
                scrollStateRef.current.right = newCanScrollRight;
                setCanScrollRight(newCanScrollRight);
            }
        }
    }, []);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        // Initial check with delay to ensure layout is complete
        const timeoutId = setTimeout(() => {
            checkScrollability();
        }, 100);

        const handleScroll = () => {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = requestAnimationFrame(checkScrollability);
        };

        el.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            clearTimeout(timeoutId);
            cancelAnimationFrame(rafIdRef.current);
            el.removeEventListener("scroll", handleScroll);
        };
    }, [checkScrollability]);

    // Effect to scroll to right when new tab is added (detected by last tab key change)
    const lastTabKey = getLastTabKey(tabItems);
    useEffect(() => {
        const el = scrollContainerRef.current;
        const prevLastTabKey = prevLastTabKeyRef.current;

        // Update the ref with current last tab key
        prevLastTabKeyRef.current = lastTabKey;

        // If the last tab changed and it's not empty, a new tab was added - scroll to the right
        if (lastTabKey !== prevLastTabKey && lastTabKey !== "" && prevLastTabKey !== "" && el) {
            const timeoutId = setTimeout(() => {
                el.scrollTo({
                    left: el.scrollWidth - el.clientWidth,
                    behavior: "smooth",
                });
                // Check scrollability after scrolling
                setTimeout(checkScrollability, 150);
            }, 100);
            return () => clearTimeout(timeoutId);
        } else {
            const timeoutId = setTimeout(() => {
                checkScrollability();
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [checkScrollability, lastTabKey]);

    const scroll = (direction: "left" | "right") => {
        const el = scrollContainerRef.current;
        if (el) {
            const scrollAmount = 200;
            el.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    const scrollButtonStyles = {
        position: "absolute" as const,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 10,
        "--IconButton-size": "28px",
        minWidth: 28,
        minHeight: 28,
        borderRadius: "50%",
        background: isDark
            ? "linear-gradient(135deg, rgba(40,40,40,0.95) 0%, rgba(30,30,30,0.95) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.98) 100%)",
        border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
        boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.1)",
        transition: "all 0.15s ease-in-out",
        "&:hover": {
            background: isDark
                ? "linear-gradient(135deg, rgba(50,50,50,0.98) 0%, rgba(40,40,40,0.98) 100%)"
                : "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(245,245,245,1) 100%)",
            boxShadow: isDark ? "0 4px 12px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.15)",
        },
    };

    return (
        <Box sx={{ position: "relative", display: "flex", alignItems: "center" }}>
            {/* Left scroll button */}
            {canScrollLeft && (
                <IconButton
                    size="sm"
                    variant="plain"
                    sx={{ ...scrollButtonStyles, left: 4 }}
                    onClick={() => scroll("left")}
                >
                    <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            )}

            {/* Scrollable container wrapper */}
            <Box
                ref={scrollContainerRef}
                sx={{
                    flex: 1,
                    overflow: "auto",
                    scrollBehavior: "smooth",
                    "&::-webkit-scrollbar": { display: "none" },
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                }}
            >
                <TabList
                    sx={{
                        display: "flex",
                        px: 1,
                        py: 0.5,
                        gap: 0.5,
                        background: isDark
                            ? "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 100%)"
                            : "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, transparent 100%)",
                        borderBottom: isDark
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "1px solid rgba(0,0,0,0.06)",
                        "--ListItem-radius": "8px",
                    }}
                >
                    {tabItems.map((tab, index) => (
                        <Tooltip
                            key={`tab-tooltip-${index}`}
                            arrow
                            placement="bottom"
                            size="sm"
                            title={tab.title}
                            variant="outlined"
                            sx={{
                                maxWidth: 280,
                                "& .MuiTooltip-arrow": {
                                    color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                                },
                            }}
                        >
                            <Tab
                                key={`tab-${tab.noteType}-${tab.noteId}`}
                                sx={{
                                    flex: "none",
                                    px: 1.5,
                                    py: 0.75,
                                    minHeight: 36,
                                    borderRadius: "8px",
                                    fontSize: "0.8125rem",
                                    fontWeight: 500,
                                    letterSpacing: "-0.01em",
                                    transition: "all 0.15s ease-in-out",
                                    border: "1px solid transparent",
                                    background: "transparent",
                                    color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(255,255,255,0.06)"
                                            : "rgba(0,0,0,0.04)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.8)"
                                            : "rgba(0,0,0,0.8)",
                                        "& .close-btn": {
                                            opacity: 1,
                                        },
                                    },
                                    "&.Mui-selected": {
                                        background: isDark
                                            ? "linear-gradient(135deg, rgba(129,140,248,0.16) 0%, rgba(99,102,241,0.10) 100%)"
                                            : "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(79,70,229,0.06) 100%)",
                                        border: isDark
                                            ? "1px solid rgba(129,140,248,0.28)"
                                            : "1px solid rgba(99,102,241,0.20)",
                                        color: isDark ? "#a5b4fc" : "#4f46e5",
                                        boxShadow: isDark
                                            ? "0 2px 8px rgba(0,0,0,0.3)"
                                            : "0 2px 8px rgba(99,102,241,0.18)",
                                        "& .tab-icon": {
                                            color: isDark ? "#a5b4fc" : "#6366f1",
                                        },
                                        "& .close-btn": {
                                            opacity: 1,
                                        },
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        maxWidth: 180,
                                    }}
                                >
                                    <DescriptionOutlinedIcon
                                        className="tab-icon"
                                        sx={{
                                            fontSize: 16,
                                            color: isDark
                                                ? "rgba(255,255,255,0.4)"
                                                : "rgba(0,0,0,0.4)",
                                            transition: "color 0.15s ease-in-out",
                                            flexShrink: 0,
                                        }}
                                    />
                                    <Typography
                                        level="body-sm"
                                        noWrap
                                        sx={{
                                            fontSize: "inherit",
                                            fontWeight: "inherit",
                                            color: "inherit",
                                            maxWidth: 120,
                                        }}
                                    >
                                        {tab.title}
                                    </Typography>

                                    <IconButton
                                        className="close-btn"
                                        color="neutral"
                                        component="span"
                                        size="sm"
                                        variant="plain"
                                        sx={{
                                            "--IconButton-size": "20px",
                                            minWidth: 20,
                                            minHeight: 20,
                                            ml: 0.5,
                                            opacity: 0,
                                            transition: "all 0.15s ease-in-out",
                                            borderRadius: "6px",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(255,255,255,0.1)"
                                                    : "rgba(0,0,0,0.08)",
                                            },
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCloseTab(index, Number(tab.noteId));
                                        }}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Box>
                            </Tab>
                        </Tooltip>
                    ))}
                </TabList>
            </Box>

            {/* Right scroll button */}
            {canScrollRight && (
                <IconButton
                    size="sm"
                    variant="plain"
                    sx={{ ...scrollButtonStyles, right: 4 }}
                    onClick={() => scroll("right")}
                >
                    <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            )}
        </Box>
    );
};
