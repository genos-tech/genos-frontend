import { KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { Box, ListItem, ListItemButton } from "@mui/joy";
import type { ListItemButtonProps } from "@mui/joy/ListItemButton";
import type { SxProps } from "@mui/joy/styles/types";

import { g, type } from "../../../theme/tokens";
import {
    NAV_HOVER_MEDIA,
    NAV_ICON_SIZE,
    NAV_PAD_X,
    navFocusSx,
    navIndentLength,
    navRowSx,
} from "./navStyles";

/**
 * The one sidebar row (MIP-1127): chat, notes, tasks, projects, milestones,
 * Genos sessions, settings. See `navStyles.ts` for the rules it enforces.
 *
 *     [indent][chevron][icon][label / secondary ........][count][trailing][actions]
 *
 * Structure: an `li` (or `div`, see `as`) that carries the look, holding the
 * row's button and, as a SIBLING of it, the `actions` slot. A button inside a
 * button is invalid HTML and browsers don't reliably deliver the inner click,
 * so row actions (pin, star, "..." menu) never live inside the row button.
 *
 * Perf: no colour-scheme or context hook in here, so a row re-renders only
 * for its own props. Everything that follows the theme is a CSS variable.
 */
export type NavItemProps = {
    /** The row's text, or a node for a composite title (lock icon, chip...). */
    label?: ReactNode;
    /** A card-shaped row (activity feed, flagged messages): replaces the
     *  icon / label / secondary layout with the caller's own content, and
     *  keeps everything else: selection, unread, focus, hover, height floor. */
    children?: ReactNode;
    /** Leading icon or avatar. Plain SVG icons are sized to `NAV_ICON_SIZE`. */
    icon?: ReactNode;
    /** Second line under the label (needs `lines={2}`). */
    secondary?: ReactNode;
    /** Trailing count, quiet and tabular. */
    count?: ReactNode;
    /** Trailing content that is always visible (a timestamp, an unread dot). */
    trailing?: ReactNode;
    /** Row actions. Hidden until hover or keyboard focus on a pointer device,
     *  always shown on touch. Rendered beside the row button, not in it. */
    actions?: ReactNode;
    /** Keep `actions` shown: a menu is open, or the state they carry (a pin)
     *  has to stay visible. */
    actionsVisible?: boolean;
    selected?: boolean;
    /** Unread: bolder label and an accent bar on the row's leading edge. */
    unread?: boolean;
    /** Tree depth (a number of levels) or a CSS length. */
    indent?: number | string;
    /** Draws the expand chevron; `true` is open. Leave undefined for a leaf. */
    expanded?: boolean;
    /** A leaf in a tree where siblings have a chevron: keep their column. */
    reserveChevron?: boolean;
    /** Makes the chevron its own click target. Without it the row toggles. */
    onToggle?: (event: MouseEvent | KeyboardEvent) => void;
    /** `1`: one density row. `2`: a documented multiple, grows with content. */
    lines?: 1 | 2;
    /** `dashed` is a "new ..." affordance, an outline instead of a fill. */
    variant?: "default" | "dashed";
    /** `li` inside a List; `div` where the row sits in a wrapper `li`. */
    as?: "li" | "div";
    /** What `aria-current` says when selected: a page, or just the item. */
    current?: "page" | "true";
    /** Style of the row box (the look). Spacing or sizing overrides only. */
    sx?: SxProps;
    /** Style of the label text. */
    labelSx?: SxProps;
    /** Extra props for the row box: `data-testid`, drag attributes. */
    rootProps?: Record<string, unknown>;
    ref?: Ref<HTMLElement>;
} & Omit<ListItemButtonProps, "children" | "selected" | "sx" | "ref" | "color" | "variant">;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export const NavItem = ({
    label,
    children,
    icon,
    secondary,
    count,
    trailing,
    actions,
    actionsVisible = false,
    selected = false,
    unread = false,
    indent,
    expanded,
    reserveChevron = false,
    onToggle,
    lines = 1,
    variant = "default",
    as = "li",
    current = "true",
    sx,
    labelSx,
    rootProps,
    ref,
    onKeyDown,
    ...buttonProps
}: NavItemProps) => {
    const expandable = expanded !== undefined;
    const showChevronColumn = expandable || reserveChevron;
    const hasActions = actions !== undefined && actions !== null && actions !== false;

    // Right arrow opens, left closes: the tree keyboard idiom, and the only
    // keyboard route to a chevron that is a separate mouse target.
    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        onKeyDown?.(event as KeyboardEvent<HTMLDivElement>);
        if (event.defaultPrevented || !onToggle || !expandable) return;
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        const open = rtl ? "ArrowLeft" : "ArrowRight";
        const close = rtl ? "ArrowRight" : "ArrowLeft";
        if ((event.key === open && !expanded) || (event.key === close && expanded)) {
            event.preventDefault();
            onToggle(event);
        }
    };

    return (
        <ListItem
            ref={ref as Ref<HTMLLIElement>}
            component={as}
            data-selected={selected ? "true" : undefined}
            sx={
                [
                    navRowSx({ lines }),
                    {
                        // ListItem brings its own padding and nesting maths;
                        // the row owns all of it.
                        p: 0,
                        m: 0,
                        minWidth: 0,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        ...(variant === "dashed" && {
                            border: `1px dashed ${g.border.default}`,
                            [NAV_HOVER_MEDIA]: {
                                "&:hover": {
                                    background: "transparent",
                                    borderColor: g.accent.border,
                                    color: g.accent.text,
                                    "--Icon-color": g.accent.text,
                                },
                            },
                        }),
                        "&:focus-within .NavItem-actions": { opacity: 1 },
                        [NAV_HOVER_MEDIA]: {
                            "&:hover .NavItem-actions": { opacity: 1 },
                        },
                    },
                    ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
                ] as SxProps
            }
            {...rootProps}
        >
            {unread && (
                <Box
                    aria-hidden
                    className="NavItem-unread"
                    sx={{
                        position: "absolute",
                        insetInlineStart: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3,
                        height: "60%",
                        borderStartEndRadius: g.radius.xs,
                        borderEndEndRadius: g.radius.xs,
                        background: g.accent.solid,
                        pointerEvents: "none",
                    }}
                />
            )}
            <ListItemButton
                aria-current={selected ? current : undefined}
                aria-expanded={expandable ? expanded : undefined}
                color="neutral"
                variant="plain"
                {...buttonProps}
                sx={{
                    // The row box carries the look; the button fills it.
                    flex: 1,
                    minWidth: 0,
                    alignSelf: "stretch",
                    minHeight: 0,
                    m: 0,
                    paddingBlock: 0,
                    paddingInlineStart: `calc(${NAV_PAD_X}px + ${navIndentLength(indent)})`,
                    paddingInlineEnd: hasActions ? 0 : `${NAV_PAD_X}px`,
                    gap: 1,
                    borderRadius: "inherit",
                    background: "transparent",
                    color: "inherit",
                    font: "inherit",
                    letterSpacing: "inherit",
                    textAlign: "start",
                    alignItems: "center",
                    // Joy paints its own hover/active plate on the button with a
                    // selector that out-ranks ours; its variables are read first,
                    // so the row box (which carries the look) is the only plate.
                    "--variant-plainHoverBg": "transparent",
                    "--variant-plainActiveBg": "transparent",
                    "--variant-plainHoverColor": "inherit",
                    "&:hover, &:active": { background: "transparent", color: "inherit" },
                    ...navFocusSx,
                }}
                onKeyDown={handleKeyDown}
            >
                {showChevronColumn && (
                    <Box
                        aria-hidden
                        className="NavItem-chevron"
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: NAV_ICON_SIZE,
                            height: NAV_ICON_SIZE,
                            flexShrink: 0,
                            borderRadius: g.radius.xs,
                            visibility: expandable ? "visible" : "hidden",
                            color: g.text.tertiary,
                            ...(onToggle && {
                                cursor: "pointer",
                                [NAV_HOVER_MEDIA]: { "&:hover": { background: g.active } },
                            }),
                            "& svg": {
                                fontSize: NAV_ICON_SIZE,
                                color: "inherit",
                                transition: `transform ${g.motion.base} ${g.ease}`,
                                transform: expanded ? "rotate(90deg)" : "none",
                            },
                            "[dir='rtl'] & svg": {
                                transform: expanded ? "rotate(90deg)" : "scaleX(-1)",
                            },
                        }}
                        onClick={
                            onToggle
                                ? (event: MouseEvent) => {
                                      stop(event);
                                      onToggle(event);
                                  }
                                : undefined
                        }
                    >
                        <ChevronRightRounded />
                    </Box>
                )}

                {children !== undefined ? (
                    <Box
                        className="NavItem-content"
                        sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
                    >
                        {children}
                    </Box>
                ) : (
                    <>
                        {icon !== undefined && icon !== null && (
                            <Box
                                className="NavItem-icon"
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    "& > svg": { fontSize: NAV_ICON_SIZE },
                                }}
                            >
                                {icon}
                            </Box>
                        )}

                        <Box
                            className="NavItem-content"
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                            }}
                        >
                            <Box
                                className="NavItem-label"
                                sx={[
                                    {
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        fontWeight: unread ? 600 : "inherit",
                                        color: unread && !selected ? g.text.primary : "inherit",
                                    },
                                    ...(Array.isArray(labelSx)
                                        ? labelSx
                                        : labelSx
                                          ? [labelSx]
                                          : []),
                                ]}
                            >
                                {label}
                            </Box>
                            {secondary !== undefined && secondary !== null && (
                                <Box
                                    className="NavItem-secondary"
                                    sx={{
                                        ...type("body-xs"),
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        fontWeight: 400,
                                        color: g.text.tertiary,
                                    }}
                                >
                                    {secondary}
                                </Box>
                            )}
                        </Box>

                        {count !== undefined && count !== null && (
                            <Box
                                className="NavItem-count"
                                component="span"
                                sx={{
                                    ...type("caption"),
                                    flexShrink: 0,
                                    color: "inherit",
                                    opacity: 0.8,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {count}
                            </Box>
                        )}

                        {trailing !== undefined && trailing !== null && (
                            <Box
                                className="NavItem-trailing"
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    flexShrink: 0,
                                }}
                            >
                                {trailing}
                            </Box>
                        )}
                    </>
                )}
            </ListItemButton>

            {hasActions && (
                <Box
                    className="NavItem-actions"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        flexShrink: 0,
                        gap: 0.25,
                        paddingInlineEnd: 0.5,
                        opacity: actionsVisible ? 1 : 0,
                        transition: `opacity ${g.motion.fast} ${g.ease}`,
                        // No hover to reveal them on touch.
                        "@media (hover: none)": { opacity: 1 },
                    }}
                >
                    {actions}
                </Box>
            )}
        </ListItem>
    );
};
