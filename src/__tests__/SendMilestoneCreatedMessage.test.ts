/**
 * What the app sends for a new milestone: only the reply into the DM or group
 * thread it was made from. The project chat's card is the api's (MIP-2483,
 * MIP-2506), so nothing may be sent to a project chat from here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendMilestoneCreatedMessage } from "../features/tasks/sprint-milestone/services/sendMilestoneCreatedMessage";
import { channelService } from "../services/channel/channelService";

// Isolate the routing under test from the real BlockNote templates.
vi.mock("../features/tasks/utils/TaskMessageTemplate", () => ({
    milestoneMessageTemplate: () => [{ type: "paragraph", content: "milestone created" }],
}));

const makeProject = (over = {}) =>
    ({
        projectId: 7,
        projectName: "Proj",
        systemUserId: "sys-1",
        projectTags: [],
        ...over,
    }) as never;
const makeMilestone = (over = {}) =>
    ({ taskId: 42, status: "Open", title: "M1", milestoneId: 1, ...over }) as never;
const USER = { userId: "u1", userName: "Me", teamId: "t1", teamName: "T" } as never;

const baseInput = () => ({
    myself: USER,
    project: makeProject(),
    milestone: makeMilestone(),
    sprintName: "Sprint 1",
    reporter: USER,
    assignees: [USER],
    fromThread: { chatType: 1, chatId: "dm-uuid", threadId: "root-uuid" } as {
        chatType: number;
        chatId: string;
        threadId: string;
    } | null,
});

describe("sendMilestoneCreatedMessage", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(channelService, "send").mockResolvedValue({ id: "msg-1" } as never);
    });

    const sends = () => (channelService.send as unknown as ReturnType<typeof vi.fn>).mock.calls;

    it("replies in the captured origin thread, and sends nothing else", async () => {
        await sendMilestoneCreatedMessage(baseInput());

        expect(sends()).toHaveLength(1);
        const [chanId, , opts] = sends()[0];
        expect(chanId).toBe("dm-uuid");
        expect(opts.parentId).toBe("root-uuid");
        expect(opts.metadata).toMatchObject({ taskId: 42, systemUserId: "sys-1" });
    });

    it("sends nothing for a milestone made outside a thread", async () => {
        await sendMilestoneCreatedMessage({ ...baseInput(), fromThread: null });
        expect(sends()).toHaveLength(0);
    });

    it("sends nothing for a project-chat thread origin", async () => {
        await sendMilestoneCreatedMessage({
            ...baseInput(),
            fromThread: { chatType: 3, chatId: "pm-uuid", threadId: "card-uuid" },
        });
        expect(sends()).toHaveLength(0);
    });

    it("bails when project.systemUserId is missing", async () => {
        await sendMilestoneCreatedMessage({
            ...baseInput(),
            project: makeProject({ systemUserId: undefined }),
        });
        expect(sends()).toHaveLength(0);
    });

    it("bails when milestone.taskId is missing", async () => {
        await sendMilestoneCreatedMessage({
            ...baseInput(),
            milestone: makeMilestone({ taskId: null }),
        });
        expect(sends()).toHaveLength(0);
    });
});
