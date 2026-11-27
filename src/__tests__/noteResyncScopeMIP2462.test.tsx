/**
 * MIP-2462: the "re-seed your editor" signal was one counter for the whole app. Restoring one note
 * made every mounted note editor replace its LIVE collab document with its own cached body, over
 * what had been typed there since, collaborators included, and dropped what it had not saved.
 *
 * The real `useNoteManagement`, note panels, save engine and `GenosNoteEditor` run. The collab
 * document is a fake with the editor's contract (`document`, `replaceBlocks`).
 */
import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyNoteEditorPanel } from "../features/notes/my-notes/components/MyNoteEditorPanel";
import { TaskNoteEditorPanel } from "../features/notes/task-notes/components/TaskNoteEditorPanel";
import { clearNoteCache, upsertNoteCache, type ResolvedNote } from "../hooks/notes/useNoteData";
import { NoteManagementState, useNoteManagement } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";

type Block = { type: string; text: string };
type FakeEditor = { document: Block[]; replaceBlocks: (_: Block[], next: Block[]) => void };

const world = vi.hoisted(() => ({
    editors: new Map<string, unknown>(),
    onChange: new Map<unknown, () => void>(),
    replaced: [] as { doc: string; text: string }[],
    puts: [] as { url: string; noteId: number; text: string }[],
}));

vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: () => ({
        get: async () => ({ data: [] }),
        post: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
        put: async (url: string, data: { note_id: number; body?: Block[] }) => {
            world.puts.push({ url, noteId: data.note_id, text: data.body?.[0]?.text ?? "" });
            return { data: {} };
        },
    }),
}));
// What the server holds after a restore, and after an agent wrote the note.
vi.mock("../features/notes/common/services/loadSpecificNote", () => ({
    loadSpecificNote: async (_me: unknown, noteType: number, noteId: number) => ({
        noteType,
        noteId,
        title: `Note ${noteId}`,
        body: [{ type: "paragraph", text: "restored" }],
        bodyFormat: "blocknote",
        tsUpdated: "2026-11-27T10:00:00Z",
    }),
}));
vi.mock("../features/notes/favorite-notes/services", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/notes/favorite-notes/services")>()),
    loadFavoriteNotesMeta: async () => ({
        personalNotes: [],
        taskNotes: [],
        chatNotes: [],
        folders: [],
    }),
}));
vi.mock("../features/notes/common/services/addNote", () => ({ addNote: async () => null }));
// The collab server cannot be reached, so an agent write falls back to the resync signal.
vi.mock("../features/notes/common/services/applyNoteBodyToYjs", () => ({
    applyNoteBodyToYjs: async () => "failed",
    noteDocumentName: () => "unused",
}));

vi.mock("../components/editors/genos/useGenosEditor", () => ({
    useGenosCollabEditor: ({ documentName, body }: { documentName: string; body: Block[] }) => {
        if (!world.editors.has(documentName)) {
            const editor: FakeEditor = {
                document: body,
                replaceBlocks: (_: Block[], next: Block[]) => {
                    editor.document = next;
                    world.replaced.push({ doc: documentName, text: next[0].text });
                },
            };
            world.editors.set(documentName, editor);
        }
        return { editor: world.editors.get(documentName), threadStore: null, collabScope: null };
    },
}));
vi.mock("@blocknote/mantine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@blocknote/mantine")>()),
    BlockNoteView: (props: { editor: unknown; onChange: () => void; children: ReactNode }) => {
        world.onChange.set(props.editor, props.onChange);
        return <div>{props.children}</div>;
    },
}));
vi.mock("@blocknote/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@blocknote/react")>()),
    BlockNoteViewEditor: () => null,
    SideMenuController: () => null,
    FormattingToolbarController: () => null,
}));
vi.mock("../components/editors/safeBlocks", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../components/editors/safeBlocks")>()),
    sanitizeBlocksForEditor: (blocks: unknown[]) => blocks,
    logSanitizeReport: () => {},
}));
vi.mock("../context/authState", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../context/authState")>()),
    useAuth: () => ({ accessToken: "token" }),
}));
vi.mock("../features/spotlight/useAskGenosAvailable", () => ({
    useAskGenosAvailable: () => false,
}));
vi.mock("../features/notes/common/components/NoteTitleField", () => ({
    NoteTitleField: () => <div />,
}));

const myself = { teamId: "team-1", userId: "user-1" } as UserProps;
const body = (text: string) => [{ type: "paragraph", text }];

const note = (noteType: number, noteId: number) =>
    ({
        noteType,
        noteId,
        title: `Note ${noteId}`,
        body: body("as opened"),
        bodyFormat: "blocknote",
    }) as unknown as ResolvedNote;

let useNM: NoteManagementState;

const Harness = () => {
    useNM = useNoteManagement(myself, "token");
    const props = {
        accessToken: "token",
        myself,
        setMyself: vi.fn(),
        socket: null,
        useTEM: { teamMembers: [], teamMemberProfiles: {} } as never,
        useUISM: {} as never,
        useCM: {} as never,
        useNM,
    };
    return (
        <>
            <MyNoteEditorPanel
                {...props}
                isActive
                tab={{ id: "my-5", kind: "my", noteId: 5 } as never}
            />
            <MyNoteEditorPanel
                {...props}
                isActive={false}
                tab={{ id: "my-6", kind: "my", noteId: 6 } as never}
            />
            {/* The same number in another family is another note. */}
            <TaskNoteEditorPanel
                {...props}
                isActive={false}
                tab={{ id: "task-5", kind: "task", noteId: 5 } as never}
            />
        </>
    );
};

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const editorOf = (doc: string) => world.editors.get(doc) as FakeEditor;

/** Someone else's words arrive in the live document; the panel's cached note does not have them. */
const remoteWrite = (doc: string, text: string) => {
    editorOf(doc).document = body(text);
};

/** A real keystroke in the note's editor: the key reaches its box, then BlockNote reports it. */
const type = async (view: ReturnType<typeof render>, index: number, doc: string, text: string) => {
    const boxes = view.container.querySelectorAll(".bn-editor-with-sidebar");
    await act(async () => {
        editorOf(doc).document = body(text);
        fireEvent.keyDown(boxes[index], { key: "a" });
        world.onChange.get(editorOf(doc))?.();
    });
};

const mount = async () => {
    const view = render(
        <CssVarsProvider>
            <Harness />
        </CssVarsProvider>
    );
    await wait(0);
    expect([...world.editors.keys()].sort()).toEqual(["my-note:5", "my-note:6", "task-note:5"]);
    return view;
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.clear();
    clearNoteCache();
    world.editors.clear();
    world.onChange.clear();
    world.replaced.length = 0;
    world.puts.length = 0;
    for (const n of [note(1, 5), note(1, 6), note(2, 5)]) upsertNoteCache(n);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("restoring one note", () => {
    it("re-seeds that note's editor and leaves the other live documents alone", async () => {
        await mount();
        remoteWrite("my-note:6", "written by a collaborator");
        remoteWrite("task-note:5", "written in the task note");

        await act(() => useNM.restoreNoteVersion(1, 5, 1));
        await wait(0);

        expect(world.replaced).toEqual([{ doc: "my-note:5", text: "restored" }]);
        expect(editorOf("my-note:6").document).toEqual(body("written by a collaborator"));
        expect(editorOf("task-note:5").document).toEqual(body("written in the task note"));
    });

    it("keeps and saves the words just typed in another note", async () => {
        const view = await mount();
        await type(view, 1, "my-note:6", "typed a moment ago");

        await act(() => useNM.restoreNoteVersion(1, 5, 1));
        await wait(5000);

        expect(editorOf("my-note:6").document).toEqual(body("typed a moment ago"));
        expect(world.puts.filter((p) => p.noteId === 6).map((p) => p.text)).toEqual([
            "typed a moment ago",
        ]);
    });

    it("reaches the note when it is restored from the Shared or Team section", async () => {
        await mount();

        await act(() => useNM.restoreNoteVersion(8, 5, 1));
        await wait(0);

        expect(world.replaced).toEqual([{ doc: "my-note:5", text: "restored" }]);
    });

    it("works again on the next restore, and for a second note", async () => {
        await mount();

        await act(() => useNM.restoreNoteVersion(1, 5, 1));
        await act(() => useNM.restoreNoteVersion(1, 6, 1));
        await act(() => useNM.restoreNoteVersion(1, 5, 1));
        await wait(0);

        expect(world.replaced.map((r) => r.doc)).toEqual(["my-note:5", "my-note:6", "my-note:5"]);
    });
});

describe("an agent write that could not reach the collab document", () => {
    it("is forced into that note's editor only", async () => {
        await mount();
        remoteWrite("my-note:6", "written by a collaborator");
        await act(async () => useNM.setCurrentMyNote(note(1, 5) as never));

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent("noteChanged", {
                    detail: {
                        note: { note_id: 5, note_type: "personal", changed_fields: ["body"] },
                    },
                })
            );
        });
        await vi.waitFor(() => expect(world.replaced.length).toBeGreaterThan(0));

        expect(world.replaced).toEqual([{ doc: "my-note:5", text: "restored" }]);
        expect(editorOf("my-note:6").document).toEqual(body("written by a collaborator"));
    });
});
