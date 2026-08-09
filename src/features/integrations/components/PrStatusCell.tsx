import { useEffect, useState } from "react";
import { Box, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { loadLinkedPullsBatched, type LinkedPull } from "../services/github";
import { getCachedOrFetchPrStatus, type PrStatusResult } from "../services/prStatusCache";
import type { PrDetailResponse } from "../services/prTypes";
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

// Compact PR/CI badge for the task table's PR column.
//
// Source of truth: the backend's `pulls-for-task` endpoint, which
// returns PRs whose head branch matches the task's display ID (e.g.
// branch `feature/GEN-42-fix` for task `GEN-42`). Auto-linking via
// the branch naming convention is the single source — manually-pasted
// PR URLs in `task.links` are intentionally not surfaced here.
//
// Two-layer fetch:
//   1. `loadLinkedPullsBatched(taskId)` — all cells mounting within
//      one paint coalesce into a single `pulls/for-tasks/` request
//      (a table of 100 rows is one GET, not 100), memoised 60s per
//      task to match the server's Redis TTL.
//   2. `getCachedOrFetchPrStatus(url)` — client-cached PR detail used
//      to derive the state + CI badge. Reuses the same module-scoped
//      TTL cache as LinkedPrCard so revisits are instant.

type Props = {
    /** Task ID to look up auto-linked PRs for. */
    taskId: number | string;
    accessToken: string | null;
};

const PrStateIcon = ({ state, size = 14 }: { state: PrState; size?: number }) => {
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

const CiBadge = ({ state, size = 10 }: { state: CiState; size?: number }) => {
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

const prStateLabel = (state: PrState, t: ReturnType<typeof useTranslation>["t"]): string => {
    switch (state) {
        case "merged":
            return t.integrations.pullRequest.state.merged;
        case "draft":
            return t.integrations.pullRequest.state.draft;
        case "closed":
            return t.integrations.pullRequest.state.closed;
        case "open":
        default:
            return t.integrations.pullRequest.state.open;
    }
};

const ciStateLabel = (state: CiState, t: ReturnType<typeof useTranslation>["t"]): string => {
    switch (state) {
        case "passing":
            return t.integrations.pullRequest.ci.passing;
        case "failing":
            return t.integrations.pullRequest.ci.failing;
        case "pending":
            return t.integrations.pullRequest.ci.pending;
        case "none":
        default:
            return t.integrations.pullRequest.ci.none;
    }
};

// One badge per PR. We have the URL from the server list but the
// detailed state (merged/draft/closed) + CI signal need a second fetch
// — that's what `prStatusCache` is for. The list response already
// carries enough info (`state`, `draft`, `merged_at`) to render a
// reasonable badge without the second fetch, so we use the list state
// as a fast first-paint and upgrade once detail lands.
const SinglePrBadge = ({
    pull,
    accessToken,
    isDark,
}: {
    pull: LinkedPull;
    accessToken: string | null;
    isDark: boolean;
}) => {
    const { t } = useTranslation();
    const [detail, setDetail] = useState<PrStatusResult | null>(null);
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        (async () => {
            const r = await getCachedOrFetchPrStatus(accessToken, pull.html_url);
            if (!cancelled) setDetail(r);
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken, pull.html_url]);

    // Derive a PR state from the list payload until detail lands.
    // Mirrors the backend list shape (`state` is open/closed, `merged_at`
    // distinguishes merged from closed-unmerged).
    const fallbackPrState: PrState = pull.merged_at
        ? "merged"
        : pull.draft
          ? "draft"
          : pull.state === "open"
            ? "open"
            : "closed";

    let prState: PrState = fallbackPrState;
    let ci: CiState = "none";
    let title = pull.title;
    let repoLabel = `${pull.owner}/${pull.repo}`;
    if (detail && detail.kind === "ok") {
        const payload = detail.payload as PrDetailResponse;
        prState = derivePrState(payload.pull);
        ci = deriveCiState(payload.combined_status, payload.check_runs);
        title = payload.pull.title || title;
        repoLabel = payload.pull.base.repo.full_name || repoLabel;
    }
    const ciColor = ciStateColor(ci);

    // Once detail is loaded, render the rich `PrHoverDetails` panel
    // shared with LinkedPrCard so the table column's hover matches the
    // task preview. Before detail lands we fall back to a small tooltip
    // built from the list payload (title, repo, derived state) so
    // there's no empty hover during the first paint.
    const hasDetail = detail?.kind === "ok";
    const hoverTitle = hasDetail ? (
        <PrHoverDetails
            isDark={isDark}
            payload={detail.payload as PrDetailResponse}
            includeHeader
        />
    ) : (
        <Stack spacing={0.25} sx={{ p: 0.5, color: palette.text }}>
            <Box sx={{ fontWeight: 600 }}>
                {repoLabel} #{pull.number}
            </Box>
            <Box sx={{ fontSize: 11, color: palette.textMuted }}>{title}</Box>
            <Box sx={{ fontSize: 11 }}>
                {prStateLabel(prState, t)} · {ciStateLabel(ci, t)}
            </Box>
        </Stack>
    );

    return (
        <AppTooltip
            arrowColor={hasDetail ? palette.surfaceSolid : undefined}
            maxWidth={hasDetail ? 320 : undefined}
            placement="top"
            size="sm"
            surface={hasDetail ? "none" : "chip"}
            title={hoverTitle}
        >
            <Box
                component="a"
                href={pull.html_url}
                rel="noreferrer"
                target="_blank"
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 0.75,
                    py: 0.25,
                    cursor: "pointer",
                    textDecoration: "none",
                    color: "inherit",
                    borderRadius: "6px",
                    // Brand-purple chip surface matching LinkedPrCard and
                    // other "soft" chips across the app — same family of
                    // interactive element, so the PR column reads as a
                    // brand chip instead of a neutral grey badge.
                    background: palette.chipBg,
                    border: `1px solid ${palette.chipBorder}`,
                    transition: "background-color 0.15s ease, border-color 0.15s ease",
                    "&:hover": {
                        background: palette.buttonBgHover,
                        borderColor: palette.borderStrong,
                    },
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <PrStateIcon state={prState} />
                {/* Tiny CI dot — easier to scan at row scale than the
                    full octicon. Hidden when there's no CI signal so we
                    don't imply "failing". */}
                {ci !== "none" && (
                    <Box
                        sx={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: ciColor,
                            flexShrink: 0,
                        }}
                    />
                )}
            </Box>
        </AppTooltip>
    );
};

// Helper used by tests / future callers that want to use the CI badge
// component standalone. Kept exported so it doesn't get marked dead.
export const _CiBadgeForTests = CiBadge;

export const PrStatusCell = ({ taskId, accessToken }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [pulls, setPulls] = useState<LinkedPull[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        setPulls(null);
        (async () => {
            const list = await loadLinkedPullsBatched(accessToken, taskId);
            if (!cancelled) setPulls(list);
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken, taskId]);

    if (!pulls || pulls.length === 0) return null;
    return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "nowrap" }}>
            {pulls.map((pull) => (
                <SinglePrBadge
                    key={pull.html_url}
                    accessToken={accessToken}
                    isDark={isDark}
                    pull={pull}
                />
            ))}
        </Stack>
    );
};
