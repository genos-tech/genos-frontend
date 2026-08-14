// TaskCommentBubble — the hover toolbar is now just Edit + the ⋮ menu;
// copy-link / wrap toggles / delete moved into the menu (MoreMenu).
// Copy link writes `${origin}<commentLink>` and is hidden on mounts
// that don't wire routing; Delete stays own-comments-only.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCommentBubble } from "../features/tasks/components/contents/base/sub/TaskCommentBubble";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TaskCommentProps } from "../types/tasks";

// BnChatPreview transitively imports the BlockNote stack — stub it.
// The comment body renders through `MessageBody` now (light DOM path,
// BlockNote only as a fallback). Stubbed here for the same reason the
// old `BnChatPreview` mock existed: this file is about the ⋮ menu, and
// the real body pulls in auth + URL-modal context it has no use for.
vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => <div data-testid="message-body" />,
}));

// Socket-driven reaction strip and the emoji picker aren't under test.
vi.mock("../components/ui/emoji/ReactionTaskCommentEmojiDisplay", () => ({
    ReactionTaskCommentEmojiDisplay: () => <div data-testid="reactions" />,
}));
vi.mock("../components/ui/emoji/TaskCommentEmojiReaction", () => ({
    TaskCommentEmojiReaction: () => <div data-testid="quick-emoji-reaction" />,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({
    EmojiPicker: () => null,
}));

// The confirm dialog owns the socket DELETE emit; here we only assert
// the menu item opens it.
vi.mock("../features/tasks/components/modals/ModalDeleteTaskComment", () => ({
    ModalDeleteTaskComment: ({ open }: { open: boolean }) =>
        open ? <div data-testid="delete-confirm-open" /> : null,
}));

vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: () => <div data-testid="avatar" />,
}));

const myself = { userId: "u1", teamId: "t1" } as UserProps;

const makeComment = (overrides: Partial<TaskCommentProps> = {}): TaskCommentProps => ({
    projectId: 7,
    taskId: 42,
    senderId: "u1",
    senderName: "Me",
    commentId: 3,
    commentBody: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    tsSent: "2026-07-17T00:00:00Z",
    tsUpdated: "2026-07-17T00:00:00Z",
    isEdited: false,
    ...overrides,
});

const renderBubble = (comment: TaskCommentProps, props: Partial<{ commentLink: string }> = {}) =>
    render(
        <CssVarsProvider>
            <TaskCommentBubble
                comment={comment}
                myself={myself}
                setEditTargetComment={vi.fn()}
                setIsInEdit={vi.fn()}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as unknown as ChatManagementState}
                useTEM={{} as unknown as TeamManagementState}
                useUISM={{} as unknown as UIStateManagementState}
                {...props}
            />
        </CssVarsProvider>
    );

// The hover toolbar that hosts the ⋮ trigger is gated on hovering the
// bubble root, and the two message layouts gate it DIFFERENTLY:
//
//   * bubble  — always mounted, `opacity: 0` until hover. `getByLabelText`
//     finds it either way, so these tests used to pass without hovering.
//   * compact — conditionally MOUNTED on hover, so the trigger doesn't
//     exist in the DOM at all until then.
//
// Hovering first is correct for both and keeps this file independent of
// which layout is the current default (it is "compact" now — that flip is
// what surfaced the difference).
const openMoreMenu = (container: HTMLElement) => {
    const root = container.firstElementChild;
    if (root) fireEvent.mouseEnter(root);
    fireEvent.click(screen.getByLabelText("More options"));
};

describe("TaskCommentBubble — ⋮ more-options menu", () => {
    beforeEach(() => vi.clearAllMocks());

    it("copies the comment's absolute deep link", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        });

        const { container } = renderBubble(makeComment(), {
            commentLink: "/workspace/tasks/project/7/task/42/comment/3",
        });
        openMoreMenu(container);
        fireEvent.click(await screen.findByText("Copy comment link"));

        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith(
                `${window.location.origin}/workspace/tasks/project/7/task/42/comment/3`
            )
        );
    });

    it("hides copy link when the mount wires no routing", async () => {
        const { container } = renderBubble(makeComment());
        openMoreMenu(container);
        await screen.findByText("Unwrap content");
        expect(screen.queryByText("Copy comment link")).not.toBeInTheDocument();
    });

    it("opens the delete confirm from the menu on own comments only", async () => {
        const { container } = renderBubble(makeComment());
        openMoreMenu(container);
        fireEvent.click(await screen.findByText("Delete"));
        expect(screen.getByTestId("delete-confirm-open")).toBeInTheDocument();
    });

    it("offers no delete on someone else's comment", async () => {
        const { container } = renderBubble(makeComment({ senderId: "u2", senderName: "Other" }));
        openMoreMenu(container);
        await screen.findByText("Unwrap content");
        expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    });

    it("flips the wrap toggle label once toggled", async () => {
        const { container } = renderBubble(makeComment());
        openMoreMenu(container);
        fireEvent.click(await screen.findByText("Unwrap content"));
        openMoreMenu(container);
        expect(await screen.findByText("Wrap content")).toBeInTheDocument();
    });
});
