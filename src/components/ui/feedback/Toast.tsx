import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { keyframes } from "@emotion/react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Button, IconButton } from "@mui/joy";
import { createPortal } from "react-dom";

import { useTranslation } from "../../../i18n";
import { focusRing, g, type } from "../../../theme/tokens";
import {
    ACTION_DURATION,
    DEFAULT_DURATION,
    toast,
    ToastAction,
    ToastItem,
    ToastTone,
    useToasts,
} from "./toastStore";

/**
 * The toast host and the `<Toast>` component (MIP-1132). 13 files rendered
 * their own Joy `<Snackbar>`, at top-right, top-center and bottom-center,
 * with five colors and three ways to dismiss. Now every toast lands in ONE
 * region, bottom-center, in one flat card.
 *
 * Announced: the region is `aria-live="polite"`, and a warning or error
 * toast is `role="alert"`, so a screen reader hears a failure at once and
 * a confirmation without being interrupted. Hover or focus pauses the
 * auto-hide, so a person reading or reaching for Undo is never raced.
 *
 * Mount `<ToastHost />` once (App). A `<Toast>` still works without it: the
 * region is created on first use, so the sign-in shell and isolated tests
 * need no setup.
 */

const REGION_ID = "genos-toast-region";

/** Above every modal and the Spotlight layer (13300); a toast is the one
 *  thing that must never be hidden by the surface that caused it. */
const REGION_Z_INDEX = 13500;

export const getToastRegion = (): HTMLElement | null => {
    if (typeof document === "undefined") return null;
    let el = document.getElementById(REGION_ID);
    if (!el) {
        el = document.createElement("div");
        el.id = REGION_ID;
        el.setAttribute("role", "region");
        el.setAttribute("aria-live", "polite");
        el.setAttribute("aria-relevant", "additions text");
        // Centered with translateX(-50%), which is direction-neutral, so the
        // same block works in `ar`. `pointer-events: none` on the region and
        // `auto` on each card keeps the gaps clickable.
        el.style.cssText = [
            "position:fixed",
            `z-index:${REGION_Z_INDEX}`,
            "left:50%",
            "transform:translateX(-50%)",
            "bottom:calc(16px + env(safe-area-inset-bottom, 0px))",
            "display:flex",
            "flex-direction:column",
            "gap:8px",
            "width:min(440px, calc(100vw - 32px))",
            "pointer-events:none",
        ].join(";");
        document.body.appendChild(el);
    }
    return el;
};

const useToastRegion = (): HTMLElement | null => {
    const { t } = useTranslation();
    const region = useMemo(() => getToastRegion(), []);
    const label = t.common.feedback.toast.region;
    useEffect(() => {
        region?.setAttribute("aria-label", label);
    }, [region, label]);
    return region;
};

const slideIn = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
`;

const TONE_ICON: Record<ToastTone, ReactNode> = {
    neutral: null,
    success: <CheckCircleRoundedIcon />,
    warning: <WarningAmberRoundedIcon />,
    danger: <ErrorOutlineRoundedIcon />,
};

export type ToastCloseReason = "timeout" | "dismiss" | "action";

type CardProps = {
    tone: ToastTone;
    duration: number | null;
    /** `undefined` = the tone's icon, `null` = none (custom content). */
    icon?: ReactNode | null;
    action?: ToastAction & { label: string };
    /** Replaces `action` and the close button (several buttons, a busy one). */
    actions?: ReactNode;
    /** Show the close button. Default true. */
    dismissible?: boolean;
    onClose: (reason: ToastCloseReason) => void;
    onClick?: () => void;
    children: ReactNode;
};

const ToastCard = ({
    tone,
    duration,
    icon,
    action,
    actions,
    dismissible = true,
    onClose,
    onClick,
    children,
}: CardProps) => {
    const { t } = useTranslation();
    const [paused, setPaused] = useState(false);
    const urgent = tone === "danger" || tone === "warning";
    const leading = icon === undefined ? TONE_ICON[tone] : icon;
    const toneColor = tone === "neutral" ? g.text.secondary : g[tone].text;

    // Latest onClose without restarting the timer when the parent re-renders.
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });

    useEffect(() => {
        if (duration === null || paused) return;
        const id = window.setTimeout(() => closeRef.current("timeout"), duration);
        return () => window.clearTimeout(id);
    }, [duration, paused, closeRef]);

    return (
        <Box
            data-toast-tone={tone}
            // `alert` is assertive, `status` polite; the region around it is
            // polite too, so a plain confirmation never interrupts.
            role={urgent ? "alert" : "status"}
            sx={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                minWidth: 0,
                px: 1.5,
                py: 1,
                background: g.surface.raised,
                color: g.text.primary,
                border: "1px solid",
                borderColor: urgent ? g[tone].border : g.border.default,
                borderRadius: g.radius.md,
                boxShadow: g.shadow.md,
                ...type("body-sm"),
                animation: `${slideIn} ${g.motion.base} ${g.easeOut}`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
            onBlur={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {leading && (
                <Box
                    aria-hidden
                    sx={{
                        display: "flex",
                        flexShrink: 0,
                        color: toneColor,
                        "--Icon-color": toneColor,
                        "& svg": { fontSize: 18 },
                    }}
                >
                    {leading}
                </Box>
            )}
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    cursor: onClick ? "pointer" : "default",
                }}
                onClick={onClick}
            >
                {children}
            </Box>
            {actions ??
                (action && (
                    <Button
                        color="neutral"
                        size="sm"
                        variant="plain"
                        sx={{
                            flexShrink: 0,
                            color: g.accent.text,
                            fontWeight: 600,
                            "&:focus-visible": focusRing,
                        }}
                        onClick={() => {
                            action.onClick();
                            onClose("action");
                        }}
                    >
                        {action.label}
                    </Button>
                ))}
            {actions === undefined && dismissible && (
                <IconButton
                    aria-label={t.common.actions.close}
                    color="neutral"
                    size="sm"
                    variant="plain"
                    sx={{ flexShrink: 0, "&:focus-visible": focusRing }}
                    onClick={() => onClose("dismiss")}
                >
                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
            )}
        </Box>
    );
};

type ToastProps = {
    open: boolean;
    tone?: ToastTone;
    /** ms before it hides itself; `null` keeps it until closed. Default 5 s
     *  (8 s with an action, since someone has to read and decide). */
    duration?: number | null;
    icon?: ReactNode | null;
    action?: ToastAction & { label: string };
    actions?: ReactNode;
    dismissible?: boolean;
    onClose?: (reason: ToastCloseReason) => void;
    onClick?: () => void;
    children: ReactNode;
};

/**
 * Declarative form, for a component that owns an `open` flag. Replaces
 * `<Snackbar open onClose>`: set `open` false in `onClose`. Imperative
 * callers use `toast.*` instead.
 */
export const Toast = ({
    open,
    tone = "neutral",
    duration,
    icon,
    action,
    actions,
    dismissible,
    onClose,
    onClick,
    children,
}: ToastProps) => {
    const region = useToastRegion();
    if (!open || !region) return null;
    return createPortal(
        <ToastCard
            action={action}
            actions={actions}
            dismissible={dismissible}
            duration={
                duration !== undefined
                    ? duration
                    : actions !== undefined || action
                      ? ACTION_DURATION
                      : DEFAULT_DURATION
            }
            icon={icon}
            tone={tone}
            onClick={onClick}
            onClose={(reason) => onClose?.(reason)}
        >
            {children}
        </ToastCard>,
        region
    );
};

const HostedToast = ({ item }: { item: ToastItem }) => {
    const { t } = useTranslation();
    const action = item.action
        ? {
              onClick: item.action.onClick,
              label: item.action.label ?? (item.undo ? t.common.feedback.toast.undo : ""),
          }
        : undefined;
    return (
        <ToastCard
            action={action}
            duration={item.duration}
            tone={item.tone}
            onClose={() => toast.dismiss(item.id)}
        >
            {item.message}
        </ToastCard>
    );
};

/** Renders every `toast.*` call. Mount once, near the app root. */
export const ToastHost = () => {
    const region = useToastRegion();
    const items = useToasts();
    if (!region) return null;
    return createPortal(
        items.map((item) => <HostedToast key={item.id} item={item} />),
        region
    );
};
