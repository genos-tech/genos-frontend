import { useEffect, useRef, useState } from "react";
import { Box, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { usePrResyncRequest } from "../hooks/usePrResyncRequest";
import {
    loadLinkedPullsBatched,
    refreshLinkedPullsBatched,
    type LinkedPull,
} from "../services/github";
import {
    beginPrResyncWork,
    reportPrResyncOutcome,
    type PrResyncRequest,
} from "../services/prResync";
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
//
// Both layers load once per mount. After that the column is re-synced by a request from
// `prResync` (MIP-1409): the Refresh tasks click (every row, past every cache) and a poll
// about once a minute (only the rows that show an open or draft PR). A re-sync that fails
// leaves what is drawn alone.

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

// A merged or closed PR is final: the list payload already says which, and
// the detail request only adds the CI dot and the richer hover card. It is
// three GitHub calls on the server (about 1.2 s the first time), and a table
// mounts a dozen of them at once, most of them for PRs nobody is looking at.
// So these rows draw from the list and ask for the detail when the chip is
// hovered or focused (MIP-994). Open and draft PRs still ask at mount: their
// CI is the live signal the dot exists for.
const isFinishedPull = (pull: LinkedPull): boolean =>
    pull.merged_at != null || pull.state === "closed";

// One badge per PR. We have the URL from the server list but the
// detailed state (merged/draft/closed) + CI signal need a second fetch
// — that's what `prStatusCache` is for. The list response already
// carries enough info (`state`, `draft`, `merged_at`) to render a
// reasonable badge without the second fetch, so we use the list state
// as a fast first-paint and upgrade once detail lands. For a finished PR
// that fetch waits for the first hover or focus (`isFinishedPull`).
const SinglePrBadge = ({
    pull,
    accessToken,
    isDark,
    showRepo,
    resync,
}: {
    pull: LinkedPull;
    accessToken: string | null;
    isDark: boolean;
    /** Name the repo in the label: only worth the room when the task's PRs span repos. */
    showRepo: boolean;
    /** The latest request to re-sync the column (MIP-1409). */
    resync: PrResyncRequest;
}) => {
    const { t } = useTranslation();
    const [detail, setDetail] = useState<PrStatusResult | null>(null);
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const finished = isFinishedPull(pull);
    // Latches on the first hover or focus. Computed from the live `pull` too,
    // so a PR that was finished when the row mounted and is open by the next
    // refresh (reopened) is fetched like any open one.
    const [asked, setAsked] = useState(false);
    const needsDetail = asked || !finished;

    useEffect(() => {
        if (!accessToken || !needsDetail) return;
        let cancelled = false;
        (async () => {
            const r = await getCachedOrFetchPrStatus(accessToken, pull.html_url);
            if (!cancelled) setDetail(r);
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken, pull.html_url, needsDetail]);
    const ask = () => setAsked(true);

    // Re-sync (MIP-1409). A click re-asks for any PR whose detail is showing or due; a poll
    // only for one that can still change. The latest values are read through a ref so that
    // a list update or a hover during the request does not cancel it.
    const latest = useRef({ accessToken, url: pull.html_url, finished, needsDetail });
    useEffect(() => {
        latest.current = { accessToken, url: pull.html_url, finished, needsDetail };
    });
    const handledResync = useRef(resync.id);
    useEffect(() => {
        if (resync.id === handledResync.current) return undefined;
        handledResync.current = resync.id;
        const now = latest.current;
        const token = now.accessToken;
        if (!token) return undefined;
        if (!(resync.reason === "manual" ? now.needsDetail : !now.finished)) return undefined;
        let cancelled = false;
        // A click's Refresh button waits for this (MIP-1411).
        const finishWork = beginPrResyncWork(resync.id);
        (async () => {
            const r = await getCachedOrFetchPrStatus(token, now.url, undefined, {
                forceRefresh: true,
            });
            // A refresh that failed leaves the detail already drawn alone.
            if (!cancelled)
                setDetail((prev) => (r.kind === "ok" || prev?.kind !== "ok" ? r : prev));
            // "Refused" and "not connected" are answers; only a failed request is a failure.
            finishWork(r.kind !== "error");
        })();
        return () => {
            cancelled = true;
        };
    }, [resync.id, resync.reason]);

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
    // The list can be newer than the detail: a re-sync asks for both at once, and the detail
    // may be on its way or may have failed. A list that says the PR is finished beats a
    // detail that still says open, or a merged PR would be drawn open (MIP-1409).
    const detailPayload = detail?.kind === "ok" ? (detail.payload as PrDetailResponse) : null;
    const detailState = detailPayload ? derivePrState(detailPayload.pull) : null;
    const detailIsStale = finished && (detailState === "open" || detailState === "draft");
    const usableDetail = detailPayload && !detailIsStale ? detailPayload : null;
    if (usableDetail) {
        prState = derivePrState(usableDetail.pull);
        ci = deriveCiState(usableDetail.combined_status, usableDetail.check_runs);
        title = usableDetail.pull.title || title;
        repoLabel = usableDetail.pull.base.repo.full_name || repoLabel;
    }
    const ciColor = ciStateColor(ci);

    // Once detail is loaded, render the rich `PrHoverDetails` panel
    // shared with LinkedPrCard so the table column's hover matches the
    // task preview. Before detail lands we fall back to a small tooltip
    // built from the list payload (title, repo, derived state) so
    // there's no empty hover during the first paint.
    const hasDetail = usableDetail != null;
    const hoverTitle = usableDetail ? (
        <PrHoverDetails isDark={isDark} payload={usableDetail} includeHeader />
    ) : (
        <Stack spacing={0.25} sx={{ p: 0.5, color: palette.text }}>
            <Box sx={{ fontWeight: 600 }}>
                {repoLabel} #{pull.number}
            </Box>
            <Box sx={{ fontSize: 11, color: palette.textMuted }}>{title}</Box>
            <Box sx={{ fontSize: 11, color: palette.textMuted }}>{pull.branch}</Box>
            <Box sx={{ fontSize: 11 }}>
                {/* "No CI" would claim something we have not asked about yet. */}
                {finished
                    ? prStateLabel(prState, t)
                    : `${prStateLabel(prState, t)} · ${ciStateLabel(ci, t)}`}
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
                aria-label={`${pull.owner}/${pull.repo} #${pull.number}`}
                component="a"
                href={pull.html_url}
                rel="noreferrer"
                target="_blank"
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    // A long repo name shrinks (ellipsis below) instead of pushing
                    // the chip wider than the column.
                    minWidth: 0,
                    maxWidth: "100%",
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
                onFocus={ask}
                onMouseEnter={ask}
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
                {/* Which PR this is: the icon only says its state, and a task's
                    PRs all look alike. The number never truncates; a long repo
                    name gives way first. Spans, not divs: a div inside the chip
                    reads as the CI dot. */}
                <Box
                    component="span"
                    sx={{
                        display: "inline-flex",
                        minWidth: 0,
                        gap: "2px",
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                    }}
                >
                    {showRepo && (
                        <Box
                            component="span"
                            sx={{
                                minWidth: 0,
                                maxWidth: 88,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                color: palette.textMuted,
                                fontWeight: 500,
                            }}
                        >
                            {pull.repo}
                        </Box>
                    )}
                    <Box component="span" sx={{ flexShrink: 0 }}>
                        #{pull.number}
                    </Box>
                </Box>
            </Box>
        </AppTooltip>
    );
};

// Repo, then PR number: the same order on every load, whatever order the
// server listed them in, so a chip never jumps when the list refreshes.
const byRepoThenNumber = (a: LinkedPull, b: LinkedPull): number =>
    `${a.owner}/${a.repo}`.localeCompare(`${b.owner}/${b.repo}`) || a.number - b.number;

// Helper used by tests / future callers that want to use the CI badge
// component standalone. Kept exported so it doesn't get marked dead.
export const _CiBadgeForTests = CiBadge;

// The same list, row for row: a re-sync that found nothing new must not re-render the cell.
const samePulls = (a: LinkedPull[] | null, b: LinkedPull[]): boolean =>
    a != null && JSON.stringify(a) === JSON.stringify(b);

export const PrStatusCell = ({ taskId, accessToken }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [pulls, setPulls] = useState<LinkedPull[] | null>(null);
    // Subscribing also keeps the once-a-minute clock running while any cell is on screen.
    const resync = usePrResyncRequest();
    const shown = useRef<LinkedPull[] | null>(null);
    useEffect(() => {
        shown.current = pulls;
    }, [pulls]);
    const handledResync = useRef(resync.id);

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

    // Re-sync (MIP-1409). A row still loading for the first time has nothing to refresh: its
    // own load is the sync. A poll only covers a row that shows an open or draft PR.
    useEffect(() => {
        if (resync.id === handledResync.current) return undefined;
        handledResync.current = resync.id;
        const before = shown.current;
        if (!accessToken || before == null) return undefined;
        if (resync.reason === "poll" && !before.some((p) => !isFinishedPull(p))) return undefined;
        let cancelled = false;
        // A click's Refresh button waits for this (MIP-1411).
        const finishWork = beginPrResyncWork(resync.id);
        (async () => {
            let went = false;
            try {
                const next = await refreshLinkedPullsBatched(accessToken, taskId, {
                    fresh: resync.reason === "manual",
                });
                if (resync.reason === "poll") reportPrResyncOutcome(resync.id, next !== null);
                went = next !== null;
                // A failed request keeps what is drawn, and so does a row the server says it
                // could not fully look at (the loader hands both back as null, MIP-1412).
                if (cancelled || next === null) return;
                // A poll that answers "no PRs" for a row that has some is not believed unless
                // the server vouches for it: a PR does not vanish, but a GitHub that refuses us
                // is read by an older server as "no PR", and the chips would blink out once a
                // minute. A server that reports completeness names the rows it could not look
                // at, so for the others an empty list is the truth. A click is the user asking,
                // and gets the answer.
                if (
                    resync.reason === "poll" &&
                    !next.complete &&
                    next.pulls.length === 0 &&
                    before.length > 0
                ) {
                    return;
                }
                setPulls((prev) => (samePulls(prev, next.pulls) ? prev : next.pulls));
            } finally {
                finishWork(went);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [resync.id, resync.reason, accessToken, taskId]);

    if (!pulls || pulls.length === 0) return null;
    const sorted = [...pulls].sort(byRepoThenNumber);
    const showRepo = new Set(sorted.map((p) => `${p.owner}/${p.repo}`)).size > 1;
    return (
        // Wraps: a wide column keeps every chip on one line, a narrow one stacks
        // them (the row grows to fit), instead of spilling past the column edge.
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                minWidth: 0,
                maxWidth: "100%",
            }}
        >
            {sorted.map((pull) => (
                <SinglePrBadge
                    key={pull.html_url}
                    accessToken={accessToken}
                    isDark={isDark}
                    pull={pull}
                    resync={resync}
                    showRepo={showRepo}
                />
            ))}
        </Box>
    );
};
