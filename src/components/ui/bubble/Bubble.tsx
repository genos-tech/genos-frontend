import { forwardRef, ReactNode, Ref } from "react";
import { Box, Typography } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import { focusRing, g, type } from "../../../theme/tokens";
import { invisibleHitAreaSx } from "../touchTargets";
import { BUBBLE_AVATAR_SIZE, BUBBLE_TOOLBAR_OFFSET } from "./bubbleMetrics";

/**
 * The one message / comment surface (MIP-1130, part of MIP-1106).
 *
 * Chat, thread replies, task comments, the inbox and the note comment list used
 * to be seven renderers, each with its own radius, shadow, meta style and hover
 * toolbar, and only three of them shared a palette. This is the shared frame;
 * what goes IN it (the author line, the body, reactions, the actions) stays the
 * caller's, because that is where the surfaces really differ.
 *
 * WHAT IT OWNS
 *  - the two looks of the user's bubble-style preference (`layout`): "compact"
 *    (a full-width row on the page, the default) and "bubble" (a balloon that
 *    is tinted when it is yours);
 *  - the deep-link / open-thread emphasis, the selected state and the hover fill;
 *  - the floating actions toolbar: one place (top-right), one look, or, for a
 *    long answer that is read to the end (`actionsPosition="bottom"`), the same
 *    actions as a quiet row under the body;
 *  - the avatar gutter, and `BubbleAuthor` / `BubbleMeta`, the one author line
 *    and meta text.
 *
 * WHAT IT DOES NOT DO
 *  - read a context, hold state or subscribe to anything. It is a plain
 *    component, so a row costs exactly what the hand-written Box it replaces
 *    cost: the memo boundary stays where it was, on the caller (MIP-904).
 *    `layout` is a prop: the caller reads `useBubbleStylePreference()`.
 *  - decide when the toolbar shows. `actionsOpen` is the caller's hover /
 *    long-press / menu-open state, kept mounted while a menu is open.
 *
 * COLOR comes from tokens only (`g.*`), so light/dark and the seven themes are
 * resolved in CSS and a bubble never branches on the mode.
 */

/** Gap between the avatar column and the text. */
const GUTTER_GAP = 12;

/** The avatar opens a profile: 32px drawn, a 44px tap on a phone (MIP-1394). The area reaches 6px
 *  past the avatar, inside the 12px gutter gap and the 4px under the header line. */
const AVATAR_HIT_AREA = invisibleHitAreaSx("& [role='button']");

export type BubbleLayout = "compact" | "bubble";
/** A deep-link target ("focused") or the root of the open thread ("threadActive"). */
export type BubbleEmphasis = "focused" | "threadActive";

export type BubbleProps = {
    /** The bubble-style preference. */
    layout: BubbleLayout;
    /** Bubble layout only: your own messages are tinted with the accent. */
    side?: "sent" | "received";
    emphasis?: BubbleEmphasis | false;
    /** A picked row (the note comment list). Not the same as `emphasis`. */
    selected?: boolean;
    /** The avatar. `"reserve"` keeps its column empty so a grouped follow-up
     *  message lines up under the first; omit for no column at all. */
    avatar?: ReactNode | "reserve";
    /** `"gutter"` (the compact row's default): the text sits beside the avatar
     *  (below `md` the body spans the full width under it, MIP-1033).
     *  `"stacked"` (the balloon's default): the avatar sits in the header line
     *  and the body takes the full width. */
    align?: "gutter" | "stacked";
    /** The author line: `BubbleAuthor` + `BubbleMeta`, or a task-card header. */
    header?: ReactNode;
    /** The body. */
    children?: ReactNode;
    /** Under the body: reactions, thread chip. */
    footer?: ReactNode;
    /** The toolbar's content (quick emoji, edit, more menu). */
    actions?: ReactNode;
    /** Where `actions` sit. `"toolbar"` (default): the floating toolbar on the
     *  top edge. `"bottom"`: a row under the body, aligned to the end, for a
     *  turn long enough that a top toolbar would be off screen by the time the
     *  reader wants it (the Genos answer: copy, retry, feedback). Same reveal
     *  rules: CSS hover / focus / touch when `actionsOpen` is left undefined. */
    actionsPosition?: "toolbar" | "bottom";
    /** Controlled: mounted only while true (chat rows: mounting the emoji row
     *  and the menu on every row at rest would cost). Left `undefined`, the
     *  toolbar is always mounted and shown by CSS on hover / focus / touch. */
    actionsOpen?: boolean;
    /** Compact layout: a follow-up message in a run drops the top divider. */
    grouped?: boolean;
    /** The row or balloon is clickable (pointer cursor). */
    interactive?: boolean;
    /** Bubble layout: the pointed corner that says who spoke. Off for a card. */
    tail?: boolean;
    /** Gutter align, below `md`: `"below"` (default) lets the body span the full
     *  width under the avatar (task comments, MIP-1033); `"beside"` keeps it in
     *  the column next to the avatar at every width (chat, as it always was). */
    narrowBody?: "below" | "beside";
    /** Space between the author line and the body, in theme spacing units. */
    bodyOffset?: number;
    /** Space above the footer when the text sits beside the avatar. */
    footerOffset?: number;
    /** Rendered inside the root, outside the visual surface (emoji picker, a
     *  delete dialog), so it survives the toolbar unmounting. */
    overlay?: ReactNode;
    /** The root element, for outside-click and picker anchoring. */
    rootRef?: Ref<HTMLElement>;
    toolbarRef?: Ref<HTMLDivElement>;
    /** iOS answers a long-press with its own callout; suppress it where the
     *  app's own long-press toolbar is the response. */
    suppressTouchCallout?: boolean;
    /** Wraps the balloon (width limits). Bubble layout only. */
    wrapperSx?: SxProps;
    /** Merged last into the surface. */
    sx?: SxProps;
    component?: "div" | "button";
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    onDoubleClick?: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void;
    onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
    onTouchStart?: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchMove?: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchEnd?: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchCancel?: (e: React.TouchEvent<HTMLElement>) => void;
    "aria-pressed"?: boolean;
    "data-testid"?: string;
};

/** What each emphasis looks like, as roles. Functional carve-out: a deep-link
 *  target is GREEN (success) so it never reads as "yours" (accent). */
const EMPHASIS = {
    focused: { tint: g.success.subtle, line: g.success.solid },
    threadActive: { tint: g.accent.subtle, line: g.accent.solid },
} as const;

/** One radius for the balloon and the card; the pointed corner is `xs`. */
const SURFACE_RADIUS = g.radius.lg;
const TAIL_RADIUS = g.radius.xs;

const hoverTransition = `background-color ${g.motion.fast} ${g.ease}, border-color ${g.motion.fast} ${g.ease}`;

const toolbarBase = {
    position: "absolute",
    zIndex: 2,
    bgcolor: g.surface.raised,
    border: "1px solid",
    borderColor: g.border.default,
    borderRadius: g.radius.md,
    boxShadow: g.shadow.sm,
    px: 0.5,
} as const;

/** Inside the row's top-right corner (compact), or straddling the balloon's top
 *  edge so it never covers a one-word message. */
const toolbarPlace = {
    compact: { insetInlineEnd: BUBBLE_TOOLBAR_OFFSET.right, top: BUBBLE_TOOLBAR_OFFSET.top },
    // The toolbar is wider than a short balloon, so it opens into the empty
    // side: a received balloon sits at the start edge of the list, a sent one at
    // the end edge. Anchored the other way it spills past the list's edge.
    bubbleReceived: {
        insetInlineStart: BUBBLE_TOOLBAR_OFFSET.right,
        top: 0,
        transform: "translateY(-50%)",
    },
    bubbleSent: {
        insetInlineEnd: BUBBLE_TOOLBAR_OFFSET.right,
        top: 0,
        transform: "translateY(-50%)",
    },
} as const;

/** Always mounted, shown by CSS (`:hover`, `:focus-within`, and always on touch):
 *  for a host that must not hold hover state, such as a streamed, memoised turn.
 *  `child` is the revealed element's selector. The toolbar sits beside the
 *  surface, so it is a direct child (`> .bubble-toolbar`); the `"bottom"` row may
 *  be inside the balloon's surface, so it is a descendant. */
const revealRules = (child: string) =>
    ({
        [`& ${child}`]: { opacity: 0, transition: `opacity ${g.motion.fast} ${g.ease}` },
        [`&:hover ${child}, &:focus-within ${child}`]: { opacity: 1 },
        "@media (hover: none)": { [`& ${child}`]: { opacity: 1 } },
    }) as const;
const cssRevealed = revealRules("> .bubble-toolbar");
const cssRevealedBottom = revealRules(".bubble-actions-bottom");

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** The floating actions toolbar. Clicks on it are not clicks on the message. */
const BubbleToolbar = forwardRef<
    HTMLDivElement,
    { children: ReactNode; place: keyof typeof toolbarPlace }
>(({ children, place }, ref) => (
    <Box
        ref={ref}
        className="bubble-toolbar"
        sx={{ ...toolbarBase, ...toolbarPlace[place] }}
        onClick={stop}
        onDoubleClick={stop}
    >
        {children}
    </Box>
));
BubbleToolbar.displayName = "BubbleToolbar";

/** The author's name: one style for every surface. */
export const BubbleAuthor = ({ children, sx }: { children: ReactNode; sx?: SxProps }) => (
    <Typography
        component="span"
        sx={{ ...type("title-sm"), color: g.text.primary, ...(sx as object) }}
    >
        {children}
    </Typography>
);

/** Timestamps, "Edited", counts: one style for every surface. Tertiary text is
 *  meta only, never the only carrier of information. */
export const BubbleMeta = ({ children, sx }: { children: ReactNode; sx?: SxProps }) => (
    <Typography
        component="span"
        sx={{ ...type("caption"), color: g.text.tertiary, ...(sx as object) }}
    >
        {children}
    </Typography>
);

const gutterNode = (avatar: ReactNode | "reserve" | undefined, narrowBody: "below" | "beside") =>
    avatar === "reserve" ? (
        // Where the body spans the full width below `md`, an empty column would
        // only add a blank row above it.
        <Box
            sx={{
                width: BUBBLE_AVATAR_SIZE,
                display: narrowBody === "below" ? { xs: "none", md: "block" } : "block",
            }}
        />
    ) : (
        avatar
    );

export const Bubble = (props: BubbleProps) => {
    const {
        layout,
        side = "received",
        emphasis = false,
        selected = false,
        avatar,
        align: alignProp,
        header,
        children,
        footer,
        actions,
        actionsOpen,
        actionsPosition = "toolbar",
        grouped = false,
        interactive = false,
        tail = true,
        bodyOffset = 0.25,
        narrowBody = "below",
        footerOffset = 0.5,
        overlay,
        rootRef,
        toolbarRef,
        suppressTouchCallout = false,
        wrapperSx,
        sx,
        component = "div",
        onMouseEnter,
        onMouseLeave,
        ...handlers
    } = props;

    const showActions = actions != null && actionsOpen !== false;
    const toolbar =
        showActions && actionsPosition === "toolbar" ? (
            <BubbleToolbar
                ref={toolbarRef}
                place={
                    layout === "compact"
                        ? "compact"
                        : side === "sent"
                          ? "bubbleSent"
                          : "bubbleReceived"
                }
            >
                {actions}
            </BubbleToolbar>
        ) : null;
    // A portal's React events bubble through the React tree into the row's own
    // onClick (a click in the emoji picker would open the message), so in the
    // compact row, where the overlay is inside the clickable root, fence it.
    const fencedOverlay =
        overlay != null && overlay !== false ? (
            <Box sx={{ display: "contents" }} onClick={stop} onDoubleClick={stop}>
                {overlay}
            </Box>
        ) : null;
    const bottomActions =
        showActions && actionsPosition === "bottom" ? (
            <Box
                className="bubble-actions-bottom"
                sx={{ display: "flex", justifyContent: "flex-end", mt: 0.25 }}
                onClick={stop}
                onDoubleClick={stop}
            >
                {actions}
            </Box>
        ) : null;
    const reveal =
        actions != null && actionsOpen === undefined
            ? actionsPosition === "bottom"
                ? cssRevealedBottom
                : cssRevealed
            : null;

    const align = alignProp ?? (layout === "compact" ? "gutter" : "stacked");
    const hasGutter = avatar !== undefined && avatar !== null && avatar !== false;

    const content =
        align === "stacked" ? (
            <Box sx={{ minWidth: 0 }}>
                {(hasGutter || header != null) && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            minWidth: 0,
                            mb: bodyOffset,
                        }}
                    >
                        {hasGutter && (
                            <Box sx={{ flexShrink: 0, ...AVATAR_HIT_AREA }}>
                                {gutterNode(avatar, narrowBody)}
                            </Box>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>{header}</Box>
                    </Box>
                )}
                {children}
                {footer != null && <Box sx={{ mt: footerOffset }}>{footer}</Box>}
            </Box>
        ) : hasGutter ? (
            // One grid, not a media-query restructure: the avatar spans the
            // rows beside the body, so it never makes the first row taller
            // than the header. Below `md` the body spans the full width.
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr)",
                    columnGap: `${GUTTER_GAP}px`,
                    alignItems: "start",
                }}
            >
                <Box
                    sx={{
                        gridColumn: 1,
                        gridRow:
                            narrowBody === "below" ? { xs: 1, md: "1 / span 3" } : "1 / span 3",
                        flexShrink: 0,
                        ...AVATAR_HIT_AREA,
                    }}
                >
                    {gutterNode(avatar, narrowBody)}
                </Box>
                <Box sx={{ gridColumn: 2, gridRow: 1, minWidth: 0 }}>{header}</Box>
                <Box
                    sx={{
                        gridColumn: narrowBody === "below" ? { xs: "1 / -1", md: 2 } : 2,
                        gridRow: 2,
                        minWidth: 0,
                        mt:
                            header != null
                                ? narrowBody === "below"
                                    ? { xs: 0.75, md: bodyOffset }
                                    : bodyOffset
                                : 0,
                    }}
                >
                    {children}
                </Box>
                {footer != null && (
                    <Box
                        sx={{
                            gridColumn: narrowBody === "below" ? { xs: "1 / -1", md: 2 } : 2,
                            gridRow: 3,
                            minWidth: 0,
                            mt: footerOffset,
                        }}
                    >
                        {footer}
                    </Box>
                )}
            </Box>
        ) : (
            <Box sx={{ minWidth: 0 }}>
                {header}
                {header != null ? <Box sx={{ mt: bodyOffset }}>{children}</Box> : children}
                {footer}
            </Box>
        );

    const accent = emphasis ? EMPHASIS[emphasis] : null;

    if (layout === "compact") {
        return (
            <Box
                ref={rootRef as Ref<HTMLDivElement>}
                component={component}
                data-bubble-layout="compact"
                type={component === "button" ? "button" : undefined}
                sx={{
                    // A <button> row (the note comment list) starts from a reset.
                    border: "none",
                    textAlign: "start",
                    font: "inherit",
                    color: g.text.primary,
                    width: "100%",
                    position: "relative",
                    py: 0.25,
                    px: 2,
                    cursor: interactive ? "pointer" : "default",
                    borderInlineStart: "3px solid",
                    borderInlineStartColor: accent ? accent.line : "transparent",
                    borderTop: grouped ? "none" : "1px solid",
                    borderTopColor: g.border.subtle,
                    bgcolor: accent
                        ? accent.tint
                        : selected
                          ? g.accent.subtle
                          : actionsOpen === true
                            ? g.hover
                            : "transparent",
                    transition: hoverTransition,
                    ...(reveal ? { "&:hover": { bgcolor: accent ? accent.tint : g.hover } } : {}),
                    ...(component === "button"
                        ? {
                              "&:hover": {
                                  bgcolor: accent
                                      ? accent.tint
                                      : selected
                                        ? g.accent.subtle
                                        : g.hover,
                              },
                              "&:focus-visible": { ...focusRing, outlineOffset: "-2px" },
                          }
                        : {}),
                    ...reveal,
                    ...(suppressTouchCallout ? { WebkitTouchCallout: "none" } : {}),
                    ...(sx as object),
                }}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                {...handlers}
            >
                {fencedOverlay}
                {toolbar}
                {content}
                {bottomActions}
            </Box>
        );
    }

    // Balloon / card. The overlay and the toolbar sit beside the surface, not in
    // it: a click inside the emoji picker or a dialog opened from here would
    // otherwise reach the surface's own onClick (portals bubble through the
    // React tree), and the surface clips its content.
    const isSent = side === "sent";
    const tailCorner = isSent ? "borderTopRightRadius" : "borderTopLeftRadius";
    return (
        <Box sx={wrapperSx}>
            <Box
                ref={rootRef as Ref<HTMLDivElement>}
                data-bubble-layout="bubble"
                sx={{ position: "relative", ...reveal }}
                // Hover belongs on the root, which contains the toolbar: on the
                // surface alone, moving the pointer onto the toolbar would count
                // as leaving the message and unmount the toolbar under it.
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {overlay}
                {toolbar}
                <Box
                    component={component}
                    sx={{
                        position: "relative",
                        p: 1.25,
                        overflow: "hidden",
                        borderRadius: SURFACE_RADIUS,
                        ...(tail ? { [tailCorner]: TAIL_RADIUS } : {}),
                        cursor: interactive ? "pointer" : "default",
                        color: g.text.primary,
                        bgcolor: accent
                            ? accent.tint
                            : isSent
                              ? g.accent.subtle
                              : g.surface.default,
                        border: "1px solid",
                        borderColor: accent
                            ? accent.line
                            : isSent
                              ? g.accent.border
                              : g.border.default,
                        transition: hoverTransition,
                        "&:hover": accent ? undefined : { borderColor: g.border.strong },
                        ...(suppressTouchCallout ? { WebkitTouchCallout: "none" } : {}),
                        ...(sx as object),
                    }}
                    {...handlers}
                >
                    {content}
                    {bottomActions}
                </Box>
            </Box>
        </Box>
    );
};
