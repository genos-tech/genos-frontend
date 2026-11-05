/**
 * MIP-1026: a task moved into a milestone from its PREVIEW takes its
 * sub-tasks with it, in the table's own state.
 *
 * The server already moves the whole sub-tree (milestone, sprint and chain
 * root on every descendant; verified end to end in genos-api). The browser
 * only mirrored that for the drag-onto-a-row path. The preview's milestone
 * picker saves through `syncPreviewEdit`, which patched ONLY the edited row, so
 * the sub-tasks kept `milestoneId: null` and the old root. A milestone-scoped
 * table keeps a child when its own `milestoneId` matches, or when its parent is
 * the milestone's backing row, so the moved task showed up under the milestone
 * with no children until something forced a full reload.
 *
 * The preview also never hands over a `rootTaskId` (the server re-derives it),
 * so the moved row itself kept a stale root.
 */

import { act, renderHook } from "@testing-library/react";
import axios, { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskProps, TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));

let originalAdapter: typeof axios.defaults.adapter;
beforeEach(() => {
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = async (config: InternalAxiosRequestConfig) => ({
        data: [],
        status: 200,
        statusText: "OK",
        headers: {},
        config,
    });
});
afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    vi.clearAllMocks();
});

const myself = {
    userId: "u1",
    teamId: "t1",
    userName: "Me",
    userEmail: "me@example.com",
} as UserProps;

const row = (id: number, over: Partial<Record<string, unknown>> = {}): TaskTableProps =>
    ({
        id: String(id),
        displayId: `PRJ-${id}`,
        title: `Task ${id}`,
        priority: "High",
        effortLevel: "M",
        createdDate: "2026-07-01",
        updatedAt: "2026-07-20 10:00:00",
        dueDate: "2026-07-25",
        daysLeft: 4,
        status: "Open",
        assigneeId: "u2",
        assigneeEmail: "a@example.com",
        assigneeName: "Ada",
        assigneeImgPath: "/img/u2.png",
        parentTaskId: null,
        rootTaskId: id,
        threadId: null,
        tags: [],
        concatTags: null,
        teamId: "t1",
        projectId: 10,
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
        ...over,
    }) as unknown as TaskTableProps;

/** What the preview hands over for task `id`: the same values its row holds,
 *  with `over` applied, and NO `rootTaskId` change (the picker never sends one). */
const previewFor = (id: number, over: Partial<Record<string, unknown>> = {}): TaskProps =>
    ({
        id,
        title: `Task ${id}`,
        priority: { priority: "High" },
        effortLevel: { level: "M" },
        status: { status: "Open" },
        createdDate: "2026-07-01",
        updatedAt: "2026-07-20 10:00:00",
        dueDate: "2026-07-25",
        daysLeft: 4,
        tags: [],
        concatTags: undefined,
        assignee: {
            userId: "u2",
            userEmail: "a@example.com",
            userName: "Ada",
            avatarImgPath: "/img/u2.png",
        },
        parentTaskId: null,
        rootTaskId: id,
        threadId: null,
        project: { projectId: 10 },
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
        ...over,
    }) as unknown as TaskProps;

// Milestone 3, backed by row 7.
const MILESTONE_ID = 3;
const BACKING = 7;

const table = () => [
    row(BACKING, { isMilestone: true, milestoneId: MILESTONE_ID, rootTaskId: BACKING }),
    // The root task under test, and its three-level tree.
    row(42),
    row(43, { parentTaskId: "42", rootTaskId: 42 }),
    row(44, { parentTaskId: "43", rootTaskId: 42 }),
    row(45, { parentTaskId: "42", rootTaskId: 42 }),
    // Not in the tree.
    row(50),
    row(51, { parentTaskId: "50", rootTaskId: 50 }),
    // A task already inside the milestone, with a sub-task of its own.
    row(60, {
        parentTaskId: String(BACKING),
        milestoneId: MILESTONE_ID,
        rootTaskId: BACKING,
    }),
];

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

const setup = async (rows: TaskTableProps[] = table()) => {
    const view = renderHook(() => useTaskManagement(myself, "token"));
    act(() => view.result.current.setAllTasks(rows));
    await flush();
    const byId = (id: number) => view.result.current.allTasks.find((t) => t.id === String(id))!;
    return { ...view, byId };
};

const intoMilestone = (id = 42) =>
    previewFor(id, { milestoneId: MILESTONE_ID, parentTaskId: BACKING });

describe("syncPreviewEdit — moving a task into a milestone from the preview", () => {
    it("files every sub-task, at every depth, under the milestone", async () => {
        const { result, byId } = await setup();

        act(() => result.current.syncPreviewEdit(intoMilestone()));
        await flush();

        for (const id of [43, 44, 45]) {
            expect(byId(id).milestoneId, `task ${id} milestoneId`).toBe(MILESTONE_ID);
        }
    });

    it("re-roots the moved task and its sub-tasks on the milestone's backing row", async () => {
        const { result, byId } = await setup();

        act(() => result.current.syncPreviewEdit(intoMilestone()));
        await flush();

        for (const id of [42, 43, 44, 45]) {
            expect(byId(id).rootTaskId, `task ${id} rootTaskId`).toBe(BACKING);
        }
        expect(byId(42).parentTaskId).toBe(String(BACKING));
    });

    it("leaves the edges inside the moved tree alone", async () => {
        const { result, byId } = await setup();

        act(() => result.current.syncPreviewEdit(intoMilestone()));
        await flush();

        expect(byId(43).parentTaskId).toBe("42");
        expect(byId(44).parentTaskId).toBe("43");
        expect(byId(45).parentTaskId).toBe("42");
    });

    it("does not touch a row outside the moved tree (same object, not a copy)", async () => {
        const { result, byId } = await setup();
        const before = [50, 51, 60, BACKING].map(byId);

        act(() => result.current.syncPreviewEdit(intoMilestone()));
        await flush();

        [50, 51, 60, BACKING].forEach((id, i) => expect(byId(id)).toBe(before[i]));
    });

    it("clearing the milestone puts the whole tree back on its own root", async () => {
        const { result, byId } = await setup();
        act(() => result.current.syncPreviewEdit(intoMilestone()));
        await flush();

        act(() =>
            result.current.syncPreviewEdit(
                previewFor(42, { milestoneId: null, parentTaskId: null })
            )
        );
        await flush();

        for (const id of [42, 43, 44, 45]) {
            expect(byId(id).rootTaskId, `task ${id} rootTaskId`).toBe(42);
        }
        for (const id of [43, 44, 45]) {
            expect(byId(id).milestoneId, `task ${id} milestoneId`).toBeNull();
        }
        expect(byId(42).parentTaskId).toBeNull();
    });

    it("moving between milestones re-homes the sub-tasks again", async () => {
        const { result, byId } = await setup([
            ...table(),
            row(8, { isMilestone: true, milestoneId: 4, rootTaskId: 8 }),
        ]);
        act(() => result.current.syncPreviewEdit(intoMilestone()));
        await flush();

        act(() =>
            result.current.syncPreviewEdit(previewFor(42, { milestoneId: 4, parentTaskId: 8 }))
        );
        await flush();

        for (const id of [43, 44, 45]) {
            expect(byId(id).milestoneId).toBe(4);
            expect(byId(id).rootTaskId).toBe(8);
        }
    });

    it("a title edit does not rewrite the sub-tree (no churn on every save)", async () => {
        const { result, byId } = await setup();
        const children = [43, 44, 45].map(byId);

        act(() => result.current.syncPreviewEdit(previewFor(42, { title: "Renamed" })));
        await flush();

        [43, 44, 45].forEach((id, i) => expect(byId(id)).toBe(children[i]));
    });
});

// MIP-1035: the sprint follows the milestone. The preview hands over the sprint
// the task ends up with (the picker always says), and `null` means "no sprint",
// not "not provided".
describe("syncPreviewEdit — the sprint follows the milestone (MIP-1035)", () => {
    const SPRINT = 5;
    const inSprint = () =>
        table().map((r) =>
            [42, 43, 44, 45].includes(Number(r.id)) ? { ...r, sprintId: SPRINT } : r
        );
    const sprintsOf = (byId: (id: number) => TaskTableProps) =>
        [42, 43, 44, 45].map((id) => byId(id).sprintId);

    it("moving into a milestone with NO sprint clears the sprint on the task and its sub-tasks", async () => {
        const { result, byId } = await setup(inSprint());

        act(() =>
            result.current.syncPreviewEdit(
                previewFor(42, {
                    milestoneId: MILESTONE_ID,
                    parentTaskId: BACKING,
                    sprintId: null,
                })
            )
        );
        await flush();

        expect(sprintsOf(byId)).toEqual([null, null, null, null]);
    });

    it("moving into a milestone WITH a sprint gives the whole tree that sprint", async () => {
        const { result, byId } = await setup(inSprint());

        act(() =>
            result.current.syncPreviewEdit(
                previewFor(42, { milestoneId: MILESTONE_ID, parentTaskId: BACKING, sprintId: 7 })
            )
        );
        await flush();

        expect(sprintsOf(byId)).toEqual([7, 7, 7, 7]);
    });

    it("clearing the milestone clears the sprint on the whole tree", async () => {
        const { result, byId } = await setup(inSprint());
        act(() =>
            result.current.syncPreviewEdit(
                previewFor(42, { milestoneId: MILESTONE_ID, parentTaskId: BACKING, sprintId: 7 })
            )
        );
        await flush();

        act(() =>
            result.current.syncPreviewEdit(
                previewFor(42, { milestoneId: null, parentTaskId: null, sprintId: 7 })
            )
        );
        await flush();

        // Even if the copy still carries the old sprint, a task with no milestone has none.
        expect(sprintsOf(byId)).toEqual([null, null, null, null]);
    });

    it("an edit that is not a move keeps the sprint, even from a copy that does not carry one", async () => {
        const { result, byId } = await setup(inSprint());
        const children = [43, 44, 45].map(byId);

        act(() =>
            result.current.syncPreviewEdit(previewFor(42, { title: "Renamed", sprintId: null }))
        );
        await flush();

        expect(byId(42).sprintId).toBe(SPRINT);
        [43, 44, 45].forEach((id, i) => expect(byId(id)).toBe(children[i]));
    });
});
