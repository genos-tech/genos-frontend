/**
 * What `uploadNewTask` sends to chat: only the reply into the DM or group thread
 * the task was made from. The project chat's card is the api's (MIP-2483,
 * MIP-2506): nothing may be sent there from the app.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadNewTask } from "../features/tasks/services/uploadNewTask";
import { channelService } from "../services/channel/channelService";

vi.mock("../features/tasks/utils/TaskMessageTemplate", () => ({
    taskMessageTemplate: () => [{ type: "paragraph", content: "task created" }],
}));

// `addTask` writes to IndexedDB through a Web Worker, which jsdom has no
// implementation for — unmocked it throws before the PM sends are reached.
vi.mock("../features/tasks/services/addTask", () => ({
    addTask: vi.fn().mockResolvedValue(undefined),
}));

const USER = { userId: "u1", userName: "Me", teamId: "t1", teamName: "T" } as never;

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
    }) as never;

// Thread not visible → the DM/GM/MDM cross-post branch stays out of the
// way, leaving only the PM sends under test.
const useCM = {
    isThreadVisible: false,
    currentMainChat: null,
    currentThreadChat: null,
    setCurrentThreadChat: vi.fn(),
} as never;

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

describe("uploadNewTask → PM channel", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    task: { task_id: 101, displayId: "PRF-1", status: "Open" },
                }),
            })
        );
        vi.spyOn(channelService, "send").mockResolvedValue({ id: "msg-1" } as never);
    });

    const fromThread = { chatType: 1, chatId: "dm-uuid", threadId: "thread-uuid" };
    const sends = () => (channelService.send as unknown as ReturnType<typeof vi.fn>).mock.calls;

    it("sends nothing for a task made outside a thread", async () => {
        await uploadNewTask(baseInput());

        expect(sends()).toHaveLength(0);
    });

    it("sends only the thread reply for a task made from a thread", async () => {
        await uploadNewTask({ ...baseInput(), taskContent: makeTaskContent(fromThread) });

        expect(sends().map(([chanId]) => chanId)).toEqual(["dm-uuid"]);
        expect(sends()[0][2].metadata).toMatchObject({ taskId: 101, displayId: "PRF-1" });
    });

    it("still cross-posts into the origin DM thread (a parented send that must keep working)", async () => {
        // Regression guard for the removal itself: this OTHER parented
        // send is a different feature (trail back to the task from the
        // conversation it came from) and must survive. The target now
        // comes from taskContent's captured linkage (`fromThread` →
        // chatType/chatId/threadId), NOT from whatever chat state is
        // open at submit time — a task created from a thread must post
        // there even if the pane was closed before submitting.
        await uploadNewTask({
            ...baseInput(),
            taskContent: makeTaskContent({
                chatType: 1,
                chatId: "dm-uuid",
                threadId: "thread-uuid",
            }),
        });

        const send = channelService.send as unknown as ReturnType<typeof vi.fn>;
        const dmSends = send.mock.calls.filter(([chanId]) => chanId === "dm-uuid");
        expect(dmSends).toHaveLength(1);
        expect(dmSends[0][2].parentId).toBe("thread-uuid");
    });

    it("finishes on the HTTP response when the socket is down (the reply never settles)", async () => {
        // Socket down: `channelService.send` queues the reply and its promise
        // stays pending until a reconnect. The create must still resolve.
        vi.spyOn(channelService, "send").mockReturnValue(new Promise(() => undefined) as never);

        const result = await Promise.race([
            uploadNewTask({ ...baseInput(), taskContent: makeTaskContent(fromThread) }),
            new Promise((resolve) => setTimeout(() => resolve("hung"), 500)),
        ]);

        expect(result).toEqual({ ok: true, taskId: 101 });
        // The reply was still handed to the queue for live sync.
        expect(sends()).toHaveLength(1);
    });

    it("logs, and still succeeds, when the reply is rejected", async () => {
        const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(channelService, "send").mockRejectedValue(new Error("socket gone"));

        const result = await uploadNewTask({
            ...baseInput(),
            taskContent: makeTaskContent(fromThread),
        });
        await Promise.resolve();

        expect(result).toEqual({ ok: true, taskId: 101 });
        expect(err).toHaveBeenCalledWith(
            "uploadNewTask: failed to post task summary into open thread",
            expect.any(Error)
        );
    });

    it("does NOT cross-post from ambient chat state when taskContent has no linkage", async () => {
        // The pre-fix behavior: an open-but-unrelated thread leaked its
        // ids into the create. With no captured linkage there must be no
        // parented send, regardless of what useCM holds.
        await uploadNewTask({
            ...baseInput(),
            useCM: {
                isThreadVisible: true,
                currentMainChat: { chatId: "dm-uuid", chatType: 1 },
                currentThreadChat: { threadId: "thread-uuid" },
                setCurrentThreadChat: vi.fn(),
            } as never,
        });

        const send = channelService.send as unknown as ReturnType<typeof vi.fn>;
        const dmSends = send.mock.calls.filter(([chanId]) => chanId === "dm-uuid");
        expect(dmSends).toHaveLength(0);
    });
});
