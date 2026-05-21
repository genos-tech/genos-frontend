import { useEffect, useState } from "react";
import { Box, Stack, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { purplePalette } from "../../../theme/purplePalette";
import { loadLinkedPulls, type LinkedPull } from "../services/github";
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
//   1. `loadLinkedPulls(taskId)` — server-cached list of "auto-linked"
//      PR URLs for this task.
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

const prStateLabel = (state: PrState): string => {
    switch (state) {
        case "merged":
            return "Merged";
        case "draft":
            return "Draft";
        case "closed":
            return "Closed";
        case "open":
        default:
            return "Open";
    }
};

const ciStateLabel = (state: CiState): string => {
    switch (state) {
        case "passing":
            return "CI passing";
        case "failing":
            return "CI failing";
        case "pending":
            return "CI pending";
        case "none":
        default:
            return "No CI";
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
            payload={detail.payload as PrDetailResponse}
            isDark={isDark}
            includeHeader
        />
    ) : (
        <Stack spacing={0.25} sx={{ p: 0.5, color: palette.text }}>
            <Box sx={{ fontWeight: 600 }}>
                {repoLabel} #{pull.number}
            </Box>
            <Box sx={{ fontSize: 11, color: palette.textMuted }}>{title}</Box>
            <Box sx={{ fontSize: 11 }}>
                {prStateLabel(prState)} · {ciStateLabel(ci)}
            </Box>
        </Stack>
    );

    return (
        <Tooltip
            arrow
            size="sm"
            placement="top"
            variant={hasDetail ? "plain" : undefined}
            title={hoverTitle}
            sx={
                hasDetail
                    ? {
                          maxWidth: 320,
                          // Surface lives on the inner Stack — keep the
                          // outer wrapper transparent so we don't stack
                          // two card surfaces.
                          bgcolor: "transparent",
                          border: "none",
                          boxShadow: "none",
                          p: 0,
                          color: palette.text,
                          "--Tooltip-arrowColor": palette.surfaceSolid,
                      }
                    : undefined
            }
        >
            <Box
                component="a"
                href={pull.html_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
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
        </Tooltip>
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
            const list = await loadLinkedPulls(accessToken, taskId);
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
                    pull={pull}
                    accessToken={accessToken}
                    isDark={isDark}
                />
            ))}
        </Stack>
    );
};
