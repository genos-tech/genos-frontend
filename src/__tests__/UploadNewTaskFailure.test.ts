/**
 * Guards that a failed create is REPORTED rather than swallowed.
 *
 * `uploadNewTask` used to catch its own throw and return `[]`, so
 * `TaskCreateFooter` ran `setIsSubmitted(true)` on any backend rejection:
 * the form closed, the draft was wiped, and the user was left with no task
 * and no message. The 400 that exposed it ("The fields project,
 * project_task_number must make a unique set", from switching the project
 * picker mid-create) is fixed in genos-api, but the swallow was never
 * specific to that error.
 *
 * The contract these pin: a failure returns `ok: false`, puts a message in
 * the form's error snackbar, and runs none of the success side effects.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadNewTask } from "../features/tasks/services/uploadNewTask";
import { channelService } from "../services/channel/channelService";
import { ChannelKind } from "../types/channel";

vi.mock("../features/tasks/utils/TaskMessageTemplate", () => ({
    taskMessageTemplate: () => [{ type: "paragraph", content: "task created" }],
}));

// `addTask` writes to IndexedDB through a Web Worker, which jsdom has no
// implementation for — unmocked it throws before the assertions are reached.
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(undefined),
}));

const PM = { id: "pm-uuid", kind: ChannelKind.PM, projectId: 7 };

const USER = { userId: "u1", userName: "Me", teamId: "t1", teamName: "T" } as any;

const makeTaskContent = (over = {}) =>
    ({
        id: 101,
        title: "New task",
        project: { projectId: 7, projectName: "Proj", systemUserId: "sys-1" },
        assignee: USER,
        reporter: USER,
        priority: { priority: "High" },
        effortLevel: { level: "Low" },
        status: { status: "Open" },
        body: [],
        dueDate: "",
        links: [],
        tags: [],
        chatType: 3,
        parentTaskId: null,
        rootTaskId: null,
        attachments: [],
        ...over,
    }) as any;

const useCM = {
    isThreadVisible: false,
    currentMainChat: null,
    currentThreadChat: null,
    setCurrentThreadChat: vi.fn(),
} as any;

const baseInput = () => ({
    socket: null,
    myself: USER,
    taskContent: makeTaskContent(),
    useCM,
    accessToken: "token",
    setTitleError: vi.fn(),
    setTitleErrorOpen: vi.fn(),
    setCurrentPreviewTaskId: vi.fn(),
});

describe("uploadNewTask failure reporting", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(channelService, "getSnapshot").mockReturnValue({
            channels: new Map([[PM.id, PM]]),
        } as any);
        vi.spyOn(channelService, "listChannels").mockResolvedValue([PM] as any);
        vi.spyOn(channelService, "handleChannelCreated").mockImplementation(() => undefined);
        vi.spyOn(channelService, "send").mockResolvedValue({ id: "msg-1" } as any);
    });

    it("reports a rejected task PUT instead of returning as if it worked", async () => {
        // The exact shape the reported bug produced.
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                json: async () => ({
                    non_field_errors: [
                        "The fields project, project_task_number must make a unique set.",
                    ],
                }),
            })
        );
        const input = baseInput();

        const result = await uploadNewTask(input);

        expect(result.ok).toBe(false);
        // The message the form's snackbar renders.
        expect(input.setTitleError).toHaveBeenCalledWith(expect.stringMatching(/.+/));
        expect(input.setTitleErrorOpen).toHaveBeenCalledWith(true);
    });

    it("runs no success side effects when the task PUT fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                json: async () => ({ error: "nope" }),
            })
        );
        const input = baseInput();

        await uploadNewTask(input);

        // No preview retarget, and above all no "task created" card for a
        // task that doesn't exist.
        expect(input.setCurrentPreviewTaskId).not.toHaveBeenCalled();
        expect(channelService.send).not.toHaveBeenCalled();
    });

    it("reports a network failure (a throw, not an !ok response)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
        const input = baseInput();

        const result = await uploadNewTask(input);

        expect(result.ok).toBe(false);
        expect(input.setTitleErrorOpen).toHaveBeenCalledWith(true);
        // The raw "Failed to fetch" is neither localized nor presentable;
        // the user gets the localized create-failure line instead.
        expect(input.setTitleError).not.toHaveBeenCalledWith("Failed to fetch");
    });

    it("reports a failed attachment upload rather than dropping the staged file", async () => {
        const fetchMock = vi
            .fn()
            // 1: the task PUT succeeds.
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    task: { task_id: 101, displayId: "PRF-1", status: "Open" },
                }),
            })
            // 2: the attachment POST fails.
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ message: "storage unavailable" }),
            });
        vi.stubGlobal("fetch", fetchMock);
        const input = {
            ...baseInput(),
            taskContent: makeTaskContent({
                attachments: [{ file: new File(["x"], "a.txt", { type: "text/plain" }) }],
            }),
        };

        const result = await uploadNewTask(input);

        // The task row landed, but the form stays open: the staged file only
        // exists here, so closing would lose it with no way back.
        expect(result.ok).toBe(false);
        expect(input.setTitleError).toHaveBeenCalledWith("storage unavailable");
        expect(input.setTitleErrorOpen).toHaveBeenCalledWith(true);
    });

    it("returns the new task id on success", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    task: { task_id: 101, displayId: "PRF-1", status: "Open" },
                }),
            })
        );
        const input = baseInput();

        const result = await uploadNewTask(input);

        // The guard on the guard: if success stopped reporting `ok: true`,
        // the form would never close and the tests above would still pass.
        expect(result).toEqual({ ok: true, taskId: 101 });
        expect(input.setTitleErrorOpen).not.toHaveBeenCalled();
        expect(input.setCurrentPreviewTaskId).toHaveBeenCalledWith(101);
    });
});
