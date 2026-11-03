// MIP-950 / MIP-951: what the browser does with the note refs an approved agent
// tool result carries.
//
//   delete_note / delete_note_folder -> the server deleted rows this tab still
//     shows. Close the tab or pane, drop the IndexedDB / Yjs copy, and take the
//     note out of the meta list and Recents, WITHOUT calling the delete endpoint.
//   restore_note_version -> the API wrote the title and body; an open editor
//     must hold the restored title (else its next autosave PUTs the old one back).
//
// The delete cases run the real chain: askAgentStream's callbacks -> useAgentQA /
// useSpotlight -> the `noteChanged` event -> useNoteManagement.

import "fake-indexeddb/auto";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteService } from "../db/services/note.service";
import { DatabaseUtils } from "../db/utils/database";
import { emitNoteChanged } from "../features/agentQA/noteWriteTools";
import { useAgentQA } from "../features/agentQA/useAgentQA";
import { loadChatNoteMeta } from "../features/notes/chat-notes/services/loadChatNoteMeta";
import { addNote } from "../features/notes/common/services/addNote";
import { applyNoteBodyToYjs } from "../features/notes/common/services/applyNoteBodyToYjs";
import { loadNoteVersions } from "../features/notes/common/services/loadNoteVersions";
import { loadSpecificNote } from "../features/notes/common/services/loadSpecificNote";
import { loadMyNoteFolders } from "../features/notes/my-notes/services/loadMyNoteFolders";
import { loadMyNoteMeta } from "../features/notes/my-notes/services/loadMyNoteMeta";
import { loadTaskNoteMeta } from "../features/notes/task-notes/services/loadTaskNoteMeta";
import { loadTeamNoteFolders } from "../features/notes/team-notes/services/loadTeamNoteFolders";
import { loadTeamNotesMeta } from "../features/notes/team-notes/services/loadTeamNotesMeta";
import { useSpotlight } from "../features/spotlight/useSpotlight";
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
    },
    {
        family: "task",
        kind: "task",
        noteType: 2,
        yjs: "task-note:7",
        idbDelete: "deleteTaskNote",
    },
    {
        family: "chat",
        kind: "chat",
        noteType: 3,
        yjs: "chat-note:7",
        idbDelete: "deleteChatNote",
    },
] as const;

// The deletes under test must never reach the network: any call to the
// api's delete endpoint would be an axios call, which these mocks leave
// unmocked on purpose.
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

// Opens a tab for the note and makes it active.
const openTab = (hook: Awaited<ReturnType<typeof mountNotes>>, noteType: number, id: number) =>
    act(() =>
        hook.result.current.tabsApi.openTab(
            noteToTab(
                { noteType, noteId: id, title: `Note ${id}`, projectId: 1, taskId: 5 },
                myself.teamId
            )
        )
    );

describe("delete_note: the browser drops what the server deleted", () => {
    it.each(FAMILIES)(
        "$family note: closes the tab, drops the local copies and filters the meta",
        async ({ family, noteType, kind, yjs, idbDelete }) => {
            const hook = await mountNotes();
            // Two notes in the list and in Recents, so the filter has to pick.
            act(() => {
                if (family === "personal")
                    hook.result.current.setMyNoteMeta([myMeta(7), myMeta(8)]);
                if (family === "task")
                    hook.result.current.setTaskNoteMeta([taskMeta(7), taskMeta(8)]);
                if (family === "chat")
                    hook.result.current.setChatNoteMeta([chatMeta(7), chatMeta(8)]);
                hook.result.current.setRecentNotes({
                    personalNotes:
                        family === "personal" ? [{ ...myMeta(7), tsOpenedAt: stamp }] : [],
                    taskNotes: family === "task" ? [{ ...taskMeta(7), tsOpenedAt: stamp }] : [],
                    chatNotes: family === "chat" ? [{ ...chatMeta(7), tsOpenedAt: stamp }] : [],
                } as never);
            });
            await openTab(hook, noteType, 7);
            await openTab(hook, noteType, 8);
            upsertNoteCache(full(7, "Note 7", { noteType }));
            await waitFor(() => expect(hook.result.current.tabsApi.tabs).toHaveLength(2));

            await act(async () => {
                emitNoteChanged("delete_note", { note_id: 7, note_type: family, deleted: true });
            });

            await waitFor(() => expect(yjsDelete).toHaveBeenCalledWith(yjs));
            expect(idbDeletes[idbDelete]).toHaveBeenCalledWith(7);
            const { tabsApi, recentNotes } = hook.result.current;
            expect(tabsApi.tabs.map((t) => t.noteId)).toEqual([8]);
            expect(getCachedNote(kind, 7)).toBeNull();
            const list = {
                personal: hook.result.current.myNoteMeta,
                task: hook.result.current.taskNoteMeta,
                chat: hook.result.current.chatNoteMeta,
            }[family];
            expect(list.map((n) => n.noteId)).toEqual([8]);
            expect([
                ...recentNotes!.personalNotes,
                ...recentNotes!.taskNotes,
                ...recentNotes!.chatNotes,
            ]).toEqual([]);
        }
    );

    it("takes the ONLY note out of the list even though the refetch answers nothing", async () => {
        // The meta loaders resolve undefined here (a failed refresh), so the
        // re-read cannot be what empties the sidebar: the local filter must.
        const hook = await mountNotes();
        act(() => hook.result.current.setMyNoteMeta([myMeta(7)]));
        await openTab(hook, 1, 7);

        await act(async () => {
            emitNoteChanged("delete_note", { note_id: 7, note_type: "personal", deleted: true });
        });

        await waitFor(() => expect(hook.result.current.myNoteMeta).toEqual([]));
        expect(hook.result.current.tabsApi.tabs).toEqual([]);
        expect(loadMyNoteMeta).toHaveBeenCalled();
    });

    it("closes the chat-page pane that shows the note", async () => {
        const hook = await mountNotes();
        act(() => hook.result.current.chatPanelApi.setNote(full(7, "Note 7", { noteType: 3 })));
        expect(hook.result.current.chatPanelApi.note?.noteId).toBe(7);

        await act(async () => {
            emitNoteChanged("delete_note", { note_id: 7, note_type: "chat", deleted: true });
        });

        await waitFor(() => expect(hook.result.current.chatPanelApi.note).toBeNull());
    });

    it("leaves a note alone when the ref is an update, not a delete", async () => {
        const hook = await mountNotes();
        act(() => hook.result.current.setMyNoteMeta([myMeta(7)]));
        await openTab(hook, 1, 7);

        await act(async () => {
            emitNoteChanged("update_note", {
                note_id: 7,
                note_type: "personal",
                changed_fields: ["title"],
            });
        });
        await settle();

        expect(hook.result.current.myNoteMeta.map((n) => n.noteId)).toEqual([7]);
        expect(hook.result.current.tabsApi.tabs).toHaveLength(1);
        expect(yjsDelete).not.toHaveBeenCalled();
    });
});

describe("empty meta responses", () => {
    // The My / Task / Chat meta endpoints are FULL loads (team + user in the
    // query, no `since` checkpoint), so [] means "no notes". A `length > 0`
    // guard kept the last note on screen after it was deleted elsewhere.
    it.each([
        ["My", loadMyNoteMeta, "getMyNoteMeta", "myNoteMeta", myMeta(1)],
        ["Task", loadTaskNoteMeta, "getTaskNoteMeta", "taskNoteMeta", taskMeta(1)],
        ["Chat", loadChatNoteMeta, "getChatNoteMeta", "chatNoteMeta", chatMeta(1)],
    ] as const)(
        "%s: [] empties the list, a failed load keeps it",
        async (_n, loader, getter, key, row) => {
            const hook = await mountNotes();
            const setter = {
                myNoteMeta: hook.result.current.setMyNoteMeta,
                taskNoteMeta: hook.result.current.setTaskNoteMeta,
                chatNoteMeta: hook.result.current.setChatNoteMeta,
            }[key] as (rows: unknown[]) => void;
            act(() => setter([row]));

            vi.mocked(loader).mockResolvedValueOnce(undefined as never);
            await act(async () => void (await hook.result.current[getter]()));
            expect(hook.result.current[key]).toHaveLength(1);

            vi.mocked(loader).mockResolvedValueOnce([] as never);
            await act(async () => void (await hook.result.current[getter]()));
            expect(hook.result.current[key]).toEqual([]);
        }
    );
});

// Streams one tool result carrying the given refs, then finishes the turn.
const streamResult = (tool_name: string, refs: Record<string, unknown>) =>
    vi.mocked(askAgentStream).mockImplementation(async (args) => {
        args.onToolStart?.({ step: 0, tool_name, arguments: {} });
        args.onToolResult?.({ step: 0, tool_name, summary: "ok", ...refs });
        args.onDelta("answer");
        args.onDone("sess-1", "run-1");
    });

describe.each([
    ["useAgentQA", () => useAgentQA({ accessToken: TOKEN, teamId: "team-1" })],
    ["useSpotlight", () => useSpotlight({ accessToken: TOKEN, teamId: "team-1" })],
] as const)("%s: delete_note_folder reaches useNoteManagement", (_name, useAsk) => {
    const FOLDERS = [
        { folderId: 10, name: "Top", parentFolderId: null },
        { folderId: 11, name: "Child", parentFolderId: 10 },
        { folderId: 12, name: "Other", parentFolderId: null },
    ];
    const seed = async () => {
        vi.mocked(loadMyNoteFolders).mockResolvedValue(FOLDERS as never);
        vi.mocked(loadTeamNoteFolders).mockResolvedValue([
            { folderId: 20, name: "Team", parentFolderId: null },
        ] as never);
        const hook = renderHook(() => ({ nm: useNoteManagement(myself, TOKEN), ask: useAsk() }));
        await settle();
        await act(async () => void (await hook.result.current.nm.getMyNoteFolders()));
        await act(async () => void (await hook.result.current.nm.getTeamNoteFolders()));
        act(() => hook.result.current.nm.setMyNoteMeta([myMeta(1), myMeta(2), myMeta(3)]));
        for (const id of [1, 2, 3]) await openTabNm(hook.result.current.nm, id);
        await waitFor(() => expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(3));
        return hook;
    };
    const openTabNm = (nm: ReturnType<typeof useNoteManagement>, id: number) =>
        act(() =>
            nm.tabsApi.openTab(noteToTab({ noteType: 1, noteId: id, title: "n" }, myself.teamId))
        );
    const ask = async (hook: Awaited<ReturnType<typeof seed>>) => {
        act(() => hook.result.current.ask.onAsk("q"));
        await waitFor(() => expect(hook.result.current.ask.turns).toHaveLength(1));
        await settle();
    };

    it("removes the listed folders and notes, closing BOTH open tabs", async () => {
        const hook = await seed();
        // What the server answers once the folder is gone, for the re-reads.
        vi.mocked(loadMyNoteFolders).mockResolvedValue([FOLDERS[2]] as never);
        vi.mocked(loadMyNoteMeta).mockResolvedValue([myMeta(3)] as never);
        streamResult("delete_note_folder", {
            note_folder: {
                folder_id: 10,
                deleted_folder_ids: [10, 11],
                deleted_note_ids: [1, 2],
                ids_truncated: false,
            },
        });
        await ask(hook);

        await waitFor(() => expect(yjsDelete).toHaveBeenCalledTimes(2));
        const { nm } = hook.result.current;
        expect(yjsDelete).toHaveBeenCalledWith("my-note:1");
        expect(yjsDelete).toHaveBeenCalledWith("my-note:2");
        expect(idbDeletes.deletePersonalNote).toHaveBeenCalledWith(1);
        expect(idbDeletes.deletePersonalNote).toHaveBeenCalledWith(2);
        expect(nm.tabsApi.tabs.map((t) => t.noteId)).toEqual([3]);
        expect(nm.myNoteFolders.map((f) => f.folderId)).toEqual([12]);
        expect(nm.myNoteMeta.map((n) => n.noteId)).toEqual([3]);
    });

    it("with ids_truncated it still cleans the listed ids and reloads the lists for the rest", async () => {
        const hook = await seed();
        // Note 2 was deleted too but is past the cap; the reload is what shows it.
        vi.mocked(loadMyNoteMeta).mockResolvedValue([myMeta(3)] as never);
        vi.mocked(loadMyNoteFolders).mockResolvedValue([FOLDERS[2]] as never);
        vi.mocked(loadMyNoteMeta).mockClear();
        vi.mocked(loadMyNoteFolders).mockClear();
        vi.mocked(loadTeamNotesMeta).mockClear();
        vi.mocked(loadTeamNoteFolders).mockClear();
        streamResult("delete_note_folder", {
            note_folder: {
                folder_id: 10,
                deleted_folder_ids: [10],
                deleted_note_ids: [1],
                ids_truncated: true,
            },
        });
        await ask(hook);

        await waitFor(() =>
            expect(hook.result.current.nm.myNoteMeta.map((n) => n.noteId)).toEqual([3])
        );
        expect(loadMyNoteMeta).toHaveBeenCalled();
        expect(loadMyNoteFolders).toHaveBeenCalled();
        expect(loadTeamNotesMeta).toHaveBeenCalled();
        expect(loadTeamNoteFolders).toHaveBeenCalled();
        expect(yjsDelete).toHaveBeenCalledWith("my-note:1");
        expect(hook.result.current.nm.myNoteFolders.map((f) => f.folderId)).toEqual([12]);
        expect(hook.result.current.nm.tabsApi.tabs.map((t) => t.noteId)).toContain(3);
    });

    it("drops a deleted TEAM folder too", async () => {
        const hook = await seed();
        vi.mocked(loadTeamNoteFolders).mockResolvedValue([] as never);
        streamResult("delete_note_folder", {
            note_folder: {
                folder_id: 20,
                deleted_folder_ids: [20],
                deleted_note_ids: [],
                ids_truncated: false,
            },
        });
        await ask(hook);

        await waitFor(() => expect(hook.result.current.nm.teamNoteFolders).toEqual([]));
        expect(hook.result.current.nm.myNoteFolders).toHaveLength(3);
    });

    it("delete_note ref through the same chain, and an unrelated tool changes nothing", async () => {
        const hook = await seed();
        streamResult("create_task", {
            note: { note_id: 1, note_type: "personal", deleted: true },
        });
        await ask(hook);
        await settle();
        expect(hook.result.current.nm.myNoteMeta).toHaveLength(3);
        expect(hook.result.current.nm.tabsApi.tabs).toHaveLength(3);
        expect(yjsDelete).not.toHaveBeenCalled();

        streamResult("delete_note", {
            note: { note_id: 1, note_type: "personal", deleted: true },
        });
        act(() => hook.result.current.ask.onAsk("q2"));
        await waitFor(() =>
            expect(hook.result.current.nm.myNoteMeta.map((n) => n.noteId)).toEqual([2, 3])
        );
        expect(yjsDelete).toHaveBeenCalledWith("my-note:1");
    });
});

describe("restore_note_version / update_note: the open editor is refreshed", () => {
    const restored = full(7, "Restored title", { noteType: 1, tsUpdated: "2026-11-03T01:00:00Z" });
    const restoreRef = {
        note_id: 7,
        note_type: "personal",
        title: "Restored title",
        changed_fields: ["title", "body"],
    } as const;

    const openStale = async () => {
        const hook = await mountNotes();
        const stale = full(7, "Old title", { noteType: 1 });
        upsertNoteCache(stale);
        act(() => {
            hook.result.current.setRecentNotes({
                personalNotes: [{ ...myMeta(7, "Old title"), tsOpenedAt: stamp }],
                taskNotes: [],
                chatNotes: [],
            } as never);
        });
        await openTab(hook, 1, 7);
        await waitFor(() => expect(hook.result.current.tabsApi.activeTab?.noteId).toBe(7));
        await settle();
        // The effect that follows the active tab loaded versions already.
        vi.mocked(loadNoteVersions).mockClear();
        vi.mocked(loadSpecificNote).mockClear();
        return hook;
    };

    it("a restore re-reads the note and puts the restored title where the editor looks", async () => {
        const hook = await openStale();
        vi.mocked(loadSpecificNote).mockResolvedValue(restored);

        await act(async () => {
            emitNoteChanged("restore_note_version", restoreRef);
        });

        await waitFor(() => expect(getCachedNote("my", 7)?.title).toBe("Restored title"));
        expect(loadSpecificNote).toHaveBeenCalledWith(myself, 1, 7, TOKEN);
        expect(addNote).toHaveBeenCalledWith(1, restored);
        // The tab label and the Recents row follow.
        expect(hook.result.current.tabsApi.tabs.find((t) => t.noteId === 7)?.title).toBe(
            "Restored title"
        );
        expect(hook.result.current.recentNotes?.personalNotes[0].title).toBe("Restored title");
        // The open note's version list is re-read.
        expect(loadNoteVersions).toHaveBeenCalledWith(myself, 1, 7, TOKEN);
        // And the body is pushed to Yjs (a diffed no-op when the API already did).
        expect(applyNoteBodyToYjs).toHaveBeenCalledWith(
            expect.objectContaining({ documentName: "my-note:7", blocks: restored.body })
        );
    });

    it("does not re-read the version list of a note that is not the open one", async () => {
        const hook = await openStale();
        act(() => hook.result.current.setMyNoteMeta([myMeta(7), myMeta(8)]));
        await openTab(hook, 1, 8);
        await waitFor(() => expect(hook.result.current.tabsApi.activeTab?.noteId).toBe(8));
        await settle();
        vi.mocked(loadNoteVersions).mockClear();
        vi.mocked(loadSpecificNote).mockResolvedValue(restored);

        await act(async () => {
            emitNoteChanged("restore_note_version", restoreRef);
        });

        await waitFor(() => expect(getCachedNote("my", 7)?.title).toBe("Restored title"));
        expect(loadNoteVersions).not.toHaveBeenCalled();
    });

    it("an update_note that changed the body only behaves as before", async () => {
        const hook = await openStale();
        const updated = full(7, "Old title", { noteType: 1, body: [{ type: "heading" }] });
        vi.mocked(loadSpecificNote).mockResolvedValue(updated);

        await act(async () => {
            emitNoteChanged("update_note", {
                note_id: 7,
                note_type: "personal",
                title: "Old title",
                changed_fields: ["body"],
            });
        });

        await waitFor(() =>
            expect(applyNoteBodyToYjs).toHaveBeenCalledWith(
                expect.objectContaining({ documentName: "my-note:7", blocks: updated.body })
            )
        );
        expect(loadSpecificNote).toHaveBeenCalledWith(myself, 1, 7, TOKEN);
        expect(getCachedNote("my", 7)?.body).toEqual(updated.body);
        // No title change: the title surfaces and the version list are untouched.
        expect(loadNoteVersions).not.toHaveBeenCalled();
        expect(hook.result.current.recentNotes?.personalNotes[0].title).toBe("Old title");
    });
});
