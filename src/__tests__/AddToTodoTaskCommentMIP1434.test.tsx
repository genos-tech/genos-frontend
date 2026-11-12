/**
 * "Add to To-Do" on a task comment, from any page (MIP-1434, part A).
 *
 *   - the comment's "…" menu has Add to To-Do (same label, glyph and rule as a chat message) and
 *     it can be pinned to the toolbar, like the chat actions;
 *   - the request goes through the store, so a bubble on the TASK page (which passes no handler)
 *     can make one; a host that threads its own handler keeps using it;
 *   - the double-click setting makes the same request;
 *   - `AddToTodoHost` (mounted once in App) makes the to-do, refreshes the list and says so.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import { AddToTodoHost } from "../features/chat/components/todo/AddToTodoHost";
/** Shows what is waiting in the store, for the tests that do not mount the host. */ import {
    setTodoFromMessageBubble,
    useTodoFromMessageBubble,
} from "../features/chat/components/todo/addToTodoStore";
import { appendTodoFromMessage } from "../features/chat/components/todo/services/appendTodoFromMessage";
import { TaskCommentBubble } from "../features/tasks/components/contents/base/sub/TaskCommentBubble";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { BubbleActionsPreferenceProvider } from "../hooks/common/useBubbleActionsPreference";
import { DoubleClickTodoPreferenceProvider } from "../hooks/common/useDoubleClickTodoPreference";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { __resetUndoables } from "../hooks/common/useUndoableAction";
import { en } from "../i18n/locales/en";
import { UserProps } from "../types/admin";
import { TaskCommentProps } from "../types/tasks";

vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => <div data-testid="message-body" />,
}));
vi.mock("../components/ui/emoji/ReactionTaskCommentEmojiDisplay", () => ({
    ReactionTaskCommentEmojiDisplay: () => <div />,
}));
vi.mock("../components/ui/emoji/TaskCommentEmojiReaction", () => ({
    TaskCommentEmojiReaction: () => <div />,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <div /> }));
vi.mock("../features/chat/components/todo/services/appendTodoFromMessage", () => ({
    appendTodoFromMessage: vi.fn(),
}));

const ADD_TO_TODO = en.chat.messageActions.addToTodo;
const myself = { userId: "u1", teamId: "t1" } as UserProps;

const comment = (over: Partial<TaskCommentProps> = {}): TaskCommentProps => ({
    projectId: 7,
    taskId: 42,
    senderId: "u2",
    senderName: "Other",
    commentId: 3,
    commentBody: [{ type: "paragraph", content: [{ type: "text", text: "please do it" }] }],
    tsSent: "2026-07-17T00:00:00Z",
    tsUpdated: "2026-07-17T00:00:00Z",
    isEdited: false,
    ...over,
});

const unsubscribe: Array<() => void> = [];

const renderBubble = (
    c: TaskCommentProps,
    props: Partial<{ currentProjectId: number; setTodoFromMessageBubble: (c: never) => void }> = {}
) =>
    render(
        <CssVarsProvider>
            <BubbleActionsPreferenceProvider>
                <DoubleClickTodoPreferenceProvider>
                    <TaskCommentBubble
                        comment={c}
                        currentProjectId={7}
                        myself={myself}
                        setEditTargetComment={vi.fn()}
                        setIsInEdit={vi.fn()}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{} as unknown as ChatManagementState}
                        useTEM={{} as unknown as TeamManagementState}
                        useUISM={{} as unknown as UIStateManagementState}
                        {...(props as object)}
                    />
                </DoubleClickTodoPreferenceProvider>
            </BubbleActionsPreferenceProvider>
        </CssVarsProvider>
    );

const hover = (container: HTMLElement) => {
    const root = container.firstElementChild;
    if (root) fireEvent.mouseEnter(root);
};
const menuLabels = (container: HTMLElement) => {
    hover(container);
    fireEvent.click(screen.getByLabelText("More options"));
    return screen.getAllByRole("menuitem").map((el) => el.textContent);
};

beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(appendTodoFromMessage).mockReset();
});
afterEach(() => {
    cleanup();
    unsubscribe.splice(0).forEach((u) => u());
    setTodoFromMessageBubble(null);
    __resetUndoables();
    __resetToasts();
    document.getElementById("genos-toast-region")?.remove();
});

describe("the task comment's … menu", () => {
    it("offers Add to To-Do", () => {
        const { container } = renderBubble(comment());
        expect(menuLabels(container)).toContain(ADD_TO_TODO);
    });

    it("sets it apart with a rule, and gives it the To-Do list's glyph, not the flag's", () => {
        // With Copy link above it: a rule is never drawn above the first item.
        const { container } = renderBubble(comment(), { commentLink: "/x" } as never);
        hover(container);
        fireEvent.click(screen.getByLabelText("More options"));
        const item = screen.getAllByRole("menuitem").find((el) => el.textContent === ADD_TO_TODO)!;
        expect(item.previousElementSibling?.getAttribute("role")).toBe("separator");
        expect(item.querySelector('[data-testid="ChecklistRoundedIcon"]')).not.toBeNull();
        expect(item.querySelector('[data-testid="FlagRoundedIcon"]')).toBeNull();
    });

    it("asks the store for a to-do from this comment, with the project", () => {
        // The store is a module-level value: read it the way the host does.
        const seen: unknown[] = [];
        const { container } = renderBubble(comment({ projectId: null }), { currentProjectId: 7 });
        hover(container);
        fireEvent.click(screen.getByLabelText("More options"));
        const item = screen.getAllByRole("menuitem").find((el) => el.textContent === ADD_TO_TODO)!;
        render(<Probe onSeen={(v) => seen.push(v)} />);
        fireEvent.click(item);
        expect(seen.at(-1)).toMatchObject({ commentId: 3, taskId: 42, projectId: 7 });
    });

    it("uses the handler a host threads in, and not the store", () => {
        const handler = vi.fn();
        const seen: unknown[] = [];
        render(<Probe onSeen={(v) => seen.push(v)} />);
        const { container } = renderBubble(comment(), { setTodoFromMessageBubble: handler });
        hover(container);
        fireEvent.click(screen.getAllByLabelText("More options").at(-1)!);
        fireEvent.click(
            screen.getAllByRole("menuitem").find((el) => el.textContent === ADD_TO_TODO)!
        );
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({ commentId: 3, projectId: 7 })
        );
        expect(seen.at(-1)).toBeNull();
    });

    it("is not offered for a comment whose project is unknown", () => {
        const { container } = renderBubble(comment({ projectId: null }), {
            currentProjectId: undefined as never,
        });
        expect(menuLabels(container)).not.toContain(ADD_TO_TODO);
    });

    it("can be pinned to the toolbar, and then leaves the menu", () => {
        window.localStorage.setItem(
            "genos-bubble-pinned-actions-v1",
            JSON.stringify(["addToTodo"])
        );
        const { container } = renderBubble(comment());
        hover(container);
        expect(screen.getByRole("button", { name: ADD_TO_TODO })).toBeTruthy();
        fireEvent.click(screen.getByLabelText("More options"));
        expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).not.toContain(
            ADD_TO_TODO
        );
    });

    it("pins apply here too: a pinned Copy link moves out of the menu", () => {
        window.localStorage.setItem(
            "genos-bubble-pinned-actions-v1",
            JSON.stringify(["copyLink"])
        );
        const { container } = renderBubble(comment(), { commentLink: "/x" } as never);
        hover(container);
        expect(screen.getByRole("button", { name: "Copy comment link" })).toBeTruthy();
        fireEvent.click(screen.getByLabelText("More options"));
        expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).not.toContain(
            "Copy comment link"
        );
    });
});

describe("double-click", () => {
    it("makes the request from the task page (no handler threaded) when the setting is on", () => {
        window.localStorage.setItem(
            "genos-double-click-todo-preference:v1",
            JSON.stringify({ enabled: true })
        );
        const seen: unknown[] = [];
        render(<Probe onSeen={(v) => seen.push(v)} />);
        const { container } = renderBubble(comment());
        fireEvent.doubleClick(
            container.firstElementChild!.querySelector("[data-testid]") ??
                container.firstElementChild!
        );
        expect(seen.at(-1)).toMatchObject({ commentId: 3, projectId: 7 });
    });

    it("does nothing when the setting is off, while the menu item still works", () => {
        window.localStorage.setItem(
            "genos-double-click-todo-preference:v1",
            JSON.stringify({ enabled: false })
        );
        const seen: unknown[] = [];
        render(<Probe onSeen={(v) => seen.push(v)} />);
        const { container } = renderBubble(comment());
        fireEvent.doubleClick(container.firstElementChild!);
        expect(seen.at(-1)).toBeFalsy();
        expect(menuLabels(container)).toContain(ADD_TO_TODO);
    });
});

describe("AddToTodoHost", () => {
    const refresh = vi.fn(async () => {});
    const host = (extra: Partial<Parameters<typeof AddToTodoHost>[0]> = {}) =>
        render(
            <CssVarsProvider>
                <ToastHost />
                <AddToTodoHost
                    accessToken="tok"
                    allChats={[]}
                    myself={myself}
                    useTG={{ refresh }}
                    {...extra}
                />
            </CssVarsProvider>
        );

    beforeEach(() => refresh.mockClear());

    it("makes the to-do from a task comment, refreshes the list and says so", async () => {
        vi.mocked(appendTodoFromMessage).mockResolvedValue({ itemId: 1 } as never);
        host();
        act(() => setTodoFromMessageBubble(comment()));
        await waitFor(() => expect(appendTodoFromMessage).toHaveBeenCalledTimes(1));
        expect(vi.mocked(appendTodoFromMessage).mock.calls[0][2]).toMatchObject({
            taskComment: { projectId: 7, taskId: 42, commentId: 3 },
            messageText: "please do it",
        });
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(document.body.textContent).toContain(en.chat.feedback.todoAddedFromMessage)
        );
    });

    it("says nothing and refreshes nothing when no to-do was made", async () => {
        vi.mocked(appendTodoFromMessage).mockResolvedValue(undefined);
        host();
        act(() => setTodoFromMessageBubble(comment()));
        await waitFor(() => expect(appendTodoFromMessage).toHaveBeenCalledTimes(1));
        await Promise.resolve();
        expect(refresh).not.toHaveBeenCalled();
        expect(document.body.textContent).not.toContain(en.chat.feedback.todoAddedFromMessage);
    });

    it("ignores a comment with no project", async () => {
        host();
        act(() => setTodoFromMessageBubble(comment({ projectId: null })));
        await Promise.resolve();
        expect(appendTodoFromMessage).not.toHaveBeenCalled();
    });

    it("handles the same message asked for twice", async () => {
        vi.mocked(appendTodoFromMessage).mockResolvedValue({ itemId: 1 } as never);
        host();
        // The very same object twice (a double-click on one bubble): the request is cleared
        // once handled, or the second would look like no change and be swallowed.
        const same = comment();
        act(() => setTodoFromMessageBubble(same));
        await waitFor(() => expect(appendTodoFromMessage).toHaveBeenCalledTimes(1));
        act(() => setTodoFromMessageBubble(same));
        await waitFor(() => expect(appendTodoFromMessage).toHaveBeenCalledTimes(2));
    });
});

function Probe({ onSeen }: { onSeen: (v: unknown) => void }) {
    const v = useTodoFromMessageBubble();
    onSeen(v);
    return null;
}
