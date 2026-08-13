/**
 * The reported bug: close every note tab on the task page and the
 * right-hand note panel stays — as an empty half-page column with no way
 * to close it. The close button lives inside the note header, which is
 * rendered by the note component, which renders nothing when there is no
 * note. So the pane that survives is exactly the pane you cannot dismiss.
 *
 * The chat page's note pane has the same shape (`ChatNoteMain` returns
 * null on a null note while `ChatNotePanel` still paints its bordered
 * column), so both pages now derive visibility through this predicate
 * instead of reading the "user asked for the notes pane" flag directly.
 * The notes page needs none of this — it swaps in a default view.
 */

import { describe, expect, it } from "vitest";

import { isNotePaneVisible } from "../features/notes/common/utils/notePaneVisibility";

describe("isNotePaneVisible", () => {
    it("hides the pane when every note tab has been closed", () => {
        // THE REPORTED BUG. The intent flag stays true — nothing clears it
        // on close — so this is the only thing standing between the user
        // and an unclosable empty panel.
        expect(isNotePaneVisible({ isVisible: true, hasOpenNote: false })).toBe(false);
    });

    it("shows the pane when a note is open", () => {
        expect(isNotePaneVisible({ isVisible: true, hasOpenNote: true })).toBe(true);
    });

    it("stays hidden when the pane was closed but tabs are still open", () => {
        // Closing the pane from the note header leaves the tabs open (the
        // task page keeps its strip), so the open note must not drag the
        // pane back up.
        expect(isNotePaneVisible({ isVisible: false, hasOpenNote: true })).toBe(false);
    });

    it("keeps the pane up while an open is still in flight", () => {
        // The chat page opens its note asynchronously (`openOrCreate`).
        // Without this the pane would flicker out between the click and
        // the note landing.
        expect(isNotePaneVisible({ isVisible: true, hasOpenNote: false, isOpening: true })).toBe(
            true
        );
    });

    it("does not resurrect a closed pane just because a load is running", () => {
        expect(isNotePaneVisible({ isVisible: false, hasOpenNote: false, isOpening: true })).toBe(
            false
        );
    });

    it("treats a missing isOpening as not-opening", () => {
        // The task page passes no loading signal at all; it must not
        // default to "open in progress" and pin the pane visible.
        expect(isNotePaneVisible({ isVisible: true, hasOpenNote: false })).toBe(false);
    });
});
