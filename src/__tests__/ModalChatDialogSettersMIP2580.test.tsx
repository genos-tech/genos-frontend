/**
 * Nothing done inside the link-preview dialog may change what is open behind it (MIP-2580). The
 * dialog drew its chat with the PAGE's setters: deleting a reply there put the dialog's thread in
 * the page's thread pane, and "1 reply" or a click on a row moved the page.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteModalHostZIndexProvider } from "../components/modals/noteModalHostZIndex";
import { ModalChatView } from "../components/modals/views/ModalChatView";
import { MessageBubble } from "../features/chat/components/bubbles/MessageBubble";
import type { ChatManagementState } from "../hooks/chats/useChatManagement";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";

const CHANNEL = "847c8111-3c14-45d1-add0-9c36373bed8b";
const ROOT = "cccccccc-3333-4333-8333-333333333333";

const rows = [
    { messageId: 1, messageIdWithChatId: ROOT, messageIdWithChatIdAndThreadId: ROOT },
    { messageId: 2, messageIdWithChatId: "r2", messageIdWithChatIdAndThreadId: "r2" },
];
vi.mock("../features/chat/services/loadV3SpecificMessages", () => ({
    loadV3SpecificMessages: () => Promise.resolve(rows),
}));
vi.mock("../features/chat/services/loadV3SpecificThreadMessages", () => ({
    loadV3SpecificThreadMessages: () => Promise.resolve(rows),
}));
vi.mock("../features/chat/context/ChatContext", () => ({
    ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// The panes stand for what they do with the setters they are handed: drop a message, as a
// delete does, from the thread and (with an updater) from the chat.
vi.mock("../features/chat/MainChatPane", () => ({
    MessagesPane: ({ useCM }: { useCM: ChatManagementState }) => (
        <button
            type="button"
            onClick={() => {
                useCM.setCurrentMainChat((prev) =>
                    prev ? { ...prev, messages: prev.messages.slice(1) } : prev
                );
                useCM.setCurrentThreadChat(undefined);
            }}
        >
            main:{useCM.currentMainChat?.messages.length}
        </button>
    ),
}));
vi.mock("../features/chat/ThreadChatPane", () => ({
    ThreadPane: ({ useCM }: { useCM: ChatManagementState }) => (
        <button
            type="button"
            onClick={() =>
                useCM.setCurrentThreadChat({
                    ...useCM.currentThreadChat!,
                    messages: useCM.currentThreadChat!.messages.slice(1),
                })
            }
        >
            thread:{useCM.currentThreadChat?.messages.length}
        </button>
    ),
}));
vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => <div data-testid="body" />,
}));
vi.mock("../components/ui/emoji/EmojiReaction", () => ({ EmojiReaction: () => null }));
vi.mock("../features/chat/components/bubbles/BubbleMoreMenu", () => ({
    BubbleMoreMenu: () => null,
}));
vi.mock("../features/chat/components/bubbles/BubbleUnderBar", () => ({
    BubbleUnderBar: () => null,
}));
vi.mock("../features/chat/components/bubbles/BubbleUserName", () => ({
    BubbleUserName: () => <div data-testid="user-name" />,
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({
    UserAvatar: () => <div data-testid="avatar" />,
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

let style: "compact" | "bubble" = "compact";
vi.mock("../hooks/common/bubbleStylePreferenceState", () => ({
    useBubbleStylePreference: () => ({ setStyle: () => {}, style }),
}));

const message = {
    messageId: 7,
    messageIdWithChatId: "ch#7",
    content: [{ type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] }],
    numReplies: 0,
    taskId: null,
    reactions: [],
    sender: { userId: "u2", userName: "Ann", isSystemUser: false },
    tsSent: "2026-07-20T09:12:00Z",
    tsUpdated: "2026-07-20T09:12:00Z",
} as never;
const myself = { userId: "u1", teamId: "t1" } as never;
const chatOf = () =>
    ({
        chatId: "ch",
        chatType: 1,
        chatName: "Ann",
        dmPartnerUser: undefined,
        messages: [],
    }) as never;

const pageSetters = () => ({
    setCurrentMainChat: vi.fn(),
    setCurrentThreadChat: vi.fn(),
});

describe.each([
    ["chatMain", "main"],
    ["chatThread", "thread"],
] as const)("the preview dialog's %s view", (kind, pane) => {
    it("writes its own copy, never the page's chat or thread", async () => {
        const setters = pageSetters();
        render(
            <ModalChatView
                accessToken="token"
                myself={{ teamId: "t1", userId: "u1" } as never}
                setMyself={vi.fn()}
                socket={null}
                target={{ chatId: CHANNEL, chatType: 2, kind, threadId: ROOT } as never}
                useCM={{ allChats: [{ chatId: CHANNEL, chatType: 2 }], ...setters } as never}
                useNM={{} as never}
                usePM={{} as never}
                useTEM={{} as never}
                useTM={{} as never}
                useUISM={{} as never}
            />
        );

        fireEvent.click(await screen.findByText(`${pane}:2`));

        expect(screen.getByText(`${pane}:1`)).toBeInTheDocument();
        expect(setters.setCurrentMainChat).not.toHaveBeenCalled();
        expect(setters.setCurrentThreadChat).not.toHaveBeenCalled();
    });
});

describe("a chat row inside the preview dialog", () => {
    const openModalByHref = vi.fn();
    const row = (hosted: boolean) => {
        const list = (
            <UrlLinkModalProvider value={{ openModalByHref }}>
                <MessageBubble
                    chat={chatOf()}
                    isFocused={false}
                    isSimpleBubble={false}
                    message={message}
                    myself={myself}
                    setEditTargetMessage={vi.fn()}
                    setIsInEdit={vi.fn()}
                    setMyself={vi.fn()}
                    setTodoFromMessageBubble={vi.fn()}
                    socket={null}
                    // No page setter here: a call to one would throw.
                    useCM={{ flaggedMessages: [] } as never}
                    usePM={{} as never}
                    useTEM={{} as never}
                    useTM={{} as never}
                    useUISM={{} as never}
                    variant="received"
                />
            </UrlLinkModalProvider>
        );
        const { container } = render(
            <CssVarsProvider>
                {hosted ? (
                    <NoteModalHostZIndexProvider value={10020}>{list}</NoteModalHostZIndexProvider>
                ) : (
                    list
                )}
            </CssVarsProvider>
        );
        return container.querySelector("[data-bubble-layout]") as HTMLElement;
    };
    beforeEach(() => {
        vi.clearAllMocks();
        style = "compact";
    });

    it("does not navigate the page on a click", () => {
        row(true);
        act(() => screen.getByTestId("body").click());
        expect(navigate).not.toHaveBeenCalled();
    });

    it("opens its thread in the dialog", () => {
        row(true);
        fireEvent.click(screen.getByTestId("body"), { metaKey: true });
        expect(openModalByHref).toHaveBeenCalledWith(
            `/workspace/chat/dm/ch/thread/${(message as { messageIdWithChatId: string }).messageIdWithChatId}`
        );
        expect(navigate).not.toHaveBeenCalled();
    });

    it("still navigates on the page itself (the harness can see a navigation)", () => {
        row(false);
        act(() => screen.getByTestId("body").click());
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(openModalByHref).not.toHaveBeenCalled();
    });
});
