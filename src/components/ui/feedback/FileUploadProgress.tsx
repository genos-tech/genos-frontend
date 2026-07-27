import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import { Box, CircularProgress, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { fmt, useTranslation } from "../../../i18n";

/**
 * Shared visuals for "file is being uploaded" UI. Centralised so the
 * chat / task / note editors and the task attachment surfaces all give
 * consistent feedback during the (often multi-second) upload round
 * trip — without each call site having to re-invent the spinner /
 * overlay markup. The matching `useUploadCounter` hook lives next to
 * this file (own module so React Fast Refresh can keep the components
 * cleanly hot-reloadable).
 */

type FileUploadOverlayProps = {
    /** Show the overlay only when true so callers can keep `isUploading`
     *  state colocated with the upload work. */
    open: boolean;
    /** Optional headline (defaults to "Uploading…"). */
    label?: string;
    /** Optional sub-line, e.g. file name or "(2 / 5)" progress. */
    detail?: string;
    /** Optional override of border-radius to match the host container. */
    borderRadius?: number | string;
};

/**
 * Absolutely-positioned overlay that covers its nearest positioned
 * ancestor. Dim + blur + spinner. Use for blocking flows where the user
 * shouldn't interact mid-upload (e.g. "Create Task" submission, dropping
 * files onto a chat panel before the editor has them).
 */
export const FileUploadOverlay = ({
    open,
    label,
    detail,
    borderRadius = 12,
}: FileUploadOverlayProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const resolvedLabel = label ?? t.common.ui.fileUpload.uploadingDefault;

    if (!open) return null;

    return (
        <Box
            aria-busy="true"
            aria-live="polite"
            sx={{
                position: "absolute",
                inset: 0,
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.25,
                borderRadius,
                background: isDark ? "rgba(15,17,26,0.55)" : "rgba(255,255,255,0.6)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                border: "1px solid",
                borderColor: isDark
                    ? "rgba(var(--gp-brandalt-500-rgb), 0.25)"
                    : "rgba(var(--gp-brand-700-rgb), 0.18)",
                pointerEvents: "auto",
                animation: "file-upload-overlay-fade 180ms ease-out",
                "@keyframes file-upload-overlay-fade": {
                    from: { opacity: 0 },
                    to: { opacity: 1 },
                },
            }}
        >
            <CircularProgress
                determinate={false}
                size="md"
                sx={{
                    "--CircularProgress-trackColor": isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                    "--CircularProgress-progressColor": isDark
                        ? "var(--gp-brandalt-400)"
                        : "var(--gp-brand-700)",
                }}
            />
            <Typography
                level="body-sm"
                sx={{
                    fontWeight: 600,
                    color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                }}
            >
                {resolvedLabel}
            </Typography>
            {detail && (
                <Typography
                    level="body-xs"
                    sx={{
                        maxWidth: "85%",
                        textAlign: "center",
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                    }}
                >
                    {detail}
                </Typography>
            )}
        </Box>
    );
};

type UploadingTileBadgeProps = {
    /** When false the badge is hidden so callers can drop it into every
     *  tile's render without a guard. */
    open: boolean;
    /** "uploading" — animated spinner (default) — vs "pending" — static
     *  cloud icon for tiles that are queued but not yet in flight (e.g.
     *  staged attachments waiting on a `Create Task` click). */
    variant?: "uploading" | "pending";
    /** Optional tooltip-ish label rendered under the spinner. Kept short
     *  to fit inside the tile. */
    label?: string;
};

/**
 * Small in-tile overlay that signals an individual attachment is mid /
 * pre-upload. Designed to be dropped inside an existing
 * `position: relative` tile alongside the file/image preview so the
 * tile keeps its shape but visibly conveys "not done yet".
 */
export const UploadingTileBadge = ({
    open,
    variant = "uploading",
    label,
}: UploadingTileBadgeProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    if (!open) return null;

    const resolvedLabel =
        label ??
        (variant === "pending"
            ? t.common.ui.fileUpload.pending
            : t.common.ui.fileUpload.uploading);

    return (
        <Box
            aria-busy={variant === "uploading"}
            sx={{
                position: "absolute",
                inset: 0,
                zIndex: 5,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                borderRadius: "inherit",
                background: isDark ? "rgba(10,12,20,0.55)" : "rgba(255,255,255,0.65)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                pointerEvents: "none",
            }}
        >
            {variant === "uploading" ? (
                <CircularProgress
                    determinate={false}
                    size="sm"
                    sx={{
                        "--CircularProgress-size": "22px",
                        "--CircularProgress-trackThickness": "3px",
                        "--CircularProgress-progressThickness": "3px",
                        "--CircularProgress-trackColor": isDark
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(0,0,0,0.08)",
                        "--CircularProgress-progressColor": isDark
                            ? "var(--gp-brandalt-400)"
                            : "var(--gp-brand-700)",
                    }}
                />
            ) : (
                <CloudUploadRoundedIcon
                    sx={{
                        fontSize: 22,
                        color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                        opacity: 0.85,
                    }}
                />
            )}
            <Typography
                level="body-xs"
                sx={{
                    fontWeight: 600,
                    fontSize: "0.65rem",
                    letterSpacing: "0.02em",
                    color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)",
                }}
            >
                {resolvedLabel}
            </Typography>
        </Box>
    );
};

type FileUploadStatusBadgeProps = {
    /** Number of in-flight uploads. The badge auto-hides at zero. */
    count: number;
    /** Optional label override. Defaults to a singular/plural variant of
     *  "Uploading n file(s)…". */
    label?: string;
    /** Where to anchor the badge inside the nearest positioned ancestor.
     *  Defaults to top-right; switch to bottom-right (or another corner)
     *  when the host already renders its own buttons in that corner so
     *  the badge doesn't cover them. */
    placement?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

const PLACEMENT_OFFSETS: Record<
    NonNullable<FileUploadStatusBadgeProps["placement"]>,
    Record<"top" | "right" | "bottom" | "left", number | "auto">
> = {
    "top-right": { top: 8, right: 12, bottom: "auto", left: "auto" },
    "top-left": { top: 8, right: "auto", bottom: "auto", left: 12 },
    "bottom-right": { top: "auto", right: 12, bottom: 8, left: "auto" },
    "bottom-left": { top: "auto", right: "auto", bottom: 8, left: 12 },
};

/**
 * Compact, non-blocking pill that floats inside an editor when one or
 * more `uploadFile` calls are in flight. Lets users notice the upload
 * even before BlockNote's own in-block placeholder appears (especially
 * relevant for slow/large uploads where the placeholder shows up
 * promptly but the round-trip itself can take several seconds).
 */
export const FileUploadStatusBadge = ({
    count,
    label,
    placement = "top-right",
}: FileUploadStatusBadgeProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    if (count <= 0) return null;

    const template =
        count === 1
            ? t.common.ui.fileUpload.uploadingFilesOne
            : t.common.ui.fileUpload.uploadingFilesOther;
    const resolved = label ?? fmt(template, { count });
    const offsets = PLACEMENT_OFFSETS[placement];

    return (
        <Box
            aria-busy="true"
            aria-live="polite"
            sx={{
                position: "absolute",
                ...offsets,
                zIndex: 30,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: "999px",
                background: isDark
                    ? "linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(var(--gp-brandalt-500-rgb), 0.22) 100%)"
                    : "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(var(--gp-brandalt-500-rgb), 0.12) 100%)",
                border: "1px solid",
                borderColor: isDark
                    ? "rgba(var(--gp-brandalt-500-rgb), 0.35)"
                    : "rgba(var(--gp-brand-700-rgb), 0.25)",
                color: isDark ? "var(--gp-brandalt-300)" : "var(--gp-brand-800)",
                fontWeight: 600,
                fontSize: "0.7rem",
                boxShadow: isDark
                    ? "0 4px 12px rgba(0,0,0,0.35)"
                    : "0 4px 12px rgba(99,102,241,0.18)",
                pointerEvents: "none",
                animation: "file-upload-badge-pop 200ms ease-out",
                "@keyframes file-upload-badge-pop": {
                    from: { opacity: 0, transform: "translateY(-4px) scale(0.96)" },
                    to: { opacity: 1, transform: "translateY(0) scale(1)" },
                },
            }}
        >
            <CircularProgress
                determinate={false}
                size="sm"
                sx={{
                    "--CircularProgress-size": "12px",
                    "--CircularProgress-trackThickness": "2px",
                    "--CircularProgress-progressThickness": "2px",
                    "--CircularProgress-trackColor": "transparent",
                    "--CircularProgress-progressColor": isDark
                        ? "var(--gp-brandalt-300)"
                        : "var(--gp-brand-800)",
                }}
            />
            <Typography
                component="span"
                sx={{ color: "inherit", fontWeight: "inherit", fontSize: "inherit" }}
            >
                {resolved}
            </Typography>
        </Box>
    );
};
