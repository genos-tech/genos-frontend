/**
 * `TaskPreview` renders NOTHING when no task and no milestone is selected
 * (TaskPreview.tsx:1044-1046 — even the loading fallback is gated on
 * `currentPreviewTaskId !== -1`). Its hosts draw the panel frame, so a host
 * that mounts it in that state shows an empty column the user can't close.
 *
 * The reported route in: open a task on the task page, switch to chat, open
 * a thread on a message with no task. That last step deselects
 * (`setCurrentPreviewTaskId(-1)`) while the global visibility flag stays
 * true from step one.
 */

import { describe, expect, it } from "vitest";

import { hasTaskPreviewContent } from "../features/tasks/utils/taskPreviewPaneVisibility";

const selection = (over: Partial<Parameters<typeof hasTaskPreviewContent>[0]> = {}) => ({
    currentPreviewTask: undefined,
    currentPreviewTaskId: -1,
    currentPreviewKind: "task" as const,
    currentPreviewMilestoneId: -1,
    ...over,
});

describe("hasTaskPreviewContent", () => {
    it("is false with nothing selected", () => {
        // THE REPORTED BUG: the state a thread-open leaves behind when the
        // message carries no task.
        expect(hasTaskPreviewContent(selection())).toBe(false);
    });

    it("is true for a selected task id, before its object loads", () => {
        // Keeps the panel mounted across the async load — `TaskPreview`
        // shows its own loading pane, so this is not an empty pane.
        expect(hasTaskPreviewContent(selection({ currentPreviewTaskId: 42 }))).toBe(true);
    });

    it("is true for a loaded task whose id was already cleared", () => {
        // Hosts that drive the preview off the object alone (the modal
        // views) never set an id; they must not be treated as empty.
        expect(hasTaskPreviewContent(selection({ currentPreviewTask: { id: 42 } }))).toBe(true);
    });

    it("stays true through a task switch", () => {
        // The id flips to the new task a beat before `loadTask` swaps the
        // object in. Both arms are set here, but the point is that neither
        // is compared against the other: an id-match test is what used to
        // unmount the panel mid-switch and flash it closed.
        expect(
            hasTaskPreviewContent(
                selection({ currentPreviewTask: { id: 41 }, currentPreviewTaskId: 42 })
            )
        ).toBe(true);
    });

    it("is true for a milestone preview, which leaves the task id at -1", () => {
        // `setCurrentPreviewMilestoneId` deliberately clears the task id,
        // so without its own arm a milestone would look like "nothing
        // selected" and its pane would never mount.
        expect(
            hasTaskPreviewContent(
                selection({ currentPreviewKind: "milestone", currentPreviewMilestoneId: 7 })
            )
        ).toBe(true);
    });

    it("is false for milestone KIND with no milestone selected", () => {
        // `setCurrentPreviewTaskId(-1)` clears the task but leaves `kind`
        // alone, so this pairing is reachable — and it has nothing to show.
        expect(hasTaskPreviewContent(selection({ currentPreviewKind: "milestone" }))).toBe(false);
    });
});
