// MIP-1677: a note's members and versions are loaded on every open; when the answer is the same as
// what is held (an empty list, or the list it already had), the write must not re-render the app.
// Every write used to put a NEW array into state, and the state lives in the app root, so each one
// was a commit of the whole Notes page. Counted as renders of a CHILD of the root that owns useNoteManagement.
import "fake-indexeddb/auto";

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render } from "@testing-library/react";
import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteContentRenderer } from "../features/notes/common/components/NoteContentRenderer";
import { clearNoteCache } from "../hooks/notes/useNoteData";
import { useNoteManagement } from "../hooks/notes/useNoteManagement";
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
const lists = vi.hoisted(() => ({ roles: [] as unknown[], versions: [] as unknown[] | null }));
vi.mock("../features/notes/common/services/loadNoteVersions", () => ({
    loadNoteVersions: vi.fn(async () =>
        lists.versions === null ? null : structuredClone(lists.versions)
    ),
}));
vi.mock("../features/notes/common/services/loadNoteRoles", () => ({
    loadNoteRoles: vi.fn(async () => structuredClone(lists.roles)),
}));
vi.mock("../features/notes/common/services/applyNoteBodyToYjs", () => ({
    applyNoteBodyToYjs: vi.fn(async () => "applied"),
    noteDocumentName: (type: string, id: number) =>
        `${type === "personal" ? "my" : type}-note:${id}`,
}));

const myself = { teamId: "team-1", userId: "u1" } as UserProps;
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

// The notes pane as the app mounts it, fed by the real hook.
const emit = vi.fn();
const fakeSocket = { emit } as unknown as Socket;
const seen = { opening: [] as Array<unknown>, renders: 0 };
// Counts renders of a CHILD of the root: when a state write changes nothing React may still run the
// root's own function once and then bail out, which re-renders no child and commits nothing; only a
// real change reaches this.
const Counter = ({ nm }: { nm: unknown }) => {
    void nm;
    seen.renders += 1;
    return null;
};
const Pane = ({ onReady }: { onReady: (nm: ReturnType<typeof useNoteManagement>) => void }) => {
    const nm = useNoteManagement(myself, "tok");
    seen.opening.push(nm.openingNote);
    onReady(nm);
    return (
        <>
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
            <Counter nm={nm} />
        </>
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
    seen.renders = 0;
    lists.roles = [];
    lists.versions = [];
    idb.personal = undefined;
    phone.value = false;
    clearNoteCache();
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const member = (userId: string, roleId: number) => ({ userId, roleId, name: userId });
const version = (id: number) => ({
    versionId: id,
    title: `v${id}`,
    tsCreated: "2026-11-17T00:00:00Z",
});
/** How many times the root re-rendered while `action` ran. */
const rendersDuring = async (action: () => Promise<void>) => {
    await settle();
    const before = seen.renders;
    await act(action);
    await settle();
    return seen.renders - before;
};

describe("a note's members", () => {
    it("an empty answer for an empty list re-renders nothing", async () => {
        const nm = await mountPane();
        expect(await rendersDuring(() => nm().loadNoteMembers(1, 7))).toBe(0);
    });

    it("the same members again re-render nothing", async () => {
        const nm = await mountPane();
        lists.roles = [member("a", 1), member("b", 2)];
        expect(await rendersDuring(() => nm().loadNoteMembers(1, 7))).toBeGreaterThan(0);
        expect(await rendersDuring(() => nm().loadNoteMembers(1, 7))).toBe(0);
        expect(nm().currentNoteMembers).toHaveLength(2);
    });

    it("different members do", async () => {
        const nm = await mountPane();
        lists.roles = [member("a", 1)];
        await rendersDuring(() => nm().loadNoteMembers(1, 7));
        lists.roles = [member("a", 1), member("c", 3)];
        expect(await rendersDuring(() => nm().loadNoteMembers(1, 7))).toBeGreaterThan(0);
        expect(nm().currentNoteMembers.map((m) => m.userId)).toEqual(["a", "c"]);
    });

    it("a member that left empties the list", async () => {
        const nm = await mountPane();
        lists.roles = [member("a", 1)];
        await rendersDuring(() => nm().loadNoteMembers(1, 7));
        lists.roles = [];
        expect(await rendersDuring(() => nm().loadNoteMembers(1, 7))).toBeGreaterThan(0);
        expect(nm().currentNoteMembers).toEqual([]);
    });
});

describe("a note's versions", () => {
    it("an empty answer for an empty list re-renders nothing", async () => {
        const nm = await mountPane();
        expect(await rendersDuring(() => nm().loadNoteVersionsFor(1, 7))).toBe(0);
    });

    it("the same versions again re-render nothing", async () => {
        const nm = await mountPane();
        lists.versions = [version(2), version(1)];
        expect(await rendersDuring(() => nm().loadNoteVersionsFor(1, 7))).toBeGreaterThan(0);
        expect(await rendersDuring(() => nm().loadNoteVersionsFor(1, 7))).toBe(0);
        expect(nm().currentNoteVersions).toHaveLength(2);
    });

    it("a new version does", async () => {
        const nm = await mountPane();
        lists.versions = [version(1)];
        await rendersDuring(() => nm().loadNoteVersionsFor(1, 7));
        lists.versions = [version(2), version(1)];
        expect(await rendersDuring(() => nm().loadNoteVersionsFor(1, 7))).toBeGreaterThan(0);
        expect(nm().currentNoteVersions).toHaveLength(2);
    });

    it("another note's empty history clears the previous note's list", async () => {
        const nm = await mountPane();
        lists.versions = [version(1)];
        await rendersDuring(() => nm().loadNoteVersionsFor(1, 7));
        // A failed load for a DIFFERENT note: nothing of this note's to keep.
        lists.versions = null;
        await rendersDuring(() => nm().loadNoteVersionsFor(1, 9));
        expect(nm().currentNoteVersions).toEqual([]);
    });
});
