import { ReactNode } from "react";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Box, Button, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { focusRing, g } from "../../../theme/tokens";

/**
 * The one "couldn't load" state (MIP-1276), the failure twin of `EmptyState`:
 * same structure and sizes, a danger-toned disc, and ALWAYS a Retry.
 * Before it, eight surfaces hand-built "red line + outlined Retry" in eight
 * slightly different ways and a dozen more showed nothing, a blank pane, or
 * (worst) "No activity yet" for a request that had simply failed.
 *
 * Copy rules (genos-ui): the TITLE says what failed ("Couldn't load the
 * activity"), the BODY says what to do; it defaults to the shared "Check your
 * connection, then try again." so most callers pass only a title. No apology,
 * no error codes. Strings come from the locale files.
 *
 * `size` matches `EmptyState`: `md` for a pane, `sm` for a card or tab panel,
 * `xs` for one quiet line in a dense list. `fill` centers it in the parent.
 */
export type ErrorStateProps = {
    /** What failed, e.g. "Couldn't load your repositories". */
    title: string;
    /** What to do next; defaults to the shared connection hint. */
    body?: string;
    /** Runs the request again. Required: an error with no way out is a dead end. */
    onRetry: () => void;
    /** Defaults to the localized "Retry". */
    retryLabel?: string;
    /**
     * A second way out, drawn before Retry (Cancel on a form that could not
     * start; "Open on GitHub" on a card that could not load). `href` makes it a
     * link that opens in a new tab; otherwise it runs `onClick`.
     */
    secondary?: { label: string } & ({ onClick: () => void } | { href: string });
    icon?: ReactNode;
    size?: "md" | "sm" | "xs";
    /** Center in the parent's full height instead of sitting at the top. */
    fill?: boolean;
    /** Marker for tests and analytics, e.g. "task-activity". */
    "data-error"?: string;
};

export const ErrorState = ({
    title,
    body,
    onRetry,
    retryLabel,
    secondary,
    icon,
    size = "md",
    fill = false,
    "data-error": dataError,
}: ErrorStateProps) => {
    const { t } = useTranslation();
    const label = retryLabel ?? t.common.actions.retry;
    const hint = body ?? t.common.feedback.loadFailedBody;
    const actions = (
        <>
            {secondary && (
                <Button
                    color="neutral"
                    component={"href" in secondary ? "a" : "button"}
                    href={"href" in secondary ? secondary.href : undefined}
                    rel={"href" in secondary ? "noreferrer" : undefined}
                    size="sm"
                    sx={{ "&:focus-visible": focusRing }}
                    target={"href" in secondary ? "_blank" : undefined}
                    variant="plain"
                    onClick={"onClick" in secondary ? secondary.onClick : undefined}
                >
                    {secondary.label}
                </Button>
            )}
            <Button
                color="neutral"
                size="sm"
                startDecorator={<RefreshRoundedIcon />}
                sx={{ "&:focus-visible": focusRing }}
                variant="outlined"
                onClick={onRetry}
            >
                {label}
            </Button>
        </>
    );

    if (size === "xs") {
        return (
            <Box
                data-error={dataError}
                role="alert"
                sx={{
                    py: 0.5,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 0.5,
                }}
            >
                <Typography
                    level="body-xs"
                    sx={{ color: g.danger.text, overflowWrap: "anywhere" }}
                >
                    {title}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>{actions}</Box>
            </Box>
        );
    }

    const small = size === "sm";
    return (
        <Box
            data-error={dataError}
            role="alert"
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: fill ? "center" : "flex-start",
                textAlign: "center",
                gap: small ? 0.5 : 1,
                py: small ? 2 : 4,
                px: 2,
                minWidth: 0,
                ...(fill ? { height: "100%", width: "100%" } : null),
            }}
        >
            <Box
                sx={{
                    width: small ? 32 : 40,
                    height: small ? 32 : 40,
                    borderRadius: g.radius.full,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: g.danger.subtle,
                    boxShadow: `inset 0 0 0 1px ${g.danger.border}`,
                    color: g.danger.text,
                    "--Icon-color": g.danger.text,
                    mb: 0.5,
                    "& svg": { fontSize: small ? 16 : 20 },
                }}
                aria-hidden
            >
                {icon ?? <ErrorOutlineRoundedIcon />}
            </Box>
            <Typography
                level={small ? "title-sm" : "title-md"}
                sx={{ color: g.text.primary, overflowWrap: "anywhere" }}
            >
                {title}
            </Typography>
            <Typography
                level="body-sm"
                sx={{ color: g.text.secondary, maxWidth: 280, overflowWrap: "anywhere" }}
            >
                {hint}
            </Typography>
            <Box
                sx={{ mt: 1, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1 }}
            >
                {actions}
            </Box>
        </Box>
    );
};
