/**
 * MIP-1435: a deleted note is gone from EVERYWHERE the client holds it, without a reload.
 *
 * Before, only the agent path (`noteChanged`) cleaned up fully. The sidebar menu and the note
 * header cleaned the My list (the header: only that list, so a Team or Shared note stayed in the
 * tree), the tab and IndexedDB, and left the note in Recents, Favorites, the in-memory note cache,
 * the history and the unread list; the folder deletes left the same. These tests run the real
 * `useNoteManagement` with the server calls mocked.
 */
import "fake-indexeddb/auto";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteService } from "../db/services/note.service";
import { DatabaseUtils } from "../db/utils/database";
import { deleteChatNote } from "../features/notes/chat-notes/services/deleteChatNote";
import { loadChatNoteMeta } from "../features/notes/chat-notes/services/loadChatNoteMeta";
import { useNoteMentionUnread } from "../features/notes/common/hooks/useNoteMentionUnread";
import { addNote } from "../features/notes/common/services/addNote";
import { applyNoteBodyToYjs } from "../features/notes/common/services/applyNoteBodyToYjs";
import { loadNoteVersions } from "../features/notes/common/services/loadNoteVersions";
import { loadSpecificNote } from "../features/notes/common/services/loadSpecificNote";
import { emitNoteDeleted } from "../features/notes/common/utils/noteDeleted";
import { loadFavoriteNotesMeta } from "../features/notes/favorite-notes/services";
import { deleteMyNote } from "../features/notes/my-notes/services/deleteMyNote";
import { deleteMyNoteFolder } from "../features/notes/my-notes/services/deleteMyNoteFolder";
import { loadMyNoteFolders } from "../features/notes/my-notes/services/loadMyNoteFolders";
import { loadMyNoteMeta } from "../features/notes/my-notes/services/loadMyNoteMeta";
import { deleteTaskNote } from "../features/notes/task-notes/services/deleteTaskNote";
import { loadTaskNoteMeta } from "../features/notes/task-notes/services/loadTaskNoteMeta";
import { deleteTeamNoteFolder } from "../features/notes/team-notes/services/deleteTeamNoteFolder";
import { loadTeamNoteFolders } from "../features/notes/team-notes/services/loadTeamNoteFolders";
import { loadTeamNotesMeta } from "../features/notes/team-notes/services/loadTeamNotesMeta";
import { HistoryProvider, useHistory } from "../hooks/common/useHistory";
import { useHistoryTracker } from "../hooks/common/useHistoryTracker";
import { clearNoteCache, getCachedNote, upsertNoteCache } from "../hooks/notes/useNoteData";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import { noteToTab } from "../hooks/notes/useNoteTabs";
import { askAgentStream } from "../services/agentApi";
import type { UserProps } from "../types/admin";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(),
    decideAgent: vi.fn(),
    fetchAgentSessionDetail: vi.fn(async () => null),
    fetchAgentSessions: vi.fn(async () => []),
    fetchAgentUsage: vi.fn(async () => null),
    submitAgentFeedback: vi.fn(async () => true),
}));
vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));
vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

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
    loadSpecificNote: vi.fn(async () => ({ error: "not-found" })),
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

vi.mock("../features/notes/my-notes/services/deleteMyNote", () => ({
    deleteMyNote: vi.fn(async () => true),
}));
vi.mock("../features/notes/task-notes/services/deleteTaskNote", () => ({
    deleteTaskNote: vi.fn(async () => true),
}));
vi.mock("../features/notes/chat-notes/services/deleteChatNote", () => ({
    deleteChatNote: vi.fn(async () => true),
}));
vi.mock("../features/notes/my-notes/services/deleteMyNoteFolder", () => ({
    deleteMyNoteFolder: vi.fn(async () => null),
}));
vi.mock("../features/notes/team-notes/services/deleteTeamNoteFolder", () => ({
    deleteTeamNoteFolder: vi.fn(async () => ({ ok: false, blocked: false })),
}));

const TOKEN = "test-token";
const myself = { teamId: "team-1", userId: "user-1" } as UserProps;
const stamp = "2026-11-03T00:00:00Z";

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

const myMeta = (noteId: number, title = `Note ${noteId}`) => ({
    noteType: 1,
    noteId,
    parentNoteId: null,
    folderId: null,
    title,
    tsCreated: stamp,
    tsUpdated: stamp,
});
const taskMeta = (noteId: number) =>
    ({ ...myMeta(noteId), noteType: 2, taskId: 5, projectId: 1 }) as never;
const chatMeta = (noteId: number) =>
    ({ ...myMeta(noteId), noteType: 3, chatType: 2, chatId: 4 }) as never;
const full = (noteId: number, title: string, extra: object = {}) =>
    ({ ...myMeta(noteId, title), body: [{ type: "paragraph" }], ...extra }) as never;

const FAMILIES = [
    {
        family: "personal",
        kind: "my",
        noteType: 1,
        yjs: "my-note:7",
        idbDelete: "deletePersonalNote",
        remove: "deleteMyNoteById",
        server: deleteMyNote,
    },
    {
        family: "task",
        kind: "task",
        noteType: 2,
        yjs: "task-note:7",
        idbDelete: "deleteTaskNote",
        remove: "deleteTaskNoteById",
        server: deleteTaskNote,
    },
    {
        family: "chat",
        kind: "chat",
        noteType: 3,
        yjs: "chat-note:7",
        idbDelete: "deleteChatNote",
        remove: "deleteChatNoteById",
        server: deleteChatNote,
    },
] as const;

let idbDeletes: Record<string, ReturnType<typeof vi.spyOn>>;
let yjsDelete: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.clearAllMocks();
    clearNoteCache();
    localStorage.clear();
    idbDeletes = {
        deletePersonalNote: vi.spyOn(NoteService.prototype, "deletePersonalNote"),
        deleteTaskNote: vi.spyOn(NoteService.prototype, "deleteTaskNote"),
        deleteChatNote: vi.spyOn(NoteService.prototype, "deleteChatNote"),
    };
    for (const spy of Object.values(idbDeletes)) spy.mockResolvedValue(true);
    yjsDelete = vi.spyOn(DatabaseUtils, "deleteYjsDatabase").mockResolvedValue(true);
});

afterEach(() => {
    vi.restoreAllMocks();
});

const mountNotes = async () => {
    const hook = renderHook(() => useNoteManagement(myself, TOKEN));
    await settle();
    return hook;
};
type Hook = Awaited<ReturnType<typeof mountNotes>>;

const openTab = (hook: Hook, noteType: number, id: number) =>
    act(() =>
        hook.result.current.tabsApi.openTab(
            noteToTab(
                { noteType, noteId: id, title: `Note ${id}`, projectId: 1, taskId: 5 },
                myself.teamId
            )
        )
    );

const row = (family: "personal" | "task" | "chat", id: number) =>
    family === "personal" ? myMeta(id) : family === "task" ? taskMeta(id) : chatMeta(id);

/** Notes 7 and 8 in every list that can hold a note of the family: meta, Recents, Favorites. */
const seed = async (hook: Hook, family: "personal" | "task" | "chat") => {
    const rows = [row(family, 7), row(family, 8)] as never[];
    vi.mocked(loadFavoriteNotesMeta).mockResolvedValue({
        personalNotes: family === "personal" ? rows : [],
        taskNotes: family === "task" ? rows : [],
        chatNotes: family === "chat" ? rows : [],
        folders: [],
    } as never);
    await act(async () => {
        if (family === "personal") hook.result.current.setMyNoteMeta(rows);
        if (family === "task") hook.result.current.setTaskNoteMeta(rows);
        if (family === "chat") hook.result.current.setChatNoteMeta(rows);
        hook.result.current.setRecentNotes({
            personalNotes:
                family === "personal"
                    ? rows.map((r) => ({ ...(r as object), tsOpenedAt: stamp }))
                    : [],
            taskNotes:
                family === "task"
                    ? rows.map((r) => ({ ...(r as object), tsOpenedAt: stamp }))
                    : [],
            chatNotes:
                family === "chat"
                    ? rows.map((r) => ({ ...(r as object), tsOpenedAt: stamp }))
                    : [],
        } as never);
        await hook.result.current.getFavoriteNotesMeta();
    });
};

const everyRecent = (hook: Hook) => {
    const r = hook.result.current.recentNotes!;
    return [...r.personalNotes, ...r.taskNotes, ...r.chatNotes].map((n) => n.noteId);
};
const everyFavorite = (hook: Hook) => {
    const f = hook.result.current.favoriteNotes!;
    return [...f.personalNotes, ...f.taskNotes, ...f.chatNotes].map((n) => n.noteId);
};
const metaOf = (hook: Hook, family: "personal" | "task" | "chat") =>
    (family === "personal"
        ? hook.result.current.myNoteMeta
        : family === "task"
          ? hook.result.current.taskNoteMeta
          : hook.result.current.chatNoteMeta
    ).map((n) => n.noteId);

describe("deleting a note by id (the sidebar menu and the note header)", () => {
    it.each(FAMILIES)(
        "$family note: gone from the list, Recents, Favorites, the star, the cache, the tabs and IndexedDB",
        async ({ family, noteType, kind, yjs, idbDelete, remove, server }) => {
            const hook = await mountNotes();
            await seed(hook, family);
            await openTab(hook, noteType, 7);
            await openTab(hook, noteType, 8);
            upsertNoteCache(full(7, "Note 7", { noteType }));
            await waitFor(() => expect(hook.result.current.tabsApi.tabs).toHaveLength(2));
            expect(hook.result.current.isNoteFavorited(7, noteType)).toBe(true);
            const seen = vi.fn();
            window.addEventListener("noteDeleted", seen);

            let ok = false;
            await act(async () => {
                ok = await hook.result.current[remove](7);
            });

            expect(ok).toBe(true);
            expect(server).toHaveBeenCalledWith(myself, 7, TOKEN);
            expect(metaOf(hook, family)).toEqual([8]);
            expect(everyRecent(hook)).toEqual([8]);
            expect(everyFavorite(hook)).toEqual([8]);
            expect(hook.result.current.isNoteFavorited(7, noteType)).toBe(false);
            expect(hook.result.current.isNoteFavorited(8, noteType)).toBe(true);
            expect(getCachedNote(kind, 7)).toBeNull();
            expect(hook.result.current.tabsApi.tabs.map((t) => t.noteId)).toEqual([8]);
            await waitFor(() => expect(yjsDelete).toHaveBeenCalledWith(yjs));
            expect(idbDeletes[idbDelete]).toHaveBeenCalledWith(7);
            // The history and unread lists hear about it.
            expect(seen).toHaveBeenCalledTimes(1);
            expect((seen.mock.calls[0][0] as CustomEvent).detail).toEqual({
                noteType,
                noteIds: [7],
            });
            window.removeEventListener("noteDeleted", seen);
        }
    );

    it("a Team and a Shared note leave their own lists, not only the My list", async () => {
        vi.mocked(loadTeamNotesMeta).mockResolvedValue([myMeta(7), myMeta(8)] as never);
        const hook = await mountNotes();
        await act(async () => {
            await hook.result.current.getTeamNoteMeta();
            hook.result.current.setSharedNoteMeta([myMeta(7), myMeta(9)] as never);
        });
        expect(hook.result.current.teamNoteMeta.map((n) => n.noteId)).toEqual([7, 8]);

        await act(async () => {
            await hook.result.current.deleteMyNoteById(7);
        });

        expect(hook.result.current.teamNoteMeta.map((n) => n.noteId)).toEqual([8]);
        expect(hook.result.current.sharedNoteMeta.map((n) => n.noteId)).toEqual([9]);
    });

    it.each(FAMILIES)(
        "$family note: when the server does not delete it, nothing changes",
        async ({ family, noteType, remove, server }) => {
            vi.mocked(server).mockResolvedValueOnce(false);
            const hook = await mountNotes();
            await seed(hook, family);
            await openTab(hook, noteType, 7);

            let ok = true;
            await act(async () => {
                ok = await hook.result.current[remove](7);
            });

            expect(ok).toBe(false);
            expect(metaOf(hook, family)).toEqual([7, 8]);
            expect(everyRecent(hook)).toEqual([7, 8]);
            expect(everyFavorite(hook)).toEqual([7, 8]);
            expect(hook.result.current.tabsApi.tabs.map((t) => t.noteId)).toEqual([7]);
            expect(yjsDelete).not.toHaveBeenCalled();
        }
    );

    it("a note with a sub-note is refused before the server is asked", async () => {
        const hook = await mountNotes();
        act(() =>
            hook.result.current.setMyNoteMeta([
                myMeta(7),
                { ...myMeta(8), parentNoteId: 7 },
            ] as never)
        );
        let ok = true;
        await act(async () => {
            ok = await hook.result.current.deleteMyNoteById(7);
        });
        expect(ok).toBe(false);
        expect(deleteMyNote).not.toHaveBeenCalled();
        expect(hook.result.current.myNoteMeta).toHaveLength(2);
    });

    it("deleting the open note from its tab leaves the other tab open and active", async () => {
        const hook = await mountNotes();
        await seed(hook, "personal");
        await openTab(hook, 1, 8);
        await openTab(hook, 1, 7);
        await waitFor(() => expect(hook.result.current.tabsApi.activeTabId).toBe("my-7"));

        await act(async () => {
            await hook.result.current.deleteMyNoteById(7);
        });

        expect(hook.result.current.tabsApi.tabs.map((t) => t.noteId)).toEqual([8]);
        expect(hook.result.current.tabsApi.activeTabId).toBe("my-8");
    });
});

describe("deleting a folder deletes its notes", () => {
    it("My Notes: the notes also leave Recents and Favorites", async () => {
        vi.mocked(deleteMyNoteFolder).mockResolvedValueOnce({
            deletedFolderIds: [3],
            deletedNoteIds: [7],
        });
        const hook = await mountNotes();
        await seed(hook, "personal");
        act(() =>
            hook.result.current.setMyNoteMeta([{ ...myMeta(7), folderId: 3 }, myMeta(8)] as never)
        );

        await act(async () => {
            await hook.result.current.deleteMyNoteFolder(3);
        });

        expect(metaOf(hook, "personal")).toEqual([8]);
        expect(everyRecent(hook)).toEqual([8]);
        expect(everyFavorite(hook)).toEqual([8]);
        expect(hook.result.current.isNoteFavorited(7, 1)).toBe(false);
    });

    it("Team Notes: the notes also leave Recents, Favorites and the team list", async () => {
        vi.mocked(deleteTeamNoteFolder).mockResolvedValueOnce({
            ok: true,
            deletedFolderIds: [3],
            deletedNoteIds: [7],
        } as never);
        vi.mocked(loadTeamNotesMeta).mockResolvedValue([myMeta(7), myMeta(8)] as never);
        const hook = await mountNotes();
        await seed(hook, "personal");
        await act(async () => {
            await hook.result.current.getTeamNoteMeta();
        });

        await act(async () => {
            await hook.result.current.deleteTeamNoteFolder(3);
        });

        expect(hook.result.current.teamNoteMeta.map((n) => n.noteId)).toEqual([8]);
        expect(everyRecent(hook)).toEqual([8]);
        expect(everyFavorite(hook)).toEqual([8]);
    });
});

describe("the history and the unread list let a deleted note go", () => {
    it("History forgets the note's rows, whichever bucket it was opened from", async () => {
        localStorage.setItem(
            "genos.history.v1.team-1",
            JSON.stringify([
                { kind: "note", noteType: 8, noteId: 7, label: "Team 7", openedAt: 3 },
                { kind: "note", noteType: 1, noteId: 7, label: "My 7", openedAt: 2 },
                { kind: "note", noteType: 2, noteId: 7, label: "Task 7", openedAt: 1 },
                { kind: "note", noteType: 1, noteId: 8, label: "My 8", openedAt: 0 },
            ])
        );
        const { result } = renderHook(() => useHistory(), {
            wrapper: ({ children }) => (
                <HistoryProvider teamId="team-1">{children}</HistoryProvider>
            ),
        });
        expect(result.current.notesEntries).toHaveLength(4);

        act(() => emitNoteDeleted({ noteType: 1, noteIds: [7] }));

        // My and Team 7 are the same note (backend type 1); Task note 7 is another note.
        expect(result.current.notesEntries.map((e) => e.label)).toEqual(["Task 7", "My 8"]);
        expect(JSON.parse(localStorage.getItem("genos.history.v1.team-1")!)).toHaveLength(2);
    });

    it("the history tracker does not record a deleted note again when its tab closes", () => {
        // Closing the open Team note's tab makes a My tab the active one a render before
        // `currentMyNote` follows: the bucket flips from team to my, which read as opening
        // the note again.
        const stubs = {
            useCM: { allChats: [], currentMainChat: null, currentThreadChat: null },
            useTM: {
                allTasks: [],
                currentPreviewKind: null,
                currentPreviewTaskId: -1,
                currentPreviewMilestoneId: -1,
                currentPreviewTask: null,
            },
            useSM: { projectMilestones: [] },
            usePM: { teamProjects: [] },
        };
        const nm = (bucket: string, team: unknown[]) => ({
            currentMyNote: { noteId: 7, title: "Team 7" },
            currentTaskNote: null,
            currentChatNote: null,
            tabsApi: { activeTab: { kind: "my", bucket } },
            teamNoteFolders: [],
            teamNoteMeta: team,
        });
        const { result, rerender } = renderHook(
            ({ bucket, team }: { bucket: string; team: unknown[] }) => {
                useHistoryTracker({ ...stubs, useNM: nm(bucket, team) } as never);
                return useHistory();
            },
            {
                initialProps: { bucket: "team", team: [{ noteId: 7, folderId: 1 }] },
                wrapper: ({ children }) => (
                    <HistoryProvider teamId="team-1">{children}</HistoryProvider>
                ),
            }
        );
        expect(result.current.notesEntries.map((e) => e.noteType)).toEqual([8]);

        act(() => emitNoteDeleted({ noteType: 1, noteIds: [7] }));
        expect(result.current.notesEntries).toEqual([]);
        rerender({ bucket: "my", team: [] });

        expect(result.current.notesEntries).toEqual([]);
    });

    it("the Unread list drops a note that was deleted, and keeps the rest", () => {
        const activity = (chatType: number, chatId: number) => ({
            chatType,
            chatId,
            chatName: `Note ${chatId}`,
            isRead: false,
            senderId: "someone",
            activityId: `a${chatType}${chatId}`,
        });
        const useCM = {
            activityMessages: [activity(6, 7), activity(6, 8), activity(7, 7)],
            setActivityMessages: vi.fn(),
        } as never;
        const { result } = renderHook(() => useNoteMentionUnread(useCM, myself, TOKEN));
        expect(result.current.unreadNotes.map((n) => `${n.noteType}:${n.noteId}`)).toEqual([
            "1:7",
            "1:8",
            "2:7",
        ]);

        act(() => emitNoteDeleted({ noteType: 1, noteIds: [7] }));

        expect(result.current.unreadNotes.map((n) => `${n.noteType}:${n.noteId}`)).toEqual([
            "1:8",
            "2:7",
        ]);
        expect(result.current.isUnread(1, 7)).toBe(false);
    });
});
