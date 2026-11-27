/**
 * MIP-2475: one note mounted twice in one browser tab (a notes-home tab and a link popup) is two
 * Y.Docs that hear of each other only through the collab server. Restoring it made BOTH replace
 * the document, and Yjs merged the two edits into doubled text.
 *
 * The real `useNoteManagement`, note panel and `GenosNoteEditor` run, each editor a real BlockNote
 * editor bound to its own real Y.Doc. The collab server is the test: it merges the docs only
 * AFTER the restore, as the real one answers later than both effects run.
 */
import { useState, type ReactNode } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { withCollaboration } from "@blocknote/core/yjs";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import { MyNoteEditorPanel } from "../features/notes/my-notes/components/MyNoteEditorPanel";
import { clearNoteCache, upsertNoteCache, type ResolvedNote } from "../hooks/notes/useNoteData";
import { NoteManagementState, useNoteManagement } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";

type Mounted = { editor: BlockNoteEditor; doc: Y.Doc };

const world = vi.hoisted(() => ({ mounted: [] as unknown[] }));

const paragraph = (text: string) => [{ id: "p1", type: "paragraph" as const, content: text }];

vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: () => ({
        get: async () => ({ data: [] }),
        post: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
    }),
}));
// What the server holds after the restore.
vi.mock("../features/notes/common/services/loadSpecificNote", () => ({
    loadSpecificNote: async (_me: unknown, noteType: number, noteId: number) => ({
        noteType,
        noteId,
        title: "Note",
        body: [{ id: "p1", type: "paragraph", content: "restored words" }],
        bodyFormat: "blocknote",
        tsUpdated: "2026-11-28T10:00:00Z",
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

vi.mock("../components/editors/genos/useGenosEditor", () => ({
    useGenosCollabEditor: () => {
        const [made] = useState(() => {
            const doc = new Y.Doc();
            const provider = { document: doc, awareness: new Awareness(doc) };
            const editor = BlockNoteEditor.create(
                withCollaboration({
                    collaboration: {
                        provider,
                        fragment: doc.getXmlFragment("document-store"),
                        user: { name: "me", color: "#000000" },
                    },
                })
            ) as unknown as BlockNoteEditor;
            editor.mount(document.body.appendChild(document.createElement("div")));
            world.mounted.push({ editor, doc });
            return { editor, provider };
        });
        return { ...made, threadStore: null, collabScope: null };
    },
}));
vi.mock("@blocknote/mantine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@blocknote/mantine")>()),
    BlockNoteView: (props: { children: ReactNode }) => <div>{props.children}</div>,
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
        tab: { id: "my-5", kind: "my", noteId: 5 } as never,
    };
    return (
        <>
            <MyNoteEditorPanel {...props} isActive />
            <MyNoteEditorPanel {...props} isActive />
        </>
    );
};

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const editors = () => world.mounted as Mounted[];
const textOf = ({ editor }: Mounted) =>
    editor.document
        .map((b) => (b.content as { text: string }[]).map((c) => c.text).join(""))
        .join("\n")
        .trim();

/** What the collab server does: every doc gets what the others hold. */
const sync = () =>
    act(async () => {
        for (const from of editors())
            for (const to of editors())
                if (from !== to) Y.applyUpdate(to.doc, Y.encodeStateAsUpdate(from.doc));
        await vi.advanceTimersByTimeAsync(0);
    });

const mount = async () => {
    render(
        <CssVarsProvider>
            <Harness />
        </CssVarsProvider>
    );
    await wait(0);
    expect(editors()).toHaveLength(2);
    await act(async () => {
        editors()[0].editor.replaceBlocks(editors()[0].editor.document, paragraph("as opened"));
    });
    await sync();
    expect(editors().map(textOf)).toEqual(["as opened", "as opened"]);
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.clear();
    clearNoteCache();
    world.mounted.length = 0;
    upsertNoteCache({
        noteType: 1,
        noteId: 5,
        title: "Note",
        body: paragraph("as opened"),
        bodyFormat: "blocknote",
    } as unknown as ResolvedNote);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("restoring a note that is mounted twice", () => {
    it("leaves one copy of the restored content in both editors, before and after they sync", async () => {
        await mount();

        await act(() => useNM.restoreNoteVersion(1, 5, 1));
        await wait(0);
        expect(editors().map(textOf)).toEqual(["restored words", "restored words"]);

        await sync();
        expect(editors().map(textOf)).toEqual(["restored words", "restored words"]);
    });

    it("still replaces what was written since, on the next restore", async () => {
        await mount();
        await act(() => useNM.restoreNoteVersion(1, 5, 1));
        await wait(0);
        await act(async () => {
            editors()[1].editor.replaceBlocks(
                editors()[1].editor.document,
                paragraph("written since")
            );
        });
        await sync();

        await act(() => useNM.restoreNoteVersion(1, 5, 1));
        await wait(0);
        await sync();

        expect(editors().map(textOf)).toEqual(["restored words", "restored words"]);
    });
});
