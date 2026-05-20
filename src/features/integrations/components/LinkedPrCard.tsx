import React, { useEffect, useState } from "react";
import CallMergeRoundedIcon from "@mui/icons-material/CallMergeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PendingRoundedIcon from "@mui/icons-material/PendingRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { redirectToOAuthConnect } from "../services/oauth";
import { getCachedOrFetchPrStatus, type PrStatusResult } from "../services/prStatusCache";
import type { CheckRunsResponse, CombinedStatus, PrDetailResponse } from "../services/prTypes";

interface Props {
    url: string;
    accessToken: string;
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

type StateChip = {
    label: string;
    color: "neutral" | "success" | "warning" | "primary" | "danger";
};

const stateChipFor = (
    pull: PrDetailResponse["pull"],
    t: ReturnType<typeof useTranslation>["t"]
): StateChip => {
    if (pull.merged) return { label: t.tasks.linkedPr.stateMerged, color: "primary" };
    if (pull.draft) return { label: t.tasks.linkedPr.stateDraft, color: "neutral" };
    if (pull.state === "open") return { label: t.tasks.linkedPr.stateOpen, color: "success" };
    return { label: t.tasks.linkedPr.stateClosed, color: "neutral" };
};

const ciIconAndColor = (
    state: CiState,
    t: ReturnType<typeof useTranslation>["t"]
): { icon: React.ReactElement; tooltip: string } => {
    switch (state) {
        case "passing":
            return {
                icon: <CheckCircleRoundedIcon sx={{ color: "success.500", fontSize: 18 }} />,
                tooltip: t.tasks.linkedPr.ciPassing,
            };
        case "failing":
            return {
                icon: <ErrorOutlineRoundedIcon sx={{ color: "danger.500", fontSize: 18 }} />,
                tooltip: t.tasks.linkedPr.ciFailing,
            };
        case "pending":
            return {
                icon: <PendingRoundedIcon sx={{ color: "warning.500", fontSize: 18 }} />,
                tooltip: t.tasks.linkedPr.ciPending,
            };
        case "none":
        default:
            return {
                icon: <PendingRoundedIcon sx={{ color: "neutral.400", fontSize: 18 }} />,
                tooltip: t.tasks.linkedPr.ciNone,
            };
    }
};

export const LinkedPrCard = ({ url, accessToken }: Props) => {
    const { t } = useTranslation();
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

    // Loading
    if (result === null) {
        return (
            <Card variant="outlined" sx={{ p: 1.5 }}>
                <Stack alignItems="center" sx={{ py: 1 }}>
                    <CircularProgress size="sm" />
                </Stack>
            </Card>
        );
    }

    // GitHub not connected — render the same Alert + Connect button pattern
    // the integrations page uses, scoped to this card.
    if (result.kind === "github_not_connected") {
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

    // Generic error (404 from upstream, network failure, malformed URL) —
    // show the URL with a graceful fallback link.
    if (result.kind === "error") {
        return (
            <Card variant="outlined" sx={{ p: 1.5 }}>
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
                    <IconButton
                        size="sm"
                        variant="plain"
                        component="a"
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t.tasks.linkedPr.openOnGithub}
                    >
                        <OpenInNewRoundedIcon />
                    </IconButton>
                </Stack>
            </Card>
        );
    }

    const { pull, combined_status, check_runs } = result.payload;
    const chip = stateChipFor(pull, t);
    const ci = deriveCiState(combined_status, check_runs);
    const ciDisplay = ciIconAndColor(ci, t);
    const lastUpdated = new Date(pull.updated_at).toLocaleString();

    return (
        <Card variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
                {pull.merged ? (
                    <CallMergeRoundedIcon sx={{ color: "primary.500" }} />
                ) : (
                    <GitHubIcon sx={{ color: "neutral.600" }} />
                )}
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
                <Tooltip title={ciDisplay.tooltip} size="sm">
                    <Box sx={{ display: "flex", alignItems: "center" }}>{ciDisplay.icon}</Box>
                </Tooltip>
                <Chip size="sm" color={chip.color} variant="soft">
                    {chip.label}
                </Chip>
                <Tooltip
                    title={fmt(t.tasks.linkedPr.lastUpdated, { when: lastUpdated })}
                    size="sm"
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        component="a"
                        href={pull.html_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t.tasks.linkedPr.openOnGithub}
                    >
                        <OpenInNewRoundedIcon />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Card>
    );
};
