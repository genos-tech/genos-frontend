import { useMemo } from "react";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import AssignmentIndRoundedIcon from "@mui/icons-material/AssignmentIndRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CallSplitRoundedIcon from "@mui/icons-material/CallSplitRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { Avatar, Box, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { GitHubIcon } from "../../../../../../assets/GithubIcon";
import { AvatarWithStatus } from "../../../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../../types/admin";
import { TaskActivityProps, TaskTableProps } from "../../../../../../types/tasks";
import { formatTaskDisplayId } from "../../../../utils/taskDisplayId";
import { effortLevels, priorities, statuses } from "../../../../utils/taskMeta";

type TaskActivityFeedProps = {
    /** Pre-loaded audit rows. Owned + fetched by `TaskPreview` so this
     *  feed can come and go (JoyUI `TabPanel` unmounts hidden children
     *  by default) without losing data or refetching every time. */
    activities: TaskActivityProps[];
    /** True while the parent is fetching `activities`. Shown only as a
     *  silent gate against the empty state — we never render an
     *  intermediate spinner because the typical fetch is sub-100ms and
     *  a flicker would itself read as a "refresh". */
    isLoading: boolean;
    /** Loaded tasks for the current project (the lightweight table
     *  shape — `id` + `displayId` are all this feed needs). Used as a
     *  best-effort fallback to render a parent-task reference with its
     *  display id ("PRF-123") on activity rows recorded before the
     *  backend started snapshotting `oldDisplayId` / `newDisplayId` into
     *  metadata. */
    allTasks: TaskTableProps[];
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};

type ChipPalette = { background: string; color: string };

// Map a (fieldName, label) pair to the canonical swatch defined in
// `taskMeta.ts` so the chips here always match the colors users see in
// the rest of the task UI (status badges, the priority/effort selectors
// in the create form, etc.). Returns null for fields without a curated
// palette (assignee, due date, parent, …) — those fall back to a
// neutral chip via the `else` branch in `<ValueChip>`.
//
// The fieldName values come from the backend signal table:
//   - "status"        → statuses (Open / WIP / Pending / Closed / …)
//   - "priority"      → priorities (Minimal / Low / Normal / High / …)
//   - "effort_level"  → effortLevels (Minimal / Low / Moderate / High / …)
// See `_TRACKED_TASK_FIELDS` in `backend_django/origin/signals/task_signals.py`.
const paletteFor = (
    fieldName: string | null | undefined,
    label: string | null | undefined
): ChipPalette | null => {
    if (!fieldName || !label) return null;
    const normalized = String(label).toLowerCase();

    const pickPalette = (
        color: string | null | undefined,
        textColor: string | null | undefined
    ): ChipPalette | null => (color ? { background: color, color: textColor || "#fff" } : null);

    switch (fieldName) {
        case "status": {
            const found = statuses.find((s) => s.status?.toLowerCase() === normalized);
            return found ? pickPalette(found.color, found.textColor) : null;
        }
        case "priority": {
            const found = priorities.find((p) => p.priority?.toLowerCase() === normalized);
            return found ? pickPalette(found.color, found.textColor) : null;
        }
        case "effort_level": {
            const found = effortLevels.find((e) => e.level?.toLowerCase() === normalized);
            return found ? pickPalette(found.color, found.textColor) : null;
        }
        default:
            return null;
    }
};

// Per-action icon. New action types fall back to a neutral history
// icon so a backend-only addition doesn't blank the row.
const actionIcon = (action: string) => {
    switch (action) {
        case "created":
            return <AddCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />;
        case "title_changed":
            return <EditOutlinedIcon sx={{ fontSize: 18 }} />;
        case "status_changed":
            return <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />;
        case "priority_changed":
            return <FlagOutlinedIcon sx={{ fontSize: 18 }} />;
        case "effort_changed":
            return <TimelineRoundedIcon sx={{ fontSize: 18 }} />;
        case "assignee_changed":
        case "reporter_changed":
        case "milestone_assignee_added":
        case "milestone_assignee_removed":
            return <AssignmentIndRoundedIcon sx={{ fontSize: 18 }} />;
        case "due_date_changed":
            return <CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />;
        case "description_edited":
            return <EditOutlinedIcon sx={{ fontSize: 18 }} />;
        case "tags_changed":
            return <LocalOfferOutlinedIcon sx={{ fontSize: 18 }} />;
        case "closed":
            return <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />;
        case "reopened":
            return <RestoreRoundedIcon sx={{ fontSize: 18 }} />;
        case "deleted":
            return <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />;
        case "attachment_added":
        case "attachment_removed":
            return <AttachFileRoundedIcon sx={{ fontSize: 18 }} />;
        case "comment_added":
        case "comment_edited":
        case "comment_deleted":
            return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />;
        case "pr_comment_added":
            return <GitHubIcon sx={{ fontSize: 18 }} />;
        case "pr_linked":
            return <CallSplitRoundedIcon sx={{ fontSize: 18 }} />;
        default:
            return <HistoryRoundedIcon sx={{ fontSize: 18 }} />;
    }
};

// Derive "owner/repo#number" from a PR URL like
// "https://github.com/acme/rocket/pull/42". Returns null when the URL
// doesn't fit the canonical PR shape — defensive against malformed
// activity metadata.
const formatPrRefFromUrl = (url: unknown): string | null => {
    if (typeof url !== "string") return null;
    const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    return m ? `${m[1]}/${m[2]}#${m[3]}` : null;
};

// Render branch for `pr_comment_added` activity rows. The row's actor
// is `null` (GitHub commenters aren't Genos users); identity comes from
// `metadata.github_username` + `metadata.github_avatar_url`. Layout
// breaks out of the parent's one-line `Stack` so we can fit a header
// line + an italic excerpt block underneath.
const PrCommentActivityRow = ({
    activity,
    isDark,
}: {
    activity: TaskActivityProps;
    isDark: boolean;
}) => {
    const metadata = activity.metadata ?? {};
    const githubUsername =
        typeof metadata.github_username === "string" ? metadata.github_username : "GitHub user";
    const githubAvatarUrl =
        typeof metadata.github_avatar_url === "string"
            ? (metadata.github_avatar_url as string)
            : undefined;
    const commentUrl =
        typeof metadata.comment_url === "string" ? (metadata.comment_url as string) : undefined;
    const commentExcerpt =
        typeof metadata.comment_excerpt === "string" ? (metadata.comment_excerpt as string) : "";
    const prRef = formatPrRefFromUrl(metadata.pr_url);
    const commentKind =
        metadata.comment_kind === "review" ? "review" : ("issue" as "review" | "issue");
    const filePath = typeof metadata.file_path === "string" ? metadata.file_path : null;
    const line = typeof metadata.line === "number" ? metadata.line : null;
    // The backend caps excerpts at 280 chars — show "…" so the user
    // knows there may be more content behind the link.
    const wasTruncated = commentExcerpt.length === 280;

    return (
        <Stack
            alignItems="flex-start"
            component={commentUrl ? "a" : "div"}
            direction="row"
            href={commentUrl}
            rel={commentUrl ? "noopener noreferrer" : undefined}
            spacing={1.25}
            target={commentUrl ? "_blank" : undefined}
            sx={{
                py: 1,
                px: 1,
                borderRadius: "8px",
                textDecoration: "none",
                color: "inherit",
                cursor: commentUrl ? "pointer" : "default",
                "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                },
            }}
        >
            <Avatar size="sm" src={githubAvatarUrl} sx={{ width: 24, height: 24, fontSize: 11 }}>
                {githubUsername[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={0.75}
                    sx={{ flexWrap: "wrap", rowGap: 0.25 }}
                >
                    <Box
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <GitHubIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        @{githubUsername}
                    </Typography>
                    <Typography
                        level="body-sm"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
                        }}
                    >
                        commented on
                    </Typography>
                    {prRef && (
                        <Typography
                            level="body-sm"
                            sx={{
                                fontFamily: "monospace",
                                fontSize: "0.8rem",
                                color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                            }}
                        >
                            {prRef}
                        </Typography>
                    )}
                    {commentKind === "review" && filePath && (
                        <Typography
                            level="body-xs"
                            sx={{
                                fontFamily: "monospace",
                                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
                            }}
                        >
                            on {filePath}
                            {line != null ? `:${line}` : ""}
                        </Typography>
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {formatRelative(activity.tsCreatedAt)}
                    </Typography>
                </Stack>
                {commentExcerpt && (
                    <Box
                        sx={{
                            mt: 0.5,
                            ml: 3,
                            pl: 1.5,
                            py: 0.5,
                            borderLeft: "2px solid",
                            borderLeftColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                        }}
                    >
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
                                fontStyle: "italic",
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                            }}
                        >
                            {commentExcerpt}
                            {wasTruncated ? "…" : ""}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Stack>
    );
};

// Render branch for a status change that was an automatic PR-merge
// close (`metadata.closedByPrMerge`). The GitHub webhook is
// unauthenticated, so the underlying row has a null actor and would
// otherwise read as an anonymous "Someone changed status from Open to
// Closed". Here we attribute it to the merged PR instead, linking the
// PR ref when `metadata.prUrl` is present, and still show the
// Open → Closed status chips for continuity with the other rows.
const PrMergeCloseActivityRow = ({
    activity,
    isDark,
}: {
    activity: TaskActivityProps;
    isDark: boolean;
}) => {
    const metadata = activity.metadata ?? {};
    const prUrl = typeof metadata.prUrl === "string" ? (metadata.prUrl as string) : undefined;
    const prRef = formatPrRefFromUrl(prUrl);
    const oldStatus = typeof activity.oldValue === "string" ? activity.oldValue : null;
    const newStatus = typeof activity.newValue === "string" ? activity.newValue : null;
    const mutedColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)";

    return (
        <Stack
            alignItems="center"
            direction="row"
            spacing={1.25}
            sx={{
                py: 1,
                px: 1,
                borderRadius: "8px",
                "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                },
            }}
        >
            <Avatar size="sm" sx={{ width: 30, height: 30 }}>
                <GitHubIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 0.75,
                    flexWrap: "wrap",
                }}
            >
                <Box
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
                </Box>
                <Typography level="body-sm" sx={{ color: mutedColor }}>
                    Auto-closed when
                </Typography>
                {prRef ? (
                    <Typography
                        component={prUrl ? "a" : "span"}
                        href={prUrl}
                        level="body-sm"
                        rel={prUrl ? "noopener noreferrer" : undefined}
                        target={prUrl ? "_blank" : undefined}
                        sx={{
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            textDecoration: "none",
                            color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                        }}
                    >
                        {prRef}
                    </Typography>
                ) : (
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        a pull request
                    </Typography>
                )}
                <Typography level="body-sm" sx={{ color: mutedColor }}>
                    was merged
                </Typography>
                {oldStatus && <ValueChip fieldName="status" isDark={isDark} label={oldStatus} />}
                {oldStatus && newStatus && (
                    <Typography
                        level="body-sm"
                        sx={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}
                    >
                        →
                    </Typography>
                )}
                {newStatus && <ValueChip fieldName="status" isDark={isDark} label={newStatus} />}
                <Box sx={{ flexGrow: 1 }} />
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                        whiteSpace: "nowrap",
                    }}
                >
                    {formatRelative(activity.tsCreatedAt)}
                </Typography>
            </Box>
        </Stack>
    );
};

// Render branch for a GitHub PR auto-linked to this task (`pr_linked`).
// The link is established when a PR is opened on a branch whose name
// carries the task's display id. Like the other GitHub rows the actor is
// null, so we anchor on a GitHub avatar and surface the PR ref (linked to
// the PR) plus the head branch chip that established the link.
const PrLinkActivityRow = ({
    activity,
    isDark,
}: {
    activity: TaskActivityProps;
    isDark: boolean;
}) => {
    const metadata = activity.metadata ?? {};
    const prUrl = typeof metadata.pr_url === "string" ? (metadata.pr_url as string) : undefined;
    const prRef = formatPrRefFromUrl(prUrl);
    const branch = typeof metadata.branch === "string" ? (metadata.branch as string) : null;
    const mutedColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)";

    return (
        <Stack
            alignItems="center"
            direction="row"
            spacing={1.25}
            sx={{
                py: 1,
                px: 1,
                borderRadius: "8px",
                "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                },
            }}
        >
            <Avatar size="sm" sx={{ width: 30, height: 30 }}>
                <GitHubIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 0.75,
                    flexWrap: "wrap",
                }}
            >
                <Box
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <CallSplitRoundedIcon sx={{ fontSize: 18 }} />
                </Box>
                <Typography level="body-sm" sx={{ color: mutedColor }}>
                    Linked pull request
                </Typography>
                {prRef ? (
                    <Typography
                        component={prUrl ? "a" : "span"}
                        href={prUrl}
                        level="body-sm"
                        rel={prUrl ? "noopener noreferrer" : undefined}
                        target={prUrl ? "_blank" : undefined}
                        sx={{
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            textDecoration: "none",
                            color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                        }}
                    >
                        {prRef}
                    </Typography>
                ) : (
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        a pull request
                    </Typography>
                )}
                {branch && (
                    <Chip
                        size="sm"
                        startDecorator={<CallSplitRoundedIcon sx={{ fontSize: 13 }} />}
                        sx={{ fontFamily: "monospace", fontSize: "0.72rem" }}
                        variant="outlined"
                    >
                        {branch}
                    </Chip>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                        whiteSpace: "nowrap",
                    }}
                >
                    {formatRelative(activity.tsCreatedAt)}
                </Typography>
            </Box>
        </Stack>
    );
};

// Smaller-than-Intl.RelativeTimeFormat formatter so we don't pull in a
// new dep. Returns "just now" / "5 minutes ago" / "2 hours ago" /
// "May 1, 2026".
const formatRelative = (iso: string): string => {
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return "";
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

// Best-effort label formatter for old/new value chips. Numbers that
// look like user ids get resolved against `teamMemberProfiles`;
// relation-id fields (parent task / milestone / sprint) prefer the
// human-readable title stashed in `metadata.oldLabel` / `newLabel`
// by the backend signal, falling back to "#<id>" so a missing /
// stale relation still renders something useful. Everything else
// is stringified.
const RELATION_ID_FIELDS = new Set(["parent_task_id", "milestone_id", "sprint_id"]);

const formatValue = (
    value: unknown,
    fieldName: string | null,
    teamMemberProfiles: Record<string, any>,
    metadata: Record<string, unknown> | null | undefined,
    side: "old" | "new",
    resolveTaskDisplayId: (id: unknown) => string | null
): { label: string; isUser: boolean } => {
    if (value == null || value === "") return { label: "None", isUser: false };
    const looksLikeUserId =
        fieldName === "assignee_id" ||
        fieldName === "reporter_id" ||
        fieldName === "milestone_assignee";
    if (looksLikeUserId) {
        const profile = teamMemberProfiles[String(value)];
        if (profile?.userName) {
            return { label: profile.userName, isUser: true };
        }
    }
    if (fieldName && RELATION_ID_FIELDS.has(fieldName)) {
        const labelKey = side === "old" ? "oldLabel" : "newLabel";
        const titleLabel = metadata?.[labelKey];
        const hasTitle = typeof titleLabel === "string" && titleLabel.trim() !== "";

        // Task references (parent task) render with the ticket-style
        // display id ("TP-38"): "Title (TP-38)". Prefer the id the backend
        // snapshotted into metadata; fall back to resolving against loaded
        // tasks so rows recorded before that metadata existed still upgrade.
        if (fieldName === "parent_task_id") {
            let idText = `#${value}`;
            const metaKey = side === "old" ? "oldDisplayId" : "newDisplayId";
            const metaDisplayId = metadata?.[metaKey];
            if (typeof metaDisplayId === "string" && metaDisplayId.trim() !== "") {
                idText = metaDisplayId;
            } else {
                const resolved = resolveTaskDisplayId(value);
                if (resolved) idText = resolved;
            }
            return {
                label: hasTitle ? `${titleLabel} (${idText})` : idText,
                isUser: false,
            };
        }

        // Milestones / sprints have no ticket-style id, and their raw
        // primary key is meaningless to a human skimming the feed — show
        // the name alone, falling back to "#<id>" only when the name is
        // unavailable (e.g. the relation was deleted).
        return {
            label: hasTitle ? (titleLabel as string) : `#${value}`,
            isUser: false,
        };
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return { label: String(value), isUser: false };
    }
    try {
        return { label: JSON.stringify(value), isUser: false };
    } catch {
        return { label: String(value), isUser: false };
    }
};

// Diff-style actions whose verb expects both an old and a new chip
// ("changed X from A → B"). For these we always render *both* chips
// even when one side is null/empty — `formatValue` substitutes
// "None" — so the sentence never collapses into a misleading
// "changed effort from Low" when the previous value was unset.
// Other actions (created, attachment_added, comment_added, …) keep
// the existing "show chip only when there's something to show" rule.
const DIFF_ACTIONS = new Set([
    "title_changed",
    "status_changed",
    "priority_changed",
    "effort_changed",
    "assignee_changed",
    "reporter_changed",
    "due_date_changed",
    "parent_changed",
    "milestone_changed",
    "sprint_changed",
]);

// Per-action sentence skeleton. The actor / chips are rendered
// outside; this returns the verb phrase only ("changed status from").
const verbFor = (action: string): string => {
    switch (action) {
        case "created":
            return "created this";
        case "title_changed":
            return "renamed this from";
        case "status_changed":
            return "changed status from";
        case "priority_changed":
            return "changed priority from";
        case "effort_changed":
            return "changed effort from";
        case "assignee_changed":
            return "reassigned from";
        case "reporter_changed":
            return "changed reporter from";
        case "due_date_changed":
            return "changed due date from";
        case "description_edited":
            return "edited the description";
        case "tags_changed":
            return "updated the tags";
        case "parent_changed":
            return "changed parent task from";
        case "milestone_changed":
            return "changed milestone from";
        case "sprint_changed":
            return "changed sprint from";
        case "closed":
            return "closed this";
        case "reopened":
            return "reopened this";
        case "deleted":
            return "deleted this";
        case "attachment_added":
            return "attached";
        case "attachment_removed":
            return "removed attachment";
        case "comment_added":
            return "posted a comment";
        case "comment_edited":
            return "edited a comment";
        case "comment_deleted":
            return "deleted a comment";
        case "milestone_assignee_added":
            return "added";
        case "milestone_assignee_removed":
            return "removed";
        default:
            return action.replace(/_/g, " ");
    }
};

const ValueChip = ({
    label,
    fieldName,
    isDark,
}: {
    label: string;
    /** The backend `field_name` for this activity row. Drives the
     *  palette so status / priority / effort chips inherit the same
     *  swatches used elsewhere in the task UI. */
    fieldName?: string | null;
    isDark: boolean;
}) => {
    const palette = paletteFor(fieldName, label);
    return (
        <Chip
            size="sm"
            variant="soft"
            sx={{
                fontSize: "0.72rem",
                fontWeight: 500,
                ...(palette
                    ? { background: palette.background, color: palette.color }
                    : {
                          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                          color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                      }),
            }}
        >
            {label}
        </Chip>
    );
};

/**
 * Audit-log feed for the "Activity" tab. The data is owned + fetched by
 * `TaskPreview` (alongside `taskComments` / `taskNotes`) and passed in
 * pre-loaded, so this component can be unmounted/remounted by the
 * JoyUI `TabPanel` without triggering a refetch + loading flash on
 * every visit.
 *
 * Rendering strategy: simple chronological list (newest at top — the
 * API already orders that way). Each row has a tiny actor avatar, an
 * action icon, a one-line sentence with optional value chips, and a
 * relative timestamp. No virtualization yet — most tasks accumulate
 * tens of rows, not thousands.
 */
export const TaskActivityFeed = ({
    activities,
    isLoading,
    allTasks,
    myself,
    setMyself,
    socket,
    useTEM,
    useCM,
    useUISM,
}: TaskActivityFeedProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const teamMemberProfiles = useTEM.teamMemberProfiles ?? {};

    const empty = useMemo(() => activities.length === 0, [activities]);

    // Best-effort raw-task-id → display-id ("PRF-123") map for parent
    // references on rows recorded before the backend snapshotted the
    // display id into metadata. Same-project only (that's what's
    // loaded); cross-project parents fall back to "#id".
    const taskDisplayIdById = useMemo(() => {
        const map = new Map<number, string>();
        for (const t of allTasks) {
            if (t.id == null) continue;
            const id = Number(t.id);
            if (Number.isFinite(id)) map.set(id, formatTaskDisplayId(t));
        }
        return map;
    }, [allTasks]);
    const resolveTaskDisplayId = (id: unknown): string | null => {
        const numeric = Number(id);
        if (!Number.isFinite(numeric)) return null;
        return taskDisplayIdById.get(numeric) ?? null;
    };

    return (
        <Stack spacing={0.5} sx={{ p: 1 }}>
            {empty && !isLoading && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        py: 4,
                        gap: 1,
                    }}
                >
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                            border: "1px dashed",
                            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                        }}
                    >
                        <HistoryRoundedIcon
                            sx={{
                                fontSize: 24,
                                color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
                            }}
                        />
                    </Box>
                    <Typography
                        level="body-sm"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                        }}
                    >
                        No activity yet
                    </Typography>
                </Box>
            )}

            {activities.map((row) => {
                // PR-comment rows render in a custom layout (GitHub
                // identity, expandable excerpt). Branch out early so we
                // don't fall through the generic actor/verb/chip path.
                if (row.actionType === "pr_comment_added") {
                    return (
                        <PrCommentActivityRow
                            key={row.activityId}
                            activity={row}
                            isDark={isDark}
                        />
                    );
                }
                // A PR auto-linked to this task (branch name carries the
                // task's display id) gets a GitHub-styled link row.
                if (row.actionType === "pr_linked") {
                    return (
                        <PrLinkActivityRow key={row.activityId} activity={row} isDark={isDark} />
                    );
                }
                // A status change tagged as an automatic PR-merge close
                // gets its own attribution row (the underlying actor is
                // null because the webhook is unauthenticated).
                if (
                    row.actionType === "status_changed" &&
                    row.metadata?.closedByPrMerge === true
                ) {
                    return (
                        <PrMergeCloseActivityRow
                            key={row.activityId}
                            activity={row}
                            isDark={isDark}
                        />
                    );
                }
                const actorName = row.actor?.userName ?? "Someone";
                const oldFmt = formatValue(
                    row.oldValue,
                    row.fieldName,
                    teamMemberProfiles,
                    row.metadata,
                    "old",
                    resolveTaskDisplayId
                );
                const newFmt = formatValue(
                    row.newValue,
                    row.fieldName,
                    teamMemberProfiles,
                    row.metadata,
                    "new",
                    resolveTaskDisplayId
                );
                // Diff-style verbs ("changed X from … →") always need
                // both sides so the sentence stays coherent even when
                // the prior value was unset (e.g. priority None → High).
                const isDiffAction = DIFF_ACTIONS.has(row.actionType);
                const showOldChip = isDiffAction || (row.oldValue != null && row.oldValue !== "");
                const showNewChip = isDiffAction || (row.newValue != null && row.newValue !== "");

                // Prefer the team-member profile (richer presence /
                // online status) over `row.actor`, which carries only
                // the basics needed for the audit log payload. Fall
                // back to `row.actor` when the actor isn't a current
                // team member (e.g. ex-member, system actor).
                const actorId = row.actor?.userId;
                const avatarUser =
                    (actorId != null
                        ? (teamMemberProfiles[String(actorId)] as UserProps | undefined)
                        : undefined) ?? (row.actor as UserProps | undefined);

                return (
                    <Stack
                        key={row.activityId}
                        alignItems="flex-start"
                        direction="row"
                        spacing={1.25}
                        sx={{
                            py: 1,
                            px: 1,
                            borderRadius: "8px",
                            "&:hover": {
                                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                            },
                        }}
                    >
                        <AvatarWithStatus
                            avatarSize={30}
                            avatarUser={avatarUser}
                            isYou={actorId != null && String(myself.userId) === String(actorId)}
                            myself={myself}
                            setMyself={setMyself}
                            showPulseDot={false}
                            socket={socket}
                            useCM={useCM}
                            useUISM={useUISM}
                        />
                        <Box
                            sx={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 0.75,
                                flexWrap: "wrap",
                            }}
                        >
                            <Box
                                sx={{
                                    color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                {actionIcon(row.actionType)}
                            </Box>
                            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                {actorName}
                            </Typography>
                            <Typography
                                level="body-sm"
                                sx={{
                                    color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
                                }}
                            >
                                {verbFor(row.actionType)}
                            </Typography>
                            {showOldChip && (
                                <ValueChip
                                    fieldName={row.fieldName}
                                    isDark={isDark}
                                    label={oldFmt.label}
                                />
                            )}
                            {showOldChip && showNewChip && (
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.5)"
                                            : "rgba(0,0,0,0.45)",
                                    }}
                                >
                                    →
                                </Typography>
                            )}
                            {showNewChip && (
                                <ValueChip
                                    fieldName={row.fieldName}
                                    isDark={isDark}
                                    label={newFmt.label}
                                />
                            )}
                            <Box sx={{ flexGrow: 1 }} />
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {formatRelative(row.tsCreatedAt)}
                            </Typography>
                        </Box>
                    </Stack>
                );
            })}
        </Stack>
    );
};
