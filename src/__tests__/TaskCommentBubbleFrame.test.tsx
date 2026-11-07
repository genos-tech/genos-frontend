// TaskCommentBubble on the shared Bubble frame (MIP-1130): both looks of the
// bubble-style preference render, the toolbar and a click on the comment stay
// separate, "Edited" is localized, and the memo boundary still holds (a parent
// re-render with the same comment must not re-render the body: MIP-904).

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCommentBubble } from "../features/tasks/components/contents/base/sub/TaskCommentBubble";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TaskCommentProps } from "../types/tasks";

let style: "compact" | "bubble" = "compact";
vi.mock("../hooks/common/useBubbleStylePreference", () => ({
    useBubbleStylePreference: () => ({ setStyle: () => {}, style }),
}));

const bodyRenders = vi.fn();
vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => {
        bodyRenders();
        return <div data-testid="message-body" />;
    },
}));
vi.mock("../components/ui/emoji/ReactionTaskCommentEmojiDisplay", () => ({
    ReactionTaskCommentEmojiDisplay: () => <div data-testid="reactions" />,
}));
vi.mock("../components/ui/emoji/TaskCommentEmojiReaction", () => ({
    TaskCommentEmojiReaction: () => <div data-testid="quick-emoji-reaction" />,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../features/tasks/components/modals/ModalDeleteTaskComment", () => ({
    ModalDeleteTaskComment: ({ open }: { open: boolean }) =>
        open ? <div data-testid="delete-confirm-open" /> : null,
}));
vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: () => <div data-testid="avatar" />,
}));

const myself = { userId: "u1", teamId: "t1" } as UserProps;
const comment = (o: Partial<TaskCommentProps> = {}): TaskCommentProps => ({
    projectId: 7,
    taskId: 42,
    senderId: "u1",
    senderName: "Me",
    commentId: 3,
    commentBody: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    tsSent: "2026-07-17T00:00:00Z",
    tsUpdated: "2026-07-17T00:00:00Z",
    isEdited: false,
    ...o,
});

const tree = (c: TaskCommentProps, extra: Record<string, unknown> = {}) => (
    <CssVarsProvider>
        <TaskCommentBubble
            comment={c}
            myself={myself}
            setEditTargetComment={vi.fn()}
            setIsInEdit={vi.fn()}
            setMyself={vi.fn()}
            socket={null}
            useCM={{} as unknown as ChatManagementState}
            useTEM={{} as unknown as TeamManagementState}
            useUISM={{} as unknown as UIStateManagementState}
            {...extra}
        />
    </CssVarsProvider>
);

describe("TaskCommentBubble on the Bubble frame", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        style = "compact";
    });

    it.each(["compact", "bubble"] as const)("renders the %s look of the preference", (s) => {
        style = s;
        const { container } = render(tree(comment()));
        expect(container.querySelector(`[data-bubble-layout="${s}"]`)).not.toBeNull();
        expect(screen.getByTestId("message-body")).toBeInTheDocument();
        expect(screen.getByTestId("reactions")).toBeInTheDocument();
    });

    it.each(["compact", "bubble"] as const)(
        "a click on the comment calls onCommentClick with its id, a click on the toolbar does not (%s)",
        (s) => {
            style = s;
            const onCommentClick = vi.fn();
            const { container } = render(tree(comment(), { onCommentClick }));
            const root = container.querySelector("[data-bubble-layout]") as HTMLElement;
            // The handlers live on the row (compact) or on the balloon inside the root.
            const surface = s === "compact" ? root : (root.lastElementChild as HTMLElement);
            fireEvent.mouseEnter(surface);
            fireEvent.click(screen.getByLabelText("More options"));
            expect(onCommentClick).not.toHaveBeenCalled();
            fireEvent.click(screen.getByTestId("message-body"));
            expect(onCommentClick).toHaveBeenCalledTimes(1);
            expect(onCommentClick).toHaveBeenCalledWith(3);
        }
    );

    it("labels an edited comment with the localized word", () => {
        render(tree(comment({ tsUpdated: "2026-07-18T00:00:00Z" })));
        expect(screen.getByText(/ Edited$/)).toBeInTheDocument();
    });

    it("does not re-render the body when a parent re-renders with the same comment", () => {
        const c = comment();
        const { rerender } = render(tree(c));
        const before = bodyRenders.mock.calls.length;
        rerender(tree(c));
        rerender(tree(c));
        expect(bodyRenders.mock.calls.length).toBe(before);
    });

    it("re-renders when the comment itself changes", () => {
        const { rerender } = render(tree(comment()));
        const before = bodyRenders.mock.calls.length;
        rerender(tree(comment({ tsUpdated: "2026-07-19T00:00:00Z" })));
        expect(bodyRenders.mock.calls.length).toBeGreaterThan(before);
    });
});
