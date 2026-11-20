/**
 * MIP-1731: the milestone preview must not put the viewer in a missing assignee's place.
 *
 * A milestone's assignees are an M2M (`MilestoneAssignees`), so a milestone nobody is assigned to
 * (a hard-deleted account simply drops out of the list, or none was ever chosen) arrives with
 * `assignees: []`. The preview used to answer that with `myself`
 * (`milestoneAssigneesToUserProps(...)[0] ?? myself`, and `assignee ?? fallbackUser` in
 * `milestoneToTaskProps`; run against that code, 3 of these tests failed).
 *
 * What the premise check found:
 *   - The preview showed the viewer as the assignee of such a milestone.
 *   - It also SAVED it: `persistFromTaskContent` diffs the working copy's assignee (the viewer)
 *     against `milestone.assignees[0]` (none), so ANY edit (a sprint, a date) sent
 *     `assigneeIds: [<viewer>]`, and the milestone PATCH replaces the assignee set with it
 *     (`sync_milestone_assignees`): a silent reassignment, the same as MIP-1730's reporter.
 *   - The TASK preview does not have this: its assignee state is `?? null`.
 *   - Server side, `sync_backing_task` gives the backing task row `first assignee ?? reporter`
 *     when the list is empty. That is the TABLE row's column only: the milestone payload's
 *     `assignees` stays the M2M, so the milestone preview does not flip to the reporter after a
 *     save. Pinned below.
 *
 * A milestone that HAS assignees is pinned unchanged.
 */
import { describe, expect, it } from "vitest";

import { Milestone } from "../features/tasks/sprint-milestone/types";
import {
    milestoneAssigneePatch,
    milestoneAssigneesToUserProps,
    milestoneFirstAssignee,
} from "../features/tasks/utils/milestoneAssignee";
import { milestoneReporterToUserProps } from "../features/tasks/utils/milestoneReporter";
import { milestoneToTaskProps } from "../features/tasks/utils/milestoneTaskProps";
import { UserProps } from "../types/admin";

const person = (userId: string, userName = userId) =>
    ({
        userId,
        userName,
        userEmail: `${userName}@x.dev`,
        avatarImgPath: "",
        teamId: "t1",
    }) as unknown as UserProps;

const viewer = person("u-viewer", "Viewer");
const ann = person("u-ann", "Ann");
const bo = person("u-bo", "Bo");
const team = [viewer, ann, bo];

const embedded = (userId: string, username: string) => ({
    userId,
    username,
    email: `${username}@x.dev`,
    profileImageUrl: "",
});

const milestone = (over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId: 7,
        taskId: 99,
        title: "Launch",
        reporterId: "u-bo",
        reporter: embedded("u-bo", "Bo"),
        assignees: [],
        ...over,
    }) as unknown as Milestone;

// The chain the preview runs on every refresh: payload -> first assignee -> task-shaped working
// copy. (The code under test is this chain as TaskPreview's sync effect wires it.)
const workingCopyOf = (m: Milestone) => {
    return milestoneToTaskProps(
        m,
        null,
        [],
        milestoneFirstAssignee(m, team),
        milestoneReporterToUserProps(m, team),
        []
    );
};

describe("the milestone preview, for a milestone nobody is assigned to", () => {
    const unassigned = milestone();

    it("shows no assignee (not the viewer)", () => {
        expect(workingCopyOf(unassigned).assignee).toBeNull();
    });

    it("sends no assignee when an edit leaves the assignee alone", () => {
        expect(milestoneAssigneePatch(workingCopyOf(unassigned), unassigned)).toBeUndefined();
    });

    it("still sends the assignee the person picks", () => {
        expect(milestoneAssigneePatch({ assignee: bo }, unassigned)).toEqual(["u-bo"]);
    });

    it("keeps no assignee after a save of something else (no flip to the reporter)", () => {
        // `sync_backing_task` gives the backing TASK row `first assignee ?? reporter`, but the
        // milestone payload's `assignees` stays the M2M: the refresh after the PATCH is the same
        // empty list, so the working copy stays empty and nothing more is sent.
        const refreshed = milestone({ tsUpdatedAt: "later" } as Partial<Milestone>);
        expect(workingCopyOf(refreshed).assignee).toBeNull();
        expect(milestoneAssigneePatch(workingCopyOf(refreshed), refreshed)).toBeUndefined();
    });
});

describe("the milestone preview, for a milestone that HAS assignees (unchanged)", () => {
    const assigned = milestone({ assignees: [embedded("u-ann", "Ann"), embedded("u-bo", "Bo")] });

    it("shows the first assignee, resolved to the team member when listed", () => {
        expect(workingCopyOf(assigned).assignee).toBe(ann);
        const offRoster = milestone({ assignees: [embedded("u-zed", "Zed")] });
        expect(milestoneAssigneesToUserProps(offRoster, team)[0]).toMatchObject({
            userId: "u-zed",
            userName: "Zed",
        });
    });

    it("sends no assignee when an edit leaves it alone", () => {
        expect(milestoneAssigneePatch(workingCopyOf(assigned), assigned)).toBeUndefined();
    });

    it("sends the new assignee when the person picks another", () => {
        expect(milestoneAssigneePatch({ assignee: bo }, assigned)).toEqual(["u-bo"]);
    });

    it("sends an empty list when the person clears the picker", () => {
        expect(milestoneAssigneePatch({ assignee: null }, assigned)).toEqual([]);
    });

    it("follows a pick through the server's refresh without sending it again", () => {
        const afterPick = milestone({ assignees: [embedded("u-bo", "Bo")] });
        expect(workingCopyOf(afterPick).assignee).toBe(bo);
        expect(milestoneAssigneePatch(workingCopyOf(afterPick), afterPick)).toBeUndefined();
    });
});
