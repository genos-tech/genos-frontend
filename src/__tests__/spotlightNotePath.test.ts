import { describe, expect, it } from "vitest";

import type { SpotlightResult } from "../features/spotlight/types";
import { spotlightFolderPath, spotlightNotePath } from "../utils/spotlightNotePath";

const note = (overrides: Partial<SpotlightResult>): SpotlightResult =>
    ({
        entity_type: "note",
        note_id: "42",
        note_type: "personal",
        chat_type: null,
        chat_id: null,
        thread_id: null,
        task_id: null,
        project_id: null,
        related_entity_ids: [],
        ...overrides,
    }) as SpotlightResult;

const CHAT = "0f0e4a51-4a43-4e57-9d07-6d1f3b0a8c11";
const THREAD = "6a4d3f7e-3b1e-4c0f-9a52-2f1f0f2c9b10";

describe("spotlightNotePath", () => {
    // A team note opened under /my/ landed in the wrong sidebar space; the
    // agent's note chips (MIP-749) and search hits share this route.
    it.each([
        [undefined, "/workspace/notes/my/42"],
        ["team", "/workspace/notes/team/42"],
        ["shared", "/workspace/notes/shared/42"],
    ] as const)("a personal note in space %s opens at %s", (space, path) => {
        const scopes = new Map<number, "shared" | "team">(space ? [[42, space]] : []);
        expect(spotlightNotePath(note({}), scopes)).toBe(path);
    });

    it("a note on a whole chat opens with thread 0", () => {
        expect(
            spotlightNotePath(
                note({ note_type: "chat", chat_type: "gm", chat_id: CHAT }),
                new Map()
            )
        ).toBe(`/workspace/notes/chat/gm/${CHAT}/thread/0/note/42`);
    });

    it("a thread note opens on its thread", () => {
        expect(
            spotlightNotePath(
                note({ note_type: "chat", chat_type: "dm", chat_id: CHAT, thread_id: THREAD }),
                new Map()
            )
        ).toBe(`/workspace/notes/chat/dm/${CHAT}/thread/${THREAD}/note/42`);
    });

    it("a task note opens under its project and task", () => {
        expect(
            spotlightNotePath(
                note({ note_type: "task", project_id: "3", task_id: "9" }),
                new Map()
            )
        ).toBe("/workspace/notes/task/project/3/task/9/note/42");
    });

    it("falls back to the notes home without coordinates", () => {
        expect(spotlightNotePath(note({ note_type: "chat" }), new Map())).toBe("/workspace/notes");
        expect(spotlightNotePath(note({ note_type: "task" }), new Map())).toBe("/workspace/notes");
    });
});

describe("spotlightFolderPath", () => {
    it("opens a folder result at its folder URL", () => {
        expect(
            spotlightFolderPath(
                note({ entity_type: "note_folder", folder_id: "7", note_id: null })
            )
        ).toBe("/workspace/notes/folder/7");
    });

    it("has no path for a folder result without an id, or for anything else", () => {
        expect(
            spotlightFolderPath(note({ entity_type: "note_folder", folder_id: null }))
        ).toBeNull();
        expect(spotlightFolderPath(note({}))).toBeNull();
    });
});
