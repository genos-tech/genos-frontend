import { describe, expect, it } from "vitest";

import { rowTargets } from "../features/schedules/scheduleRowParams";
import type { ScheduleJob } from "../services/schedules";

const job = (params: ScheduleJob["params"]): ScheduleJob => ({
    job: "j",
    title: "J",
    description: "",
    params,
});

describe("rowTargets (MIP-1631)", () => {
    it("finds the project and the milestone by the parameters the form has pickers for", () => {
        const project = job({ project_id: { type: "integer" }, hours: { type: "integer" } });
        expect(rowTargets(project, { project_id: 11, hours: 5 })).toEqual({ projectId: "11" });
        const milestone = job({ milestone_id: { type: "integer", required: true } });
        expect(rowTargets(milestone, { milestone_id: 501 })).toEqual({ milestoneId: "501" });
    });

    it("names nothing when the value is empty, the job is gone, or the parameter has no picker", () => {
        const project = job({ project_id: { type: "integer" } });
        expect(rowTargets(project, {})).toEqual({});
        expect(rowTargets(project, { project_id: "" })).toEqual({});
        expect(rowTargets(undefined, { project_id: 11 })).toEqual({});
        expect(rowTargets(job({ days: { type: "integer" } }), { days: 7 })).toEqual({});
    });
});
