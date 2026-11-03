/**
 * Pushing an EDITED preview onto its table row: `syncPreviewEdit(task)`.
 *
 * The preview used to reach its row through a flag loop: TaskPreview copied
 * its working copy into `currentPreviewTask` and set `isTaskUpdated`; a hook
 * effect then patched the row, called `/task/meta/` and reset the flag. That
 * fired on every task OPEN too (two extra commits and a request each time) and
 * could DROP an edit: a second edit that landed while the flag was still set
 * was not copied. It is now one direct call per edit.
 *
 * The contract is two-sided, and both sides matter:
 *   - a no-op patch must hand back the SAME `allTasks` array, because a new
 *     identity is expensive far beyond this hook: TaskFilterMenu re-runs
 *     `applyFilters` (a full walk) plus a sort, the task table rebuilds
 *     `childrenByParent` / `displayRows`, and the sprint board re-runs its
 *     column-organizing effect, all scaling with the project's task count;
 *   - a real edit must still produce a new array (or the table goes stale).
 * And: every edit reaches the row, however close together they are, and none
 * of it asks the server for task meta.
 */

import { act, renderHook } from "@testing-library/react";
import axios, { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { authApi } from "../../services/api";
import { UserProps } from "../../types/admin";
import { TaskProps, TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));

// Every request any axios instance makes lands here, whichever module makes it:
// the test watches the wire, not one loader, so a request added back under any
// name is seen. Every request is answered with an empty list.
const requested: string[] = [];
let originalAdapter: typeof axios.defaults.adapter;
beforeEach(() => {
    requested.length = 0;
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        requested.push(`${config.baseURL ?? ""}${config.url ?? ""}`);
        return { data: [], status: 200, statusText: "OK", headers: {}, config };
    };
});

// `/note/task/meta/` (task NOTES) is a different endpoint that ends the same way.
const taskMetaRequests = () => requested.filter((url) => /(?<!\/note)\/task\/meta\//.test(url));

const myself = {
    userId: "u1",
    teamId: "t1",
    userName: "Me",
    userEmail: "me@example.com",
} as UserProps;

// A table row and the preview object that mirrors it EXACTLY. Every field
// the patch touches has to agree, otherwise the guard would be reported as
// working for the wrong reason.
const ROW: TaskTableProps = {
    id: "42",
    displayId: "PRJ-42",
    title: "Ship the thing",
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
    rootTaskId: 42,
    threadId: null,
    tags: [{ tagName: "backend", tagColor: "#111", tagTextColor: "#fff" }],
    concatTags: "/backend/",
    teamId: "t1",
    projectId: 10,
    isMilestone: false,
    milestoneId: null,
    sprintId: null,
} as unknown as TaskTableProps;

const previewFor = (over: Partial<Record<string, unknown>> = {}): TaskProps =>
    ({
        id: 42,
        title: "Ship the thing",
        priority: { priority: "High" },
        effortLevel: { level: "M" },
        status: { status: "Open" },
        createdDate: "2026-07-01",
        updatedAt: "2026-07-20 10:00:00",
        dueDate: "2026-07-25",
        daysLeft: 4,
        // A FRESH array instance every call, exactly as the preview
        // supplies it — the guard must compare tags by content, or it
        // would report "changed" on every open and never fire.
        tags: [{ tagName: "backend", tagColor: "#111", tagTextColor: "#fff" }],
        concatTags: "/backend/",
        assignee: {
            userId: "u2",
            userEmail: "a@example.com",
            userName: "Ada",
            avatarImgPath: "/img/u2.png",
        },
        parentTaskId: null,
        rootTaskId: 42,
        threadId: null,
        project: { projectId: 10 },
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
        ...over,
    }) as unknown as TaskProps;

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

const setup = async (rows: TaskTableProps[] = [ROW]) => {
    const view = renderHook(() => useTaskManagement(myself, "token"));
    act(() => view.result.current.setAllTasks(rows));
    await flush();
    return view;
};

afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    vi.clearAllMocks();
});

describe("useTaskManagement — syncPreviewEdit (preview→row)", () => {
    it("preserves allTasks identity when the patch changes nothing (task OPEN)", async () => {
        const { result } = await setup();
        const before = result.current.allTasks;

        // What an open hands over: the same values the row already has.
        act(() => result.current.syncPreviewEdit(previewFor()));
        await flush();

        // Same ARRAY, not merely equal contents — identity is what the
        // downstream filter/sort/index cascade keys off.
        expect(result.current.allTasks).toBe(before);
    });

    it("still produces a new array (and patched row) on a real edit", async () => {
        const { result } = await setup();
        const before = result.current.allTasks;

        act(() =>
            result.current.syncPreviewEdit(previewFor({ title: "Ship the thing (revised)" }))
        );
        await flush();

        expect(result.current.allTasks).not.toBe(before);
        expect(result.current.allTasks[0].title).toBe("Ship the thing (revised)");
    });

    it("detects a tag-only edit despite tags arriving as a fresh array", async () => {
        const { result } = await setup();
        const before = result.current.allTasks;

        act(() =>
            result.current.syncPreviewEdit(
                previewFor({
                    tags: [
                        { tagName: "backend", tagColor: "#111", tagTextColor: "#fff" },
                        { tagName: "urgent", tagColor: "#222", tagTextColor: "#fff" },
                    ],
                })
            )
        );
        await flush();

        expect(result.current.allTasks).not.toBe(before);
        expect(result.current.allTasks[0].tags).toHaveLength(2);
    });

    it("two edits in back-to-back commits both reach the row (the old flag dropped the second)", async () => {
        const { result } = await setup();

        // No flush between the two: the second lands in the very next commit.
        act(() => result.current.syncPreviewEdit(previewFor({ title: "First edit" })));
        act(() =>
            result.current.syncPreviewEdit(
                previewFor({ title: "Second edit", status: { status: "WIP" } })
            )
        );

        expect(result.current.allTasks[0].title).toBe("Second edit");
        expect(result.current.allTasks[0].status).toBe("WIP");
    });

    it("two edits batched into one commit are applied in order", async () => {
        const { result } = await setup();

        act(() => {
            result.current.syncPreviewEdit(previewFor({ title: "First edit" }));
            result.current.syncPreviewEdit(previewFor({ title: "Second edit" }));
        });

        expect(result.current.allTasks[0].title).toBe("Second edit");
    });

    it("never asks the server for task meta: not on mount, not for an open, not for an edit of any field it used to refetch for", async () => {
        const { result } = await setup();

        act(() => result.current.syncPreviewEdit(previewFor()));
        act(() => result.current.syncPreviewEdit(previewFor({ title: "Edited" })));
        act(() =>
            result.current.syncPreviewEdit(
                previewFor({ title: "Edited", status: { status: "WIP" } })
            )
        );
        act(() => result.current.syncPreviewEdit(previewFor({ parentTaskId: 7 })));
        act(() =>
            result.current.syncPreviewEdit(
                previewFor({ parentTaskId: 7, project: { projectId: 11 } })
            )
        );
        await flush();

        // Vacuity guard: the edits reached the row, so the requests below
        // would have been sent had anything wanted to send them.
        expect(result.current.allTasks[0].projectId).toBe(11);
        expect(result.current.allTasks[0].parentTaskId).toBe("7");
        expect(taskMetaRequests()).toEqual([]);
    });

    it("sees a /task/meta/ request when one is made, and not a /note/task/meta/ one (the watcher is not blind)", async () => {
        await setup();

        await authApi("token")!.get("/note/task/meta/?team_id=t1&user_id=u1");
        expect(taskMetaRequests()).toEqual([]);

        await authApi("token")!.get("/task/meta/?team_id=t1&user_id=u1");
        expect(taskMetaRequests()).toHaveLength(1);
    });

    it("keeps no team-wide task-meta list, tree or loader (nothing reads them)", async () => {
        const { result } = await setup();

        for (const member of ["taskMeta", "setTaskMeta", "taskMetaTree", "getTaskMeta"]) {
            expect(member in result.current, member).toBe(false);
        }
    });

    it("keeps milestone fields the preview does not carry (the row's own survive the patch)", async () => {
        const milestoneRow = {
            ...ROW,
            isMilestone: true,
            milestoneId: 7,
            sprintId: 3,
        } as TaskTableProps;
        const { result } = await setup([milestoneRow]);

        act(() =>
            result.current.syncPreviewEdit(
                previewFor({
                    title: "Renamed",
                    isMilestone: undefined,
                    milestoneId: undefined,
                    sprintId: undefined,
                })
            )
        );

        const row = result.current.allTasks[0];
        expect(row.title).toBe("Renamed");
        expect(row.isMilestone).toBe(true);
        expect(row.milestoneId).toBe(7);
        expect(row.sprintId).toBe(3);
    });

    it("ignores a task that is not in the table, and the empty working copy of a fresh mount", async () => {
        const { result } = await setup();
        const before = result.current.allTasks;

        act(() => result.current.syncPreviewEdit(previewFor({ id: 999 })));
        act(() => result.current.syncPreviewEdit({} as TaskProps));
        await flush();

        expect(result.current.allTasks).toBe(before);
    });

    it("keeps one stable function across renders (hosts put it in effect dependencies)", async () => {
        const view = await setup();
        const first = view.result.current.syncPreviewEdit;

        act(() => view.result.current.setAllTasks([{ ...ROW, title: "Other" } as TaskTableProps]));
        view.rerender();

        expect(view.result.current.syncPreviewEdit).toBe(first);
    });
});
