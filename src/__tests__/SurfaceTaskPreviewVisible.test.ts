import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useSurfaceTaskPreviewVisible } from "../hooks/tasks/useSurfaceTaskPreviewVisible";
import { TaskManagementState } from "../hooks/tasks/useTaskManagement";

// The task preview used to leak across pages: `isTaskPreviewVisible` is
// one global flag, and the Homes are keep-alive, so the chat Home's
// effect adopted an "opened" transition that happened while the user was
// on the TASK page. Arriving at chat then found the panel already open.
//
// The rule under test: only the page the user is actually looking at
// (`isActiveRoute`) may adopt an open; a close always propagates.

const useTMWith = (
    visible: boolean,
    taskId: number,
    // A milestone preview carries its id here and leaves `taskId` at -1.
    milestone: { kind: "task" | "milestone"; id: number } = { kind: "task", id: -1 }
): TaskManagementState =>
    ({
        currentPreviewKind: milestone.kind,
        currentPreviewMilestoneId: milestone.id,
        currentPreviewTaskId: taskId,
        isTaskPreviewVisible: visible,
    }) as unknown as TaskManagementState;

describe("useSurfaceTaskPreviewVisible", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("does NOT open when the preview is opened while this surface is backgrounded", () => {
        const { result, rerender } = renderHook(
            ({ visible, active }: { visible: boolean; active: boolean }) =>
                useSurfaceTaskPreviewVisible("chat", active, useTMWith(visible, 1)),
            { initialProps: { active: false, visible: false } }
        );

        // User opens a preview on the task page: global flag flips true
        // while the chat surface is hidden.
        rerender({ active: false, visible: true });
        expect(result.current[0]).toBe(false);

        // Now they switch to chat. The panel must still be closed — this
        // is the reported bug.
        rerender({ active: true, visible: true });
        expect(result.current[0]).toBe(false);
    });

    it("opens when the preview is opened while this surface is in the foreground", () => {
        const { result, rerender } = renderHook(
            ({ visible, active }: { visible: boolean; active: boolean }) =>
                useSurfaceTaskPreviewVisible("chat", active, useTMWith(visible, 1)),
            { initialProps: { active: true, visible: false } }
        );

        rerender({ active: true, visible: true });
        expect(result.current[0]).toBe(true);
    });

    it("closes on this surface when the preview is closed globally", () => {
        const { result, rerender } = renderHook(
            ({ visible, active }: { visible: boolean; active: boolean }) =>
                useSurfaceTaskPreviewVisible("chat", active, useTMWith(visible, 1)),
            { initialProps: { active: true, visible: false } }
        );

        rerender({ active: true, visible: true });
        expect(result.current[0]).toBe(true);

        rerender({ active: true, visible: false });
        expect(result.current[0]).toBe(false);
    });

    it("adopts a task SWITCH made while in the foreground", () => {
        const { result, rerender } = renderHook(
            ({ taskId, active }: { taskId: number; active: boolean }) =>
                useSurfaceTaskPreviewVisible("chat", active, useTMWith(true, taskId)),
            { initialProps: { active: true, taskId: 1 } }
        );

        // Seed: visible globally on mount but never adopted here.
        expect(result.current[0]).toBe(false);

        rerender({ active: true, taskId: 2 });
        expect(result.current[0]).toBe(true);
    });

    it("does NOT adopt a DESELECTION as an open", () => {
        // THE REPORTED BUG. Open a task on the task page (global flag true,
        // a real id), switch to chat, then open a thread on a message with
        // no task: `MessageBubble.replayHandler` runs
        // `setCurrentPreviewTaskId(-1)`. That id change read as a "switch"
        // and turned this surface visible — for an empty selection, so
        // `TaskPreview` rendered null and the chat page painted an empty,
        // unclosable right-hand column.
        const { result, rerender } = renderHook(
            ({ taskId }: { taskId: number }) =>
                useSurfaceTaskPreviewVisible("chat", true, useTMWith(true, taskId)),
            { initialProps: { taskId: 5 } }
        );

        expect(result.current[0]).toBe(false);

        rerender({ taskId: -1 });
        expect(result.current[0]).toBe(false);
    });

    it("still adopts a switch to a MILESTONE, which clears the task id", () => {
        // The guard above must not swallow milestone previews: they set
        // `currentPreviewTaskId` to -1 on purpose and carry the real
        // selection in `currentPreviewMilestoneId`.
        const { result, rerender } = renderHook(
            ({
                taskId,
                milestone,
            }: {
                taskId: number;
                milestone: { kind: "task" | "milestone"; id: number };
            }) => useSurfaceTaskPreviewVisible("chat", true, useTMWith(true, taskId, milestone)),
            { initialProps: { milestone: { id: -1, kind: "task" as const }, taskId: 5 } }
        );

        expect(result.current[0]).toBe(false);

        rerender({ milestone: { id: 9, kind: "milestone" }, taskId: -1 });
        expect(result.current[0]).toBe(true);
    });

    it("persists per surface so a reload restores the same layout", () => {
        const { result, rerender } = renderHook(
            ({ visible }: { visible: boolean }) =>
                useSurfaceTaskPreviewVisible("chat", true, useTMWith(visible, 1)),
            { initialProps: { visible: false } }
        );
        rerender({ visible: true });
        expect(localStorage.getItem("taskPreviewVisible:chat")).toBe("true");

        // A fresh mount (the reload) picks the stored value back up.
        const second = renderHook(() =>
            useSurfaceTaskPreviewVisible("chat", true, useTMWith(true, 1))
        );
        expect(second.result.current[0]).toBe(true);
    });

    it("keeps surfaces independent of one another", () => {
        renderHook(() => useSurfaceTaskPreviewVisible("chat", true, useTMWith(true, 1)));
        const notes = renderHook(() =>
            useSurfaceTaskPreviewVisible("notes", true, useTMWith(true, 1))
        );
        expect(notes.result.current[0]).toBe(false);
    });

    it("can be opened imperatively, for the cross-page open-task intent", () => {
        const { result } = renderHook(() =>
            useSurfaceTaskPreviewVisible("chat", true, useTMWith(true, 1))
        );
        expect(result.current[0]).toBe(false);
        act(() => result.current[1](true));
        expect(result.current[0]).toBe(true);
    });
});
