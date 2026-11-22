// An automatic comment has no sender (genos-api writes it with `sender` null). It reads
// "Genos" with the app mark, never "Deleted user" (MIP-2025). A real deleted account keeps its
// user id, so only a missing id is Genos.

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthorAvatar, AuthorName, isGenosAuthor } from "../components/ui/avatars/GenosAuthor";
import { TaskCommentBubble } from "../features/tasks/components/contents/base/sub/TaskCommentBubble";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TaskCommentProps } from "../types/tasks";

vi.mock("../hooks/common/bubbleStylePreferenceState", () => ({
    useBubbleStylePreference: () => ({ setStyle: () => {}, style: "compact" }),
}));
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
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: () => <div data-testid="user-avatar" />,
}));

const myself = { userId: "u1", teamId: "t1" } as UserProps;
const comment = (o: Partial<TaskCommentProps> = {}): TaskCommentProps => ({
    projectId: 7,
    taskId: 42,
    senderId: "u2",
    senderName: "Ada",
    commentId: 3,
    commentBody: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    tsSent: "2026-07-17T00:00:00Z",
    tsUpdated: "2026-07-17T00:00:00Z",
    isEdited: false,
    ...o,
});

const tree = (c: TaskCommentProps) => (
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
        />
    </CssVarsProvider>
);

describe("Genos as the author of an automatic comment", () => {
    it("recognises a missing id only", () => {
        expect(isGenosAuthor(null)).toBe(true);
        expect(isGenosAuthor(undefined)).toBe(true);
        expect(isGenosAuthor("")).toBe(true);
        expect(isGenosAuthor("u2")).toBe(false);
        expect(isGenosAuthor(0)).toBe(false);
    });

    it("a comment with no sender shows Genos and the app mark, not Deleted user", () => {
        render(tree(comment({ senderId: null as unknown as string, senderName: "Deleted user" })));
        expect(screen.getByText("Genos")).toBeInTheDocument();
        expect(screen.queryByText("Deleted user")).toBeNull();
        expect(screen.getByTestId("genos-author-avatar")).toBeInTheDocument();
        expect(screen.queryByTestId("user-avatar")).toBeNull();
    });

    it("a comment from a person is unchanged", () => {
        render(tree(comment()));
        expect(screen.getByText("Ada")).toBeInTheDocument();
        expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
        expect(screen.queryByTestId("genos-author-avatar")).toBeNull();
    });

    it("AuthorName and AuthorAvatar (PM mirror, activity feed) follow the same rule", () => {
        render(
            <div>
                <AuthorName fallbackName="Deleted user" userId={null} />
                <AuthorAvatar fallbackName="Deleted user" userId={null} />
            </div>
        );
        expect(screen.getByText("Genos")).toBeInTheDocument();
        expect(screen.getByTestId("genos-author-avatar")).toBeInTheDocument();
    });
});
