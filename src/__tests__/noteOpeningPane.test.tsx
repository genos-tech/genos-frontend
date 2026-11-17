// MIP-1675: while a note that is not in IndexedDB is fetched, the pane must say so.
//
// `loadNote` waits for the network BEFORE it opens the tab. For that time the pane said "No Note
// Selected" (nothing open) or kept showing the previous note (something open), so a click looked as
// if it did nothing. These hold the request OPEN (a promise the test settles) and read the pane in
// the middle: request -> loadSpecificNote -> useNoteManagement.openingNote -> NoteContentRenderer.
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { LOADING_INDICATOR_DELAY_MS } from "../components/ui/misc/LoadingIndicator";
import { NoteContentRenderer } from "../features/notes/common/components/NoteContentRenderer";
import { clearNoteCache } from "../hooks/notes/useNoteData";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
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
            const out = await hit.out;
            if (out instanceof Error) throw out;
            return { data: out };
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
const defer = <T,>() => {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};
const hits = (match: string) => calls.urls.filter((u) => u.includes(match)).length;

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <span /> }));
const idb = vi.hoisted(() => ({ personal: undefined as unknown }));
const phone = vi.hoisted(() => ({ value: false }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => phone.value }));
vi.mock("../db/services/note.service", () => ({
    NoteService: class {
        getPersonalNote = async () => idb.personal;
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

// The notes pane as the app mounts it, fed by the real hook.
const emit = vi.fn();
const fakeSocket = { emit } as unknown as Socket;
const seen = { opening: [] as Array<unknown> };
const Pane = ({ onReady }: { onReady: (nm: ReturnType<typeof useNoteManagement>) => void }) => {
    const nm = useNoteManagement(myself, "tok");
    seen.opening.push(nm.openingNote);
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
    seen.opening.length = 0;
    idb.personal = undefined;
    phone.value = false;
    clearNoteCache();
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const PERSONAL = "/note/personal/single/";
const NOTE9 = { ...NOTE, noteId: 9, title: "Other" };
const opening = () => document.querySelector<HTMLElement>("[data-note-opening]");
const statusLabel = { name: en.notes.editor.loadingNote };
const tabs = (nm: () => ReturnType<typeof useNoteManagement>) => nm().tabsApi.tabs.length;

describe("a note that has to come from the network", () => {
    it("with nothing open: the pane says a note is opening, not 'No Note Selected', until the tab opens", async () => {
        const nm = await mountPane();
        const answer = defer<unknown>();
        reply(PERSONAL, answer.promise);
        let opened!: Promise<void>;
        await act(async () => {
            opened = nm().loadNote(1, 7, -1);
        });

        // Mid-wait, with the request still open.
        expect(opening()?.getAttribute("data-note-opening")).toBe("pane");
        expect(screen.getByRole("status", statusLabel)).toBeTruthy();
        expect(screen.queryByText(en.notes.placeholder.noNoteSelectedTitle)).toBeNull();
        expect(nm().openingNote).toEqual({ noteType: 1, noteId: 7 });

        await act(async () => {
            answer.resolve(NOTE);
            await opened;
        });
        await waitFor(() => expect(tabs(nm)).toBe(1));
        expect(opening()).toBeNull();
        expect(nm().openingNote).toBeNull();
        expect(screen.getAllByTestId("note-editor").length).toBeGreaterThan(0);
    });

    it("with a note open: an overlay over the editor area, and the open note stays mounted under it", async () => {
        const nm = await mountPane();
        reply(PERSONAL, NOTE);
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });
        await waitFor(() => expect(tabs(nm)).toBe(1));
        expect(opening()).toBeNull();

        const answer = defer<unknown>();
        reply(PERSONAL, answer.promise);
        let opened!: Promise<void>;
        await act(async () => {
            opened = nm().loadNote(1, 9, -1);
        });
        const overlay = opening()!;
        expect(overlay.getAttribute("data-note-opening")).toBe("overlay");
        // The note that is open is still there, in the same editor area as the overlay...
        const editor = screen.getAllByTestId("note-editor")[0];
        expect(overlay.parentElement?.contains(editor)).toBe(true);
        // ...and the header and tab strip (outside the editor area) are not under it.
        const header = screen.queryByTestId("note-main");
        if (header) expect(overlay.parentElement?.contains(header)).toBe(false);
        expect(screen.queryByText(en.notes.placeholder.noNoteSelectedTitle)).toBeNull();

        await act(async () => {
            answer.resolve(NOTE9);
            await opened;
        });
        await waitFor(() => expect(tabs(nm)).toBe(2));
        expect(opening()).toBeNull();
    });

    it.each([
        ["task note", 2, "/note/task/single/"],
        ["chat note", 3, "/note/chat/single/"],
    ])("%s: says so while it is fetched", async (_name, noteType, url) => {
        const nm = await mountPane();
        reply(url, defer<unknown>().promise);
        await act(async () => {
            void nm().loadNote(noteType, 7, -1);
        });
        expect(nm().openingNote).toEqual({ noteType, noteId: 7 });
        expect(screen.getByRole("status", statusLabel)).toBeTruthy();
    });

    it("a team or shared link says so too, for the backend's note type", async () => {
        const nm = await mountPane();
        reply(PERSONAL, defer<unknown>().promise);
        await act(async () => {
            void nm().loadNote(8, 7, -1);
        });
        expect(nm().openingNote).toEqual({ noteType: 8, noteId: 7 });
    });
});

describe("on a phone", () => {
    it("the overlay sits in the pool that fills the height, over the editor and not the header", async () => {
        phone.value = true;
        const nm = await mountPane();
        reply(PERSONAL, NOTE);
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });
        await waitFor(() => expect(tabs(nm)).toBe(1));
        reply(PERSONAL, defer<unknown>().promise);
        await act(async () => {
            void nm().loadNote(1, 9, -1);
        });
        const overlay = opening()!;
        expect(overlay.getAttribute("data-note-opening")).toBe("overlay");
        expect(overlay.parentElement?.classList.contains("note-editor-pool-fill")).toBe(true);
        expect(overlay.parentElement?.contains(screen.getAllByTestId("note-editor")[0])).toBe(
            true
        );
        expect(cssOf(overlay.parentElement!)).toMatch(/position:\s*relative/);
    });

    it("with nothing open it replaces 'No Note Selected' there too", async () => {
        phone.value = true;
        const nm = await mountPane();
        reply(PERSONAL, defer<unknown>().promise);
        await act(async () => {
            void nm().loadNote(1, 7, -1);
        });
        expect(opening()?.getAttribute("data-note-opening")).toBe("pane");
        expect(screen.queryByText(en.notes.placeholder.noNoteSelectedTitle)).toBeNull();
    });
});

describe("a note IndexedDB already has", () => {
    it("opens at once and never says it is opening (no flash on a fast open)", async () => {
        idb.personal = { ...NOTE };
        const nm = await mountPane();
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });
        await waitFor(() => expect(tabs(nm)).toBe(1));
        expect(hits(PERSONAL)).toBe(0);
        // Not once, in any render along the way.
        expect(seen.opening.every((o) => o === null)).toBe(true);
        expect(opening()).toBeNull();
    });
});

describe("while IndexedDB is still being asked", () => {
    it("says nothing: only the network wait is a wait worth showing", async () => {
        const nm = await mountPane();
        const lookup = defer<unknown>();
        idb.personal = lookup.promise;
        let opened!: Promise<void>;
        await act(async () => {
            opened = nm().loadNote(1, 7, -1);
        });
        // The lookup has not answered: no loader, no state, and no request yet.
        expect(nm().openingNote).toBeNull();
        expect(opening()).toBeNull();
        expect(hits(PERSONAL)).toBe(0);

        await act(async () => {
            lookup.resolve({ ...NOTE });
            await opened;
        });
        await waitFor(() => expect(tabs(nm)).toBe(1));
        expect(seen.opening.every((o) => o === null)).toBe(true);
    });

    it("a newer click ends an older click's loader at once, without waiting for its own lookup", async () => {
        const nm = await mountPane();
        reply(PERSONAL, defer<unknown>().promise);
        await act(async () => {
            void nm().loadNote(1, 7, -1);
        });
        expect(nm().openingNote?.noteId).toBe(7);

        // The newer click's own IndexedDB lookup is slow; the older loader must not linger meanwhile.
        idb.personal = defer<unknown>().promise;
        await act(async () => {
            void nm().loadNote(1, 9, -1);
        });
        expect(nm().openingNote).toBeNull();
        expect(opening()).toBeNull();
    });
});

describe("the wait ends, whatever happened", () => {
    it("a failed request: the error state, no loader", async () => {
        const nm = await mountPane();
        const answer = defer<unknown>();
        reply(PERSONAL, answer.promise);
        let opened!: Promise<void>;
        await act(async () => {
            opened = nm().loadNote(1, 7, -1);
        });
        expect(opening()).not.toBeNull();
        await act(async () => {
            answer.resolve(networkError());
            await opened;
        });
        expect(opening()).toBeNull();
        expect(nm().openingNote).toBeNull();
        expect(screen.getByText(en.notes.editor.loadFailed)).toBeTruthy();
    });

    it("a 404: the 'gone' state, no loader", async () => {
        const nm = await mountPane();
        const answer = defer<unknown>();
        reply(PERSONAL, answer.promise);
        let opened!: Promise<void>;
        await act(async () => {
            opened = nm().loadNote(1, 7, -1);
        });
        await act(async () => {
            answer.resolve(httpError(404));
            await opened;
        });
        expect(opening()).toBeNull();
        expect(screen.getByText(en.notes.placeholder.noteNotFoundTitle)).toBeTruthy();
    });

    it("a newer open that IndexedDB answers ends the wait of an older one still in flight", async () => {
        const nm = await mountPane();
        const older = defer<unknown>();
        reply(PERSONAL, older.promise);
        let openedOlder!: Promise<void>;
        await act(async () => {
            openedOlder = nm().loadNote(1, 7, -1);
        });
        expect(nm().openingNote?.noteId).toBe(7);

        idb.personal = { ...NOTE9 };
        await act(async () => {
            await nm().loadNote(1, 9, -1);
        });
        expect(nm().openingNote).toBeNull();
        expect(opening()).toBeNull();

        // The older one answers late: it neither brings the loader back nor leaves it stranded.
        await act(async () => {
            older.resolve(NOTE);
            await openedOlder;
        });
        expect(nm().openingNote).toBeNull();
        expect(opening()).toBeNull();
    });

    it("an older open that finishes first does not end the wait of the newer one", async () => {
        const nm = await mountPane();
        const older = defer<unknown>();
        const newer = defer<unknown>();
        reply(PERSONAL, older.promise);
        let openedOlder!: Promise<void>;
        await act(async () => {
            openedOlder = nm().loadNote(1, 7, -1);
        });
        reply(PERSONAL, newer.promise);
        let openedNewer!: Promise<void>;
        await act(async () => {
            openedNewer = nm().loadNote(1, 9, -1);
        });
        expect(nm().openingNote?.noteId).toBe(9);

        await act(async () => {
            older.resolve(NOTE);
            await openedOlder;
        });
        // The newer one is still what the pane is waiting on.
        expect(nm().openingNote?.noteId).toBe(9);
        expect(opening()).not.toBeNull();

        await act(async () => {
            newer.resolve(NOTE9);
            await openedNewer;
        });
        expect(nm().openingNote).toBeNull();
    });

    it("abandoning the open (clearNoteOpenFailure) ends the wait", async () => {
        const nm = await mountPane();
        reply(PERSONAL, defer<unknown>().promise);
        await act(async () => {
            void nm().loadNote(1, 7, -1);
        });
        expect(opening()).not.toBeNull();
        await act(async () => {
            nm().clearNoteOpenFailure();
        });
        expect(nm().openingNote).toBeNull();
        expect(opening()).toBeNull();
    });
});

describe("what it looks like", () => {
    it("the overlay is hidden and click-through for the shared delay, then fades in", async () => {
        const nm = await mountPane();
        reply(PERSONAL, NOTE);
        await act(async () => {
            await nm().loadNote(1, 7, -1);
        });
        await waitFor(() => expect(tabs(nm)).toBe(1));
        reply(PERSONAL, defer<unknown>().promise);
        await act(async () => {
            void nm().loadNote(1, 9, -1);
        });
        const css = cssOf(opening()!);
        expect(css).toMatch(new RegExp(`0\\.2s ease-out ${LOADING_INDICATOR_DELAY_MS}ms both`));
        expect(css).toMatch(new RegExp(`1ms linear ${LOADING_INDICATOR_DELAY_MS}ms both`));
        expect(css).toMatch(/position:\s*absolute/);
        expect(css).toMatch(/z-index:\s*110/);
        // Hidden (not just transparent) until then, so it takes no clicks: a keyframe, not a style.
        const source = readFileSync(
            join(
                dirname(fileURLToPath(import.meta.url)),
                "../features/notes/common/components/NoteOpeningState.tsx"
            ),
            "utf8"
        );
        expect(source).toMatch(/from \{ opacity: 0; visibility: hidden; \}/);
        expect(source).toMatch(/to \{ opacity: 1; visibility: visible; \}/);
    });

    it("with nothing open the surface is plain and only the dots and caption are delayed", async () => {
        const nm = await mountPane();
        reply(PERSONAL, defer<unknown>().promise);
        await act(async () => {
            void nm().loadNote(1, 7, -1);
        });
        const pane = opening()!;
        expect(cssOf(pane)).not.toMatch(/position:\s*absolute/);
        const [dots, caption] = Array.from(pane.children);
        for (const el of [dots, caption]) {
            expect(cssOf(el)).toMatch(
                new RegExp(`0\\.2s ease-out ${LOADING_INDICATOR_DELAY_MS}ms both`)
            );
        }
    });
});
