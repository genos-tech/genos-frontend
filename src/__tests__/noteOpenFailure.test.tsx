// MIP-1276: clicking a note whose body is not cached, while the request FAILS, used to
// do nothing at all: no tab, no message. It now says "Couldn't open this note" with a
// Retry that asks again. A 403 is not a failure (the access-request panel owns it).
//
// MIP-1307: with NO tab open the toast (8 s) is not enough: the failure is kept in
// `noteOpenFailure` for the pane (see noteOpenFailurePane.test.tsx); the toast is for
// the case where another note is still on screen.

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

const renderNm = () =>
    renderHook(() => ({
        nm: useNoteManagement(myself, TOKEN),
        toasts: useToasts(),
    }));

describe("opening a note from the sidebar when the request fails", () => {
    it("with nothing open, keeps the failure for the pane (no toast) and Retry opens the note", async () => {
        vi.mocked(loadSpecificNote).mockResolvedValueOnce(undefined as never);
        const hook = renderNm();
        await settle();

        await act(async () => {
            await hook.result.current.nm.loadNote(1, 7, 0);
        });
        expect(hook.result.current.nm.noteOpenFailure).toMatchObject({
            noteId: 7,
            reason: "failed",
        });
        expect(hook.result.current.toasts).toHaveLength(0);
        expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(0);

        vi.mocked(loadSpecificNote).mockResolvedValueOnce(NOTE as never);
        await act(async () => {
            hook.result.current.nm.retryNoteOpen();
        });
        await waitFor(() => expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(1));
        expect(hook.result.current.nm.noteOpenFailure).toBeNull();
        expect(loadSpecificNote).toHaveBeenCalledTimes(2);
    });

    it("with another note open, says so with a toast and a Retry that opens the note", async () => {
        vi.mocked(loadSpecificNote).mockResolvedValueOnce({ ...NOTE, noteId: 8 } as never);
        const hook = renderNm();
        await settle();
        await act(async () => {
            await hook.result.current.nm.loadNote(1, 8, 0);
        });
        await waitFor(() => expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(1));

        vi.mocked(loadSpecificNote).mockResolvedValueOnce(undefined as never);
        await act(async () => {
            await hook.result.current.nm.loadNote(1, 7, 0);
        });
        const toast = hook.result.current.toasts.find((t) => t.tone === "danger");
        expect(toast?.message).toBe(en.notes.editor.loadFailed);
        expect(toast?.action?.label).toBe(en.common.actions.retry);
        expect(hook.result.current.nm.noteOpenFailure).toBeNull();

        vi.mocked(loadSpecificNote).mockResolvedValueOnce(NOTE as never);
        await act(async () => {
            toast?.action?.onClick();
        });
        await waitFor(() => expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(2));
    });

    it("a 404 with another note open is a toast without Retry", async () => {
        vi.mocked(loadSpecificNote).mockResolvedValueOnce({ ...NOTE, noteId: 8 } as never);
        const hook = renderNm();
        await settle();
        await act(async () => {
            await hook.result.current.nm.loadNote(1, 8, 0);
        });
        await waitFor(() => expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(1));

        vi.mocked(loadSpecificNote).mockResolvedValueOnce({ error: "not_found" } as never);
        await act(async () => {
            await hook.result.current.nm.loadNote(1, 7, 0);
        });
        const toast = hook.result.current.toasts.find((t) => t.tone === "danger");
        expect(toast?.message).toBe(en.notes.placeholder.noteNotFoundTitle);
        expect(toast?.action).toBeUndefined();
    });

    it("a 403 is not a failure: no toast, no kept failure", async () => {
        vi.mocked(loadSpecificNote).mockResolvedValueOnce({ error: "forbidden" } as never);
        const hook = renderNm();
        await settle();
        await act(async () => {
            await hook.result.current.nm.loadNote(1, 7, 0);
        });
        expect(hook.result.current.toasts).toHaveLength(0);
        expect(hook.result.current.nm.noteOpenFailure).toBeNull();
    });

    it("clearNoteOpenFailure resets the kept failure", async () => {
        vi.mocked(loadSpecificNote).mockResolvedValueOnce(undefined as never);
        const hook = renderNm();
        await settle();
        await act(async () => {
            await hook.result.current.nm.loadNote(1, 7, 0);
        });
        expect(hook.result.current.nm.noteOpenFailure).not.toBeNull();
        act(() => hook.result.current.nm.clearNoteOpenFailure());
        expect(hook.result.current.nm.noteOpenFailure).toBeNull();
    });
});
