import { useCallback, useEffect, useRef, useState } from "react";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import {
    Box,
    IconButton,
    Tab,
    TabList,
    Tabs,
    Tooltip,
    Typography,
    useColorScheme,
} from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

interface TaskNoteTabsProps {
    useNM: NoteManagementState;
    onCloseTab: (tabIndex: number, closingNoteId: number) => void;
}

// Tab strip for the task-notes view. The editor body (title input,
// "saved" chip, BlockNote editor) used to live in this component but
// has been lifted into `TaskNoteEditorPanel`, rendered once per live
// tab by the editor pool in `NoteContentRenderer` so cross-tab switches
// don't remount the editor.
export const TaskNoteTabs = ({ useNM, onCloseTab }: TaskNoteTabsProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const scrollStateRef = useRef({ left: false, right: false });
    const rafIdRef = useRef<number>(0);

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

    // Keep the active tab visible in the strip. Fires whenever the
    // active selection changes (new tab opened → becomes active,
    // existing tab clicked, tab closed → neighbour promotes) or the
    // tab count changes. Replaces the old "scroll to right end on new
    // tab" effect, which missed clicks on existing off-screen tabs.
    const selectedTabIndex = useNM.selectedTabIndex;
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        if (selectedTabIndex < 0) return;

        const timeoutId = setTimeout(() => {
            const target =
                container.querySelectorAll<HTMLElement>('[role="tab"]')[selectedTabIndex];
            if (!target) {
                checkScrollability();
                return;
            }
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
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
            setTimeout(checkScrollability, 150);
        }, 80);
        return () => clearTimeout(timeoutId);
    }, [checkScrollability, selectedTabIndex, useNM.tabItems.length]);

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
        <Tabs
            sx={{ width: "100%" }}
            value={useNM.selectedTabIndex}
            onChange={(_, val) => {
                const next = useNM.tabsApi.tabs[Number(val)];
                if (next) useNM.tabsApi.switchTab(next.id);
            }}
        >
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
                                        color: isDark
                                            ? "rgba(255,255,255,0.1)"
                                            : "rgba(0,0,0,0.05)",
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
                                        color: isDark
                                            ? "rgba(255,255,255,0.55)"
                                            : "rgba(0,0,0,0.55)",
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
                                            onClick={(e: React.MouseEvent) => {
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
        </Tabs>
    );
};
