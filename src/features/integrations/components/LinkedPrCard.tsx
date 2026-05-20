import React, { useEffect, useState } from "react";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Divider,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { redirectToOAuthConnect } from "../services/oauth";
import { getCachedOrFetchPrStatus, type PrStatusResult } from "../services/prStatusCache";
import type { CheckRunsResponse, CombinedStatus, PrDetailResponse } from "../services/prTypes";
import {
    CheckFailingIcon,
    CheckNoneIcon,
    CheckPassingIcon,
    CheckPendingIcon,
    PrClosedIcon,
    PrDraftIcon,
    PrMergedIcon,
    PrOpenIcon,
} from "./icons/Octicons";

interface Props {
    url: string;
    accessToken: string;
    /** When true, render nothing if the user hasn't connected GitHub.
     *  Chat / task-comment unfurls use this so a single chat scroll
     *  doesn't show a "Connect GitHub" prompt for every PR-bearing
     *  message. Task metadata view keeps the default (prompt visible). */
    hideOnNotConnected?: boolean;
}

type CiState = "passing" | "failing" | "pending" | "none";

const deriveCiState = (cs: CombinedStatus | null, cr: CheckRunsResponse | null): CiState => {
    const checks = cr?.check_runs ?? [];
    const csState = cs?.state ?? null;
    const hasFailure = checks.some(
        (c) => c.conclusion === "failure" || c.conclusion === "action_required"
    );
    const hasPending = checks.some((c) => c.status !== "completed") || csState === "pending";
    if (hasFailure || csState === "failure" || csState === "error") return "failing";
    if (hasPending) return "pending";
    if (checks.length === 0 && (csState === null || csState === undefined)) return "none";
    return "passing";
};

type PrState = "merged" | "draft" | "open" | "closed";

const derivePrState = (pull: PrDetailResponse["pull"]): PrState => {
    if (pull.merged) return "merged";
    if (pull.draft) return "draft";
    if (pull.state === "open") return "open";
    return "closed";
};

// GitHub's canonical colors for PR state badges. Matches what
// github.com renders.
const prStateColor = (state: PrState): string => {
    switch (state) {
        case "open":
            return "#1f883d";
        case "merged":
            return "#8250df";
        case "closed":
            return "#cf222e";
        case "draft":
        default:
            return "#6e7781";
    }
};

const PrStateIcon = ({ state, size = 16 }: { state: PrState; size?: number }) => {
    const color = prStateColor(state);
    const common = { width: size, height: size, style: { color } };
    switch (state) {
        case "merged":
            return <PrMergedIcon {...common} />;
        case "draft":
            return <PrDraftIcon {...common} />;
        case "closed":
            return <PrClosedIcon {...common} />;
        case "open":
        default:
            return <PrOpenIcon {...common} />;
    }
};

const CiBadge = ({ state, size = 16 }: { state: CiState; size?: number }) => {
    const color =
        state === "passing"
            ? "#1f883d"
            : state === "failing"
              ? "#cf222e"
              : state === "pending"
                ? "#bf8700"
                : "#6e7781";
    const common = { width: size, height: size, style: { color } };
    switch (state) {
        case "passing":
            return <CheckPassingIcon {...common} />;
        case "failing":
            return <CheckFailingIcon {...common} />;
        case "pending":
            return <CheckPendingIcon {...common} />;
        case "none":
        default:
            return <CheckNoneIcon {...common} />;
    }
};

// "5 minutes ago" / "2 hours ago" / "3 days ago" — no extra dep,
// good enough for a tooltip subtitle.
const relativeAgo = (iso: string): string => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
    const units: [number, string][] = [
        [60, "second"],
        [60, "minute"],
        [24, "hour"],
        [7, "day"],
        [4.345, "week"],
        [12, "month"],
        [Number.POSITIVE_INFINITY, "year"],
    ];
    let value = secs;
    let label = "second";
    for (const [factor, unit] of units) {
        if (value < factor) {
            label = unit;
            break;
        }
        value = value / factor;
        label = unit;
    }
    const rounded = Math.max(1, Math.floor(value));
    return `${rounded} ${label}${rounded === 1 ? "" : "s"} ago`;
};

const stateLabel = (state: PrState, t: ReturnType<typeof useTranslation>["t"]): string => {
    switch (state) {
        case "merged":
            return t.tasks.linkedPr.stateMerged;
        case "draft":
            return t.tasks.linkedPr.stateDraft;
        case "closed":
            return t.tasks.linkedPr.stateClosed;
        case "open":
        default:
            return t.tasks.linkedPr.stateOpen;
    }
};

const ciTooltipLabel = (state: CiState, t: ReturnType<typeof useTranslation>["t"]): string => {
    switch (state) {
        case "passing":
            return t.tasks.linkedPr.ciPassing;
        case "failing":
            return t.tasks.linkedPr.ciFailing;
        case "pending":
            return t.tasks.linkedPr.ciPending;
        case "none":
        default:
            return t.tasks.linkedPr.ciNone;
    }
};

// Rich hover content: author, branch, stats, opened/updated dates.
// Rendered inside Tooltip's `title` prop. Colors flow through
// `purplePalette` so the panel matches menus/popovers elsewhere instead
// of Joy's stock white-on-black solid tooltip.
const HoverDetails = ({ payload, isDark }: { payload: PrDetailResponse; isDark: boolean }) => {
    const { pull } = payload;
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const author = pull.user?.login;
    const avatar = pull.user?.avatar_url;
    const headRef = pull.head?.ref;
    const baseRef = pull.base?.ref;
    const adds = pull.additions;
    const dels = pull.deletions;
    const changed = pull.changed_files;
    const commits = pull.commits;
    const comments = (pull.comments ?? 0) + (pull.review_comments ?? 0);

    return (
        <Stack
            spacing={0.75}
            sx={{
                minWidth: 260,
                p: 1.25,
                // Solid surface (vs `menuBg`'s translucent dark) so the
                // tooltip body has clear contrast against the dark task
                // panel sitting behind the popper. `surfaceSolid` is the
                // palette's most opaque card surface.
                bgcolor: palette.surfaceSolid,
                border: `1px solid ${palette.menuBorder}`,
                borderRadius: "10px",
                boxShadow: palette.shadow,
            }}
        >
            {author && (
                <Stack direction="row" alignItems="center" spacing={1}>
                    {avatar && (
                        <Avatar
                            src={avatar}
                            size="sm"
                            sx={{ width: 20, height: 20, fontSize: 10 }}
                        />
                    )}
                    <Typography level="body-xs" sx={{ color: palette.text }}>
                        Opened by <strong>{author}</strong> · {relativeAgo(pull.created_at)}
                    </Typography>
                </Stack>
            )}

            {(headRef || baseRef) && (
                <Typography
                    level="body-xs"
                    sx={{
                        color: palette.text,
                        fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 11,
                    }}
                >
                    {headRef ?? "?"} → {baseRef ?? "?"}
                </Typography>
            )}

            <Divider sx={{ borderColor: palette.divider }} />

            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
                {commits != null && (
                    <Typography level="body-xs" sx={{ color: palette.text }}>
                        {commits} commit{commits === 1 ? "" : "s"}
                    </Typography>
                )}
                {(adds != null || dels != null) && (
                    <Typography level="body-xs" sx={{ color: palette.text }}>
                        {/* Diff +/- colors are functional, not branded —
                            keep GitHub's canonical green/red but pick
                            the shade that's readable on each theme. */}
                        <span style={{ color: isDark ? "#7ee787" : "#1a7f37" }}>+{adds ?? 0}</span>{" "}
                        <span style={{ color: isDark ? "#ffa198" : "#cf222e" }}>−{dels ?? 0}</span>
                        {changed != null ? ` · ${changed} file${changed === 1 ? "" : "s"}` : ""}
                    </Typography>
                )}
                {comments > 0 && (
                    <Typography level="body-xs" sx={{ color: palette.text }}>
                        {comments} comment{comments === 1 ? "" : "s"}
                    </Typography>
                )}
            </Stack>

            <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                Updated {relativeAgo(pull.updated_at)}
            </Typography>
        </Stack>
    );
};

export const LinkedPrCard = ({ url, accessToken, hideOnNotConnected }: Props) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const [result, setResult] = useState<PrStatusResult | null>(null);

    useEffect(() => {
        let cancelled = false;
        setResult(null);
        (async () => {
            const r = await getCachedOrFetchPrStatus(accessToken, url);
            if (cancelled) return;
            setResult(r);
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken, url]);

    if (result === null) {
        return (
            <Card variant="outlined" sx={{ p: 1.5 }}>
                <Stack alignItems="center" sx={{ py: 1 }}>
                    <CircularProgress size="sm" />
                </Stack>
            </Card>
        );
    }

    if (result.kind === "github_not_connected") {
        // Chat / task-comment unfurl path opts out of the inline Connect
        // prompt — rendering it under every PR-bearing message would be
        // visually noisy. Task metadata view keeps it.
        if (hideOnNotConnected) return null;
        return (
            <Card variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1.25}>
                    <Alert color="primary" startDecorator={<GitHubIcon />}>
                        {t.tasks.linkedPr.connectPrompt}
                    </Alert>
                    <Button
                        size="sm"
                        onClick={() => {
                            void redirectToOAuthConnect(
                                "github",
                                accessToken,
                                window.location.pathname
                            );
                        }}
                        startDecorator={<LinkRoundedIcon />}
                        sx={{ alignSelf: "flex-start" }}
                    >
                        {t.tasks.linkedPr.connectButton}
                    </Button>
                </Stack>
            </Card>
        );
    }

    if (result.kind === "error") {
        return (
            <Card
                variant="outlined"
                component="a"
                href={url}
                target="_blank"
                rel="noreferrer"
                sx={{
                    p: 1.5,
                    textDecoration: "none",
                    color: "inherit",
                    "&:hover": { borderColor: "primary.500" },
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1.25}>
                    <GitHubIcon sx={{ color: "neutral.500" }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                            {t.tasks.linkedPr.privateOrDeleted}
                        </Typography>
                        <Typography
                            level="body-xs"
                            sx={{
                                color: "text.tertiary",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {url}
                        </Typography>
                    </Box>
                    <OpenInNewRoundedIcon sx={{ color: "text.tertiary", fontSize: 18 }} />
                </Stack>
            </Card>
        );
    }

    const { pull, combined_status, check_runs } = result.payload;
    const prState = derivePrState(pull);
    const ci = deriveCiState(combined_status, check_runs);

    return (
        <Tooltip
            arrow
            placement="top-start"
            variant="plain"
            size="sm"
            title={<HoverDetails payload={result.payload} isDark={isDark} />}
            sx={{
                maxWidth: 320,
                // The visible surface lives on `HoverDetails`' inner
                // Stack (palette.surfaceSolid + border + shadow), so
                // make this outer wrapper transparent / unpadded —
                // otherwise we'd render two stacked card surfaces.
                bgcolor: "transparent",
                border: "none",
                boxShadow: "none",
                p: 0,
                color: palette.text,
                // Tint the arrow to the same solid surface so it looks
                // attached to the inner panel.
                "--Tooltip-arrowColor": palette.surfaceSolid,
            }}
        >
            <Card
                variant="outlined"
                component="a"
                href={pull.html_url}
                target="_blank"
                rel="noreferrer"
                sx={{
                    p: 1.5,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "border-color 0.15s, transform 0.15s",
                    "&:hover": {
                        borderColor: "primary.500",
                        transform: "translateY(-1px)",
                    },
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1.25}>
                    {/* PR state octicon */}
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                        <PrStateIcon state={prState} size={18} />
                    </Box>

                    {/* Title + repo path */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            level="title-sm"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {pull.title}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                            {pull.base.repo.full_name} #{pull.number}
                        </Typography>
                    </Box>

                    {/* CI badge */}
                    <Tooltip title={ciTooltipLabel(ci, t)} size="sm">
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                            <CiBadge state={ci} size={16} />
                        </Box>
                    </Tooltip>

                    {/* State chip */}
                    <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                            backgroundColor: `${prStateColor(prState)}1f`,
                            color: prStateColor(prState),
                            fontWeight: 600,
                        }}
                    >
                        {stateLabel(prState, t)}
                    </Chip>

                    {/* Open-in-new affordance — purely decorative now that
                        the whole card is clickable, but keeps the existing
                        visual cue. */}
                    <OpenInNewRoundedIcon sx={{ color: "text.tertiary", fontSize: 16 }} />
                </Stack>
            </Card>
        </Tooltip>
    );
};
