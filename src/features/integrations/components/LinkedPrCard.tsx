import React, { useEffect, useState } from "react";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Alert, Box, Button, Card, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonLines } from "../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { redirectToOAuthConnect } from "../services/oauth";
import { getCachedOrFetchPrStatus, type PrStatusResult } from "../services/prStatusCache";
import {
    ciStateColor,
    deriveCiState,
    derivePrState,
    prStateColor,
    type CiState,
    type PrState,
} from "../utils/prState";
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
import { PrHoverDetails } from "./PrHoverDetails";

interface Props {
    url: string;
    accessToken: string;
    /** When true, render nothing if the user hasn't connected GitHub.
     *  Chat / task-comment unfurls use this so a single chat scroll
     *  doesn't show a "Connect GitHub" prompt for every PR-bearing
     *  message. Task metadata view keeps the default (prompt visible). */
    hideOnNotConnected?: boolean;
}

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
    const color = ciStateColor(state);
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

const stateLabel = (state: PrState, t: ReturnType<typeof useTranslation>["t"]): string => {
    switch (state) {
        case "merged":
            return t.integrations.pullRequest.linkedCard.state.merged;
        case "draft":
            return t.integrations.pullRequest.linkedCard.state.draft;
        case "closed":
            return t.integrations.pullRequest.linkedCard.state.closed;
        case "open":
        default:
            return t.integrations.pullRequest.linkedCard.state.open;
    }
};

const ciTooltipLabel = (state: CiState, t: ReturnType<typeof useTranslation>["t"]): string => {
    switch (state) {
        case "passing":
            return t.integrations.pullRequest.linkedCard.ci.passing;
        case "failing":
            return t.integrations.pullRequest.linkedCard.ci.failing;
        case "pending":
            return t.integrations.pullRequest.linkedCard.ci.pending;
        case "none":
        default:
            return t.integrations.pullRequest.linkedCard.ci.none;
    }
};

export const LinkedPrCard = ({ url, accessToken, hideOnNotConnected }: Props) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const [result, setResult] = useState<PrStatusResult | null>(null);
    // Bumped by Retry: the effect below runs again for the same PR.
    const [attempt, setAttempt] = useState(0);

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
    }, [accessToken, url, attempt]);

    if (result === null) {
        return (
            <Card sx={{ p: 1.5 }} variant="outlined">
                <SkeletonLines lines={2} />
            </Card>
        );
    }

    if (result.kind === "github_not_connected") {
        // Chat / task-comment unfurl path opts out of the inline Connect
        // prompt — rendering it under every PR-bearing message would be
        // visually noisy. Task metadata view keeps it.
        if (hideOnNotConnected) return null;
        return (
            <Card sx={{ p: 1.5 }} variant="outlined">
                <Stack spacing={1.25}>
                    <Alert color="primary" startDecorator={<GitHubIcon />}>
                        {t.integrations.pullRequest.linkedCard.connectPrompt}
                    </Alert>
                    <Button
                        size="sm"
                        startDecorator={<LinkRoundedIcon />}
                        sx={{ alignSelf: "flex-start" }}
                        onClick={() => {
                            void redirectToOAuthConnect(
                                "github",
                                accessToken,
                                window.location.pathname
                            );
                        }}
                    >
                        {t.integrations.pullRequest.linkedCard.connectButton}
                    </Button>
                </Stack>
            </Card>
        );
    }

    if (result.kind === "error") {
        // A lookup that failed is NOT "this PR is gone": a dropped connection
        // looks the same as a private repo from here, so the card says what
        // failed, offers Retry, and still lets the person open the PR on GitHub.
        return (
            <Card sx={{ p: 1.5 }} variant="outlined">
                <Stack alignItems="center" direction="row" spacing={1.25}>
                    <GitHubIcon sx={{ color: "neutral.500" }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <ErrorState
                            data-error="linked-pr"
                            secondary={{
                                label: t.integrations.github.openOnGithub,
                                href: url,
                            }}
                            size="xs"
                            title={t.integrations.pullRequest.linkedCard.loadFailed}
                            onRetry={() => setAttempt((n) => n + 1)}
                        />
                    </Box>
                </Stack>
            </Card>
        );
    }

    const { pull, combined_status, check_runs } = result.payload;
    const prState = derivePrState(pull);
    const ci = deriveCiState(combined_status, check_runs);

    return (
        <AppTooltip
            arrowColor={palette.surfaceSolid}
            maxWidth={320}
            placement="top-start"
            size="sm"
            surface="none"
            title={<PrHoverDetails isDark={isDark} payload={result.payload} />}
        >
            <Card
                component="a"
                href={pull.html_url}
                rel="noreferrer"
                target="_blank"
                variant="outlined"
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
                <Stack alignItems="center" direction="row" spacing={1.25}>
                    {/* PR state octicon */}
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                        <PrStateIcon size={18} state={prState} />
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
                    <AppTooltip size="sm" title={ciTooltipLabel(ci, t)}>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                            <CiBadge size={16} state={ci} />
                        </Box>
                    </AppTooltip>

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
        </AppTooltip>
    );
};
