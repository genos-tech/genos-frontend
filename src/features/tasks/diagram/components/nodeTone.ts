/**
 * Tones and words the task graph's node cards share (MIP-1124 3/3): kept out of
 * `nodeParts.tsx` so that file exports components only.
 */

import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import type { DueTone } from "../../components/card";
import type { ScheduleHealthTone, ScheduleStatus, ScheduleTone } from "../utils/scheduleStatus";

/** A schedule tone as the family's due tone (so the node's date reads like the
 *  board card's): red is overdue, amber is due soon, the rest is quiet text.
 *  A closed task is "success" and is quiet too: its status already says so. */
export const dueToneOf = (tone: ScheduleTone): DueTone =>
    tone === "red" ? "overdue" : tone === "amber" ? "soon" : "later";

/** The relative-due words under a node's dates ("Overdue 3d", "Due tomorrow",
 *  "Closed"), or null when the task has no due date. */
export const useScheduleLabel = (
    schedule: ScheduleStatus,
    status: string | null | undefined
): string | null => {
    const { t } = useTranslation();
    const days = schedule.daysUntilDue;
    if (days == null) return null;
    const s = t.tasks.diagram.schedule;
    if (status?.toLowerCase() === "closed") return s.closed;
    if (days < 0) return fmt(s.overdueDays, { count: -days });
    if (days === 0) return s.dueToday;
    if (days === 1) return s.dueTomorrow;
    return fmt(s.dueInDays, { count: days });
};

export const HEALTH_COLOR: Record<ScheduleHealthTone, string> = {
    "on-track": g.success.solid,
    "at-risk": g.warning.solid,
    behind: g.danger.solid,
};
