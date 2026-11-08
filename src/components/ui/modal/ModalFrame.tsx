import { ReactNode, useId } from "react";
import { keyframes } from "@emotion/react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, IconButton, Modal, ModalDialog } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";

/**
 * The one dialog frame (MIP-1125, part of MIP-1106).
 *
 * 88 files used to build their own: dark gradients that ignored the light
 * theme, a coloured glow, radius 12 / 16 / xl, each with its own shadow.
 * This is the flat version the design system settled on: a solid raised
 * surface, one thin neutral border, `radius.lg`, `shadow.lg`, and nothing
 * else. Only the backdrop blurs.
 *
 * Layout: header (icon, title, description, close) / scrolling body /
 * footer actions. Only the body scrolls, so the actions never leave the
 * screen on a phone.
 *
 * Stacking (genos-ui rule 1): never hardcode a layer in a caller. A dialog
 * opened from a modal-hosted surface passes that host's layer as
 * `hostZIndex` (the frame lifts itself above it, the same +2 as
 * `noteModalChildStackSx`) or an exact `zIndex`. With neither it sits at
 * 10010, where the page-level dialogs have always been.
 *
 * Events: the dialog portals to <body>, but React events still bubble
 * through the COMPONENT tree, i.e. into whatever row, bubble or editor
 * opened it. The frame therefore stops click, double-click, key, mouse,
 * pointer and touch events at its own root (see FENCE). Escape is handled by
 * Joy's Modal before it gets there.
 */

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** Bubble-phase events kept inside the portal. Touch and press events too: a
 *  chat bubble's long-press (`useLongPress`) would otherwise count a finger
 *  held on a dialog button as a long-press on the message under it. (A
 *  CAPTURE handler on an ancestor still sees everything: mount the dialog
 *  outside such an element.) */
const FENCE = {
    onClick: stop,
    onDoubleClick: stop,
    onKeyDown: stop,
    onMouseDown: stop,
    onMouseUp: stop,
    onPointerDown: stop,
    onPointerUp: stop,
    onTouchStart: stop,
    onTouchMove: stop,
    onTouchEnd: stop,
    onTouchCancel: stop,
} as const;

/**
 * `sm` / `md` / `lg` are fixed widths for dialogs. `xl` is the wide tabbed
 * panel (Settings): 550 / 700 / 920 as the screen grows. `wide` is the wider
 * ladder (550 / 806 from md up) for a dialog that holds two side-by-side pickers
 * (dependencies). `profile` is the
 * 1000px profile card (project, group, team); it is built to be used with
 * `fullScreenOnMobile` (below `md` the card is the screen, with the close X as
 * the only way out), so pass both.
 */
export type ModalFrameSize = "sm" | "md" | "lg" | "xl" | "wide" | "profile";

const WIDTH: Record<ModalFrameSize, number | Record<string, number | string>> = {
    sm: 400,
    md: 480,
    lg: 640,
    xl: { sm: 550, md: 700, lg: 920 },
    wide: { sm: 550, md: 806 },
    profile: { md: 1000 },
};

/** Where page-level dialogs have always sat. */
export const MODAL_FRAME_DEFAULT_Z_INDEX = 10010;
/** Joy's own modal layer, below which its default popup rule is already right. */
const JOY_MODAL_LAYER = 1300;
/** Lift over a host's layer: clears the host dialog and its dropdown (host + 1). */
export const MODAL_FRAME_HOST_OFFSET = 2;

const enter = keyframes`
    from { opacity: 0; transform: translate(-50%, calc(-50% + 6px)) scale(0.98); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

export type ModalFrameProps = {
    open: boolean;
    /** Called for Esc, a backdrop click and the close button, unless `dismissible` is false. */
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    /** Shown before the title; the caller picks its colour. */
    icon?: ReactNode;
    children?: ReactNode;
    /** Footer buttons. Placed at the end of the row (the left in RTL). */
    actions?: ReactNode;
    size?: ModalFrameSize;
    /** A header-bottom hairline, for a panel whose body is its own surface (tabs). */
    headerDivider?: boolean;
    /** Something to show between the title and the close button (a chip, say). */
    headerAccessory?: ReactNode;
    /** The body brings its own padding (tabs, a scrolling card). Default: 20px. */
    flush?: boolean;
    /** On a phone the frame fills the screen with square corners, not an inset card. */
    fullScreenOnMobile?: boolean;
    /** Keep the frame clear of the mobile bottom tab bar (a dialog that paints over it).
     *  Not combinable with `fullScreenOnMobile`, which is the whole screen. */
    clearBottomBar?: boolean;
    /** Exact layer. Wins over the default, loses to nothing but `hostZIndex`. */
    zIndex?: number;
    /** The layer of the surface that opened this dialog; the frame sits above it. */
    hostZIndex?: number;
    /** "alertdialog" for a question that needs an answer (confirmations). */
    role?: "dialog" | "alertdialog";
    /** Show the X in the header. */
    closable?: boolean;
    /**
     * This dialog owns Select / Autocomplete popups that portal to `<body>` as siblings of
     * its root, and it is raised above Joy's modal layer: write the picker layer for them
     * (Joy's own sibling rule would leave them at 1301, behind the dialog). Off by default
     * and meant for ONE surface at a time: the rule is a claim on every following sibling
     * listbox in the page, so two open surfaces that both make it fight by stylesheet
     * order (the cascade race behind the invisible-dropdown bug, fe #122). Prefer
     * `slotProps.listbox.sx.zIndex` on the component; use this only when the dialog is the
     * sole owner of the listboxes that open over it (the Genos settings over Spotlight).
     */
    ownsListboxPopups?: boolean;
    /** Accessible name of the X, when a more specific one than "Close" exists. */
    closeLabel?: string;
    /** False while work is under way: Esc, the backdrop and the X do nothing. */
    dismissible?: boolean;
    /** Free-form marker for tests and styling hooks (e.g. "danger"). */
    tone?: string;
};

export const ModalFrame = ({
    open,
    onClose,
    title,
    description,
    icon,
    children,
    actions,
    size = "md",
    headerDivider = false,
    headerAccessory,
    flush = false,
    fullScreenOnMobile = false,
    clearBottomBar = false,
    zIndex,
    hostZIndex,
    role = "dialog",
    closable = true,
    ownsListboxPopups = false,
    closeLabel,
    dismissible = true,
    tone,
}: ModalFrameProps) => {
    const { t } = useTranslation();
    const titleId = useId();
    const descriptionId = useId();

    const inset = "calc(100vw - 24px)";
    const inner = "calc(100dvh - 32px)";
    const width = WIDTH[size];
    const sizing = fullScreenOnMobile
        ? {
              // Below `md` the card IS the screen; from `md` up it is the
              // centered card again.
              width: { xs: "100vw", md: typeof width === "number" ? width : width.md },
              maxWidth: { xs: "100vw", md: inset },
              height: { xs: "100dvh", md: "auto" },
              maxHeight: { xs: "100dvh", md: inner },
              m: { xs: 0, md: "auto" },
          }
        : {
              width: { xs: inset, ...(typeof width === "number" ? { sm: width } : width) },
              maxWidth: inset,
              maxHeight: clearBottomBar
                  ? {
                        xs: "calc(100dvh - var(--mobile-bottom-inset, 60px) - 24px)",
                        sm: inner,
                    }
                  : inner,
          };

    const layer =
        hostZIndex != null
            ? hostZIndex + MODAL_FRAME_HOST_OFFSET
            : (zIndex ?? MODAL_FRAME_DEFAULT_Z_INDEX);

    return (
        <Modal
            open={open}
            slotProps={{ backdrop: { sx: { backgroundColor: g.scrim } } }}
            sx={{
                zIndex: layer,
                // Joy pins the pickers a dialog opens to calc(modal + 1);
                // keep them above this layer too. Select and Autocomplete
                // listboxes portal to <body> as SIBLINGS of this root, so the
                // variable also has to be written for them (Joy's own rule
                // does exactly that, with the default layer); the inline popups
                // inherit it from the root. The sibling rule is opt-in
                // (`ownsListboxPopups`): it is a global claim on every listbox.
                "--unstable_popup-zIndex": layer + 10,
                ...(ownsListboxPopups &&
                    layer > JOY_MODAL_LAYER && {
                        '& ~ [role="listbox"]': { "--unstable_popup-zIndex": layer + 10 },
                    }),
                // The blur lives on the root; Joy's Backdrop slot paints the dim.
                backdropFilter: "blur(4px)",
                backgroundColor: "transparent",
            }}
            {...FENCE}
            onClose={() => {
                if (dismissible) onClose();
            }}
        >
            <ModalDialog
                aria-describedby={description != null ? descriptionId : undefined}
                aria-labelledby={titleId}
                data-tone={tone}
                role={role}
                sx={{
                    p: 0,
                    gap: 0,
                    ...sizing,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    // Flat: solid surface, one thin line, no gradient, no glow.
                    background: g.surface.raised,
                    border: `1px solid ${g.border.default}`,
                    borderRadius: fullScreenOnMobile ? { xs: 0, md: g.radius.lg } : g.radius.lg,
                    boxShadow: g.shadow.lg,
                    color: g.text.primary,
                    fontFamily: g.font.body,
                    textAlign: "start",
                    animation: `${enter} ${g.motion.base} ${g.easeOut}`,
                    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                        px: 2.5,
                        pt: 2.5,
                        pb: headerDivider ? 1.5 : 1,
                        flexShrink: 0,
                        ...(headerDivider && { borderBottom: `1px solid ${g.border.subtle}` }),
                    }}
                >
                    {icon && (
                        <Box
                            aria-hidden="true"
                            sx={{
                                display: "flex",
                                flexShrink: 0,
                                mt: "2px",
                                "& svg": { fontSize: 20 },
                            }}
                        >
                            {icon}
                        </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                            component="h2"
                            id={titleId}
                            sx={{
                                ...type("title-lg"),
                                m: 0,
                                color: g.text.primary,
                                overflowWrap: "anywhere",
                                textWrap: "balance",
                            }}
                        >
                            {title}
                        </Box>
                        {description != null && (
                            <Box
                                id={descriptionId}
                                sx={{
                                    ...type("body-sm"),
                                    mt: 0.5,
                                    color: g.text.secondary,
                                    overflowWrap: "anywhere",
                                }}
                            >
                                {description}
                            </Box>
                        )}
                    </Box>
                    {Boolean(headerAccessory) && (
                        <Box sx={{ display: "flex", flexShrink: 0, alignItems: "center" }}>
                            {headerAccessory}
                        </Box>
                    )}
                    {closable && (
                        <IconButton
                            aria-label={closeLabel ?? t.common.actions.close}
                            color="neutral"
                            disabled={!dismissible}
                            size="sm"
                            variant="plain"
                            sx={{
                                flexShrink: 0,
                                mt: "-4px",
                                color: g.text.secondary,
                                "&:hover": { background: g.hover, color: g.text.primary },
                                "&:focus:not(:focus-visible)": { outline: "none" },
                                "&:focus-visible": focusRing,
                            }}
                            onClick={onClose}
                        >
                            <CloseRoundedIcon />
                        </IconButton>
                    )}
                </Box>

                {children != null && (
                    <Box
                        sx={{
                            px: flush ? 0 : 2.5,
                            py: flush ? 0 : 1,
                            flex: "1 1 auto",
                            minHeight: 0,
                            overflowY: "auto",
                            overscrollBehavior: "contain",
                        }}
                    >
                        {children}
                    </Box>
                )}

                {actions != null && (
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            flexWrap: "wrap",
                            gap: 1,
                            px: 2.5,
                            pt: 1.5,
                            pb: 2.5,
                            flexShrink: 0,
                        }}
                    >
                        {actions}
                    </Box>
                )}
            </ModalDialog>
        </Modal>
    );
};
