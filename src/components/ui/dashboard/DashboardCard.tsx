import { ReactNode, useId } from "react";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { Box, IconButton, Typography } from "@mui/joy";

import { focusRing, g, type } from "../../../theme/tokens";
import { visuallyHidden } from "../a11y/visuallyHidden";
import { AppTooltip } from "../AppTooltip";
import { EmptyState } from "../feedback/EmptyState";
import { ErrorState } from "../feedback/ErrorState";
import { SkeletonLines } from "../feedback/Skeleton";

/**
 * The one dashboard card (MIP-1963): flat surface, 1 px subtle border, radius md, no shadow,
 * no gradient, no tint, no hover lift. Every dashboard widget sits in one, and a card renders
 * its own loading / error / empty state at the loaded card's height so nothing jumps.
 *
 * `variant="flush"` is for lists and tables whose rows bring their own padding; the header
 * keeps 16 px either way.
 */
const noop = () => {};

export type CardState = "loading" | "error" | "empty" | "ready";

export type CardHeaderProps = {
    title: string;
    subtitle?: string;
    /** A number after the title ("Needs you 3"). */
    count?: string;
    /** Opens a tooltip behind a "?" button. `helpLabel` is the button's accessible name. */
    help?: string;
    helpLabel?: string;
    /** At most two: one SegmentedChips and/or one text button. */
    actions?: ReactNode;
    /** Heading level of the title (the page h1 is the PageHeader's). */
    as?: "h2" | "h3" | "h4";
    /** `id` of the title, so the card is a named region. */
    titleId?: string;
};

export const CardHeader = ({
    title,
    subtitle,
    count,
    help,
    helpLabel,
    actions,
    as = "h3",
    titleId,
}: CardHeaderProps) => {
    const helpId = useId();
    return (
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-start",
                justifyContent: "space-between",
                columnGap: 1.5,
                rowGap: 1,
                minWidth: 0,
            }}
        >
            <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    <Typography
                        component={as}
                        id={titleId}
                        sx={{ ...type("title-sm"), color: g.text.primary, m: 0, minWidth: 0 }}
                    >
                        {title}
                    </Typography>
                    {count !== undefined && (
                        <Typography
                            sx={{
                                ...type("body-xs"),
                                color: g.text.secondary,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {count}
                        </Typography>
                    )}
                    {help && (
                        <AppTooltip title={help}>
                            <IconButton
                                aria-describedby={helpId}
                                aria-label={helpLabel ?? help}
                                size="sm"
                                variant="plain"
                                sx={{
                                    "--IconButton-size": "20px",
                                    minHeight: 0,
                                    color: g.text.secondary,
                                    "& svg": { fontSize: 16 },
                                    "&:focus-visible": focusRing,
                                }}
                            >
                                <HelpOutlineRoundedIcon />
                            </IconButton>
                        </AppTooltip>
                    )}
                    {help && (
                        <Box component="span" id={helpId} sx={visuallyHidden}>
                            {help}
                        </Box>
                    )}
                </Box>
                {subtitle && (
                    <Typography
                        sx={{
                            ...type("body-xs"),
                            color: g.text.secondary,
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: { xs: 2, md: 1 },
                            overflow: "hidden",
                        }}
                    >
                        {subtitle}
                    </Typography>
                )}
            </Box>
            {actions && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    {actions}
                </Box>
            )}
        </Box>
    );
};

export type DashboardCardProps = Omit<CardHeaderProps, "as" | "titleId"> & {
    variant?: "padded" | "flush";
    state?: CardState;
    /** Replaces the default `SkeletonLines` while loading. */
    skeleton?: ReactNode;
    /** Fixed body height so the loading / error / empty / ready states do not jump. */
    minBodyHeight?: number;
    emptyTitle?: string;
    emptyBody?: string;
    emptyAction?: { label: string; onClick: () => void };
    errorTitle?: string;
    onRetry?: () => void;
    retryLabel?: string;
    headingLevel?: CardHeaderProps["as"];
    children?: ReactNode;
    "data-testid"?: string;
};

export const DashboardCard = ({
    variant = "padded",
    state = "ready",
    skeleton,
    minBodyHeight,
    emptyTitle,
    emptyBody,
    emptyAction,
    errorTitle,
    onRetry,
    retryLabel,
    headingLevel,
    children,
    "data-testid": testId,
    ...header
}: DashboardCardProps) => {
    const flush = variant === "flush";
    const titleId = useId();
    let body: ReactNode = children;
    if (state === "loading") body = skeleton ?? <SkeletonLines lines={3} />;
    else if (state === "error") {
        body = (
            <ErrorState
                retryLabel={retryLabel}
                size="sm"
                title={errorTitle ?? header.title}
                onRetry={onRetry ?? noop}
            />
        );
    } else if (state === "empty") {
        body = (
            <EmptyState
                action={emptyAction}
                body={emptyBody}
                size="sm"
                title={emptyTitle ?? header.title}
            />
        );
    }
    return (
        <Box
            aria-labelledby={titleId}
            component="section"
            data-state={state}
            data-testid={testId}
            sx={{
                background: g.surface.default,
                border: `1px solid ${g.border.subtle}`,
                borderRadius: g.radius.md,
                boxShadow: "none",
                minWidth: 0,
                py: { xs: 1.5, md: 2 },
                px: flush ? 0 : { xs: 1.5, md: 2 },
            }}
        >
            <Box sx={{ px: flush ? { xs: 1.5, md: 2 } : 0 }}>
                <CardHeader as={headingLevel} titleId={titleId} {...header} />
            </Box>
            <Box sx={{ mt: 1.5, minHeight: minBodyHeight, minWidth: 0 }}>{body}</Box>
        </Box>
    );
};
