// Plain grouping of the sidebar's milestones by folder (MIP-847).

import { describe, expect, it } from "vitest";

import type { Milestone, MilestoneFolder } from "../features/tasks/sprint-milestone/types";
import { groupMilestonesByFolder } from "../features/tasks/sprint-milestone/utils/groupMilestonesByFolder";
import {
    selectOutdatedMilestones,
    selectVisibleMilestones,
} from "../features/tasks/sprint-milestone/utils/sortMilestones";

const folder = (folderId: number, name: string, sortOrder = folderId): MilestoneFolder => ({
    folderId,
    projectId: 1,
    name,
    sortOrder,
    tsCreatedAt: "",
    tsUpdatedAt: "",
});

const ms = (
    milestoneId: number,
    folderId: number | null | undefined,
    over: Partial<Milestone> = {}
): Milestone =>
    ({
        milestoneId,
        title: `M${milestoneId}`,
        status: "Open",
        sprintId: null,
        isDeleted: false,
        dueDate: null,
        assignees: [],
        folderId,
        ...over,
    }) as unknown as Milestone;

describe("groupMilestonesByFolder", () => {
    it("puts each milestone under its folder and the rest in unfiled", () => {
        const out = groupMilestonesByFolder(
            [ms(1, 10), ms(2, null), ms(3, 11), ms(4, 10), ms(5, undefined)],
            [folder(10, "Launch"), folder(11, "Growth")]
        );
        expect(
            out.folders.map((g) => [g.folder.name, g.milestones.map((m) => m.milestoneId)])
        ).toEqual([
            ["Launch", [1, 4]],
            ["Growth", [3]],
        ]);
        expect(out.unfiled.map((m) => m.milestoneId)).toEqual([2, 5]);
    });

    it("keeps an empty folder so it can receive a milestone", () => {
        const out = groupMilestonesByFolder([], [folder(10, "Empty")]);
        expect(out.folders).toHaveLength(1);
        expect(out.folders[0].milestones).toEqual([]);
    });

    it("orders folders by sortOrder, then id", () => {
        const out = groupMilestonesByFolder(
            [],
            [folder(3, "C", 1), folder(1, "A", 2), folder(2, "B", 1)]
        );
        expect(out.folders.map((g) => g.folder.name)).toEqual(["B", "C", "A"]);
    });

    it("keeps the input order inside a group", () => {
        const out = groupMilestonesByFolder([ms(3, 10), ms(1, 10), ms(2, 10)], [folder(10, "F")]);
        expect(out.folders[0].milestones.map((m) => m.milestoneId)).toEqual([3, 1, 2]);
    });

    it("leaves a milestone with an unknown folder in unfiled instead of dropping it", () => {
        const out = groupMilestonesByFolder([ms(1, 99)], [folder(10, "F")]);
        expect(out.unfiled.map((m) => m.milestoneId)).toEqual([1]);
        expect(out.folders[0].milestones).toEqual([]);
    });

    it("does not mutate its inputs", () => {
        const folders = [folder(2, "B", 2), folder(1, "A", 1)];
        const input = [ms(1, 1)];
        groupMilestonesByFolder(input, folders);
        expect(folders.map((f) => f.folderId)).toEqual([2, 1]);
        expect(input).toHaveLength(1);
    });

    it("a Closed milestone in an ended sprint is only in Past, and keeps its folder", () => {
        const sprints = [
            { sprintId: 1, status: "archived", isDeleted: false },
            { sprintId: 2, status: "active", isDeleted: false },
        ] as never;
        const all = [
            ms(1, 10, { status: "Closed", sprintId: 1 }), // ended + closed -> Past only
            ms(2, 10, { status: "Closed", sprintId: 2 }), // closed in an ACTIVE sprint -> stays
            ms(3, 10, { status: "Open", sprintId: 1 }), // open in an old sprint -> stays
        ];
        const visible = selectVisibleMilestones(all, sprints);
        const grouped = groupMilestonesByFolder(visible, [folder(10, "Launch")]);
        expect(grouped.folders[0].milestones.map((m) => m.milestoneId).sort()).toEqual([2, 3]);
        const past = selectOutdatedMilestones(all, sprints);
        expect(past.map((m) => m.milestoneId)).toEqual([1]);
        expect(past[0].folderId).toBe(10);
    });
});
