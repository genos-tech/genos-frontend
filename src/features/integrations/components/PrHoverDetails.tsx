import { Avatar, Box, Divider, Stack, Typography } from "@mui/joy";

import { purplePalette } from "../../../theme/purplePalette";
import type { PrDetailResponse } from "../services/prTypes";

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

interface Props {
    payload: PrDetailResponse;
    isDark: boolean;
    // When the calling surface doesn't already show the PR title /
    // repo path (e.g. the table's PR column where the cell is just an
    // icon), set this to render them at the top of the tooltip. The
    // full LinkedPrCard already shows those in its visible card, so
    // it omits the header to avoid duplication.
    includeHeader?: boolean;
}

// Rich hover content for a PR: author, branch, stats, opened/updated
// dates. Rendered inside Tooltip's `title` prop. Colors flow through
// `purplePalette` so the panel matches menus/popovers elsewhere instead
// of Joy's stock white-on-black solid tooltip.
export const PrHoverDetails = ({ payload, isDark, includeHeader = false }: Props) => {
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
            {includeHeader && (
                <Stack spacing={0.25}>
                    <Typography
                        level="body-sm"
                        sx={{ color: palette.text, fontWeight: 600, lineHeight: 1.3 }}
                    >
                        {pull.title}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                        {pull.base.repo.full_name} #{pull.number}
                    </Typography>
                </Stack>
            )}

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
