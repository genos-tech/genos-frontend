// The AI effort of a schedule (MIP-1212): which level the form shows as chosen, and the
// estimate printed beside it.
//
// The server sends the member's choice as `aiEffort` (null = the job's own default), what a run
// will actually use as `aiEffortEffective` (the choice held to the member's plan), and per job a
// cost ESTIMATE for each level. Nothing here claims a level is cheaper than another: the numbers
// are arithmetic from the size of a typical prompt, not a measurement (MIP-928 moved a digest to a
// cheaper model and saved nothing), so the form states each level's own figure and says it is an
// estimate. The unit is the one Plan & usage shows: AI credits, through `formatCredits`.

import type { EffortCost, EffortLevel, Schedule, ScheduleJob } from "../../services/schedules";
import { formatCredits } from "../../utils/formatCredits";
import { knownParam } from "./scheduleParams";

export const EFFORT_LEVELS: readonly EffortLevel[] = ["low", "medium", "high"];

export const asEffortLevel = (value: unknown): EffortLevel | null =>
    value === "low" || value === "medium" || value === "high" ? value : null;

/** Whether the job has an effort to choose. A job without the flag (an older server) has none. */
export const jobUsesAi = (job: ScheduleJob | undefined): boolean => job?.usesAi === true;

/** The key of the parameter that turns the job's AI step off (`ai_sentences`), if it has one. */
export const aiSwitchKey = (job: ScheduleJob | undefined): string | undefined =>
    Object.keys(job?.params ?? {}).find((key) => knownParam(key)?.aiSwitch === true);

/** The control is drawn only while the AI step can run: the job uses AI and the member has not
 *  switched its AI parameter off (then the report is plain and the level means nothing). */
export const showsEffort = (
    job: ScheduleJob | undefined,
    typed: Record<string, string>
): boolean => {
    if (!jobUsesAi(job)) return false;
    const key = aiSwitchKey(job);
    return key === undefined || typed[key] !== "false";
};

/** The level the form shows as chosen: the member's own, else the job's default. */
export const chosenEffort = (job: ScheduleJob | undefined, aiEffort: string): EffortLevel | null =>
    asEffortLevel(aiEffort) ?? asEffortLevel(job?.effortDefault);

/** Credits as Plan & usage shows them, from thousandths, to the hundredth. */
const credits = (milli: number): string => formatCredits(Math.round(milli / 10) / 100);

export type CostText =
    /** Under a hundredth of a credit: a figure would print as "0", which is not true. */
    | { kind: "tiny" }
    | { kind: "about"; credits: string }
    | { kind: "range"; from: string; to: string };

/** The estimate for one level, or null when the server sent none for it. Two figures that read
 *  the same at the hundredth are one figure. */
export const costText = (
    cost: EffortCost | null | undefined,
    level: EffortLevel
): CostText | null => {
    const range = cost?.levels?.[level]?.creditsMilli;
    if (!Array.isArray(range) || range.length !== 2) return null;
    const [fewest, most] = range;
    if (!Number.isFinite(fewest) || !Number.isFinite(most) || fewest < 0 || most < fewest) {
        return null;
    }
    if (most < 5) return { kind: "tiny" };
    const from = credits(fewest);
    const to = credits(most);
    return from === to ? { kind: "about", credits: from } : { kind: "range", from, to };
};

/** The level a list row shows quietly: what a run uses (held to the plan), for a schedule of an
 *  AI job whose AI step is on. Null otherwise: a plain job, or its AI switched off, shows none. */
export const rowEffort = (
    job: ScheduleJob | undefined,
    schedule: Pick<Schedule, "params" | "aiEffortEffective">
): EffortLevel | null => {
    const level = asEffortLevel(schedule.aiEffortEffective);
    if (!level || !jobUsesAi(job)) return null;
    const key = aiSwitchKey(job);
    return key !== undefined && schedule.params?.[key] === false ? null : level;
};
