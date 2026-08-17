/**
 * Milestone-preview title draft vs. edits made elsewhere.
 *
 * The bug: renaming a milestone inline in the task table persists through
 * `useSM.updateExistingMilestone`, which upserts `projectMilestones` — the
 * source `MilestonePreviewInner`'s `milestone` memo reads — but the header's
 * title draft was seeded only on milestone identity change, so an open preview
 * kept showing the old title until it was re-opened. Every other table-editable
 * field already propagated (they re-derive through the `tsUpdatedAt`-keyed
 * `taskContentLike` sync), which is why this looked milestone-title-specific.
 *
 * The fix can't be "re-seed whenever the milestone refreshes": the draft backs
 * a live text input, and the preview refreshes for unrelated reasons (the
 * initial loads resolving after mount, the body autosave's deferred
 * `tsUpdatedAt` bump). So adoption is suspended while a local edit is unsaved —
 * these tests pin both halves, since regressing either one silently either
 * stops syncing or eats keystrokes.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAdoptableTitleDraft } from "../features/tasks/components/contents/utils/useAdoptableTitleDraft";

const setup = (entityId: number | null, title: string | null | undefined) =>
    renderHook(
        ({ id, t }: { id: number | null; t: string | null | undefined }) =>
            useAdoptableTitleDraft(id, t),
        { initialProps: { id: entityId, t: title } }
    );

describe("useAdoptableTitleDraft", () => {
    it("seeds from the entity's title", () => {
        const { result } = setup(1, "Beta launch");
        expect(result.current.titleDraft).toBe("Beta launch");
    });

    it("adopts a rename that happened elsewhere", () => {
        // The reported bug: the table renamed it while the preview was open.
        const { result, rerender } = setup(1, "Beta launch");
        rerender({ id: 1, t: "Beta launch v2" });
        expect(result.current.titleDraft).toBe("Beta launch v2");
    });

    it("does not adopt over an unsaved local edit", () => {
        const { result, rerender } = setup(1, "Beta launch");
        act(() => result.current.setTitleDraft("My in-progress ti"));
        // A rename lands mid-typing. Must NOT overwrite the input, or the
        // user's keystrokes vanish as they type.
        rerender({ id: 1, t: "Renamed by someone else" });
        expect(result.current.titleDraft).toBe("My in-progress ti");
    });

    it("resumes adopting once the edit is saved", () => {
        const { result, rerender } = setup(1, "Beta launch");
        act(() => result.current.setTitleDraft("Mine"));
        act(() => result.current.markTitleSaved());
        rerender({ id: 1, t: "Renamed elsewhere" });
        expect(result.current.titleDraft).toBe("Renamed elsewhere");
    });

    it("keeps an unsaved edit when the save FAILED", () => {
        // `saveTitle` marks saved only when the update returns a milestone;
        // clearing on failure would discard text that was never persisted.
        const { result, rerender } = setup(1, "Beta launch");
        act(() => result.current.setTitleDraft("Unpersisted"));
        // No `markTitleSaved()` — the PATCH came back empty. A later refresh
        // still carrying the server's older title must leave the input alone.
        rerender({ id: 1, t: "Beta launch (server copy)" });
        expect(result.current.titleDraft).toBe("Unpersisted");
    });

    it("takes the new title on a milestone switch, dirty draft or not", () => {
        const { result, rerender } = setup(1, "Beta launch");
        act(() => result.current.setTitleDraft("half-typed"));
        rerender({ id: 2, t: "Gamma launch" });
        expect(result.current.titleDraft).toBe("Gamma launch");
    });

    it("adopts again after a switch, without needing a save first", () => {
        // The dirty flag belonged to the PREVIOUS milestone; if the switch
        // didn't clear it, the new milestone would never sync.
        const { result, rerender } = setup(1, "Beta launch");
        act(() => result.current.setTitleDraft("half-typed"));
        rerender({ id: 2, t: "Gamma launch" });
        rerender({ id: 2, t: "Gamma launch v2" });
        expect(result.current.titleDraft).toBe("Gamma launch v2");
    });

    it("holds the current draft while the entity is unresolved", () => {
        // `milestone` is undefined until the lookup memo finds it (project
        // milestones still loading); that must not blank the input.
        const { result, rerender } = setup(1, "Beta launch");
        rerender({ id: 1, t: undefined });
        expect(result.current.titleDraft).toBe("Beta launch");
        rerender({ id: 2, t: null });
        expect(result.current.titleDraft).toBe("Beta launch");
    });

    it("starts empty when there is no entity yet", () => {
        const { result } = setup(null, undefined);
        expect(result.current.titleDraft).toBe("");
    });

    it("keeps setters stable so callers can depend on them", () => {
        const { result, rerender } = setup(1, "Beta launch");
        const first = result.current;
        rerender({ id: 1, t: "Beta launch v2" });
        expect(result.current.setTitleDraft).toBe(first.setTitleDraft);
        expect(result.current.markTitleSaved).toBe(first.markTitleSaved);
    });
});
