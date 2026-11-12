/**
 * "Where does this note live?" (MIP-1429): the second line of a Recents or Favorites row.
 *
 * One rule for every kind of note. Before, a task note showed the INTERNAL task number
 * ("#12953"), a chat note its type ("GM"), a personal note nothing, so two notes with the same
 * title in different folders looked the same.
 */
import { describe, expect, it } from "vitest";

import {
    buildLocationSources,
    noteLocation,
    type LocationLabels,
} from "../features/notes/common/utils/noteLocation";
import { isNoteOpen } from "../features/notes/common/utils/openNote";

const labels: LocationLabels = {
    myNotes: "My Notes",
    teamNotes: "Team Notes",
    sharedNotes: "Shared Notes",
    sharedBy: (name) => `Shared by ${name}`,
    chatType: (type) => (type === 2 ? "Group" : "Chat"),
};

const lists = (extra: Partial<Parameters<typeof buildLocationSources>[0]> = {}) =>
    buildLocationSources({
        myNoteMeta: [],
        myNoteFolders: [],
        teamNoteMeta: [],
        teamNoteFolders: [],
        sharedNoteMeta: [],
        taskNoteMeta: [],
        chatNoteMeta: [],
        ...extra,
    });

const folder = (folderId: number, name: string, parentFolderId: number | null = null) => ({
    folderId,
    parentFolderId,
    name,
});
const note = (
    noteId: number,
    folderId: number | null = null,
    parentNoteId: number | null = null
) => ({
    noteId,
    parentNoteId,
    folderId,
});

describe("a personal note", () => {
    const sources = lists({
        myNoteFolders: [
            folder(1, "Product"),
            folder(2, "Roadmap", 1),
            folder(3, "Q4", 2),
            folder(4, "Draft", 3),
        ],
        myNoteMeta: [note(10, 1), note(11, null), note(12, 3), note(13, 4), note(14, null, 10)],
    });
    const where = (id: number, includeSpace = true) =>
        noteLocation(1, { noteId: id }, sources, labels, { includeSpace });

    it("names its space and its folder", () => {
        expect(where(10)).toBe("My Notes › Product");
    });

    it("names only the space when it is not filed in a folder", () => {
        expect(where(11)).toBe("My Notes");
    });

    it("keeps the innermost folders of a long path", () => {
        // Product › Roadmap › Q4 › Draft would be cut at the end by the row, losing the part
        // that tells notes apart.
        expect(where(13)).toBe("My Notes › … › Q4 › Draft");
        expect(where(12)).toBe("My Notes › … › Roadmap › Q4");
    });

    it("a child note follows its root note's folder", () => {
        expect(where(14)).toBe("My Notes › Product");
    });

    it("can leave out the space's own name for a list already grouped under it", () => {
        expect(where(10, false)).toBe("Product");
        expect(where(11, false)).toBeNull();
    });

    it("gives no line rather than a wrong one for a note it does not know", () => {
        expect(where(999)).toBe("My Notes");
    });

    it("survives a loop in the folder or note links", () => {
        const loop = lists({
            myNoteFolders: [folder(1, "A", 2), folder(2, "B", 1)],
            myNoteMeta: [note(5, 1), note(6, null, 7), note(7, null, 6)],
        });
        expect(noteLocation(1, { noteId: 5 }, loop, labels)).toBe("My Notes › B › A");
        expect(noteLocation(1, { noteId: 6 }, loop, labels)).toBe("My Notes");
    });
});

describe("a team note", () => {
    const sources = lists({
        teamNoteFolders: [folder(7, "Design")],
        teamNoteMeta: [note(20, 7), note(21, null)],
    });

    it("names Team Notes and its folder", () => {
        expect(noteLocation(8, { noteId: 20 }, sources, labels)).toBe("Team Notes › Design");
        expect(noteLocation(8, { noteId: 21 }, sources, labels)).toBe("Team Notes");
    });

    it("does not read a personal folder with the same id", () => {
        const both = lists({
            myNoteFolders: [folder(7, "Mine")],
            teamNoteFolders: [folder(7, "Design")],
            myNoteMeta: [note(30, 7)],
            teamNoteMeta: [note(31, 7)],
        });
        expect(noteLocation(1, { noteId: 30 }, both, labels)).toBe("My Notes › Mine");
        expect(noteLocation(8, { noteId: 31 }, both, labels)).toBe("Team Notes › Design");
    });
});

describe("a shared note", () => {
    const sources = lists({
        sharedNoteMeta: [{ noteId: 40, ownerName: "Carol Park" }, { noteId: 41 }],
    });

    it("says who shared it", () => {
        expect(noteLocation(4, { noteId: 40 }, sources, labels)).toBe("Shared by Carol Park");
    });

    it("falls back to the space when the owner is not known", () => {
        expect(noteLocation(4, { noteId: 41 }, sources, labels)).toBe("Shared Notes");
        expect(
            noteLocation(4, { noteId: 41 }, sources, labels, { includeSpace: false })
        ).toBeNull();
    });
});

describe("a task note", () => {
    const sources = lists({
        taskNoteMeta: [
            {
                noteId: 50,
                displayId: "QR-2",
                taskTitle: "Synthesize 12 customer interviews",
                projectName: "Q4 Roadmap",
            },
            { noteId: 51, displayId: null, taskTitle: "No code yet", projectName: "Scratch" },
        ],
    });

    it("gives the task's DISPLAY id and title", () => {
        expect(noteLocation(2, { noteId: 50 }, sources, labels)).toBe(
            "QR-2 · Synthesize 12 customer interviews"
        );
    });

    it("never shows the internal task number", () => {
        // The recents payload has `taskId` (12953) but no `displayId`; the old line was
        // "Q4 Roadmap #12953".
        const line = noteLocation(
            2,
            {
                noteId: 50,
                taskTitle: "Synthesize 12 customer interviews",
                projectName: "Q4 Roadmap",
            },
            lists(),
            labels
        );
        expect(line).not.toMatch(/#\d/);
        expect(line).toBe("Q4 Roadmap · Synthesize 12 customer interviews");
    });

    it("uses the project when the task has no display id", () => {
        expect(noteLocation(2, { noteId: 51 }, sources, labels)).toBe("Scratch · No code yet");
    });

    it("prefers the loaded list over what the row carries", () => {
        expect(
            noteLocation(2, { noteId: 50, displayId: "OLD-1", taskTitle: "Old" }, sources, labels)
        ).toBe("QR-2 · Synthesize 12 customer interviews");
    });

    it("gives no line when it knows nothing", () => {
        expect(noteLocation(2, { noteId: 99 }, lists(), labels)).toBeNull();
    });
});

describe("a chat note", () => {
    const sources = lists({
        chatNoteMeta: [
            { noteId: 60, chatName: "general · Product & Design", chatType: 2 },
            { noteId: 61, chatTypeName: "Group", chatType: 2 },
        ],
    });

    it("names the chat, not its type", () => {
        // The old line was "GM".
        expect(noteLocation(3, { noteId: 60 }, sources, labels)).toBe(
            "general · Product & Design"
        );
    });

    it("falls back to the kind of chat when it has no name", () => {
        expect(noteLocation(3, { noteId: 61 }, sources, labels)).toBe("Group");
        expect(noteLocation(3, { noteId: 99, chatType: 1 }, lists(), labels)).toBe("Chat");
    });
});

describe("a bucket it does not know", () => {
    it("has no line", () => {
        expect(noteLocation(5, { noteId: 1 }, lists(), labels)).toBeNull();
    });
});

describe("isNoteOpen", () => {
    const my = { kind: "my" as const, noteId: 5, bucket: "my" as const };

    it("is true only for the open note, in the bucket it was opened from", () => {
        expect(isNoteOpen(my, 1, 5)).toBe(true);
        expect(isNoteOpen(my, 1, 6)).toBe(false);
        // the same note listed under another bucket does not light up there
        expect(isNoteOpen(my, 8, 5)).toBe(false);
        expect(isNoteOpen(my, 4, 5)).toBe(false);
    });

    it("reads a team or shared tab as its bucket", () => {
        expect(isNoteOpen({ kind: "my", noteId: 5, bucket: "team" }, 8, 5)).toBe(true);
        expect(isNoteOpen({ kind: "my", noteId: 5, bucket: "shared" }, 4, 5)).toBe(true);
        expect(isNoteOpen({ kind: "my", noteId: 5 }, 1, 5)).toBe(true);
    });

    it("reads task and chat tabs", () => {
        expect(isNoteOpen({ kind: "task", noteId: 7 }, 2, 7)).toBe(true);
        expect(isNoteOpen({ kind: "task", noteId: 7 }, 3, 7)).toBe(false);
        expect(isNoteOpen({ kind: "chat", noteId: 7 }, 3, 7)).toBe(true);
    });

    it("is false with no tab open", () => {
        expect(isNoteOpen(null, 1, 5)).toBe(false);
        expect(isNoteOpen(undefined, 1, 5)).toBe(false);
    });
});
