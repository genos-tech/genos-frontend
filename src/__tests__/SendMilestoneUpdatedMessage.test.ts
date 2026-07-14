/**
 * Milestone-card live-sync on edit.
 *
 * The milestone PM "card" bubble used to freeze at create time — nothing
 * rewrote it when a milestone's status/title/etc. changed (the task-card
 * path had the same gap, fixed via `channelService.updateTaskCard`). This
 * service is the milestone twin: it rebuilds the card and pushes it through
 * the by-task-id `updateTaskCard` endpoint. These tests assert that wiring
 * and its guards.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendMilestoneUpdatedMessage } from "../features/tasks/sprint-milestone/services/sendMilestoneUpdatedMessage";
import { channelService } from "../services/channel/channelService";

// Isolate the routing from the real BlockNote template.
vi.mock("../features/tasks/utils/TaskMessageTemplate", () => ({
    milestoneMessageTemplate: () => [{ type: "paragraph", content: "milestone card" }],
}));

const USER = { userId: "u1", userName: "Me", teamId: "t1", teamName: "T" } as any;
const makeMilestone = (over = {}) =>
    ({ taskId: 42, status: "WIP", title: "M1", milestoneId: 1, ...over }) as any;

const baseInput = () => ({
    myself: USER,
    milestone: makeMilestone(),
    sprintName: "Sprint 1",
    reporter: USER,
    assignees: [USER],
    systemUserId: "sys-1",
});

describe("sendMilestoneUpdatedMessage", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(channelService, "updateTaskCard").mockResolvedValue(undefined as any);
    });

    it("rewrites the milestone card via updateTaskCard, keyed by the backing task id", async () => {
        await sendMilestoneUpdatedMessage(baseInput());

        const call = channelService.updateTaskCard as unknown as ReturnType<typeof vi.fn>;
        expect(call).toHaveBeenCalledTimes(1);
        const [taskId, body, bodyText, metadata] = call.mock.calls[0];
        expect(taskId).toBe(42);
        expect(body).toEqual([{ type: "paragraph", content: "milestone card" }]);
        expect(bodyText).toBe("M1");
        expect(metadata).toMatchObject({ taskId: 42, taskStatus: "WIP", systemUserId: "sys-1" });
    });

    it("does NOT call updateTaskCard when the milestone has no backing task", async () => {
        await sendMilestoneUpdatedMessage({
            ...baseInput(),
            milestone: makeMilestone({ taskId: null }),
        });
        expect(channelService.updateTaskCard).not.toHaveBeenCalled();
    });

    it("swallows a channelService failure (never throws — must not block the save)", async () => {
        vi.spyOn(channelService, "updateTaskCard").mockRejectedValue(new Error("socket down"));
        await expect(sendMilestoneUpdatedMessage(baseInput())).resolves.toBeUndefined();
    });
});
