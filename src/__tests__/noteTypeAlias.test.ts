import { describe, expect, it } from "vitest";

import {
    isPersonalNoteBucket,
    personalNoteScopes,
    resolvePersonalBucket,
    toBackendNoteType,
} from "../features/notes/common/utils/noteTypeAlias";

// The sidebar's `noteType` is overloaded: 4 (Shared) and 8 (Team) are
// UI-only buckets over personal notes, and the backend only knows 1/2/3.
// Before this helper the 4->1 mapping was open-coded per call site, so
// adding bucket 8 sent an unknown type to the backend from every site
// that wasn't updated — a 404 or an empty response, never a type error.
// These tests exist so a THIRD alias can't reintroduce that.
describe("toBackendNoteType", () => {
    it("maps every personal-backed bucket to note_type 1", () => {
        expect(toBackendNoteType(1)).toBe(1); // My Notes
        expect(toBackendNoteType(4)).toBe(1); // Shared Notes
        expect(toBackendNoteType(8)).toBe(1); // Team Notes
    });

    it("passes real task and chat types through", () => {
        expect(toBackendNoteType(2)).toBe(2);
        expect(toBackendNoteType(3)).toBe(3);
    });

    it("never emits a code the backend doesn't know", () => {
        // 0 and 5-7 are pseudo buckets (Home / Favorites / Recents /
        // Unread) with no backend note behind them.
        for (const pseudo of [0, 5, 6, 7, 99]) {
            expect([1, 2, 3]).toContain(toBackendNoteType(pseudo));
        }
    });
});

describe("isPersonalNoteBucket", () => {
    it("is true for My, Shared and Team", () => {
        expect(isPersonalNoteBucket(1)).toBe(true);
        expect(isPersonalNoteBucket(4)).toBe(true);
        expect(isPersonalNoteBucket(8)).toBe(true);
    });

    it("is false for task and chat notes", () => {
        expect(isPersonalNoteBucket(2)).toBe(false);
        expect(isPersonalNoteBucket(3)).toBe(false);
    });
});

describe("resolvePersonalBucket (MIP-830)", () => {
    const scopes = personalNoteScopes([{ noteId: 7 }], [{ noteId: 9 }]);
    const myTab = { kind: "my", noteId: 1, bucket: "my" as const };

    it("takes the space from the meta lists, whatever tab is active", () => {
        // The modal case: a team note open over a page whose active tab is a My note.
        expect(
            resolvePersonalBucket({ noteId: 7, scopes, activeTab: myTab, currentNoteType: 1 })
        ).toBe("team");
        expect(
            resolvePersonalBucket({ noteId: 9, scopes, activeTab: myTab, currentNoteType: 1 })
        ).toBe("shared");
    });

    it("uses the host's note type when the lists don't know the note and the tab isn't its own", () => {
        expect(
            resolvePersonalBucket({
                noteId: 55,
                scopes,
                activeTab: myTab,
                currentNoteType: 8,
            })
        ).toBe("team");
        expect(
            resolvePersonalBucket({ noteId: 55, scopes, activeTab: null, currentNoteType: 4 })
        ).toBe("shared");
    });

    it("uses the active tab's bucket when it is this note's own tab", () => {
        expect(
            resolvePersonalBucket({
                noteId: 1,
                scopes,
                activeTab: { kind: "my", noteId: 1, bucket: "team" },
                currentNoteType: 1,
            })
        ).toBe("team");
        expect(
            resolvePersonalBucket({ noteId: 1, scopes, activeTab: myTab, currentNoteType: 8 })
        ).toBe("my");
    });

    it("leaves a plain My note as My", () => {
        expect(
            resolvePersonalBucket({ noteId: 1, scopes, activeTab: null, currentNoteType: 1 })
        ).toBe("my");
    });

    it("a task or chat tab doesn't decide the bucket", () => {
        expect(
            resolvePersonalBucket({
                noteId: 55,
                scopes,
                activeTab: { kind: "task" },
                currentNoteType: 8,
            })
        ).toBe("team");
    });
});
