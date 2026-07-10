import { useCallback, useEffect, useRef, useState } from "react";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import { Box, IconButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { createPortal } from "react-dom";

import { useTranslation } from "../../i18n";

export type MoreMenuItem = {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    /** Defaults to true. When false (or undefined-falsy), the item is hidden. */
    visible?: boolean;
    /** Renders the item with the red palette and a divider above it. */
    danger?: boolean;
    /** Highlights the item with the accent color and adds the right-edge dot. */
    active?: boolean;
};

export type MoreMenuProps = {
    items: MoreMenuItem[];
    /** Aligns the menu's right edge to the trigger when "bottom-end". Default: "bottom-start". */
    placement?: "bottom-start" | "bottom-end";
    /** Width/height of the trigger button in px. Default: 28. */
    triggerSize?: number;
    /** Extra sx merged onto the trigger IconButton (after the default purple style). */
    triggerSx?: Record<string, any>;
    /** Default: 200. */
    menuMinWidth?: number;
    ariaLabel?: string;
    /** Trigger icon font size. Default: 18. */
    iconFontSize?: number;
    /** Notified when the menu opens (`true`) or closes (`false`). */
    onOpenChange?: (open: boolean) => void;
    /** Stacking level of the dropdown portal. Default 9999 — fine on
     *  page surfaces, but a menu triggered from inside a higher layer
     *  (e.g. the UrlLinkModal at 10020) must pass its host's z + 1 or
     *  the dropdown opens invisibly BEHIND the host. */
    zIndex?: number;
};

// Single purple accent for all non-danger items.
const ACCENT = {
    light: "#6366f1",
    dark: "#a5b4fc",
    hoverBgLight: "rgba(99,102,241,0.10)",
    hoverBgDark: "rgba(99,102,241,0.20)",
    iconBoxBgLight: "rgba(99,102,241,0.10)",
    iconBoxBgDark: "rgba(99,102,241,0.18)",
};

const DANGER = {
    light: "#dc2626",
    dark: "#f87171",
    hoverBgLight: "rgba(220,38,38,0.12)",
    hoverBgDark: "rgba(248,113,113,0.18)",
};

export const MoreMenu = ({
    items,
    placement = "bottom-start",
    triggerSize = 28,
    triggerSx,
    menuMinWidth = 200,
    ariaLabel,
    iconFontSize = 18,
    onOpenChange,
    zIndex = 9999,
}: MoreMenuProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const resolvedAriaLabel = ariaLabel ?? t.common.ui.moreMenu.ariaLabel;

    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const visibleItems = items.filter((item) => item.visible !== false);

    const updateMenuPosition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const menuWidth = menuMinWidth;
        const menuHeight = Math.max(40, visibleItems.length * 50 + 16);
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top = rect.bottom + 6;
        let left = placement === "bottom-end" ? rect.right - menuWidth : rect.left;

        if (left < 8) {
            left = 8;
        } else if (left + menuWidth > viewportWidth - 8) {
            left = viewportWidth - menuWidth - 8;
        }

        if (top + menuHeight > viewportHeight - 8) {
            top = rect.top - menuHeight - 6;
        }

        setMenuPosition({ top, left });
    }, [menuMinWidth, placement, visibleItems.length]);

    const openMenu = () => {
        updateMenuPosition();
        setIsOpen(true);
        setFocusedIndex(0);
        onOpenChange?.(true);
    };

    const closeMenu = () => {
        setIsOpen(false);
        setFocusedIndex(-1);
        onOpenChange?.(false);
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleUpdate = () => {
            updateMenuPosition();
        };
        window.addEventListener("scroll", handleUpdate, true);
        window.addEventListener("resize", handleUpdate);
        return () => {
            window.removeEventListener("scroll", handleUpdate, true);
            window.removeEventListener("resize", handleUpdate);
        };
    }, [isOpen, updateMenuPosition]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                menuRef.current &&
                !menuRef.current.contains(target) &&
                buttonRef.current &&
                !buttonRef.current.contains(target)
            ) {
                closeMenu();
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;
            const count = visibleItems.length;
            switch (event.key) {
                case "Escape":
                    closeMenu();
                    buttonRef.current?.focus();
                    break;
                case "ArrowDown":
                    event.preventDefault();
                    setFocusedIndex((prev) => (count === 0 ? -1 : (prev + 1) % count));
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    setFocusedIndex((prev) => (count === 0 ? -1 : (prev - 1 + count) % count));
                    break;
                case "Enter":
                case " ":
                    event.preventDefault();
                    if (focusedIndex >= 0 && focusedIndex < count) {
                        visibleItems[focusedIndex].onClick();
                        closeMenu();
                    }
                    break;
                case "Tab":
                    closeMenu();
                    break;
            }
        };
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, focusedIndex, visibleItems]);

    const dropdownMenu = isOpen
        ? createPortal(
              <Box
                  ref={menuRef}
                  aria-orientation="vertical"
                  role="menu"
                  sx={{
                      position: "fixed",
                      top: menuPosition.top,
                      left: menuPosition.left,
                      zIndex,
                      minWidth: menuMinWidth,
                      py: 0.75,
                      borderRadius: "14px",
                      background: isDark
                          ? "linear-gradient(145deg, rgba(32,32,42,0.98) 0%, rgba(24,24,34,0.98) 100%)"
                          : "linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(250,251,253,0.99) 100%)",
                      backdropFilter: "blur(24px) saturate(180%)",
                      border: "1px solid",
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                      boxShadow: isDark
                          ? "0 12px 48px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
                          : "0 12px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
                      animation: "moreMenuSlideIn 0.18s cubic-bezier(0.32, 0.72, 0, 1) forwards",
                      transformOrigin: "top center",
                      "@keyframes moreMenuSlideIn": {
                          from: {
                              opacity: 0,
                              transform: "scale(0.95) translateY(-6px)",
                          },
                          to: {
                              opacity: 1,
                              transform: "scale(1) translateY(0)",
                          },
                      },
                  }}
                  onClick={(e) => e.stopPropagation()}
              >
                  {visibleItems.map((item, index) => {
                      const isFocused = focusedIndex === index;
                      const palette = item.danger ? DANGER : ACCENT;
                      const accentColor = isDark ? palette.dark : palette.light;
                      const hoverBg = isDark ? palette.hoverBgDark : palette.hoverBgLight;
                      const iconBoxBg = item.danger
                          ? isDark
                              ? palette.hoverBgDark
                              : palette.hoverBgLight
                          : isDark
                            ? ACCENT.iconBoxBgDark
                            : ACCENT.iconBoxBgLight;

                      const restingTextColor = item.danger
                          ? accentColor
                          : isDark
                            ? "rgba(255,255,255,0.9)"
                            : "rgba(15,23,42,0.85)";

                      const showAsHighlighted = item.active || isFocused;
                      const textColor = showAsHighlighted ? accentColor : restingTextColor;
                      const itemBg = showAsHighlighted ? hoverBg : "transparent";

                      return (
                          <Box key={item.id}>
                              {item.danger && index > 0 && (
                                  <Box
                                      sx={{
                                          height: "1px",
                                          mx: 1.5,
                                          my: 0.5,
                                          background: isDark
                                              ? "rgba(255,255,255,0.08)"
                                              : "rgba(0,0,0,0.06)",
                                      }}
                                  />
                              )}
                              <Box
                                  role="menuitem"
                                  tabIndex={isFocused ? 0 : -1}
                                  sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1.5,
                                      px: 1.5,
                                      py: 1,
                                      mx: 0.75,
                                      my: 0.25,
                                      borderRadius: "10px",
                                      minHeight: 40,
                                      cursor: "pointer",
                                      outline: "none",
                                      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                      color: textColor,
                                      background: itemBg,
                                      transform: isFocused ? "translateX(3px)" : "none",
                                      "&:hover": {
                                          background: hoverBg,
                                          color: accentColor,
                                          transform: "translateX(3px)",
                                      },
                                      "&:active": {
                                          transform: "translateX(3px) scale(0.98)",
                                      },
                                  }}
                                  onMouseEnter={() => setFocusedIndex(index)}
                                  onClick={() => {
                                      item.onClick();
                                      closeMenu();
                                  }}
                              >
                                  <Box
                                      sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: 30,
                                          height: 30,
                                          borderRadius: "8px",
                                          background: showAsHighlighted
                                              ? iconBoxBg
                                              : "transparent",
                                          transition: "all 0.15s ease",
                                          flexShrink: 0,
                                      }}
                                  >
                                      {item.icon}
                                  </Box>
                                  <Typography
                                      level="body-sm"
                                      sx={{
                                          fontWeight: 500,
                                          fontSize: "0.875rem",
                                          letterSpacing: "-0.01em",
                                          color: "inherit",
                                          flex: 1,
                                          userSelect: "none",
                                      }}
                                  >
                                      {item.label}
                                  </Typography>
                                  {item.active && (
                                      <Box
                                          sx={{
                                              width: 7,
                                              height: 7,
                                              borderRadius: "50%",
                                              background: accentColor,
                                              boxShadow: `0 0 10px ${accentColor}50`,
                                              flexShrink: 0,
                                          }}
                                      />
                                  )}
                              </Box>
                          </Box>
                      );
                  })}
              </Box>,
              document.body
          )
        : null;

    return (
        <Box sx={{ position: "relative" }}>
            <IconButton
                ref={buttonRef}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label={resolvedAriaLabel}
                size="sm"
                sx={{
                    width: triggerSize,
                    height: triggerSize,
                    minWidth: triggerSize,
                    minHeight: triggerSize,
                    borderRadius: "8px",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    color: isOpen
                        ? isDark
                            ? ACCENT.dark
                            : ACCENT.light
                        : isDark
                          ? "rgba(255,255,255,0.55)"
                          : "rgba(0,0,0,0.45)",
                    background: isOpen
                        ? isDark
                            ? "rgba(99,102,241,0.22)"
                            : "rgba(99,102,241,0.12)"
                        : "transparent",
                    "&:hover": {
                        background: isDark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.15)",
                        color: isDark ? ACCENT.dark : ACCENT.light,
                        transform: "scale(1.08)",
                    },
                    "&:focus-visible": {
                        background: isDark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.15)",
                        color: isDark ? ACCENT.dark : ACCENT.light,
                        outline: "2px solid",
                        outlineColor: isDark ? ACCENT.dark : ACCENT.light,
                        outlineOffset: "2px",
                    },
                    "&:active": {
                        transform: "scale(0.95)",
                    },
                    ...(triggerSx ?? {}),
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isOpen) {
                        closeMenu();
                    } else {
                        openMenu();
                    }
                }}
            >
                <MoreHorizRoundedIcon sx={{ fontSize: iconFontSize }} />
            </IconButton>
            {dropdownMenu}
        </Box>
    );
};
