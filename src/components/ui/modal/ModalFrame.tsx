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
 * opened it. The frame therefore stops click, double-click and key events at
 * its own root. (Escape is handled by Joy's Modal before it gets there.)
 */

export type ModalFrameSize = "sm" | "md" | "lg";

const WIDTH: Record<ModalFrameSize, number> = { sm: 400, md: 480, lg: 640 };

/** Where page-level dialogs have always sat. */
export const MODAL_FRAME_DEFAULT_Z_INDEX = 10010;
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
    /** Exact layer. Wins over the default, loses to nothing but `hostZIndex`. */
    zIndex?: number;
    /** The layer of the surface that opened this dialog; the frame sits above it. */
    hostZIndex?: number;
    /** "alertdialog" for a question that needs an answer (confirmations). */
    role?: "dialog" | "alertdialog";
    /** Show the X in the header. */
    closable?: boolean;
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
    zIndex,
    hostZIndex,
    role = "dialog",
    closable = true,
    dismissible = true,
    tone,
}: ModalFrameProps) => {
    const { t } = useTranslation();
    const titleId = useId();
    const descriptionId = useId();

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
                // keep them above this layer too.
                "--unstable_popup-zIndex": layer + 10,
                // The blur lives on the root; Joy's Backdrop slot paints the dim.
                backdropFilter: "blur(4px)",
                backgroundColor: "transparent",
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
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
                    width: { xs: "calc(100vw - 24px)", sm: WIDTH[size] },
                    maxWidth: "calc(100vw - 24px)",
                    maxHeight: "calc(100dvh - 32px)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    // Flat: solid surface, one thin line, no gradient, no glow.
                    background: g.surface.raised,
                    border: `1px solid ${g.border.default}`,
                    borderRadius: g.radius.lg,
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
                        pb: 1,
                        flexShrink: 0,
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
                    {closable && (
                        <IconButton
                            aria-label={t.common.actions.close}
                            color="neutral"
                            disabled={!dismissible}
                            size="sm"
                            variant="plain"
                            sx={{
                                flexShrink: 0,
                                mt: "-4px",
                                color: g.text.secondary,
                                "&:hover": { background: g.hover, color: g.text.primary },
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
                            px: 2.5,
                            py: 1,
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
