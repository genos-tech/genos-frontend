/**
 * Deleting a task comment is an Undo toast, not a confirm (MIP-1274).
 *
 * The contract: the comment leaves the list at once, NOTHING is sent while the
 * window is open, Undo puts it back with nothing sent, and when the window ends
 * the socket DELETE goes out once. The Flask handler cannot report a refusal (it
 * returns early and the ack fires either way), so a delete only counts as done
 * when a re-read of the comments no longer holds it; otherwise the comment comes
 * back with an error toast.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import { TaskCommentBubble } from "../features/tasks/components/contents/base/sub/TaskCommentBubble";
import { TaskCommentList } from "../features/tasks/components/contents/base/sub/TaskCommentList";
import {
    deleteTaskComment,
    deleteTaskCommentOnExit,
    taskCommentKey,
} from "../features/tasks/services/deleteTaskComment";
import { loadTaskComments } from "../features/tasks/services/loadTaskComments";
import { emitTaskTouched } from "../features/tasks/services/taskEvents";
import type { ChatManagementState } from "../hooks/chats/useChatManagement";
import type { TeamManagementState } from "../hooks/common/useTeamManagement";
import type { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { __resetUndoables, flushUndoables } from "../hooks/common/useUndoableAction";
import { en } from "../i18n/locales/en";
import type { UserProps } from "../types/admin";
import type { TaskCommentProps } from "../types/tasks";

vi.mock("../features/tasks/services/loadTaskComments", () => ({ loadTaskComments: vi.fn() }));
vi.mock("../features/tasks/services/taskEvents", async (importActual) => ({
    ...(await importActual<typeof import("../features/tasks/services/taskEvents")>()),
    emitTaskTouched: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => <div data-testid="message-body" />,
}));
vi.mock("../components/ui/emoji/ReactionTaskCommentEmojiDisplay", () => ({
    ReactionTaskCommentEmojiDisplay: () => null,
}));
vi.mock("../components/ui/emoji/TaskCommentEmojiReaction", () => ({
    TaskCommentEmojiReaction: () => null,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));
// Virtuoso measures real layout, which jsdom has none of: render every row.
vi.mock("react-virtuoso", () => ({
    Virtuoso: ({
        totalCount,
        itemContent,
    }: {
        totalCount: number;
        itemContent: (i: number) => React.ReactNode;
    }) => (
        <div>
            {Array.from({ length: totalCount }, (_, i) => (
                <div key={i}>{itemContent(i)}</div>
            ))}
        </div>
    ),
}));

const myself = { userId: "u1", teamId: "t1" } as UserProps;
const UNDO = en.common.feedback.toast.undo;

const comment = (commentId: number, text = `comment ${commentId}`): TaskCommentProps => ({
    projectId: 7,
    taskId: 42,
    senderId: "u1",
    senderName: "Me",
    commentId,
    commentBody: [{ type: "paragraph", content: [{ type: "text", text }] }],
    tsSent: "2026-07-17T00:00:00Z",
    tsUpdated: "2026-07-17T00:00:00Z",
    isEdited: false,
});

const makeSocket = (ack: (cb: (e: Error | null) => void) => void = (cb) => cb(null)) => {
    const emit = vi.fn((_event: string, _payload: unknown, cb: (e: Error | null) => void) =>
        ack(cb)
    );
    const timeout = vi.fn(() => ({ emit }));
    const socket = { connected: true, timeout } as unknown as Socket;
    return { socket, emit, timeout };
};

const renderList = (comments: TaskCommentProps[], socket: Socket | null) =>
    render(
        <CssVarsProvider>
            <MemoryRouter>
                <ToastHost />
                <TaskCommentList
                    currentProjectId={3}
                    currentProjectName="Proj"
                    currentTaskDisplayId="PRJ-42"
                    myself={myself}
                    setEditTargetComment={vi.fn()}
                    setIsInEdit={vi.fn()}
                    setMyself={vi.fn()}
                    socket={socket}
                    taskComments={comments}
                    useCM={{} as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useUISM={{} as unknown as UIStateManagementState}
                />
            </MemoryRouter>
        </CssVarsProvider>
    );

/** Hover the nth bubble (the toolbar mounts on hover), open ⋮, press Delete. */
const deleteViaMenu = async (index: number) => {
    const bubble = screen.getAllByTestId("message-body")[index].closest(".comment-row")!;
    fireEvent.mouseEnter(bubble.firstElementChild!);
    fireEvent.click(
        screen.getAllByLabelText("More options")[index] ?? screen.getByLabelText("More options")
    );
    fireEvent.click(await screen.findByText("Delete"));
};

beforeEach(() => {
    vi.mocked(loadTaskComments).mockReset().mockResolvedValue([]);
    vi.mocked(emitTaskTouched).mockReset();
});

afterEach(() => {
    cleanup();
    __resetUndoables();
    __resetToasts();
    document.getElementById("genos-toast-region")?.remove();
    document.getElementById("genos-banner-region")?.remove();
    vi.unstubAllGlobals();
});

describe("deleting a comment from the list", () => {
    it("takes it out at once with no dialog, and sends nothing while the window is open", async () => {
        const { socket, emit } = makeSocket();
        renderList([comment(1), comment(2)], socket);
        expect(screen.getAllByTestId("message-body")).toHaveLength(2);

        await deleteViaMenu(0);

        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(screen.getAllByTestId("message-body")).toHaveLength(1);
        expect(screen.getByText(en.tasks.comment.deleted)).toBeTruthy();
        expect(screen.getByRole("button", { name: UNDO })).toBeTruthy();
        expect(emit).not.toHaveBeenCalled();
    });

    it("Undo brings it back and nothing was ever sent", async () => {
        const { socket, emit } = makeSocket();
        renderList([comment(1), comment(2)], socket);
        await deleteViaMenu(0);
        fireEvent.click(screen.getByRole("button", { name: UNDO }));
        act(() => flushUndoables("navigate"));

        expect(screen.getAllByTestId("message-body")).toHaveLength(2);
        expect(emit).not.toHaveBeenCalled();
        expect(emitTaskTouched).not.toHaveBeenCalled();
    });

    it("when the window ends the socket DELETE goes out once, with the full payload", async () => {
        const { socket, emit, timeout } = makeSocket();
        renderList([comment(1), comment(2)], socket);
        await deleteViaMenu(1);
        act(() => flushUndoables("navigate"));

        await waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
        expect(timeout).toHaveBeenCalledWith(10_000);
        const [event, payload] = emit.mock.calls[0];
        expect(event).toBe("task_comment");
        expect(payload).toEqual({
            method_type: "DELETE",
            project_id: 3,
            project_name: "Proj",
            task_id: 42,
            display_id: "PRJ-42",
            comment_id: 2,
        });
        // The ack drops the comment cache for the deleter's own panes.
        await waitFor(() => expect(emitTaskTouched).toHaveBeenCalledWith(42, "comment"));
        // It stays out of the list.
        expect(screen.getAllByTestId("message-body")).toHaveLength(1);
    });

    it("a delete the server refused (the comment is still there after the ack) brings it back with an error", async () => {
        const { socket } = makeSocket();
        vi.mocked(loadTaskComments).mockResolvedValue([comment(1), comment(2)]);
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        renderList([comment(1), comment(2)], socket);
        await deleteViaMenu(0);
        act(() => flushUndoables("navigate"));

        expect(await screen.findByText(en.tasks.comment.deleteFailedRestored)).toBeTruthy();
        await waitFor(() => expect(screen.getAllByTestId("message-body")).toHaveLength(2));
        spy.mockRestore();
    });

    it("a lost socket brings the comment back with an error and sends nothing", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        renderList([comment(1)], null);
        await deleteViaMenu(0);
        act(() => flushUndoables("navigate"));

        expect(await screen.findByText(en.tasks.comment.deleteFailedRestored)).toBeTruthy();
        await waitFor(() => expect(screen.getAllByTestId("message-body")).toHaveLength(1));
        spy.mockRestore();
    });

    it("the page closing inside the window deletes through Django with a keepalive fetch", async () => {
        const { socket, emit } = makeSocket();
        const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
        vi.stubGlobal("fetch", fetchSpy);
        renderList([comment(1)], socket);
        await deleteViaMenu(0);

        window.dispatchEvent(new Event("pagehide"));

        expect(emit).not.toHaveBeenCalled();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toMatch(/\/task\/comment\/\?task_id=42&comment_id=1$/);
        expect(init).toMatchObject({ method: "DELETE", keepalive: true });
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    });
});

describe("the bubble does not own the delete", () => {
    it("hiding the row (which unmounts the bubble) does not lose the delete", async () => {
        const { socket, emit } = makeSocket();
        const view = renderList([comment(1)], socket);
        await deleteViaMenu(0);
        expect(screen.queryByTestId("message-body")).toBeNull();
        view.unmount();
        act(() => flushUndoables("navigate"));
        await waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
    });

    it("the bubble alone (no list) still just starts the toast", async () => {
        const { socket, emit } = makeSocket();
        render(
            <CssVarsProvider>
                <ToastHost />
                <TaskCommentBubble
                    comment={comment(5)}
                    myself={myself}
                    setEditTargetComment={vi.fn()}
                    setIsInEdit={vi.fn()}
                    setMyself={vi.fn()}
                    socket={socket}
                    useCM={{} as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useUISM={{} as unknown as UIStateManagementState}
                />
            </CssVarsProvider>
        );
        fireEvent.mouseEnter(screen.getByTestId("message-body").closest("div")!.parentElement!);
        fireEvent.click(screen.getByLabelText("More options"));
        fireEvent.click(await screen.findByText("Delete"));
        expect(await screen.findByText(en.tasks.comment.deleted)).toBeTruthy();
        expect(emit).not.toHaveBeenCalled();
    });
});

describe("deleteTaskComment (the commit)", () => {
    const args = (socket: Socket | null) => ({
        socket,
        myself,
        accessToken: "tok",
        taskId: 42,
        commentId: 9,
    });

    it("resolves when the ack is clean and the re-read no longer holds the comment", async () => {
        const { socket } = makeSocket();
        vi.mocked(loadTaskComments).mockResolvedValue([comment(1)]);
        await expect(deleteTaskComment(args(socket))).resolves.toBeUndefined();
    });

    it("rejects when the comment is still in the re-read (the handler returned early)", async () => {
        const { socket } = makeSocket();
        vi.mocked(loadTaskComments).mockResolvedValue([comment(9)]);
        await expect(deleteTaskComment(args(socket))).rejects.toThrow(/did not delete/);
    });

    it("rejects when the ack never comes (the emit's own timeout)", async () => {
        const { socket } = makeSocket((cb) => cb(new Error("operation has timed out")));
        await expect(deleteTaskComment(args(socket))).rejects.toThrow(/timed out/);
        expect(loadTaskComments).not.toHaveBeenCalled();
    });

    it("rejects with no socket, or one that is not connected", async () => {
        await expect(deleteTaskComment(args(null))).rejects.toThrow();
        const { socket } = makeSocket();
        (socket as unknown as { connected: boolean }).connected = false;
        await expect(deleteTaskComment(args(socket))).rejects.toThrow();
    });

    it("an acked delete whose re-read fails is taken as done (nothing to compare)", async () => {
        const { socket } = makeSocket();
        vi.mocked(loadTaskComments).mockResolvedValue(undefined);
        await expect(deleteTaskComment(args(socket))).resolves.toBeUndefined();
    });

    it("keys are per task and comment", () => {
        expect(taskCommentKey(42, 9)).toBe("task-comment:42:9");
        expect(taskCommentKey(42, 9)).not.toBe(taskCommentKey(43, 9));
    });

    it("the exit path needs a token and never throws without fetch", () => {
        vi.stubGlobal("fetch", undefined);
        expect(() => deleteTaskCommentOnExit("tok", 1, 2)).not.toThrow();
        const fetchSpy = vi.fn(() => Promise.resolve(new Response()));
        vi.stubGlobal("fetch", fetchSpy);
        deleteTaskCommentOnExit(null, 1, 2);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
