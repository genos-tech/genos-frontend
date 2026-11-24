// MIP-2215: a note whose body_format is "html" is shown by HtmlNoteView in every note panel, and the
// editor (BlockNote + collab) is never mounted for it; an ordinary note, or one whose format is not
// known yet, still gets the editor.
import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatNoteEditorPanel } from "../features/notes/chat-notes/components/ChatNoteEditorPanel";
import { MyNoteEditorPanel } from "../features/notes/my-notes/components/MyNoteEditorPanel";
import { TaskNoteEditorPanel } from "../features/notes/task-notes/components/TaskNoteEditorPanel";

const note = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const editorMounts = vi.hoisted(() => ({ n: 0 }));

vi.mock("../hooks/notes/useNoteData", () => ({
    useNoteData: () => ({
        note: note.current,
        accessDenied: false,
        isLoading: false,
        error: null,
        notFound: false,
        reload: vi.fn(),
    }),
    upsertNoteCache: vi.fn(),
}));
vi.mock("../hooks/notes/useNoteEditor", () => ({
    useNoteEditor: () => ({
        body: [],
        currentMyNoteTitle: "t",
        noteBodySaved: false,
        setNoteBodyEdited: vi.fn(),
        setNoteBodySaved: vi.fn(),
        titleInputRef: { current: null },
        handleBodyChange: vi.fn(),
        handleTitleBlur: vi.fn(),
        handleTitleChange: vi.fn(),
    }),
}));
vi.mock("../hooks/notes/useChatNoteEditor", () => ({
    useChatNoteEditor: () => ({
        body: [],
        currentChatNoteTitle: "t",
        noteBodySaved: false,
        setNoteBodyEdited: vi.fn(),
        setNoteBodySaved: vi.fn(),
        titleInputRef: { current: null },
        handleBodyChange: vi.fn(),
        handleTitleBlur: vi.fn(),
        handleTitleChange: vi.fn(),
    }),
}));
vi.mock("../features/notes/common/hooks/useNoteAutoSave", () => ({
    useNoteAutoSave: () => ({
        body: [],
        currentTaskNoteTitle: "t",
        noteBodySaved: false,
        setNoteBodyEdited: vi.fn(),
        setNoteBodySaved: vi.fn(),
        setBody: vi.fn(),
        handleTitleBlur: vi.fn(),
        handleTitleChange: vi.fn(),
    }),
}));

// The editors: mounting any of them is what must not happen for a page.
vi.mock("../features/notes/common/components/NoteEditor", () => ({
    NoteEditor: () => {
        editorMounts.n += 1;
        return <div data-testid="editor" />;
    },
}));
vi.mock("../features/notes/chat-notes/components/ChatNoteEditor", () => ({
    ChatNoteEditor: () => {
        editorMounts.n += 1;
        return <div data-testid="editor" />;
    },
}));
vi.mock("../components/editors/bnTaskNoteEditor", () => ({
    BnTaskNoteEditor: () => {
        editorMounts.n += 1;
        return <div data-testid="editor" />;
    },
}));
vi.mock("../features/notes/common/components/NoteTitleField", () => ({
    NoteTitleField: () => <div />,
}));
vi.mock("../features/notes/common/components/NoteLoadState", () => ({
    NoteLoadState: () => <div data-testid="load-state" />,
}));
vi.mock("../features/notes/common/components/NoteAccessRequestPanel", () => ({
    NoteAccessRequestPanel: () => <div />,
}));
vi.mock("../features/notes/common/components/HtmlNoteView", () => ({
    HtmlNoteView: (props: { noteType: number; noteId: number; title: string }) => (
        <div
            data-note-id={props.noteId}
            data-note-type={props.noteType}
            data-testid="html-view"
            data-title={props.title}
        />
    ),
}));

const common = {
    isActive: true,
    accessToken: "tok",
    myself: { userId: "u1", teamId: "team-1" },
    setMyself: vi.fn(),
    socket: null,
    useTEM: {},
    useUISM: {},
    useCM: {},
    useNM: { noteResyncNonce: 0, tabsApi: {}, taskNoteMeta: [], chatNoteMeta: [] },
};

// The panels take wide props (whole management states) that none of these paths read.
const propsFor = <P,>(tab: { id: string; kind: string; noteId: number }) =>
    ({ ...common, tab }) as unknown as P;

const panels = [
    {
        name: "my note",
        type: 1,
        render: () => (
            <MyNoteEditorPanel
                {...propsFor<ComponentProps<typeof MyNoteEditorPanel>>({
                    id: "my-5",
                    kind: "my",
                    noteId: 5,
                })}
            />
        ),
    },
    {
        name: "task note",
        type: 2,
        render: () => (
            <TaskNoteEditorPanel
                {...propsFor<ComponentProps<typeof TaskNoteEditorPanel>>({
                    id: "task-5",
                    kind: "task",
                    noteId: 5,
                })}
            />
        ),
    },
    {
        name: "chat note",
        type: 3,
        render: () => (
            <ChatNoteEditorPanel
                {...propsFor<ComponentProps<typeof ChatNoteEditorPanel>>({
                    id: "chat-5",
                    kind: "chat",
                    noteId: 5,
                })}
            />
        ),
    },
];

afterEach(() => {
    cleanup();
    editorMounts.n = 0;
    note.current = null;
});

describe.each(panels)("$name panel", (panel) => {
    it("shows an HTML page in the viewer and never mounts the editor", () => {
        note.current = { noteId: 5, noteType: panel.type, title: "Burndown", bodyFormat: "html" };
        render(panel.render());
        const view = screen.getByTestId("html-view");
        expect(view.getAttribute("data-note-id")).toBe("5");
        expect(view.getAttribute("data-note-type")).toBe(String(panel.type));
        expect(view.getAttribute("data-title")).toBe("Burndown");
        expect(screen.queryByTestId("editor")).toBeNull();
        expect(editorMounts.n).toBe(0);
    });

    it("mounts the editor for an ordinary note", () => {
        note.current = {
            noteId: 5,
            noteType: panel.type,
            title: "Plain",
            bodyFormat: "blocknote",
        };
        render(panel.render());
        expect(screen.getByTestId("editor")).toBeTruthy();
        expect(screen.queryByTestId("html-view")).toBeNull();
    });

    it("mounts the editor when the format is not known (a note cached before the API said it)", () => {
        note.current = { noteId: 5, noteType: panel.type, title: "Old" };
        render(panel.render());
        expect(screen.getByTestId("editor")).toBeTruthy();
        expect(screen.queryByTestId("html-view")).toBeNull();
    });
});
