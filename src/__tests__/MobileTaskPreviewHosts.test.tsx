/**
 * The mobile chat and note pages host the task / milestone preview in the same
 * full-screen shell as the task page.
 *
 * They used to carry their own copies of the shell: Close floating over the pane
 * (so the pane started 40-48px down to stay clear of it), the pane wrapped in an
 * 8px-padded `overflow: auto` box (a second scroller around the preview's own,
 * which is what left it a short card), and a bare strip under it the height of
 * the tab bar. The preview overlay now uses `components/layout/MobileOverlay`,
 * where the preview is the only child of the overlay body.
 *
 * Only the preview overlay moved: the create-task and chat-note overlays on the
 * chat page keep their local shell, and this test pins that too.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileChatHome } from "../features/chat/MobileChatHome";
import { MobileNoteHome } from "../features/notes/MobileNoteHome";

vi.mock("../features/tasks/components/contents/TaskPreview", () => ({
    TaskPreview: () => <div data-testid="task-preview">preview</div>,
}));
vi.mock("../features/tasks/components/contents/CreateTaskForm", () => ({
    CreateTaskForm: () => <div data-testid="create-task">create</div>,
}));
vi.mock("../features/notes/common/components/NoteSidebar", () => ({
    NoteSidebar: () => <div data-testid="note-sidebar" />,
}));
vi.mock("../features/notes/common/components/NoteContentRenderer", () => ({
    NoteContentRenderer: () => <div data-testid="note-content" />,
}));
vi.mock("../features/chat/components/sidebar/ChatSidebar", () => ({
    ChatSidebar: () => <div data-testid="chat-sidebar" />,
}));
vi.mock("../features/chat/MainChatPane", () => ({ MessagesPane: () => null }));
vi.mock("../features/chat/ThreadChatPane", () => ({ ThreadPane: () => null }));
vi.mock("../features/notes/chat-notes/components/ChatNoteMain", () => ({
    ChatNoteMain: () => <div data-testid="chat-note" />,
}));

const renderInTheme = (ui: React.ReactElement) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

// The preview must be the overlay body's only content: no padded or scrolling
// box around it.
const expectBareInShell = () => {
    const preview = screen.getByTestId("task-preview");
    const body = screen.getByTestId("mobile-overlay-body");
    expect(preview.parentElement).toBe(body);
    // Close is a real header row, not a floater over the pane.
    expect(getComputedStyle(screen.getByRole("button", { name: "Close" })).position).not.toBe(
        "absolute"
    );
};

describe("MobileNoteHome task preview", () => {
    const setIsTaskVisibleInNote = vi.fn();
    const props = (visible: boolean) =>
        ({
            useTEM: {},
            socket: null,
            myself: {},
            setMyself: vi.fn(),
            useUISM: {},
            useCM: {},
            usePM: {},
            useSM: {},
            useTM: { currentPreviewTask: { id: 1 } },
            useNM: {
                tabsApi: { activeTabId: null, openTick: 0, tabs: [] },
                isTaskVisibleInNote: visible,
                currentTaskNoteChain: { chain: true },
                setIsTaskVisibleInNote,
            },
        }) as unknown as React.ComponentProps<typeof MobileNoteHome>;

    it("opens the preview bare inside the shared shell", () => {
        renderInTheme(<MobileNoteHome {...props(true)} />);
        expectBareInShell();
    });

    it("closes through the shell's Close button", () => {
        renderInTheme(<MobileNoteHome {...props(true)} />);
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(setIsTaskVisibleInNote).toHaveBeenCalledWith(false);
    });

    it("renders no overlay while the preview is not visible", () => {
        renderInTheme(<MobileNoteHome {...props(false)} />);
        expect(screen.queryByTestId("task-preview")).toBeNull();
        expect(screen.queryByTestId("mobile-overlay-body")).toBeNull();
    });
});

describe("MobileChatHome task preview", () => {
    const setIsTaskPreviewVisible = vi.fn();
    const props = (over: { preview?: boolean; creating?: boolean }) =>
        ({
            useTEM: {},
            socket: null,
            myself: {},
            setMyself: vi.fn(),
            useCM: {
                isThreadVisible: false,
                isMainChatVisible: false,
                currentThreadChat: null,
                currentMainChat: null,
                isChatNoteVisibleInChat: false,
            },
            useUISM: {},
            useNM: { chatPanelApi: { note: null, isLoading: false } },
            usePM: {},
            useSM: {},
            useTM: {
                isCreatingTask: { flag: over.creating ?? false },
                isTaskPreviewVisible: true,
                currentPreviewTask: { id: 1 },
                currentPreviewKind: "task",
                setIsTaskPreviewVisible,
                setIsCreatingTask: vi.fn(),
            },
            chatRouting: { parseCurrentRoute: () => ({}) },
            currentMainChatId: -1,
            currentThreadChatId: -1,
            currentWindowHeight: 800,
            mainChatPanelSize: 50,
            incompleteTodoCount: 0,
            isToDoVisible: false,
            setIsToDoVisible: vi.fn(),
            useTG: {},
            setTodoFromMessageBubble: vi.fn(),
            isActiveRoute: true,
            isTaskPreviewVisibleHere: over.preview ?? true,
        }) as unknown as React.ComponentProps<typeof MobileChatHome>;

    it("opens the preview bare inside the shared shell", () => {
        renderInTheme(<MobileChatHome {...props({})} />);
        expectBareInShell();
    });

    it("closes through the shell's Close button", () => {
        renderInTheme(<MobileChatHome {...props({})} />);
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(setIsTaskPreviewVisible).toHaveBeenCalledWith(false);
    });

    it("renders no preview overlay when the preview belongs to another page", () => {
        renderInTheme(<MobileChatHome {...props({ preview: false })} />);
        expect(screen.queryByTestId("task-preview")).toBeNull();
    });

    it("leaves the create-task overlay on its own shell, padded and scrolling as before", () => {
        renderInTheme(<MobileChatHome {...props({ preview: false, creating: true })} />);
        const form = screen.getByTestId("create-task");
        // Not the shared shell (no overlay body), and still wrapped.
        expect(screen.queryByTestId("mobile-overlay-body")).toBeNull();
        expect(form.parentElement).not.toBeNull();
        expect(getComputedStyle(form.parentElement as HTMLElement).overflow).toBe("auto");
    });
});
