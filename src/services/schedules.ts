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
}

export interface ScheduleJob {
    job: string;
    title: string;
    description: string;
    params: Record<string, JobParam>;
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
    nextRun: string | null;
    lastRun: string | null;
    lastStatus: ScheduleStatus | null;
    lastError?: string;
    lastResult?: { title: string; items: number };
    /** The job was removed: the schedule stays, and says so. */
    problem?: string;
}

export interface ScheduleList {
    timeZone: string;
    limit: number;
    jobs: ScheduleJob[];
    schedules: Schedule[];
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
}

export type ScheduleChange = Partial<ScheduleFields> & { enabled?: boolean };

/** `error`: the sentence the API wrote for the member (400), or null when there
 *  was none (network, 5xx). `gone`: a 404, so the list on screen is stale. */
export type ScheduleFailure = { ok: false; gone: boolean; error: string | null };
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
    const res = (error as { response?: { status?: number; data?: { error?: unknown } } })
        ?.response;
    const sentence = res?.data?.error;
    return {
        ok: false,
        gone: res?.status === 404,
        error: typeof sentence === "string" && sentence.trim() !== "" ? sentence : null,
    };
};

const NO_SESSION: ScheduleFailure = { ok: false, gone: false, error: null };

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
            timeZone: res.data.timeZone ?? "",
            limit: res.data.limit ?? 0,
            jobs: res.data.jobs ?? [],
            schedules: res.data.schedules ?? [],
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
