import type { Messages } from "../../../../i18n/types";
import { STATUS_TONE, toneSolid } from "../../meta/taskTone";
import { Milestone } from "../../sprint-milestone/types";
import { EffectiveTask } from "../../utils/effectiveTasks";
import { dueBucket, DueBucket, effortPoints } from "../../utils/taskWeight";
import type { CapacityEntry } from "./taskHomeTypes";

export const buildCapacityMap = (
    tasks: EffectiveTask[],
    unassignedLabel: string
): Map<string, CapacityEntry> => {
    const map = new Map<string, CapacityEntry>();
    for (const t of tasks) {
        if (t.effectiveStatus === "Closed") continue;
        if (t.isMilestone === true) continue;
        const id = t.assigneeId || "__unassigned__";
        const entry = map.get(id) || {
            id,
            name: t.assigneeName || unassignedLabel,
            imgPath: t.assigneeImgPath || null,
            buckets: { overdue: 0, today: 0, week: 0, later: 0, none: 0 } as Record<
                DueBucket,
                number
            >,
            total: 0,
            nearTerm: 0,
            count: 0,
        };
        const pts = effortPoints(t.effortLevel);
        const bucket = dueBucket(t.dueDate);
        entry.buckets[bucket] += pts;
        entry.total += pts;
        entry.count += 1;
        if (bucket === "overdue" || bucket === "today" || bucket === "week") {
            entry.nearTerm += pts;
        }
        map.set(id, entry);
    }
    return map;
};

// "Ongoing" for the Assigned Milestones section: anything not Closed
// (Pending and Blocked count as ongoing). Applied ON TOP of
// `selectVisibleMilestones` (MIP-1004) and kept local on purpose: that
// selector also feeds the sidebar's live list, the task filter menu and the
// milestone picker, which all keep Closed milestones that have no sprint or
// sit in an active/upcoming sprint.
// A status bar segment / legend swatch: the tone's solid fill (a graphic, not
// text), from the one tone source (`taskTone`), so a status reads the same here
// as in the table. Icons and words use the `toneCss` text role instead.
export const statusColor = (status: keyof typeof STATUS_TONE): string =>
    toneSolid(STATUS_TONE[status]).bg;

export const isOngoingMilestone = (m: Milestone): boolean => m.status !== "Closed";

// Maps a backend status enum to the i18n key whose value renders in
// the dashboard. Resolve through `t.tasks.dashboard.statusLabels[key]`
// at the call site (`statusKeyFor` below).
export const STATUS_LABEL_KEYS: Record<string, "open" | "wip" | "blocked" | "pending" | "closed"> =
    {
        Open: "open",
        WIP: "wip",
        Blocked: "blocked",
        Pending: "pending",
        Closed: "closed",
    };

export const formatRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "1 day ago";
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return "1 week ago";
    return `${weeks} weeks ago`;
};

// Last-update time by numeric task id, for the velocity chart to skip tasks
// with nothing in its window (see `TaskVelocitySection`'s `taskUpdatedAt`).
export const taskUpdatedAtById = (
    tasks: EffectiveTask[]
): Record<number, string | null | undefined> => {
    const out: Record<number, string | null | undefined> = {};
    for (const t of tasks) out[Number(t.id)] = t.updatedAt;
    return out;
};

export type StatusLabels = Messages["tasks"]["dashboard"]["statusLabels"];

/**
 * The dashboard's own word for a status ("Completed", not the stored "Closed"); a status it has
 * no word for (or the "Other" bucket) falls back to the caller's text.
 */
export const statusText = (status: string, labels: StatusLabels, other: string): string => {
    if (status === "Other") return other;
    const key = status.toLowerCase() as keyof StatusLabels;
    return labels[key] ?? status;
};
