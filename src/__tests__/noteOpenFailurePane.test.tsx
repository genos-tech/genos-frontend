// MIP-1307: a deep link (or a tab) whose note failed to load must keep saying so.
//
// The toast for a failed open lasts 8 s; after it the pane used to read "No Note
// Selected" as if nothing had been asked for. And a 404 (deleted note) was
// indistinguishable from a network failure, so it got a Retry that could never work.
//
// These fail at the REQUEST (axios `get` rejects with the real AxiosError a
// network drop / a 404 produces), so they cover request -> loadSpecificNote ->
// useNoteManagement / useNoteData -> pane -> Retry -> the second request landing.
import "fake-indexeddb/auto";

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteContentRenderer } from "../features/notes/common/components/NoteContentRenderer";
import { NoteLoadState } from "../features/notes/common/components/NoteLoadState";
import { clearNoteCache, useNoteData } from "../hooks/notes/useNoteData";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
import type { NoteTab } from "../hooks/notes/useNoteTabs";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";

// ---- HTTP, faked at axios -------------------------------------------------
const answers = vi.hoisted(() => ({ queue: [] as Array<{ match: string; out: unknown }> }));
const calls = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock("../services/api", async (orig) => ({
    ...(await orig<typeof import("../services/api")>()),
    authApi: () => ({
        get: vi.fn(async (url: string) => {
            calls.urls.push(url);
            const i = answers.queue.findIndex((a) => url.includes(a.match));
            const hit = i >= 0 ? answers.queue.splice(i, 1)[0] : undefined;
            if (!hit) throw new Error(`unexpected request ${url}`);
            if (hit.out instanceof Error) throw hit.out;
            return { data: hit.out };
        }),
    }),
}));
const networkError = () => new AxiosError("Network Error", "ERR_NETWORK");
const httpError = (status: number) =>
    new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status,
        data: {},
    } as AxiosResponse);
const reply = (match: string, out: unknown) => answers.queue.push({ match, out });
const hits = (match: string) => calls.urls.filter((u) => u.includes(match)).length;

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <span /> }));
vi.mock("../db/services/note.service", () => ({
    NoteService: class {
        getPersonalNote = async () => undefined;
        getTaskNote = async () => undefined;
        getChatNote = async () => undefined;
    },
}));
vi.mock("../features/notes/common/services/addNote", () => ({ addNote: vi.fn(async () => null) }));

// The opened note's own chrome needs a router and BlockNote; the pane under test is not it.
vi.mock("../features/notes/my-notes/components/MyNoteMain", () => ({
    MyNoteMain: () => <div data-testid="note-main" />,
}));
vi.mock("../features/notes/task-notes/components/TaskNoteMain", () => ({
    TaskNoteMain: () => <div data-testid="note-main" />,
}));
vi.mock("../features/notes/chat-notes/components/ChatNoteMain", () => ({
    ChatNoteMain: () => <div data-testid="note-main" />,
}));
vi.mock("../features/notes/my-notes/components/MyNoteEditorPanel", () => ({
    MyNoteEditorPanel: () => <div data-testid="note-editor" />,
}));
vi.mock("../features/notes/task-notes/components/TaskNoteEditorPanel", () => ({
    TaskNoteEditorPanel: () => <div data-testid="note-editor" />,
}));
vi.mock("../features/notes/chat-notes/components/ChatNoteEditorPanel", () => ({
    ChatNoteEditorPanel: () => <div data-testid="note-editor" />,
}));
vi.mock("../features/tasks/components/contents/TaskPreview", () => ({
    TaskPreview: () => <div />,
}));

// Every other loader useNoteManagement reaches (a real one goes to axios).
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
vi.mock("../features/notes/common/services/loadNoteVersions", () => ({
    loadNoteVersions: vi.fn(async () => []),
}));
vi.mock("../features/notes/common/services/loadNoteRoles", () => ({
    loadNoteRoles: vi.fn(async () => []),
}));
vi.mock("../features/notes/common/services/applyNoteBodyToYjs", () => ({
    applyNoteBodyToYjs: vi.fn(async () => "applied"),
    noteDocumentName: (type: string, id: number) =>
        `${type === "personal" ? "my" : type}-note:${id}`,
}));

const myself = { teamId: "team-1", userId: "u1" } as UserProps;
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const NOTE = {
    noteId: 7,
    noteType: 1,
    parentNoteId: null,
    folderId: null,
    title: "Plan",
    body: "[]",
    teamId: "team-1",
    userId: "u1",
    tsCreated: "2026-11-03T00:00:00Z",
    tsUpdated: "2026-11-03T00:00:00Z",
};
const retry = () => screen.getByRole("button", { name: en.common.actions.retry });

// The notes pane as the app mounts it, fed by the real hook.
const emit = vi.fn();
const fakeSocket = { emit } as unknown as Socket;
const Pane = ({ onReady }: { onReady: (nm: ReturnType<typeof useNoteManagement>) => void }) => {
    const nm = useNoteManagement(myself, "tok");
    onReady(nm);
    return (
        <NoteContentRenderer
            myself={myself}
            setMyself={() => {}}
            socket={fakeSocket}
            useCM={{} as never}
            useNM={nm}
            usePM={{} as never}
            useTEM={{} as never}
            useTM={{} as never}
            useUISM={{} as never}
        />
    );
};
const mountPane = async () => {
    let nm!: ReturnType<typeof useNoteManagement>;
    render(
        <CssVarsProvider>
            <Pane onReady={(x) => (nm = x)} />
        </CssVarsProvider>
    );
    await settle();
    return () => nm;
};

beforeEach(() => {
    emit.mockClear();
    answers.queue.length = 0;
    calls.urls.length = 0;
    clearNoteCache();
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("a deep link whose note failed to open", () => {
    it("shows the error state (not 'No Note Selected') until Retry opens the note", async () => {
        const nm = await mountPane();
        reply("/note/personal/single/", networkError());
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });

        // Still there after the toast would have expired: it is state, not a toast.
        expect(screen.getByText(en.notes.editor.loadFailed)).toBeTruthy();
        expect(screen.queryByText(en.notes.placeholder.noNoteSelectedTitle)).toBeNull();

        reply("/note/personal/single/", NOTE);
        fireEvent.click(retry());
        await waitFor(() => expect(nm().tabsApi.tabs).toHaveLength(1));
        expect(screen.queryByText(en.notes.editor.loadFailed)).toBeNull();
        expect(screen.getAllByTestId("note-editor").length).toBeGreaterThan(0);
        expect(hits("/note/personal/single/")).toBe(2);
    });

    it("a Retry that fails again keeps the error state on screen", async () => {
        const nm = await mountPane();
        reply("/note/personal/single/", networkError());
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });
        reply("/note/personal/single/", networkError());
        await act(async () => {
            fireEvent.click(retry());
        });
        await waitFor(() => expect(hits("/note/personal/single/")).toBe(2));
        await waitFor(() => expect(screen.getByText(en.notes.editor.loadFailed)).toBeTruthy());
        expect(screen.queryByText(en.notes.placeholder.noNoteSelectedTitle)).toBeNull();
    });

    it("a 404 says the note no longer exists and offers no Retry", async () => {
        const nm = await mountPane();
        reply("/note/personal/single/", httpError(404));
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });
        expect(screen.getByText(en.notes.placeholder.noteNotFoundTitle)).toBeTruthy();
        expect(screen.queryByRole("button", { name: en.common.actions.retry })).toBeNull();
        expect(screen.queryByText(en.notes.placeholder.noNoteSelectedTitle)).toBeNull();
        expect(hits("/note/personal/single/")).toBe(1);
    });

    it("a 500 is a failure (Retry), not 'gone'", async () => {
        const nm = await mountPane();
        reply("/note/personal/single/", httpError(500));
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });
        expect(screen.getByText(en.notes.editor.loadFailed)).toBeTruthy();
        expect(screen.queryByText(en.notes.placeholder.noteNotFoundTitle)).toBeNull();
    });
});

// MIP-1330: a note that EXISTS but the user has no role on (403) is the shared-URL case. The
// access-request panel lives in a tab's editor panel, and no tab opens for a note that could
// not be fetched, so the pane used to end on "No Note Selected".
describe("a deep link to a note the user has no role on (403)", () => {
    const accessRequest = en.notes.accessRequest;
    const requestAccess = () => screen.getByRole("button", { name: accessRequest.sendButton });

    it.each([
        ["my note", 1, "/note/personal/single/"],
        ["task note", 2, "/note/task/single/"],
        ["chat note", 3, "/note/chat/single/"],
    ])(
        "%s: the pane offers the access request, and Request Access files it",
        async (_name, noteType, url) => {
            const nm = await mountPane();
            reply(url, httpError(403));
            await act(async () => {
                await nm().loadNote(noteType, 7, -1);
            });

            expect(screen.getByText(accessRequest.heading)).toBeTruthy();
            expect(screen.queryByText(en.notes.placeholder.noNoteSelectedTitle)).toBeNull();
            expect(screen.queryByRole("button", { name: en.common.actions.retry })).toBeNull();

            fireEvent.click(requestAccess());
            expect(emit).toHaveBeenCalledWith("note_access_request", {
                note_type: noteType,
                note_id: 7,
            });
            expect(hits(url)).toBe(1);
        }
    );

    it("a team / shared link asks about the backend note type (they live in type 1)", async () => {
        const nm = await mountPane();
        reply("/note/personal/single/", httpError(403));
        await act(async () => {
            await nm().loadNote(8, 7, -1);
        });
        fireEvent.click(requestAccess());
        expect(emit).toHaveBeenCalledWith("note_access_request", { note_type: 1, note_id: 7 });
    });

    it("another route replaces it (the denial belongs to the URL that asked)", async () => {
        const nm = await mountPane();
        reply("/note/personal/single/", httpError(403));
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });
        expect(screen.getByText(accessRequest.heading)).toBeTruthy();

        reply("/note/personal/single/", NOTE);
        await act(async () => {
            nm().clearNoteOpenFailure();
            await nm().loadNote(1, 7, -1);
        });
        await waitFor(() => expect(nm().tabsApi.tabs).toHaveLength(1));
        expect(screen.queryByText(accessRequest.heading)).toBeNull();
    });
});

describe("a tab whose note failed to load", () => {
    const tab = { id: "my:7", kind: "my", noteId: 7, noteType: 1 } as unknown as NoteTab;

    it("a 404 turns the tab's panel into 'no longer exists' with no Retry", async () => {
        reply("/note/personal/single/", httpError(404));
        const { result } = renderHook(() => useNoteData(tab, { myself, accessToken: "tok" }));
        await waitFor(() => expect(result.current.notFound).toBe(true));
        expect(result.current.error).not.toBeNull();

        render(
            <CssVarsProvider>
                <NoteLoadState
                    error={result.current.error !== null}
                    isLoading={false}
                    notFound={result.current.notFound}
                    isActive
                    onRetry={() => {}}
                />
            </CssVarsProvider>
        );
        expect(screen.getByText(en.notes.placeholder.noteNotFoundTitle)).toBeTruthy();
        expect(screen.queryByRole("button", { name: en.common.actions.retry })).toBeNull();
    });

    it("a network failure is not notFound (Retry stays)", async () => {
        reply("/note/personal/single/", networkError());
        const { result } = renderHook(() => useNoteData(tab, { myself, accessToken: "tok" }));
        await waitFor(() => expect(result.current.error).not.toBeNull());
        expect(result.current.notFound).toBe(false);
    });
});
