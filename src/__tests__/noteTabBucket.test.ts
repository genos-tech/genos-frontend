import { beforeEach, describe, expect, it } from "vitest";

import {
    bucketFromNoteType,
    noteTypeFromBucket,
} from "../features/notes/common/utils/noteTypeAlias";
import { loadPersistedTabs, savePersistedTabs, toRefs } from "../hooks/notes/noteTabsPersistence";
import { noteToTab } from "../hooks/notes/useNoteTabs";

const TEAM = "team-1";

// My / Shared / Team notes are ALL note_type 1. The bucket is the only
// thing that tells them apart once a note is open, so these tests pin
// the two places it can silently be lost: building a tab, and the
// localStorage round-trip on reload.
describe("note tab bucket", () => {
    beforeEach(() => localStorage.clear());

    it("defaults to my so existing call sites are unchanged", () => {
        const tab = noteToTab({ noteType: 1, noteId: 7, title: "n" }, TEAM);
        expect(tab.kind).toBe("my");
        expect(tab.kind === "my" && tab.bucket).toBe("my");
    });

    it("carries the team bucket onto the tab", () => {
        const tab = noteToTab({ noteType: 1, noteId: 7, title: "n" }, TEAM, "team");
        expect(tab.kind === "my" && tab.bucket).toBe("team");
    });

    it("survives the persistence round-trip", () => {
        // The regression that matters: without this, reloading demotes
        // every team tab back to My Notes.
        savePersistedTabs(TEAM, {
            selectedTabIndex: 0,
            tabs: toRefs([
                { noteType: 1, noteId: 1, bucket: "team" },
                { noteType: 1, noteId: 2, bucket: "shared" },
                { noteType: 1, noteId: 3 },
            ]),
        });
        const loaded = loadPersistedTabs(TEAM);
        expect(loaded?.tabs.map((r) => r.bucket)).toEqual(["team", "shared", undefined]);
    });

    it("still loads records written before Team Notes existed", () => {
        localStorage.setItem(
            `noteTabs:${TEAM}`,
            JSON.stringify({ selectedTabIndex: 0, tabs: [{ noteType: 1, noteId: 9 }] })
        );
        const loaded = loadPersistedTabs(TEAM);
        expect(loaded?.tabs).toHaveLength(1);
        expect(loaded?.tabs[0].bucket).toBeUndefined();
    });

    it("rejects a corrupt bucket without dropping valid tabs", () => {
        localStorage.setItem(
            `noteTabs:${TEAM}`,
            JSON.stringify({
                selectedTabIndex: 0,
                tabs: [
                    { noteType: 1, noteId: 1, bucket: "nonsense" },
                    { noteType: 1, noteId: 2, bucket: "team" },
                ],
            })
        );
        expect(loadPersistedTabs(TEAM)?.tabs.map((r) => r.noteId)).toEqual([2]);
    });

    it("round-trips bucket <-> sidebar noteType", () => {
        for (const [noteType, bucket] of [
            [1, "my"],
            [4, "shared"],
            [8, "team"],
        ] as const) {
            expect(bucketFromNoteType(noteType)).toBe(bucket);
            expect(noteTypeFromBucket(bucket)).toBe(noteType);
        }
    });
});
