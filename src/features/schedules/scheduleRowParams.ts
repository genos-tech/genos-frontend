// What a schedule's row says about the project or milestone it reports on (MIP-1631).
//
// The row used to show the name, the report's title and the time only, so two
// "Project updates" schedules for different projects looked the same. Which
// parameters point at a project or a milestone is the same knowledge the form
// uses (`KNOWN_PARAMS[...].picker`); the value stays the id, the row shows a name.

import type { ParamValue, ScheduleJob } from "../../services/schedules";
import { knownParam } from "./scheduleParams";

export interface RowTargets {
    /** The project id as text, when the schedule has a project parameter set. */
    projectId?: string;
    /** The milestone id as text, when the schedule has a milestone parameter set. */
    milestoneId?: string;
}

const present = (v: ParamValue | undefined): string | undefined =>
    v === undefined || v === "" ? undefined : String(v);

export const rowTargets = (
    job: ScheduleJob | undefined,
    params: Record<string, ParamValue> | undefined
): RowTargets => {
    const out: RowTargets = {};
    for (const key of Object.keys(job?.params ?? {})) {
        const picker = knownParam(key)?.picker;
        const value = present(params?.[key]);
        if (!value) continue;
        if (picker === "project") out.projectId = value;
        else if (picker === "milestone") out.milestoneId = value;
    }
    return out;
};
