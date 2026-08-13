/**
 * Mount rules for the chat page's task-preview pane.
 *
 * Two failure modes pull in opposite directions, which is the whole reason
 * this is a hook and not one `&&`:
 *
 *  - Mount it with nothing selected and `TaskPreview` renders null inside a
 *    frame the pane draws itself: a blank, unclosable column (the reported
 *    bug).
 *  - Unmount it the moment the selection empties and every DM/GM/MDM
 *    thread→thread switch flashes the pane out for a network round trip —
 *    `MessageBubble.replayHandler` deselects synchronously and only learns
 *    the thread's real task id after an awaited fetch. Worse, `TaskPreview`
 *    flushes the outgoing task's unsaved body from an instance ref
 *    (`prevTaskIdRef`) and has no unmount-time save, so the remount drops
 *    whatever was typed since the last autosave.
 *
 * So: content is required to OPEN, not to stay open.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskPreviewSelection } from "../features/tasks/utils/taskPreviewPaneVisibility";
import { useTaskPreviewPaneVisible } from "../hooks/tasks/useTaskPreviewPaneVisible";

const selection = (over: Partial<TaskPreviewSelection> = {}): TaskPreviewSelection => ({
    currentPreviewTask: undefined,
    currentPreviewTaskId: -1,
    currentPreviewKind: "task",
    currentPreviewMilestoneId: -1,
    ...over,
});

type Props = { requested: boolean; sel: TaskPreviewSelection };

const render = (initialProps: Props) =>
    renderHook(({ requested, sel }: Props) => useTaskPreviewPaneVisible(requested, sel), {
        initialProps,
    });

describe("useTaskPreviewPaneVisible", () => {
    it("stays closed when the pane is wanted but nothing is selected", () => {
        // THE REPORTED BUG, and specifically the shape of it that survives
        // the hook-level fix: `useSurfaceTaskPreviewVisible` PERSISTS its
        // flag, so anyone who already tripped this arrives with
        // `taskPreviewVisible:chat === "true"` in localStorage. The request
        // is true through no fault of the current page; only the empty
        // selection can stop the blank column.
        const { result } = render({ requested: true, sel: selection() });
        expect(result.current).toBe(false);
    });

    it("opens for a selected id, before the task object loads", () => {
        const { result } = render({
            requested: true,
            sel: selection({ currentPreviewTaskId: 42 }),
        });
        expect(result.current).toBe(true);
    });

    it("stays open through the transient deselection of a thread switch", () => {
        // THE REGRESSION GUARD. Pane open on task A, user clicks another
        // thread: `replayHandler` writes `setCurrentPreviewTaskId(-1)`
        // synchronously (the clicked row carries no task — for DM/GM/MDM the
        // task rides on the card reply), which also clears
        // `currentPreviewTask`. The real id lands only after
        // `await loadV3SpecificThreadMessages`. The pane must not blink out
        // across that window: it keeps showing task A, and keeping the same
        // `TaskPreview` instance is what preserves the outgoing body flush.
        const { result, rerender } = render({
            requested: true,
            sel: selection({ currentPreviewTask: { id: 41 }, currentPreviewTaskId: 41 }),
        });
        expect(result.current).toBe(true);

        rerender({ requested: true, sel: selection() });
        expect(result.current).toBe(true);

        // ...and the new task arrives.
        rerender({ requested: true, sel: selection({ currentPreviewTaskId: 42 }) });
        expect(result.current).toBe(true);
    });

    it("does not hold the pane open if a task never loaded into it", () => {
        // Opened on an id that never resolved (project not current, request
        // failed), then deselected. Nothing to preserve and no dirty body to
        // lose, so the pane stands down rather than keeping a blank frame.
        const { result, rerender } = render({
            requested: true,
            sel: selection({ currentPreviewTaskId: 42 }),
        });
        expect(result.current).toBe(true);

        rerender({ requested: true, sel: selection() });
        expect(result.current).toBe(false);
    });

    it("closes when the request drops, even with a task still selected", () => {
        // "Thread Note" does exactly this: `openNoteHandler` lowers
        // `isTaskPreviewVisible` without touching the selection.
        const { result, rerender } = render({
            requested: true,
            sel: selection({ currentPreviewTask: { id: 41 }, currentPreviewTaskId: 41 }),
        });
        expect(result.current).toBe(true);

        rerender({ requested: false, sel: selection({ currentPreviewTask: { id: 41 } }) });
        expect(result.current).toBe(false);
    });

    it("re-arms after a close, so an empty selection cannot reopen it", () => {
        // The latch must not outlive the pane it was protecting.
        const { result, rerender } = render({
            requested: true,
            sel: selection({ currentPreviewTask: { id: 41 }, currentPreviewTaskId: 41 }),
        });
        expect(result.current).toBe(true);

        rerender({ requested: false, sel: selection() });
        expect(result.current).toBe(false);

        rerender({ requested: true, sel: selection() });
        expect(result.current).toBe(false);
    });

    it("opens for a milestone, which leaves the task id at -1", () => {
        const { result } = render({
            requested: true,
            sel: selection({ currentPreviewKind: "milestone", currentPreviewMilestoneId: 7 }),
        });
        expect(result.current).toBe(true);
    });
});
