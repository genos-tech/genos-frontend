import React, { useEffect, useState } from "react";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../components/ui/AppTooltip";
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
            title={<PrHoverDetails payload={result.payload} isDark={isDark} />}
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
                    <AppTooltip title={ciTooltipLabel(ci, t)} size="sm">
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                            <CiBadge state={ci} size={16} />
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
        </Tooltip>
    );
};
