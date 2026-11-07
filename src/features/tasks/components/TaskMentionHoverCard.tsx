import { useEffect, useState } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/joy";

import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { useAuth } from "../../../context/AuthContext";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { TaskProps, TaskTableProps } from "../../../types/tasks";
import { getCachedOrFetchTaskStatus, type TaskStatusResult } from "../services/taskStatusCache";
import { deriveDaysLeft } from "../utils/daysLeft";
import { MilestoneFlag, TagStrip } from "./card/parts";
import { EffortLabel } from "./meta/EffortLabel";
import { PriorityIcon } from "./meta/PriorityIcon";
import { StatusLabel } from "./meta/StatusLabel";

interface Props {
    projectId: string;
    taskId: string;
    // The displayId / title stored on the chip — shown immediately (and as
    // the fallback header while the live data loads or if the fetch fails).
    displayId: string;
    title: string;
}

type CardVM = {
    displayId: string;
    title: string;
    projectName?: string;
    isMilestone: boolean;
    // `allTasks` carries these as bare strings, the fetched `TaskProps` as
    // `{ status, color, textColor }` objects; both collapse to the name, since
    // the colors come from the shared status / priority components now.
    status?: string;
    priority?: string;
    effort?: string;
    assignee?: { userId: string | number; name?: string };
    reporterName?: string;
    startDate?: string | null;
    dueDate?: string | null;
    daysLeft?: number | null;
    tags: { tagName: string; tagColor: string; tagTextColor: string }[];
};

// From the in-memory project task row (instant, current project only).
const vmFromTable = (t: TaskTableProps, projectName?: string): CardVM => ({
    displayId: t.displayId || `#${t.id}`,
    title: t.title || "",
    projectName,
    isMilestone: !!t.isMilestone,
    status: t.status || undefined,
    priority: t.priority || undefined,
    effort: t.effortLevel || undefined,
    assignee: t.assigneeId
        ? { userId: t.assigneeId, name: t.assigneeName ?? undefined }
        : undefined,
    startDate: t.startDate,
    dueDate: t.dueDate,
    // Fresh from dueDate — the row's `daysLeft` is a stale server snapshot.
    daysLeft: deriveDaysLeft(t.dueDate),
    tags: t.tags ?? [],
});

// From the fetched full task (richest: real color objects, assignee +
// reporter objects, project — and works cross-project).
const vmFromFull = (t: TaskProps): CardVM => ({
    displayId: t.displayId || `#${t.id}`,
    title: t.title || "",
    projectName: t.project?.projectName,
    isMilestone: !!t.isMilestone,
    status: t.status?.status || undefined,
    priority: t.priority?.priority || undefined,
    effort: t.effortLevel?.level || undefined,
    assignee: t.assignee ? { userId: t.assignee.userId, name: t.assignee.userName } : undefined,
    reporterName: t.reporter?.userName,
    startDate: t.startDate,
    dueDate: t.dueDate,
    // Fresh from dueDate — the row's `daysLeft` is a stale server snapshot.
    daysLeft: deriveDaysLeft(t.dueDate),
    tags: t.tags ?? [],
});

const fmtDate = (iso?: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Same rule as the cards: red when expired, amber within a week, else quiet.
const dueColor = (daysLeft: number | null | undefined): string => {
    if (daysLeft === -1) return g.danger.text;
    if (daysLeft != null && daysLeft <= 7) return g.warning.text;
    return g.text.tertiary;
};

// Rich hover content for a task / milestone mention chip: status, priority,
// effort, assignee, reporter, dates, and tags. Renders instantly from the
// in-memory project task list (`allTasks`) when the task is in the current
// project, and a hover fetch fills in the rest (reporter, fresh colors) and
// covers cross-project references. A spinner shows only while nothing is
// available yet. Mirrors `LinkedPrCard` + `PrHoverDetails`. The pieces are the task
// family's (MIP-1124): status, priority, effort and tags read as on every card.
export const TaskMentionHoverCard = ({ projectId, taskId, displayId, title }: Props) => {
    const { t } = useTranslation();
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
        bgcolor: g.surface.raised,
        border: `1px solid ${g.border.default}`,
        borderRadius: g.radius.md,
        boxShadow: g.shadow.md,
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
                    {vm?.isMilestone && <MilestoneFlag size={14} />}
                    <Typography
                        level="body-sm"
                        sx={{
                            color: g.text.primary,
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
                    <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
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
                <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                    {t.tasks.mentionHover.statusUnavailable}
                </Typography>
            )}

            {vm && (
                <>
                    {/* Status / priority / effort: the shared pieces. */}
                    <Stack
                        alignItems="center"
                        direction="row"
                        sx={{ flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5 }}
                    >
                        {vm.status && <StatusLabel status={vm.status} />}
                        <PriorityIcon priority={vm.priority} showLabel />
                        {vm.effort && <EffortLabel level={vm.effort} />}
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
                                    showPulseDot={false}
                                    size={20}
                                    userId={vm.assignee.userId}
                                />
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: g.text.primary,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {vm.assignee.name ?? t.tasks.mentionHover.assignee}
                                </Typography>
                            </Stack>
                        ) : (
                            <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                                {t.tasks.mentionHover.unassigned}
                            </Typography>
                        )}

                        {(dueStr || vm.daysLeft === -1) && (
                            <Box sx={{ flexShrink: 0 }}>
                                <Typography level="body-xs" sx={{ color: dueColor(vm.daysLeft) }}>
                                    {vm.daysLeft === -1
                                        ? t.tasks.mentionHover.expired
                                        : vm.daysLeft != null && vm.daysLeft >= 0
                                          ? fmt(t.tasks.mentionHover.dueWithDays, {
                                                date: dueStr ?? "",
                                                count: vm.daysLeft,
                                            })
                                          : fmt(t.tasks.mentionHover.due, {
                                                date: dueStr ?? "",
                                            })}
                                </Typography>
                            </Box>
                        )}
                    </Stack>

                    {/* Reporter + start date. */}
                    {(vm.reporterName || startStr) && (
                        <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                            {vm.reporterName
                                ? fmt(t.tasks.mentionHover.reportedBy, { name: vm.reporterName })
                                : ""}
                            {vm.reporterName && startStr ? " · " : ""}
                            {startStr ? fmt(t.tasks.mentionHover.started, { date: startStr }) : ""}
                        </Typography>
                    )}

                    {/* Tags. */}
                    {vm.tags.length > 0 && <TagStrip max={6} tags={vm.tags} />}
                </>
            )}
        </Stack>
    );
};
