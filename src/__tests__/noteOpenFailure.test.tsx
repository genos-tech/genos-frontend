// MIP-1276: clicking a note whose body is not cached, while the request FAILS, used to
// do nothing at all: no tab, no message. It now says "Couldn't open this note" with a
// Retry that asks again. A 403 is not a failure (the access-request panel owns it).

import "fake-indexeddb/auto";

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetToasts, useToasts } from "../components/ui/feedback/toastStore";
import { loadSpecificNote } from "../features/notes/common/services/loadSpecificNote";
import { clearNoteCache } from "../hooks/notes/useNoteData";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";

// Every loader useNoteManagement can reach is mocked: a real one goes to axios.
vi.mock("../features/notes/my-notes/services/loadMyNoteFolders", () => ({
    loadMyNoteFolders: vi.fn(async () => []),
}));
vi.mock("../features/notes/team-notes/services/loadTeamNoteFolders", () => ({
    loadTeamNoteFolders: vi.fn(async () => []),
}));
vi.mock("../features/notes/favorite-notes/services", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/favorite-notes/services")>()),
    loadFavoriteNotesMeta: vi.fn(async () => ({
        personalNotes: [],
        taskNotes: [],
        chatNotes: [],
        folders: [],
    })),
}));
vi.mock("../features/notes/my-notes/services/loadMyNoteMeta", () => ({
    loadMyNoteMeta: vi.fn(async () => undefined),
}));
vi.mock("../features/notes/task-notes/services/loadTaskNoteMeta", () => ({
    loadTaskNoteMeta: vi.fn(async () => undefined),
}));
vi.mock("../features/notes/chat-notes/services/loadChatNoteMeta", () => ({
    loadChatNoteMeta: vi.fn(async () => undefined),
}));
vi.mock("../features/notes/team-notes/services/loadTeamNotesMeta", () => ({
    loadTeamNotesMeta: vi.fn(async () => []),
}));
vi.mock("../features/notes/common/services/loadSpecificNote", () => ({
    loadSpecificNote: vi.fn(),
}));
vi.mock("../features/notes/common/services/loadNoteVersions", () => ({
    loadNoteVersions: vi.fn(async () => []),
}));
vi.mock("../features/notes/common/services/addNote", () => ({
    addNote: vi.fn(async () => null),
}));
vi.mock("../features/notes/common/services/applyNoteBodyToYjs", () => ({
    applyNoteBodyToYjs: vi.fn(async () => "applied"),
    noteDocumentName: (type: string, id: number) =>
        `${type === "personal" ? "my" : type}-note:${id}`,
}));

const TOKEN = "test-token";
const myself = { teamId: "team-1", userId: "user-1" } as UserProps;
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const NOTE = {
    noteType: 1,
    noteId: 7,
    parentNoteId: null,
    folderId: null,
    title: "Plan",
    body: [{ type: "paragraph" }],
    tsCreated: "2026-11-03T00:00:00Z",
    tsUpdated: "2026-11-03T00:00:00Z",
};

beforeEach(() => {
    vi.clearAllMocks();
    clearNoteCache();
    localStorage.clear();
    __resetToasts();
});

describe("opening a note from the sidebar when the request fails", () => {
    it("says so with a Retry, and Retry opens the note", async () => {
        vi.mocked(loadSpecificNote).mockResolvedValueOnce(undefined as never);
        const hook = renderHook(() => ({
            nm: useNoteManagement(myself, TOKEN),
            toasts: useToasts(),
        }));
        await settle();

        await act(async () => {
            await hook.result.current.nm.loadNote(1, 7, 0);
        });
        const toast = hook.result.current.toasts.find((t) => t.tone === "danger");
        expect(toast?.message).toBe(en.notes.editor.loadFailed);
        expect(toast?.action?.label).toBe(en.common.actions.retry);
        expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(0);

        vi.mocked(loadSpecificNote).mockResolvedValueOnce(NOTE as never);
        await act(async () => {
            toast?.action?.onClick();
        });
        await waitFor(() => expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(1));
        expect(loadSpecificNote).toHaveBeenCalledTimes(2);
    });

    it("a 403 is not a failure: no toast", async () => {
        vi.mocked(loadSpecificNote).mockResolvedValueOnce({ error: "forbidden" } as never);
        const hook = renderHook(() => ({
            nm: useNoteManagement(myself, TOKEN),
            toasts: useToasts(),
        }));
        await settle();
        await act(async () => {
            await hook.result.current.nm.loadNote(1, 7, 0);
        });
        expect(hook.result.current.toasts).toHaveLength(0);
    });
});
