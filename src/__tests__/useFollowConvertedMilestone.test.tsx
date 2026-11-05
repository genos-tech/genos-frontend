/**
 * MIP-1042: an old milestone link follows the conversion. The milestone read
 * answered "converted" and named the task; the preview switches to it, or to the
 * milestone it became again, once per answer.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFollowConvertedMilestone } from "../features/tasks/hooks/useFollowConvertedMilestone";
import type { ConvertedTaskRef } from "../features/tasks/sprint-milestone/services";

const tm = () => ({
    setCurrentPreviewTaskId: vi.fn(),
    setCurrentPreviewMilestoneId: vi.fn(),
    setIsTaskPreviewVisible: vi.fn(),
    loadTask: vi.fn().mockResolvedValue(undefined),
});
const task: ConvertedTaskRef = {
    taskId: 10,
    displayId: "MIP-10",
    projectId: 3,
    isMilestone: false,
    milestoneId: null,
};

describe("useFollowConvertedMilestone", () => {
    it("opens the task the milestone became, in its own project", () => {
        const useTM = tm();
        renderHook(() => useFollowConvertedMilestone(task, useTM as never));

        expect(useTM.setCurrentPreviewTaskId).toHaveBeenCalledWith(10);
        expect(useTM.loadTask).toHaveBeenCalledWith(3, 10);
        expect(useTM.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
        expect(useTM.setCurrentPreviewMilestoneId).not.toHaveBeenCalled();
    });

    it("opens the new milestone when the task was made a milestone again", () => {
        const useTM = tm();
        const again = { ...task, isMilestone: true, milestoneId: 77 };
        renderHook(() => useFollowConvertedMilestone(again, useTM as never));

        expect(useTM.setCurrentPreviewMilestoneId).toHaveBeenCalledWith(77);
        expect(useTM.setCurrentPreviewTaskId).not.toHaveBeenCalled();
        expect(useTM.loadTask).not.toHaveBeenCalled();
        expect(useTM.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
    });

    it("does nothing while the milestone has not been converted", () => {
        const useTM = tm();
        renderHook(() => useFollowConvertedMilestone(undefined, useTM as never));

        expect(useTM.setCurrentPreviewTaskId).not.toHaveBeenCalled();
        expect(useTM.setCurrentPreviewMilestoneId).not.toHaveBeenCalled();
        expect(useTM.setIsTaskPreviewVisible).not.toHaveBeenCalled();
    });

    it("follows an answer once: a re-render with the same answer opens nothing again", () => {
        const useTM = tm();
        const { rerender } = renderHook(
            ({ answer }) => useFollowConvertedMilestone(answer, useTM as never),
            { initialProps: { answer: task as ConvertedTaskRef | undefined } }
        );
        useTM.setCurrentPreviewTaskId.mockClear();
        useTM.loadTask.mockClear();

        rerender({ answer: task });
        rerender({ answer: task });

        expect(useTM.setCurrentPreviewTaskId).not.toHaveBeenCalled();
        expect(useTM.loadTask).not.toHaveBeenCalled();
    });

    it("follows a new answer (another milestone's link)", () => {
        const useTM = tm();
        const { rerender } = renderHook(
            ({ answer }) => useFollowConvertedMilestone(answer, useTM as never),
            { initialProps: { answer: task as ConvertedTaskRef | undefined } }
        );

        rerender({ answer: { ...task, taskId: 11 } });

        expect(useTM.setCurrentPreviewTaskId).toHaveBeenLastCalledWith(11);
    });
});
