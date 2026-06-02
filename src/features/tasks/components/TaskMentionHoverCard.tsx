import { useEffect, useState } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Chip, CircularProgress, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { useAuth } from "../../../context/AuthContext";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { purplePalette } from "../../../theme/purplePalette";
import type { TaskProps, TaskTableProps } from "../../../types/tasks";
import { getCachedOrFetchTaskStatus, type TaskStatusResult } from "../services/taskStatusCache";
import { effortLevels, priorities, statuses } from "../utils/taskMeta";

interface Props {
    projectId: string;
    taskId: string;
    // The displayId / title stored on the chip — shown immediately (and as
    // the fallback header while the live data loads or if the fetch fails).
    displayId: string;
    title: string;
}

// One normalized badge. `allTasks` carries status/priority/effort as bare
// strings, the fetched `TaskProps` carries them as `{ color, textColor }`
// objects — both collapse to this so the card renders from one shape.
type Pill = { label: string; color?: string | null; textColor?: string | null };

type CardVM = {
    displayId: string;
    title: string;
    projectName?: string;
    isMilestone: boolean;
    status?: Pill;
    priority?: Pill;
    effort?: Pill;
    assignee?: { userId: string | number; name?: string };
    reporterName?: string;
    startDate?: string | null;
    dueDate?: string | null;
    daysLeft?: number | null;
    tags: { name: string; color?: string; textColor?: string }[];
};

const statusPill = (name?: string | null): Pill | undefined => {
    if (!name) return undefined;
    const m = statuses.find((s) => s.status === name);
    return { label: name, color: m?.color, textColor: m?.textColor };
};
const priorityPill = (name?: string | null): Pill | undefined => {
    if (!name) return undefined;
    const m = priorities.find((p) => p.priority === name);
    return { label: name, color: m?.color, textColor: m?.textColor };
};
const effortPill = (name?: string | null): Pill | undefined => {
    if (!name) return undefined;
    const m = effortLevels.find((e) => e.level === name);
    return { label: name, color: m?.color, textColor: m?.textColor };
};

// From the in-memory project task row (instant, current project only).
const vmFromTable = (t: TaskTableProps, projectName?: string): CardVM => ({
    displayId: t.displayId || `#${t.id}`,
    title: t.title || "",
    projectName,
    isMilestone: !!t.isMilestone,
    status: statusPill(t.status),
    priority: priorityPill(t.priority),
    effort: effortPill(t.effortLevel),
    assignee: t.assigneeId
        ? { userId: t.assigneeId, name: t.assigneeName ?? undefined }
        : undefined,
    startDate: t.startDate,
    dueDate: t.dueDate,
    daysLeft: t.daysLeft,
    tags: (t.tags ?? []).map((tag) => ({
        name: tag.tagName,
        color: tag.tagColor,
        textColor: tag.tagTextColor,
    })),
});

// From the fetched full task (richest: real color objects, assignee +
// reporter objects, project — and works cross-project).
const vmFromFull = (t: TaskProps): CardVM => ({
    displayId: t.displayId || `#${t.id}`,
    title: t.title || "",
    projectName: t.project?.projectName,
    isMilestone: !!t.isMilestone,
    status: t.status?.status
        ? { label: t.status.status, color: t.status.color, textColor: t.status.textColor }
        : undefined,
    priority: t.priority?.priority
        ? { label: t.priority.priority, color: t.priority.color, textColor: t.priority.textColor }
        : undefined,
    effort: t.effortLevel?.level
        ? {
              label: t.effortLevel.level,
              color: t.effortLevel.color,
              textColor: t.effortLevel.textColor,
          }
        : undefined,
    assignee: t.assignee ? { userId: t.assignee.userId, name: t.assignee.userName } : undefined,
    reporterName: t.reporter?.userName,
    startDate: t.startDate,
    dueDate: t.dueDate,
    daysLeft: t.daysLeft,
    tags: (t.tags ?? []).map((tag) => ({
        name: tag.tagName,
        color: tag.tagColor,
        textColor: tag.tagTextColor,
    })),
});

const MetaPill = ({ pill, isDark }: { pill?: Pill; isDark: boolean }) =>
    pill?.label ? (
        <Chip
            size="sm"
            variant="soft"
            sx={{
                backgroundColor: pill.color ? alpha(pill.color, isDark ? 0.5 : 0.75) : undefined,
                color: pill.textColor ?? undefined,
                fontWeight: "bold",
                borderRadius: "5px",
            }}
        >
            {pill.label}
        </Chip>
    ) : null;

const fmtDate = (iso?: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const dueColor = (daysLeft: number | null | undefined, muted: string): string => {
    if (daysLeft === -1) return "#ef4444";
    if (daysLeft != null && daysLeft <= 3) return "#f44336";
    if (daysLeft != null && daysLeft <= 7) return "#ff9800";
    return muted;
};

// Rich hover content for a task / milestone mention chip: status, priority,
// effort, assignee, reporter, dates, and tags. Renders instantly from the
// in-memory project task list (`allTasks`) when the task is in the current
// project, and a hover fetch fills in the rest (reporter, fresh colors) and
// covers cross-project references. A spinner shows only while nothing is
// available yet. Colors flow through `purplePalette` to match the app's
// popovers. Mirrors `LinkedPrCard` + `PrHoverDetails`.
export const TaskMentionHoverCard = ({ projectId, taskId, displayId, title }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const { accessToken } = useAuth();
    const { myself, tasks, projects } = useHashMentionData();
    const [result, setResult] = useState<TaskStatusResult | null>(null);

    useEffect(() => {
        if (!myself || !accessToken) {
            setResult({ kind: "error" });
            return;
        }
        let cancelled = false;
        setResult(null);
        void (async () => {
            const r = await getCachedOrFetchTaskStatus(
                myself,
                Number(projectId),
                Number(taskId),
                accessToken
            );
            if (!cancelled) setResult(r);
        })();
        return () => {
            cancelled = true;
        };
    }, [myself, accessToken, projectId, taskId]);

    // Instant view-model from the in-memory project task list, enriched (or
    // replaced) by the fetched full task once it lands.
    const tableEntry = tasks.find((t) => t.id != null && String(t.id) === String(taskId));
    const tableVM = tableEntry
        ? vmFromTable(
              tableEntry,
              projects.find((p) => p.projectId === tableEntry.projectId)?.projectName
          )
        : null;
    const fetchedVM = result?.kind === "ok" ? vmFromFull(result.payload) : null;
    const vm = fetchedVM ?? tableVM;

    const surfaceSx = {
        minWidth: 240,
        maxWidth: 340,
        p: 1.25,
        bgcolor: palette.surfaceSolid,
        border: `1px solid ${palette.menuBorder}`,
        borderRadius: "10px",
        boxShadow: palette.shadow,
    } as const;

    const headerId = vm?.displayId || displayId;
    const headerTitle = vm?.title || title;
    const dueStr = fmtDate(vm?.dueDate);
    const startStr = fmtDate(vm?.startDate);

    return (
        <Stack spacing={0.75} sx={surfaceSx}>
            {/* Header: milestone flag + id · title, with project subtitle. */}
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Stack alignItems="center" direction="row" spacing={0.5} sx={{ minWidth: 0 }}>
                    {vm?.isMilestone && (
                        <FlagRoundedIcon sx={{ fontSize: 14, color: "#f97316", flexShrink: 0 }} />
                    )}
                    <Typography
                        level="body-sm"
                        sx={{
                            color: palette.text,
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {headerId}
                        {headerTitle ? ` · ${headerTitle}` : ""}
                    </Typography>
                </Stack>
                {vm?.projectName && (
                    <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                        {vm.projectName}
                    </Typography>
                )}
            </Stack>

            {/* Loading / error when nothing is available yet. */}
            {!vm && result === null && (
                <Stack alignItems="center" sx={{ py: 0.5 }}>
                    <CircularProgress size="sm" />
                </Stack>
            )}
            {!vm && result?.kind === "error" && (
                <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                    Status unavailable
                </Typography>
            )}

            {vm && (
                <>
                    {/* Status / priority / effort badges. */}
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                        <MetaPill isDark={isDark} pill={vm.status} />
                        <MetaPill isDark={isDark} pill={vm.priority} />
                        <MetaPill isDark={isDark} pill={vm.effort} />
                    </Stack>

                    {/* Assignee + due. */}
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        spacing={1}
                    >
                        {vm.assignee ? (
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={0.75}
                                sx={{ minWidth: 0 }}
                            >
                                <UserAvatar
                                    clickable={false}
                                    size={20}
                                    showPulseDot={false}
                                    userId={vm.assignee.userId}
                                />
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: palette.text,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {vm.assignee.name ?? "Assignee"}
                                </Typography>
                            </Stack>
                        ) : (
                            <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                                Unassigned
                            </Typography>
                        )}

                        {(dueStr || vm.daysLeft === -1) && (
                            <Box sx={{ flexShrink: 0 }}>
                                <Typography
                                    level="body-xs"
                                    sx={{ color: dueColor(vm.daysLeft, palette.textMuted) }}
                                >
                                    {vm.daysLeft === -1
                                        ? "Expired"
                                        : `Due ${dueStr}${
                                              vm.daysLeft != null && vm.daysLeft >= 0
                                                  ? ` · ${vm.daysLeft}d`
                                                  : ""
                                          }`}
                                </Typography>
                            </Box>
                        )}
                    </Stack>

                    {/* Reporter + start date. */}
                    {(vm.reporterName || startStr) && (
                        <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                            {vm.reporterName ? `Reported by ${vm.reporterName}` : ""}
                            {vm.reporterName && startStr ? " · " : ""}
                            {startStr ? `Started ${startStr}` : ""}
                        </Typography>
                    )}

                    {/* Tags. */}
                    {vm.tags.length > 0 && (
                        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.4 }}>
                            {vm.tags.slice(0, 6).map((tag, i) => (
                                <Chip
                                    key={`${tag.name}-${i}`}
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: tag.color
                                            ? alpha(tag.color, isDark ? 0.45 : 0.7)
                                            : undefined,
                                        color: tag.textColor ?? undefined,
                                        borderRadius: "5px",
                                        fontSize: "0.65rem",
                                    }}
                                >
                                    {tag.name}
                                </Chip>
                            ))}
                            {vm.tags.length > 6 && (
                                <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                                    +{vm.tags.length - 6}
                                </Typography>
                            )}
                        </Stack>
                    )}
                </>
            )}
        </Stack>
    );
};
