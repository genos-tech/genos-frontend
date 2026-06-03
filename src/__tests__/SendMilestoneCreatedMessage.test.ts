/**
 * Regression test for the milestone-created notification.
 *
 * The service used to emit deleted legacy `join`/`message`/`thread_message`
 * sockets, so nothing persisted — no message, no activity, no push. It now
 * routes through `channelService.send` (the v3 message path) like
 * `uploadNewTask`. These tests assert that wiring: the milestone bubble +
 * its thread follow-up are sent to the project's PM channel, and the
 * guards bail without sending.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendMilestoneCreatedMessage } from "../features/tasks/sprint-milestone/services/sendMilestoneCreatedMessage";
import { channelService } from "../services/channel/channelService";
import { ChannelKind } from "../types/channel";

// Isolate the routing under test from the real BlockNote templates.
vi.mock("../features/tasks/utils/TaskMessageTemplate", () => ({
    milestoneMessageTemplate: () => [{ type: "paragraph", content: "milestone created" }],
    milestoneCreatedThreadMessageTemplate: () => [{ type: "paragraph", content: "thread" }],
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
const useCM = { isThreadVisible: false } as any;

const baseInput = () => ({
    myself: USER,
    project: makeProject(),
    milestone: makeMilestone(),
    sprintName: "Sprint 1",
    reporter: USER,
    assignees: [USER],
    useCM,
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

    it("posts the milestone bubble + thread follow-up to the project's PM channel", async () => {
        await sendMilestoneCreatedMessage(baseInput());

        const send = channelService.send as unknown as ReturnType<typeof vi.fn>;
        expect(send).toHaveBeenCalledTimes(2);

        const [chanId, , opts] = send.mock.calls[0];
        expect(chanId).toBe("pm-uuid");
        expect(opts.metadata.taskId).toBe(42);
        expect(opts.metadata.systemUserId).toBe("sys-1");

        // Second call is the thread follow-up, parented to the first message.
        const [, , followupOpts] = send.mock.calls[1];
        expect(followupOpts.parentId).toBe("msg-1");
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
});
