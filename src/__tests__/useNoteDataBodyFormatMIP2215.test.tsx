// MIP-2215: a note cached before the API said `bodyFormat` cannot tell a page from an ordinary note, so
// it is fetched once (the fetched copy carries the format). When that fetch cannot be made or fails
// the cached row is used as before, and a row that already knows its format is never refetched.
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearNoteCache, useNoteData } from "../hooks/notes/useNoteData";
import type { NoteTab } from "../hooks/notes/useNoteTabs";
import type { UserProps } from "../types/admin";

const idb = vi.hoisted(() => ({ row: undefined as Record<string, unknown> | undefined }));
const loadSpecific = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock("../db/services/note.service", () => ({
    NoteService: class {
        getPersonalNote = async () => idb.row;
        getTaskNote = async () => idb.row;
        getChatNote = async () => idb.row;
    },
}));
vi.mock("../features/notes/common/services/loadSpecificNote", () => ({
    loadSpecificNote: (...args: unknown[]) => loadSpecific.fn(...args),
}));
vi.mock("../features/notes/common/services/addNote", () => ({ addNote: vi.fn() }));

const myself = { userId: "u1", teamId: "t1" } as UserProps;
const tabs = {
    my: { id: "my-5", kind: "my", noteId: 5 },
    task: { id: "task-5", kind: "task", noteId: 5 },
    chat: { id: "chat-5", kind: "chat", noteId: 5 },
} as unknown as Record<string, NoteTab>;
const typeOf = { my: 1, task: 2, chat: 3 } as const;

const hook = (kind: keyof typeof tabs, accessToken: string | null = "tok") =>
    renderHook(() => useNoteData(tabs[kind], { myself, accessToken }));

beforeEach(() => {
    clearNoteCache();
    idb.row = undefined;
    loadSpecific.fn.mockReset();
});
afterEach(() => clearNoteCache());

describe.each(["my", "task", "chat"] as const)("%s note", (kind) => {
    const noteType = typeOf[kind];

    it("fetches a cached row that has no bodyFormat, and the fetched copy wins", async () => {
        idb.row = { noteId: 5, title: "old", body: [] };
        loadSpecific.fn.mockResolvedValue({
            noteId: 5,
            noteType,
            title: "page",
            body: [],
            bodyFormat: "html",
        });
        const { result } = hook(kind);
        await waitFor(() => expect(result.current.note?.bodyFormat).toBe("html"));
        expect(loadSpecific.fn).toHaveBeenCalledTimes(1);
    });

    it("never refetches a cached row that already knows its format", async () => {
        idb.row = { noteId: 5, title: "plain", body: [], bodyFormat: "blocknote" };
        const { result } = hook(kind);
        await waitFor(() => expect(result.current.note?.title).toBe("plain"));
        expect(loadSpecific.fn).not.toHaveBeenCalled();
    });

    it("uses the cached row as before when the fetch fails", async () => {
        idb.row = { noteId: 5, title: "old", body: [] };
        loadSpecific.fn.mockResolvedValue(undefined);
        const { result } = hook(kind);
        await waitFor(() => expect(result.current.note?.title).toBe("old"));
        expect(result.current.error).toBeNull();
    });

    it("uses the cached row as before when there is no token to fetch with", async () => {
        idb.row = { noteId: 5, title: "old", body: [] };
        const { result } = hook(kind, null);
        await waitFor(() => expect(result.current.note?.title).toBe("old"));
        expect(loadSpecific.fn).not.toHaveBeenCalled();
    });
});
