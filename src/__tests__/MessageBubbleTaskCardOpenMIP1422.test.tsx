/**
 * MIP-1422: a click on a task card's BODY opens the task on the chat page.
 *
 * On the chat page a task merely SELECTED never opens the pane (a thread opening selects its
 * task). An open has to be asked for, `setIsTaskPreviewVisible(true)`. The card body's click
 * used to only select the task, and relied on the pane opening for a new selection, which is
 * exactly what MIP-1422 removed. So the click now asks, like the "Open task" controls.
 *
 * The setup mirrors `MessageBubbleRenderBudget.test.tsx`: the body, the emoji row and the menus
 * are replaced by stubs, and only the "bubble" look has a card click (compact has none).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessageBubble } from "../features/chat/components/bubbles/MessageBubble";

vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => <div data-testid="body">card</div>,
}));
vi.mock("../components/ui/emoji/EmojiReaction", () => ({ EmojiReaction: () => null }));
vi.mock("../features/chat/components/bubbles/BubbleMoreMenu", () => ({
    BubbleMoreMenu: () => null,
}));
vi.mock("../features/chat/components/bubbles/BubbleUnderBar", () => ({
    BubbleUnderBar: () => null,
}));
vi.mock("../features/chat/components/bubbles/BubbleUserName", () => ({
    BubbleUserName: () => null,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../hooks/common/useBubbleStylePreference", () => ({
    useBubbleStylePreference: () => ({ setStyle: () => {}, style: "bubble" }),
}));

const messageWith = (taskId: number | null) =>
    ({
        messageId: 7,
        messageIdWithChatId: "ch#7",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] }],
        numReplies: 0,
        taskId,
        reactions: [],
        sender: { userId: "u2", userName: "Ann", isSystemUser: false },
        tsSent: "2026-07-20T09:12:00Z",
        tsUpdated: "2026-07-20T09:12:00Z",
    }) as never;

// A DM: a PM bubble's own click also reaches `handleOpenTaskClick`, which hid the
// regression there; in a DM/GM/MDM only the card click can open the task.
const chat = {
    chatId: "ch",
    chatType: 1,
    chatName: "Ann",
    dmPartnerUser: undefined,
    messages: [],
} as never;

const fakeTM = () => ({
    setCurrentPreviewTaskId: vi.fn(),
    setIsTaskPreviewVisible: vi.fn(),
    setIsCreatingTask: vi.fn(),
});
const fakeCM = () => ({
    flaggedMessages: [],
    setFlaggedMessages: vi.fn(),
    setIsMainChatVisible: vi.fn(),
    setIsThreadVisible: vi.fn(),
});

const clickCardBody = (taskId: number | null) => {
    const useTM = fakeTM();
    const useCM = fakeCM();
    render(
        <CssVarsProvider>
            <MessageBubble
                chat={chat}
                isFocused={false}
                isSimpleBubble={false}
                message={messageWith(taskId)}
                myself={{ userId: "u1", teamId: "t1" } as never}
                setEditTargetMessage={vi.fn()}
                setIsInEdit={vi.fn()}
                setMyself={vi.fn()}
                setTodoFromMessageBubble={vi.fn()}
                socket={null}
                useCM={useCM as never}
                usePM={{} as never}
                useTEM={{} as never}
                useTM={useTM as never}
                useUISM={{} as never}
                variant="received"
            />
        </CssVarsProvider>
    );
    fireEvent.click(screen.getByTestId("body"));
    return useTM;
};

describe("MIP-1422: a task card's body click opens the task", () => {
    beforeEach(() => navigate.mockReset());

    it("asks for the pane AND selects the task (a selection alone opens nothing)", () => {
        const useTM = clickCardBody(42);
        expect(useTM.setCurrentPreviewTaskId).toHaveBeenCalledWith(42);
        expect(useTM.setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
    });

    it("a message with no task opens nothing", () => {
        const useTM = clickCardBody(null);
        expect(useTM.setIsTaskPreviewVisible).not.toHaveBeenCalled();
        expect(useTM.setCurrentPreviewTaskId).not.toHaveBeenCalled();
    });

    it("task id 0 (a thread with no task, as the activity adapter writes it) opens nothing", () => {
        const useTM = clickCardBody(0);
        expect(useTM.setIsTaskPreviewVisible).not.toHaveBeenCalled();
        expect(useTM.setCurrentPreviewTaskId).not.toHaveBeenCalled();
    });
});
