// Member schedules (MIP-1150): "at this local time, on these days, run this
// built-in job; the report arrives in the Inbox". Thin wrappers over
// `/schedules/*`; every rule (limits, rate limit, what a job may read) lives
// server-side and arrives as a sentence in `{ error }`, which the page shows
// as it is.
//
// Every call names the member's CURRENT team: `team_id` in the query on
// GET/PATCH/DELETE/run, in the JSON body on POST. A schedule is looked up
// through its owner and team, so a call without it can only fail.

import { authApi } from "./api";

export type ScheduleFrequency = "daily" | "weekdays" | "weekly" | "monthly" | "once";
export type ScheduleStatus = "ok" | "failed" | "skipped_late" | "skipped_access";

/** One declared parameter of a job: the small JSON Schema subset the API uses. */
export interface JobParam {
    type?: string;
    enum?: (string | number)[];
    minimum?: number;
    maximum?: number;
    /** Optional: the catalog does not send them today, but a label or hint the
     *  server provides is shown in preference to one made from the key. */
    title?: string;
    description?: string;
    /** True when the job cannot run without it: the catalog sends it (MIP-1216), so the form
     *  marks it and shows the inline "required" without a client-side list. */
    required?: boolean;
}

/** The AI effort levels (MIP-1212): the same low / medium / high Spotlight uses. */
export type EffortLevel = "low" | "medium" | "high";

/** What one run costs at one level: an ESTIMATE from the size of a typical prompt and the
 *  catalog prices, never a measurement. Each range is [fewest, most], in thousandths of a
 *  credit (15 = 0.015 credits). */
export interface EffortLevelCost {
    model?: string;
    creditsMilli: [number, number];
    usdMicro?: [number, number];
}

export interface EffortCost {
    estimate: true;
    /** English only ("a report listing 10 tasks with comments, ..."): the form writes its own. */
    basis?: string;
    levels: Partial<Record<EffortLevel, EffortLevelCost>>;
}

export interface ScheduleJob {
    job: string;
    title: string;
    description: string;
    params: Record<string, JobParam>;
    /** False: the job uses no AI and the form draws no effort control. Absent on a server that
     *  predates MIP-1212: read it as false. */
    usesAi?: boolean;
    /** The level the job runs at when the member chose none. Null without AI. */
    effortDefault?: EffortLevel | null;
    /** Null without AI. */
    effortCost?: EffortCost | null;
}

export type ParamValue = string | number | boolean;

export interface Schedule {
    id: string;
    name: string;
    job: string;
    /** Null when the job no longer exists. */
    jobTitle: string | null;
    params: Record<string, ParamValue>;
    when: string;
    frequency: ScheduleFrequency;
    timeOfDay: string;
    weekdays?: number[];
    monthDay?: number;
    runDate?: string;
    enabled: boolean;
    pausedReason?: string;
    deliverPush: boolean;
    /** The member's own choice of effort; null = the job's default. Only on a schedule of an AI
     *  job. */
    aiEffort?: EffortLevel | null;
    /** The level a run will use: the choice (or the default) held to the member's plan. Show it
     *  when it differs from the choice. Only on a schedule of an AI job. */
    aiEffortEffective?: EffortLevel;
    nextRun: string | null;
    lastRun: string | null;
    lastStatus: ScheduleStatus | null;
    lastError?: string;
    lastResult?: { title: string; items: number };
    /** The job was removed: the schedule stays, and says so. */
    problem?: string;
}

/** An ordinary schedule Genos offers; accepting one is a normal create. */
export interface ScheduleSuggestion {
    key: string;
    name: string;
    job: string;
    params: Record<string, ParamValue>;
    frequency: ScheduleFrequency;
    timeOfDay: string;
}

export interface ScheduleList {
    /** Whether the member's plan includes schedules (Core and up, MIP-1213). Absent on a server
     *  that predates the gate: read it as allowed (`planAllowed !== false`). When false the page
     *  shows the upgrade prompt instead of the form. */
    planAllowed?: boolean;
    /** The upgrade sentence the server wrote ("" when allowed). English only, so the page writes
     *  its own words and does not show it. */
    planMessage?: string;
    /** Whether AI reports can run on this deployment at all (MIP-1309): the operator switch is
     *  on, the cost meter is on and the model's credentials exist. Absent on a server that
     *  predates it: read it as available (`aiAvailable !== false`). When false the form shows no
     *  AI switch, effort or estimate, because they would do nothing. */
    aiAvailable?: boolean;
    timeZone: string;
    limit: number;
    jobs: ScheduleJob[];
    schedules: Schedule[];
    suggestions: ScheduleSuggestion[];
}

/** What the member can set. Fields a frequency does not use are not sent. */
export interface ScheduleFields {
    name: string;
    job: string;
    params: Record<string, ParamValue>;
    frequency: ScheduleFrequency;
    timeOfDay: string;
    weekdays?: number[];
    monthDay?: number;
    runDate?: string;
    deliverPush: boolean;
    /** AI jobs only. null goes back to the job's default; omitted leaves it alone. */
    aiEffort?: EffortLevel | null;
}

export type ScheduleChange = Partial<ScheduleFields> & { enabled?: boolean };

/** `error`: the sentence the API wrote for the member (400), or null when there
 *  was none (network, 5xx). `gone`: a 404, so the list on screen is stale.
 *  `planRequired`: a 403 `plan_required` (MIP-1213), the member's plan does not include
 *  schedules: show the upgrade prompt, not a failure. */
export type ScheduleFailure = {
    ok: false;
    gone: boolean;
    error: string | null;
    planRequired: boolean;
};
export type ScheduleResult<T> = ({ ok: true } & T) | ScheduleFailure;

export interface RunOutcome {
    status: "ok" | "failed";
    error: string;
    title: string;
    items: number;
}

// The page renders every failure inline, so the global toast stays off.
const SILENT = { suppressErrorToast: true } as const;

const failure = (error: unknown): ScheduleFailure => {
    const res = (
        error as { response?: { status?: number; data?: { error?: unknown; code?: unknown } } }
    )?.response;
    const sentence = res?.data?.error;
    return {
        ok: false,
        gone: res?.status === 404,
        error: typeof sentence === "string" && sentence.trim() !== "" ? sentence : null,
        planRequired: res?.status === 403 && res?.data?.code === "plan_required",
    };
};

const NO_SESSION: ScheduleFailure = { ok: false, gone: false, error: null, planRequired: false };

export const listSchedules = async (
    accessToken: string | null,
    teamId: string
): Promise<ScheduleList | null> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return null;
    try {
        const res = await api.get<Partial<ScheduleList>>("/schedules/", {
            params: { team_id: teamId },
            ...SILENT,
        });
        return {
            // A server that predates the plan gate sends neither key: that is "allowed".
            planAllowed: res.data.planAllowed !== false,
            planMessage: typeof res.data.planMessage === "string" ? res.data.planMessage : "",
            // Same for a server that predates MIP-1309: available, as before.
            aiAvailable: res.data.aiAvailable !== false,
            timeZone: res.data.timeZone ?? "",
            limit: res.data.limit ?? 0,
            jobs: res.data.jobs ?? [],
            schedules: res.data.schedules ?? [],
            suggestions: res.data.suggestions ?? [],
        };
    } catch {
        return null;
    }
};

export const createSchedule = async (
    accessToken: string | null,
    teamId: string,
    fields: ScheduleFields
): Promise<ScheduleResult<{ schedule: Schedule }>> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return NO_SESSION;
    try {
        const res = await api.post<{ schedule: Schedule }>(
            "/schedules/",
            { ...fields, team_id: teamId },
            SILENT
        );
        return { ok: true, schedule: res.data.schedule };
    } catch (error) {
        return failure(error);
    }
};

/** `enabled: false` pauses, `true` resumes; anything else edits. */
export const updateSchedule = async (
    accessToken: string | null,
    teamId: string,
    id: string,
    change: ScheduleChange
): Promise<ScheduleResult<{ schedule: Schedule }>> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return NO_SESSION;
    try {
        const res = await api.patch<{ schedule: Schedule }>(`/schedules/${id}/`, change, {
            params: { team_id: teamId },
            ...SILENT,
        });
        return { ok: true, schedule: res.data.schedule };
    } catch (error) {
        return failure(error);
    }
};

export const deleteSchedule = async (
    accessToken: string | null,
    teamId: string,
    id: string
): Promise<ScheduleResult<object>> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return NO_SESSION;
    try {
        await api.delete(`/schedules/${id}/`, { params: { team_id: teamId }, ...SILENT });
        return { ok: true };
    } catch (error) {
        return failure(error);
    }
};

/** Runs the job once, now. The report itself arrives in the Inbox; a 200 can
 *  still say `status: "failed"`, with the reason in `error`. */
export const runScheduleNow = async (
    accessToken: string | null,
    teamId: string,
    id: string
): Promise<ScheduleResult<{ outcome: RunOutcome }>> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return NO_SESSION;
    try {
        const res = await api.post<Partial<RunOutcome>>(`/schedules/${id}/run/`, undefined, {
            params: { team_id: teamId },
            ...SILENT,
        });
        return {
            ok: true,
            outcome: {
                status: res.data.status === "ok" ? "ok" : "failed",
                error: res.data.error ?? "",
                title: res.data.title ?? "",
                items: res.data.items ?? 0,
            },
        };
    } catch (error) {
        return failure(error);
    }
};
