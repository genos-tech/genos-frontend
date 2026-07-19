/**
 * `buildTaskContextCrumbs` — the thread header's task-info breadcrumb
 * ancestry, built from a full task payload (getTask /
 * getTaskByThreadId). Mirrors `buildTaskNoteContextCrumbs`' semantics:
 * Project → Milestone → (parent Task), with the task itself rendered by
 * the caller as the clickable tail node (so it is NOT part of the
 * returned context).
 */
import { describe, expect, it } from "vitest";

import { buildTaskContextCrumbs } from "../utils/note";

const project = { projectId: 7, projectName: "Genos" };

describe("buildTaskContextCrumbs", () => {
    it("returns [] for null", () => {
        expect(buildTaskContextCrumbs(null)).toEqual([]);
    });

    it("project only for a plain top-level task", () => {
        const crumbs = buildTaskContextCrumbs({
            id: 1,
            title: "T",
            project,
            parentTaskId: null,
            milestoneId: null,
        });
        expect(crumbs.map((c) => c.kind)).toEqual(["project"]);
        expect(crumbs[0].label).toBe("Genos");
    });

    it("adds the milestone level for a task inside a milestone", () => {
        const crumbs = buildTaskContextCrumbs({
            id: 2,
            title: "T",
            project,
            milestoneId: 9,
            milestoneTitle: "Launch",
            parentTaskId: null,
        });
        expect(crumbs.map((c) => c.kind)).toEqual(["project", "milestone"]);
        expect(crumbs[1].label).toBe("Launch");
    });

    it("falls back to #id when the milestone title is missing", () => {
        const crumbs = buildTaskContextCrumbs({
            id: 2,
            title: "T",
            project,
            milestoneId: 9,
            parentTaskId: null,
        });
        expect(crumbs[1].label).toBe("#9");
    });

    it("adds the parent level for a subtask, skipping milestone-backing parents", () => {
        const asSubtask = buildTaskContextCrumbs({
            id: 3,
            title: "T",
            project,
            milestoneId: 9,
            milestoneTitle: "Launch",
            parentTaskId: 2,
            parentTaskTitle: "Parent",
            parentTaskIsMilestone: false,
        });
        expect(asSubtask.map((c) => c.kind)).toEqual(["project", "milestone", "task"]);
        expect(asSubtask[2].label).toBe("Parent");

        // Parent IS the milestone's backing task → the milestone crumb
        // already represents it; no duplicate task crumb.
        const underMilestone = buildTaskContextCrumbs({
            id: 3,
            title: "T",
            project,
            milestoneId: 9,
            milestoneTitle: "Launch",
            parentTaskId: 100,
            parentTaskTitle: "Launch",
            parentTaskIsMilestone: true,
        });
        expect(underMilestone.map((c) => c.kind)).toEqual(["project", "milestone"]);
    });

    it("stops at the project for a milestone-backing task (the tail node IS the milestone)", () => {
        const crumbs = buildTaskContextCrumbs({
            id: 100,
            title: "Launch",
            project,
            isMilestone: true,
            milestoneId: 9,
            milestoneTitle: "Launch",
            parentTaskId: null,
        });
        expect(crumbs.map((c) => c.kind)).toEqual(["project"]);
    });
});
