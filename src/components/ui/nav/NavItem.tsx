import { KeyboardEvent, MouseEvent, ReactNode, Ref, SyntheticEvent } from "react";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { Box, ListItem, ListItemButton } from "@mui/joy";
import type { ListItemButtonProps } from "@mui/joy/ListItemButton";
import type { SxProps } from "@mui/joy/styles/types";

import { g, type } from "../../../theme/tokens";
import {
    NAV_HIDE_ON_ACTIONS_CLASS,
    NAV_HOVER_MEDIA,
    NAV_ICON_SIZE,
    NAV_KEEP_CLASS,
    NAV_OVERLAY_BG,
    NAV_OVERLAY_FADE,
    NAV_PAD_X,
    NAV_ROW_GAP,
    navButtonPlateOffSx,
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
    /** Actions take NO room until they show, and replace the content marked
     *  `NAV_HIDE_ON_ACTIONS_CLASS` (a timestamp) while they do: no empty
     *  column at rest, the same width either way. An action with
     *  `NAV_KEEP_CLASS` (a lit pin) shows at rest too, beside what stays. */
    actionsInPlace?: boolean;
    /** Actions that overlay the row's end instead of sitting in it: out of flow, so they
     *  take NO width and the title does not move when they appear. For rows with two lines
     *  or crowded ends (milestones, folders). Hidden until the row is hovered, keyboard
     *  focused (the keyboard ring, not a mouse click) or a menu in them is open; the
     *  buttons keep a background of the row's hover colour (opaque) and a fade to their left.
     *  On touch they are always shown and the row keeps `reserve` (default 32px) free at
     *  its end for them, through `--nav-actions-reserve`, which a container query on the
     *  row can set back to 0 (a narrow list: title room is scarcer than chip room).
     *  `top` is where the actions centre (default: the row's middle), `end` how far they
     *  sit from the row's end. */
    actionsOverlay?: boolean | { top?: string; end?: string; reserve?: string };
    /** Keep `actions` shown: a menu is open. (An action that carries state, a
     *  lit star or a pin, stays visible by itself: give it `NAV_KEEP_CLASS`.) */
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
    onToggleExpanded?: (event: SyntheticEvent) => void;
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

// `actionsInPlace`: a hidden action leaves the layout (absolute, invisible, not
// clickable) but stays focusable; showing it puts it back in the flow.
const ACTION_OUT_OF_FLOW = { position: "absolute", pointerEvents: "none" } as const;
const ACTION_IN_FLOW = { position: "static", pointerEvents: "auto" } as const;

export const NavItem = ({
    label,
    children,
    icon,
    secondary,
    count,
    trailing,
    actions,
    actionsVisible = false,
    actionsInPlace = false,
    actionsOverlay = false,
    selected = false,
    unread = false,
    indent,
    expanded,
    reserveChevron = false,
    onToggleExpanded,
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
    const overlay =
        hasActions && actionsOverlay ? (actionsOverlay === true ? {} : actionsOverlay) : null;

    // Right arrow opens, left closes: the tree keyboard idiom, and the only
    // keyboard route to a chevron that is a separate mouse target.
    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        onKeyDown?.(event as KeyboardEvent<HTMLDivElement>);
        // Only for the row itself: arrows inside something it contains (an input) are theirs.
        if (event.target !== event.currentTarget) return;
        if (event.defaultPrevented || !onToggleExpanded || !expandable) return;
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        const open = rtl ? "ArrowLeft" : "ArrowRight";
        const close = rtl ? "ArrowRight" : "ArrowLeft";
        if ((event.key === open && !expanded) || (event.key === close && expanded)) {
            event.preventDefault();
            onToggleExpanded(event);
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
                        marginBlock: `${NAV_ROW_GAP}px`,
                        marginInline: 0,
                        minWidth: 0,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        ...(variant === "dashed" && { border: `1px dashed ${g.border.default}` }),
                        ...(!overlay && { "&:focus-within .NavItem-actions > *": { opacity: 1 } }),
                        ...(overlay && {
                            // The keyboard ring on the row button, an action's own focus ring, or
                            // an open menu. Not `:focus-within`: a mouse click on the row would
                            // leave the actions showing. Not `:has()` (MIP-963).
                            [`& > .Mui-focusVisible ~ .NavItem-actions button, & .NavItem-actions button:focus-visible, & .NavItem-actions button[aria-expanded="true"]`]:
                                { opacity: 1, pointerEvents: "auto" },
                            // Touch has no hover: the actions are always there, in their own space.
                            "@media (hover: none)": {
                                "--nav-actions-reserve": overlay.reserve ?? "32px",
                                "--nav-actions-bg": "transparent",
                                "--nav-actions-fade": "none",
                            },
                        }),
                        ...(actionsInPlace && {
                            "&:focus-within .NavItem-actions > *": {
                                opacity: 1,
                                ...ACTION_IN_FLOW,
                            },
                            [`&:focus-within .${NAV_HIDE_ON_ACTIONS_CLASS}`]: { display: "none" },
                        }),
                        // ONE hover key: a second `[NAV_HOVER_MEDIA]` would replace this one.
                        [NAV_HOVER_MEDIA]: {
                            ...(!overlay && { "&:hover .NavItem-actions > *": { opacity: 1 } }),
                            ...(overlay && {
                                "&:hover .NavItem-actions button": {
                                    opacity: 1,
                                    pointerEvents: "auto",
                                },
                            }),
                            ...(actionsInPlace && {
                                "&:hover .NavItem-actions > *": {
                                    opacity: 1,
                                    ...ACTION_IN_FLOW,
                                },
                                [`&:hover .${NAV_HIDE_ON_ACTIONS_CLASS}`]: { display: "none" },
                            }),
                            ...(variant === "dashed" && {
                                "&:hover": {
                                    background: "transparent",
                                    borderColor: g.accent.border,
                                    color: g.accent.text,
                                    "--Icon-color": g.accent.text,
                                },
                            }),
                        },
                    },
                    ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
                ] as SxProps
            }
            {...rootProps}
        >
            {unread && (
                <Box
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
                    aria-hidden
                />
            )}
            <ListItemButton
                // `selected` also puts Joy's Mui-selected class on the button: tests and
                // a few selectors outside the row key on it. Its plate is off (below).
                aria-current={selected ? current : undefined}
                aria-expanded={expandable ? expanded : undefined}
                color="neutral"
                selected={selected}
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
                    // `--nav-pad-end` lets a crowded list (the milestone tree below 200px)
                    // take a smaller end padding for all of its rows at once.
                    paddingInlineEnd: overlay
                        ? `calc(var(--nav-pad-end, ${NAV_PAD_X}px) + var(--nav-actions-reserve, 0px))`
                        : hasActions && !actionsInPlace
                          ? 0
                          : `var(--nav-pad-end, ${NAV_PAD_X}px)`,
                    // `--nav-gap`: a crowded list (the milestone tree below 200px) narrows it for all rows.
                    gap: `var(--nav-gap, 8px)`,
                    borderRadius: "inherit",
                    // Joy paints its own hover/active plate on the button; the row
                    // box (which carries the look) is the only plate.
                    ...navButtonPlateOffSx,
                    font: "inherit",
                    letterSpacing: "inherit",
                    textAlign: "start",
                    alignItems: "center",
                    ...navFocusSx,
                }}
                onKeyDown={handleKeyDown}
            >
                {showChevronColumn && (
                    <Box
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
                            ...(onToggleExpanded && {
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
                        aria-hidden
                        onClick={
                            onToggleExpanded
                                ? (event: MouseEvent) => {
                                      stop(event);
                                      onToggleExpanded(event);
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
                    sx={
                        overlay
                            ? {
                                  position: "absolute",
                                  top: overlay.top ?? "50%",
                                  insetInlineEnd:
                                      overlay.end ?? `var(--nav-pad-end, ${NAV_PAD_X}px)`,
                                  transform: "translateY(-50%)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  // The wrapper never takes a click itself: a hidden action
                                  // cannot block the row. Opacity and pointer events sit on
                                  // the BUTTONS (an opacity-0 wrapper would hide them in
                                  // every state), which stay in the tab order.
                                  pointerEvents: "none",
                                  "& button": {
                                      opacity: actionsVisible ? 1 : 0,
                                      pointerEvents: actionsVisible ? "auto" : "none",
                                      transition: "opacity 0.12s",
                                      "--IconButton-size": "28px",
                                      backgroundColor: `var(--nav-actions-bg, ${NAV_OVERLAY_BG})`,
                                      boxShadow: `var(--nav-actions-fade, ${NAV_OVERLAY_FADE})`,
                                  },
                                  "@media (hover: none)": {
                                      "& button": {
                                          opacity: 1,
                                          pointerEvents: "auto",
                                          "--IconButton-size": "32px",
                                      },
                                  },
                              }
                            : {
                                  display: "inline-flex",
                                  alignItems: "center",
                                  flexShrink: 0,
                                  gap: 0.25,
                                  paddingInlineEnd: 0.5,
                                  // Each action fades; one that carries state (a lit star)
                                  // opts out with NAV_KEEP_CLASS and stays put.
                                  [`& > *:not(.${NAV_KEEP_CLASS})`]: {
                                      opacity: actionsVisible ? 1 : 0,
                                      transition: `opacity ${g.motion.fast} ${g.ease}`,
                                      // In place: no room while hidden, but still in the tab order
                                      // (a `display: none` button cannot be focused, and focus is
                                      // what reveals it for a keyboard user).
                                      ...(actionsInPlace &&
                                          (actionsVisible ? ACTION_IN_FLOW : ACTION_OUT_OF_FLOW)),
                                  },
                                  ...(actionsInPlace &&
                                      actionsVisible && {
                                          [`.${NAV_HIDE_ON_ACTIONS_CLASS}`]: { display: "none" },
                                      }),
                                  // No hover to reveal them on touch.
                                  "@media (hover: none)": {
                                      "& > *": {
                                          opacity: 1,
                                          ...(actionsInPlace && ACTION_IN_FLOW),
                                      },
                                  },
                              }
                    }
                >
                    {actions}
                </Box>
            )}
        </ListItem>
    );
};
