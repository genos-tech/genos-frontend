/**
 * The chat-PAGE note panel (`useChatPanelNote`, opened from
 * `ThreadChatPaneHeader`) is the one note surface that does not render through
 * `useNoteData`. It holds the open note in plain `useState`, seeded once by
 * `openOrCreate` from a backend read.
 *
 * That made it exempt from the fix applied to the task-note path, in two ways:
 *   1. Nothing subscribed it to the shared note cache, so a rename saved on
 *      notes-home never reached it — its title input kept the old title until
 *      remount, and its next body autosave PUT that old title back over the
 *      rename. Same bug, different surface.
 *   2. `openOrCreate` never published the note to the shared cache at all, so
 *      the save path's freshest-title lookup (`getCachedNote` in
 *      `useNoteEditorCore.updateNote`) MISSED for this panel and silently
 *      degraded to the panel's own unreconciled snapshot.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadChatNotesByChatId } from "../features/notes/chat-notes/services/loadChatNotesByChatId";
import { useChatPanelNote } from "../hooks/notes/useChatPanelNote";
import {
    clearNoteCache,
    getCachedNote,
    upsertNoteCache,
    type ResolvedNote,
} from "../hooks/notes/useNoteData";
import { ChatNoteProps } from "../types/notes";

vi.mock("../features/notes/chat-notes/services/loadChatNotesByChatId", () => ({
    loadChatNotesByChatId: vi.fn(),
}));
vi.mock("../features/notes/chat-notes/services/loadChatNoteMeta", () => ({
    loadChatNoteMeta: vi.fn().mockResolvedValue([]),
}));
vi.mock("../features/notes/chat-notes/services/createEmptyChatNote", () => ({
    createEmptyChatNote: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/notes/common/services/addNote", () => ({
    addNote: vi.fn().mockResolvedValue(null),
}));

const mockedLoad = vi.mocked(loadChatNotesByChatId);

const myself = { teamId: "team-1", userId: "u1" } as never;

const chatNote = (title: string, tsUpdated?: string): ChatNoteProps =>
    ({
        noteType: 3,
        noteId: 5,
        chatType: 1,
        chatId: 2,
        isThread: false,
        threadId: 0,
        title,
        body: [],
        ...(tsUpdated ? { tsUpdated } : {}),
    }) as unknown as ChatNoteProps;

const renderPanel = () => renderHook(() => useChatPanelNote({ myself, accessToken: "token" }));

describe("chat-page note panel title convergence", () => {
    beforeEach(() => {
        clearNoteCache();
        mockedLoad.mockReset();
    });

    it("publishes the note it opened to the shared cache", async () => {
        mockedLoad.mockResolvedValue([chatNote("Chat Note Title")] as never);
        const panel = renderPanel();

        await act(async () => {
            await panel.result.current.openOrCreate(1, 2, false, 0);
        });

        expect(panel.result.current.note?.title).toBe("Chat Note Title");
        // Without this the save path's freshest-title lookup misses and falls
        // back to whatever snapshot this panel is holding.
        expect(getCachedNote("chat", 5)?.title).toBe("Chat Note Title");
    });

    it("adopts a rename saved on another surface", async () => {
        mockedLoad.mockResolvedValue([chatNote("New Chat Note (1)")] as never);
        const panel = renderPanel();
        await act(async () => {
            await panel.result.current.openOrCreate(1, 2, false, 0);
        });
        expect(panel.result.current.note?.title).toBe("New Chat Note (1)");

        // The user renames the same note on notes-home; every save publishes
        // to the shared cache.
        act(() => {
            upsertNoteCache(chatNote("Renamed On Notes Home") as unknown as ResolvedNote);
        });

        await waitFor(() =>
            expect(panel.result.current.note?.title).toBe("Renamed On Notes Home")
        );
        // The panel's own tab strip follows too, so nothing on the chat page
        // still displays the pre-rename title.
        expect(panel.result.current.tabs[0]?.title).toBe("Renamed On Notes Home");
    });

    it("keeps a rename that landed while the open request was in flight", async () => {
        let release!: (notes: ChatNoteProps[]) => void;
        mockedLoad.mockReturnValue(
            new Promise<ChatNoteProps[]>((resolve) => {
                release = resolve;
            }) as never
        );

        const panel = renderPanel();
        let opening!: Promise<void>;
        act(() => {
            opening = panel.result.current.openOrCreate(1, 2, false, 0);
        });

        // Rename saved elsewhere before the read comes back.
        act(() => {
            upsertNoteCache(chatNote("Renamed While Opening") as unknown as ResolvedNote);
        });

        await act(async () => {
            release([chatNote("New Chat Note (1)")]);
            await opening;
        });

        // The stale read must not win, in the panel or in the cache.
        expect(panel.result.current.note?.title).toBe("Renamed While Opening");
        expect(getCachedNote("chat", 5)?.title).toBe("Renamed While Opening");
    });

    // The panel unconditionally GETs a fresh row on every open, so it is the
    // one surface that can learn about a rename made in ANOTHER session (there
    // is no socket event for note renames). Publishing that read through the
    // cache must not throw it away: a cache entry can be seeded on boot from
    // an IndexedDB row that outlived the session, and nothing evicts it. If
    // the stale entry won, this panel would display the superseded title and
    // its next body autosave would PUT it back over the other session's
    // rename.
    it("adopts a rename made in another session over a stale cached entry", async () => {
        // Boot state: tab rehydrate seeded the cache from an old IndexedDB row.
        upsertNoteCache(chatNote("Team Sync", "2026-08-13T09:00:00Z") as unknown as ResolvedNote);
        // Meanwhile someone else renamed it; the GET returns the newer row.
        mockedLoad.mockResolvedValue([chatNote("Team Sync Q3", "2026-08-13T10:00:00Z")] as never);

        const panel = renderPanel();
        await act(async () => {
            await panel.result.current.openOrCreate(1, 2, false, 0);
        });

        expect(panel.result.current.note?.title).toBe("Team Sync Q3");
        expect(getCachedNote("chat", 5)?.title).toBe("Team Sync Q3");
    });

    it("stops adopting writes once the note is closed", async () => {
        mockedLoad.mockResolvedValue([chatNote("Chat Note Title")] as never);
        const panel = renderPanel();
        await act(async () => {
            await panel.result.current.openOrCreate(1, 2, false, 0);
        });

        act(() => {
            panel.result.current.closeTab(5);
        });
        expect(panel.result.current.note).toBeNull();

        // A later write for that note must not re-open it in this panel.
        act(() => {
            upsertNoteCache(chatNote("Renamed After Close") as unknown as ResolvedNote);
        });
        expect(panel.result.current.note).toBeNull();
    });
});
