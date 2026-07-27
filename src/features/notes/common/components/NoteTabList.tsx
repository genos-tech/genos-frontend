import { useEffect, useRef, useState } from "react";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { Box, IconButton, Tab, TabList, Tooltip, Typography, useColorScheme } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

interface NoteTabListProps {
    useNM: NoteManagementState;
    onCloseTab: (tabIndex: number, closingNoteId: number) => void;
}

export const NoteTabList = ({ useNM, onCloseTab }: NoteTabListProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const tabListRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Use refs to track state without triggering re-renders during checks
    const scrollStateRef = useRef({ left: false, right: false });
    const checkScheduledRef = useRef(false);
    const lastCheckTimeRef = useRef(0);

    // Single effect that handles all scroll detection
    useEffect(() => {
        const container = scrollContainerRef.current;
        const tabList = tabListRef.current;
        if (!container) return;

        // Debounced scroll check that won't cause infinite loops
        const performCheck = () => {
            const now = Date.now();
            // Minimum 200ms between state updates to prevent rapid cycling
            if (now - lastCheckTimeRef.current < 200) {
                return;
            }

            const scrollLeft = container.scrollLeft;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;

            // Use 5px tolerance to prevent edge-case flickering
            const newCanScrollLeft = scrollLeft > 5;
            const newCanScrollRight = scrollLeft < scrollWidth - clientWidth - 5;

            // Only update if both values are stable and different from current state
            if (
                scrollStateRef.current.left !== newCanScrollLeft ||
                scrollStateRef.current.right !== newCanScrollRight
            ) {
                scrollStateRef.current.left = newCanScrollLeft;
                scrollStateRef.current.right = newCanScrollRight;
                lastCheckTimeRef.current = now;

                // Use functional updates to avoid stale closures
                setCanScrollLeft(newCanScrollLeft);
                setCanScrollRight(newCanScrollRight);
            }

            checkScheduledRef.current = false;
        };

        const scheduleCheck = () => {
            if (checkScheduledRef.current) return;
            checkScheduledRef.current = true;
            // Use setTimeout instead of rAF for more predictable timing
            setTimeout(performCheck, 50);
        };

        // Initial check after mount with longer delay
        const initialTimeout = setTimeout(scheduleCheck, 300);

        // Scroll handler
        const handleScroll = () => {
            scheduleCheck();
        };

        // ResizeObserver for container size changes (including when tabs are added/removed)
        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined" && tabList) {
            resizeObserver = new ResizeObserver(() => {
                scheduleCheck();
            });
            resizeObserver.observe(tabList);
        }

        container.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            clearTimeout(initialTimeout);
            checkScheduledRef.current = false;
            container.removeEventListener("scroll", handleScroll);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, []); // Empty dependency array - only run on mount/unmount

    // Keep the active tab visible in the strip. Fires whenever the
    // active selection changes (new tab opened → becomes active,
    // existing tab clicked, tab closed → neighbour promotes) or the
    // tab count changes (so removal-induced index shifts also recenter).
    // Replaces the old "scroll to right end on new tab" effect, which
    // missed two important cases:
    //   - clicking an existing tab off-screen
    //   - opening a tab that's not at the strip's right edge
    // Joy renders each Tab as `<button role="tab">`, so we locate the
    // target by index without threading per-tab refs through every Tab.
    useEffect(() => {
        const container = scrollContainerRef.current;
        const tabList = tabListRef.current;
        if (!container || !tabList) return;
        const idx = useNM.selectedTabIndex;
        if (idx < 0) return;

        const timeoutId = setTimeout(() => {
            const target = tabList.querySelectorAll<HTMLElement>('[role="tab"]')[idx];
            if (!target) return;
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            // 12px padding so the active tab isn't flush against the
            // scroll button / edge — keeps the close-X hoverable.
            const padding = 12;
            if (targetRect.left < containerRect.left + padding) {
                container.scrollTo({
                    left: container.scrollLeft + (targetRect.left - containerRect.left) - padding,
                    behavior: "smooth",
                });
            } else if (targetRect.right > containerRect.right - padding) {
                container.scrollTo({
                    left:
                        container.scrollLeft + (targetRect.right - containerRect.right) + padding,
                    behavior: "smooth",
                });
            }
            // Tabs that are already visible: no scroll needed.
        }, 80);
        return () => clearTimeout(timeoutId);
    }, [useNM.selectedTabIndex, useNM.tabItems.length]);

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
                    sx={{ ...scrollButtonStyles, left: 4 }}
                    variant="plain"
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
                    ref={tabListRef}
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
                    {useNM.tabItems.map((tab, index) => (
                        <Tooltip
                            key={`tab-tooltip-${index}`}
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
                            arrow
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
                                            ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.16) 0%, rgba(var(--gp-brand-700-rgb), 0.10) 100%)"
                                            : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.12) 0%, rgba(var(--gp-brand-700-rgb), 0.06) 100%)",
                                        border: isDark
                                            ? "1px solid rgba(var(--gp-brand-700-rgb), 0.28)"
                                            : "1px solid rgba(var(--gp-brand-700-rgb), 0.20)",
                                        color: isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-800)",
                                        boxShadow: isDark
                                            ? "0 2px 8px rgba(0,0,0,0.3)"
                                            : "0 2px 8px rgba(var(--gp-brand-700-rgb), 0.18)",
                                        "& .tab-icon": {
                                            color: isDark
                                                ? "var(--gp-brandalt-400)"
                                                : "var(--gp-brand-700)",
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
                                        sx={{
                                            fontSize: "inherit",
                                            fontWeight: "inherit",
                                            color: "inherit",
                                            maxWidth: 120,
                                        }}
                                        noWrap
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
                    sx={{ ...scrollButtonStyles, right: 4 }}
                    variant="plain"
                    onClick={() => scroll("right")}
                >
                    <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            )}
        </Box>
    );
};
