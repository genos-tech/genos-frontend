/**
 * Regression test for the milestone-created notification.
 *
 * The service used to emit deleted legacy `join`/`message`/`thread_message`
 * sockets, so nothing persisted — no message, no activity, no push. It now
 * routes through `channelService.send` (the v3 message path) like
 * `uploadNewTask`. These tests assert that wiring: the milestone CARD is
 * sent to the project's PM channel, and the guards bail without sending.
 *
 * The card send is the only one left. The service used to follow it with a
 * "🚩 New milestone created by @X" thread reply; the PM thread's Activities
 * tab now renders the structured audit log instead of system bubbles, so
 * that follow-up was removed and must not come back.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendMilestoneCreatedMessage } from "../features/tasks/sprint-milestone/services/sendMilestoneCreatedMessage";
import { channelService } from "../services/channel/channelService";
import { ChannelKind } from "../types/channel";

// Isolate the routing under test from the real BlockNote templates.
vi.mock("../features/tasks/utils/TaskMessageTemplate", () => ({
    milestoneMessageTemplate: () => [{ type: "paragraph", content: "milestone created" }],
}));

const PM = { id: "pm-uuid", kind: ChannelKind.PM, projectId: 7 };

const makeProject = (over = {}) =>
    ({
        projectId: 7,
        projectName: "Proj",
        systemUserId: "sys-1",
        projectTags: [],
        ...over,
    }) as any;
const makeMilestone = (over = {}) =>
    ({ taskId: 42, status: "Open", title: "M1", milestoneId: 1, ...over }) as any;
const USER = { userId: "u1", userName: "Me", teamId: "t1", teamName: "T" } as any;

const baseInput = () => ({
    myself: USER,
    project: makeProject(),
    milestone: makeMilestone(),
    sprintName: "Sprint 1",
    reporter: USER,
    assignees: [USER],
    // No thread origin by default — the thread cross-post is opt-in via
    // the explicit context captured at create-intent time.
    fromThread: null,
});

describe("sendMilestoneCreatedMessage", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(channelService, "getSnapshot").mockReturnValue({
            channels: new Map([[PM.id, PM]]),
        } as any);
        vi.spyOn(channelService, "listChannels").mockResolvedValue([] as any);
        vi.spyOn(channelService, "handleChannelCreated").mockImplementation(() => undefined);
        vi.spyOn(channelService, "send").mockResolvedValue({ id: "msg-1" } as any);
    });

    it("posts the milestone card to the project's PM channel", async () => {
        await sendMilestoneCreatedMessage(baseInput());

        const send = channelService.send as unknown as ReturnType<typeof vi.fn>;
        expect(send).toHaveBeenCalledTimes(1);

        const [chanId, , opts] = send.mock.calls[0];
        expect(chanId).toBe("pm-uuid");
        expect(opts.metadata.taskId).toBe(42);
        expect(opts.metadata.systemUserId).toBe("sys-1");
    });

    it("posts NO thread follow-up under the PM card", async () => {
        await sendMilestoneCreatedMessage(baseInput());

        // `parentId` is the only thing distinguishing a thread reply from
        // a top-level card — both go through the same `send`. Scoped to
        // the PM channel on purpose: the service also cross-posts into an
        // open DM/GM/MDM thread (a parented send that must keep working),
        // so a blanket "no parentId" would ban the wrong thing.
        const send = channelService.send as unknown as ReturnType<typeof vi.fn>;
        const pmSends = send.mock.calls.filter(([chanId]) => chanId === PM.id);
        expect(pmSends).toHaveLength(1);
        expect(pmSends[0][2]?.parentId).toBeUndefined();
    });

    it("falls back to a REST channel refresh when the snapshot lacks the PM channel", async () => {
        vi.spyOn(channelService, "getSnapshot").mockReturnValue({ channels: new Map() } as any);
        vi.spyOn(channelService, "listChannels").mockResolvedValue([PM] as any);

        await sendMilestoneCreatedMessage(baseInput());

        expect(channelService.listChannels).toHaveBeenCalled();
        expect(channelService.handleChannelCreated).toHaveBeenCalledWith(PM);
        expect(channelService.send).toHaveBeenCalled();
    });

    it("does NOT send when no PM channel can be resolved", async () => {
        vi.spyOn(channelService, "getSnapshot").mockReturnValue({ channels: new Map() } as any);
        vi.spyOn(channelService, "listChannels").mockResolvedValue([] as any);

        await sendMilestoneCreatedMessage(baseInput());

        expect(channelService.send).not.toHaveBeenCalled();
    });

    it("bails (no send) when project.systemUserId is missing", async () => {
        await sendMilestoneCreatedMessage({
            ...baseInput(),
            project: makeProject({ systemUserId: undefined }),
        });
        expect(channelService.send).not.toHaveBeenCalled();
    });

    it("bails (no send) when milestone.taskId is missing", async () => {
        await sendMilestoneCreatedMessage({
            ...baseInput(),
            milestone: makeMilestone({ taskId: null }),
        });
        expect(channelService.send).not.toHaveBeenCalled();
    });

    it("cross-posts into the captured origin thread (not ambient chat state)", async () => {
        await sendMilestoneCreatedMessage({
            ...baseInput(),
            fromThread: { chatType: 1, chatId: "dm-uuid", threadId: "root-uuid" },
        });

        const send = channelService.send as unknown as ReturnType<typeof vi.fn>;
        expect(send).toHaveBeenCalledTimes(2);
        const threadSend = send.mock.calls.find(([chanId]) => chanId === "dm-uuid");
        expect(threadSend).toBeDefined();
        expect(threadSend![2]?.parentId).toBe("root-uuid");
        expect(threadSend![2]?.metadata.taskId).toBe(42);
    });

    it("does NOT cross-post for a PM-thread origin", async () => {
        await sendMilestoneCreatedMessage({
            ...baseInput(),
            fromThread: { chatType: 3, chatId: "pm-uuid", threadId: "card-uuid" },
        });

        const send = channelService.send as unknown as ReturnType<typeof vi.fn>;
        const parented = send.mock.calls.filter(([, , opts]) => opts?.parentId);
        expect(parented).toHaveLength(0);
    });
});
