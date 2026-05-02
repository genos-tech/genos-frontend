import { useEffect, useMemo, useState } from "react";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import AssignmentIndRoundedIcon from "@mui/icons-material/AssignmentIndRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
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

import { useAuth } from "../../../../../../context/AuthContext";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { TaskManagementState } from "../../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../../types/admin";
import { TaskActivityProps, TaskProps } from "../../../../../../types/tasks";
import { loadTaskActivities } from "../../../../services/loadTaskActivities";
import { statusOptions } from "../../../table/DraggableTaskTable";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type TaskActivityFeedProps = {
    task: TaskProps;
    myself: UserProps;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
};

// Map status → DraggableTaskTable swatch so the chips here match the
// table's chips. Falls back to the action-type colour for fields that
// don't have a curated palette (priority/effort/etc.).
const statusColor = (status: string | null | undefined) => {
    if (!status) return null;
    const found = statusOptions.find(
        (option) => option.value.toLowerCase() === String(status).toLowerCase()
    );
    return found ? { background: found.color, color: found.textColor } : null;
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
        default:
            return <HistoryRoundedIcon sx={{ fontSize: 18 }} />;
    }
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
// everything else is stringified.
const formatValue = (
    value: unknown,
    fieldName: string | null,
    teamMemberProfiles: Record<string, any>
): { label: string; isUser: boolean } => {
    if (value == null || value === "") return { label: "—", isUser: false };
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
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return { label: String(value), isUser: false };
    }
    try {
        return { label: JSON.stringify(value), isUser: false };
    } catch {
        return { label: String(value), isUser: false };
    }
};

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
            return "changed parent task";
        case "milestone_changed":
            return "changed milestone";
        case "sprint_changed":
            return "changed sprint";
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
    statusKey,
    isDark,
}: {
    label: string;
    statusKey?: string | null;
    isDark: boolean;
}) => {
    const palette = statusKey ? statusColor(statusKey) : null;
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
 * Audit-log feed mounted on the new "Activity" tab. Pulls from
 * `/api/v2/task/activity/` and refetches whenever the task or any of
 * its comments are flagged updated by the existing socket handlers.
 *
 * Rendering strategy: simple chronological list (newest at top — the
 * API already orders that way). Each row has a tiny actor avatar, an
 * action icon, a one-line sentence with optional value chips, and a
 * relative timestamp. No virtualization yet — most tasks accumulate
 * tens of rows, not thousands.
 */
export const TaskActivityFeed = ({ task, myself, useTM, useTEM }: TaskActivityFeedProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [activities, setActivities] = useState<TaskActivityProps[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Cheap stable key — `task.id` + the two flip-flags the rest of
    // the preview uses to signal "something changed". Avoids a
    // dedicated socket event for v1.
    const taskId = task?.id;
    const refetchTriggers = `${useTM.isTaskUpdated ? "u" : ""}${
        useTM.isTaskCommentUpdated.isUpdate ? "c" : ""
    }${useTM.isTaskUpdatedBySomeone ? "s" : ""}`;

    useEffect(() => {
        if (taskId == null) {
            setActivities([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            const rows = await loadTaskActivities(myself, Number(taskId), accessToken);
            if (cancelled) return;
            setActivities(rows);
            setIsLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [taskId, refetchTriggers, myself, accessToken]);

    const teamMemberProfiles = useTEM.teamMemberProfiles ?? {};

    const empty = useMemo(() => activities.length === 0, [activities]);

    if (taskId == null) {
        return null;
    }

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
                const actorName = row.actor?.userName ?? "Someone";
                const oldFmt = formatValue(row.oldValue, row.fieldName, teamMemberProfiles);
                const newFmt = formatValue(row.newValue, row.fieldName, teamMemberProfiles);
                const showOldChip = row.oldValue != null && row.oldValue !== "";
                const showNewChip = row.newValue != null && row.newValue !== "";
                // Status colours apply only when the field name says
                // status — guard so a "priority: Closed" payload
                // doesn't accidentally pick up the green status chip.
                const statusKeyOld = row.fieldName === "status" ? oldFmt.label : null;
                const statusKeyNew = row.fieldName === "status" ? newFmt.label : null;

                const avatarPath = row.actor?.avatarImgPath;
                const avatarUrl = avatarPath ? `${media_url}${avatarPath}` : undefined;

                return (
                    <Stack
                        key={row.activityId}
                        direction="row"
                        alignItems="flex-start"
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
                        <Avatar
                            src={avatarUrl}
                            size="sm"
                            sx={{ width: 24, height: 24, fontSize: "0.7rem" }}
                        >
                            {actorName.slice(0, 1).toUpperCase()}
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
                                    label={oldFmt.label}
                                    statusKey={statusKeyOld}
                                    isDark={isDark}
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
                                    label={newFmt.label}
                                    statusKey={statusKeyNew}
                                    isDark={isDark}
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
