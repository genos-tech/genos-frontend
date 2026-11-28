/**
 * MIP-2524: a full save re-sends the project its copy was read in. The server
 * keeps a task that was moved meanwhile and answers `staleProject`; nothing of
 * the old copy may then reach the caches or the chat card, and the lists of
 * both projects are asked for again.
 */
import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cacheFullTask, invalidateCachedFullTask } from "../db/services/task-full.service";
import { addTask } from "../features/tasks/services/addTask";
import { sendUpdatedSpecificTask } from "../features/tasks/services/sendUpdatedSpecificTask";
import {
    emitTaskMetadataSaved,
    emitTasksBulkChanged,
} from "../features/tasks/services/taskEvents";
import { useSendUpdatedTask } from "../hooks/tasks/useSendUpdatedTask";
import { useTaskEditState } from "../hooks/tasks/useTaskEditState";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

const put = vi.fn();
vi.mock("../services/api", () => ({ authApi: () => ({ put }) }));
vi.mock("../db/services/task-full.service", () => ({
    cacheFullTask: vi.fn().mockResolvedValue(undefined),
    invalidateCachedFullTask: vi.fn().mockResolvedValue(undefined),
    getCachedFullTask: vi.fn().mockResolvedValue(null),
}));
const loadSpecificTask = vi.fn();
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: (...args: unknown[]) => loadSpecificTask(...args),
}));
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/uploadTaskAttachments", () => ({
    uploadTaskAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../features/tasks/services/taskEvents", () => ({
    emitTaskMetadataSaved: vi.fn(),
    emitTasksBulkChanged: vi.fn(),
    emitTaskTouched: vi.fn(),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: vi.fn().mockResolvedValue(undefined) },
}));

const myself = { teamId: "t1", userId: "u1" } as unknown as UserProps;

const makeTask = (extra: Partial<TaskProps> = {}): TaskProps =>
    ({
        id: 5,
        title: "T",
        body: [],
        project: { projectId: 1, projectName: "Source", systemUserId: "sys" },
        storedProjectId: 1,
        assignee: null,
        reporter: null,
        priority: { priority: "High" },
        effortLevel: { level: "" },
        status: { status: "Open" },
        dueDate: "",
        links: [],
        tags: [],
        attachments: [],
        parentTaskId: null,
        threadId: null,
        ...extra,
    }) as unknown as TaskProps;

const answer = (extra: Record<string, unknown>) => ({
    data: { task: { project: 2 }, movedFromProjectId: null, ...extra },
});

describe("a save from a copy older than a project move (MIP-2524)", () => {
    beforeEach(() => vi.clearAllMocks());

    it("sends the project the copy was read in beside the one it holds", async () => {
        put.mockResolvedValue(answer({}));
        await sendUpdatedSpecificTask(
            null,
            myself,
            makeTask({ project: { projectId: 2, projectName: "D" } as never }),
            false,
            "tok"
        );
        expect(put.mock.calls[0][1]).toMatchObject({ project: 2, base_project: 1 });
    });

    it("keeps the old copy out of the caches, reloads the lists and tells the caller", async () => {
        put.mockResolvedValue(answer({ staleProject: true }));
        const onStaleProject = vi.fn();
        await sendUpdatedSpecificTask(null, myself, makeTask(), true, "tok", undefined, {
            onStaleProject,
        });
        expect(onStaleProject).toHaveBeenCalledWith(2);
        expect(invalidateCachedFullTask).toHaveBeenCalledWith(5);
        expect(cacheFullTask).not.toHaveBeenCalled();
        expect(addTask).not.toHaveBeenCalled();
        expect(emitTaskMetadataSaved).not.toHaveBeenCalled();
        expect(emitTasksBulkChanged).toHaveBeenCalledWith(1);
        expect(emitTasksBulkChanged).toHaveBeenCalledWith(2);
    });

    it("a move the person picked caches the new stored project and reports it", async () => {
        put.mockResolvedValue(answer({ movedFromProjectId: 1 }));
        const onStoredProject = vi.fn();
        const task = makeTask({ project: { projectId: 2, projectName: "D" } as never });
        await sendUpdatedSpecificTask(null, myself, task, false, "tok", undefined, {
            onStoredProject,
        });
        expect(onStoredProject).toHaveBeenCalledWith(2);
        expect(vi.mocked(cacheFullTask).mock.calls[0][0].storedProjectId).toBe(2);
    });
});

const useHarness = (initial: TaskProps) => {
    const [preview, setPreview] = useState<TaskProps | undefined>(initial);
    const state = useTaskEditState(initial);
    const send = useSendUpdatedTask({
        socket: null,
        myself,
        accessToken: "tok",
        currentPreviewTask: preview,
        setCurrentPreviewTask: setPreview,
        taskEditState: state,
        bodyRef: { current: [] },
    });
    return { state, preview, send };
};

describe("the open task after a save (MIP-2524)", () => {
    beforeEach(() => vi.clearAllMocks());

    it("is reloaded from where the task now is after a stale save", async () => {
        put.mockResolvedValue(answer({ staleProject: true }));
        loadSpecificTask.mockResolvedValue([
            makeTask({
                project: { projectId: 2, projectName: "Destination" } as never,
                storedProjectId: 2,
                milestoneId: null,
            }),
        ]);
        const hook = renderHook(() => useHarness(makeTask({ milestoneId: 9 })));

        await act(async () => {
            await hook.result.current.send(false);
        });

        await waitFor(() =>
            expect(hook.result.current.state.tmpCurrentTaskContent.storedProjectId).toBe(2)
        );
        const { tmpCurrentTaskContent } = hook.result.current.state;
        expect(tmpCurrentTaskContent.project?.projectId).toBe(2);
        expect(tmpCurrentTaskContent.milestoneId).toBeNull();
        expect(hook.result.current.preview?.project?.projectId).toBe(2);
        expect(loadSpecificTask).toHaveBeenCalledWith(
            myself,
            2,
            5,
            "tok",
            expect.objectContaining({ forceRefresh: true })
        );
    });

    it("holds the new stored project after the person's own move", async () => {
        put.mockResolvedValue(answer({ movedFromProjectId: 1 }));
        const hook = renderHook(() =>
            useHarness(makeTask({ project: { projectId: 2, projectName: "D" } as never }))
        );

        await act(async () => {
            await hook.result.current.send(false);
        });

        expect(hook.result.current.state.tmpCurrentTaskContent.storedProjectId).toBe(2);
    });
});
