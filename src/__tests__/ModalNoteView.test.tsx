/**
 * ModalNoteView state-machine harness — the note "second entry point".
 *
 * A note opens two ways: the full-page workspace (via useNoteData) AND
 * this modal (a note URL clicked in a task preview / chat message /
 * agent answer, routed here by UrlLinkModal). The two paths duplicate the
 * fetch→state logic, so they can drift — which is exactly how the 403
 * "request access" affordance shipped for the workspace but not the
 * modal. This locks the modal's four outcomes:
 *
 *   forbidden (403 marker) → NoteAccessRequestPanel  (the shared-URL case)
 *   not-found / load error → "unavailable" message
 *   success                → the note surface
 *
 * The heavy note children (BlockNote editors + *NoteMain headers) are
 * stubbed; loadSpecificNote is mocked to drive each outcome. The access
 * panel is the REAL component so a rename of its copy breaks this test.
 */

import "fake-indexeddb/auto";

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalNoteView } from "../components/modals/views/ModalNoteView";
import { loadSpecificNote } from "../features/notes/common/services/loadSpecificNote";
import type {
    ChatNoteTarget,
    MyNoteTarget,
    SharedNoteTarget,
    TaskNoteTarget,
} from "../utils/parseInternalUrl";

vi.mock("../features/notes/common/services/loadSpecificNote", () => ({
    loadSpecificNote: vi.fn(),
}));

// Stub the heavy surfaces — the modal's branch logic is what's under test,
// not the editors. Each renders a testid so the success path is assertable.
vi.mock("../features/notes/my-notes/components/MyNoteMain", () => ({
    MyNoteMain: () => <div data-testid="my-note-main" />,
}));
vi.mock("../features/notes/my-notes/components/MyNoteEditorPanel", () => ({
    MyNoteEditorPanel: () => <div data-testid="my-note-editor" />,
}));
vi.mock("../features/notes/task-notes/components/TaskNoteMain", () => ({
    TaskNoteMain: () => <div data-testid="task-note-main" />,
}));
vi.mock("../features/notes/task-notes/components/TaskNoteEditorPanel", () => ({
    TaskNoteEditorPanel: () => <div data-testid="task-note-editor" />,
}));
vi.mock("../features/notes/chat-notes/components/ChatNoteMain", () => ({
    ChatNoteMain: () => <div data-testid="chat-note-main" />,
}));
vi.mock("../features/notes/chat-notes/components/ChatNoteEditorPanel", () => ({
    ChatNoteEditorPanel: () => <div data-testid="chat-note-editor" />,
}));

const mockedLoad = vi.mocked(loadSpecificNote);

const baseProps = {
    onClose: vi.fn(),
    accessToken: "token",
    myself: { teamId: "team-1", userId: "u1" },
    setMyself: vi.fn(),
    socket: { emit: vi.fn() },
    useTEM: {},
    useUISM: {},
    useCM: {},
    useTM: {},
    usePM: {},
    // Only read on the success path (`useNM.myNoteMeta.length` etc.).
    useNM: { myNoteMeta: [], taskNoteMeta: [], chatNoteMeta: [] },
    hostZIndex: 10020,
};

type NoteTarget = MyNoteTarget | SharedNoteTarget | TaskNoteTarget | ChatNoteTarget;

const renderView = (target: NoteTarget) =>
    render(
        <CssVarsProvider>
            <ModalNoteView
                {...(baseProps as unknown as React.ComponentProps<typeof ModalNoteView>)}
                target={target}
            />
        </CssVarsProvider>
    );

describe("ModalNoteView 403 → request-access (shared-URL entry point)", () => {
    beforeEach(() => mockedLoad.mockReset());

    const noteTargets: Array<[string, NoteTarget]> = [
        ["myNote", { kind: "myNote", noteId: 433 }],
        ["sharedNote", { kind: "sharedNote", noteId: 433 }],
        ["taskNote", { kind: "taskNote", projectId: 1, taskId: 2, noteId: 433 }],
        ["chatNote", { kind: "chatNote", chatType: 3, chatId: 1, threadId: 2, noteId: 433 }],
    ];

    it.each(noteTargets)(
        "shows the request-access panel on 403 for kind=%s",
        async (_name, target) => {
            mockedLoad.mockResolvedValue({ error: "forbidden" } as never);
            renderView(target);
            // The real NoteAccessRequestPanel — its CTA, not a dead end.
            expect(
                await screen.findByRole("button", { name: "Request Access" })
            ).toBeInTheDocument();
            expect(screen.queryByText("This note isn't available.")).toBeNull();
        }
    );
});

describe("ModalNoteView other outcomes", () => {
    beforeEach(() => mockedLoad.mockReset());

    it("shows the unavailable message when the note can't be loaded", async () => {
        mockedLoad.mockResolvedValue(undefined as never);
        renderView({ kind: "myNote", noteId: 433 });
        expect(await screen.findByText("This note isn't available.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Request Access" })).toBeNull();
    });

    it("renders the note surface on success (no panel, no error)", async () => {
        mockedLoad.mockResolvedValue({
            noteId: 433,
            noteType: 1,
            title: "Q3 Strategy",
            parentNoteId: null,
            tsUpdated: "2026-07-13T00:00:00Z",
        } as never);
        renderView({ kind: "myNote", noteId: 433 });
        expect(await screen.findByTestId("my-note-main")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Request Access" })).toBeNull();
        expect(screen.queryByText("This note isn't available.")).toBeNull();
    });
});
