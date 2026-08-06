/**
 * The preview modal has to focus the message its link names.
 *
 * A `/message/:id` link opened in the preview used to land on the chat
 * with nothing highlighted: the modal filled `moveToSpecificIndex` with
 * the pre-v3 composite `{chatId}-{messageId}`, while the list keys focus
 * and scroll on the bare v3 `Message.id`. The lookup missed, and because a
 * focus target being SET is what suppresses the scroll-to-bottom
 * fallback, the pane didn't even land at the latest message.
 *
 * `moveToSpecificIndex` on the chat handed to the pane is the whole
 * contract — `MessageListRenderer.resolveFocusedState` compares it to each
 * bubble's uuid for the highlight, and `useScrollManagement` looks it up in
 * `indexMap` to scroll. So the panes are stubbed to report what they got,
 * which keeps Virtuoso out of the harness.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalChatView } from "../components/modals/views/ModalChatView";
import type { ChatManagementState } from "../hooks/chats/useChatManagement";
import type { MessageProps, ThreadMessageProps } from "../types/chat";
import type { ChatMainTarget, ChatThreadTarget } from "../utils/parseInternalUrl";

const CHANNEL = "847c8111-3c14-45d1-add0-9c36373bed8b";
const MSG_109 = "aaaaaaaa-1111-4111-8111-111111111111";
const MSG_111 = "bbbbbbbb-2222-4222-8222-222222222222";
const ROOT = "cccccccc-3333-4333-8333-333333333333";
const REPLY_3 = "dddddddd-4444-4444-8444-444444444444";

const loadMessages = vi.fn();
const loadThreadMessages = vi.fn();

vi.mock("../features/chat/services/loadV3SpecificMessages", () => ({
    loadV3SpecificMessages: (...args: unknown[]) => loadMessages(...args),
}));
vi.mock("../features/chat/services/loadV3SpecificThreadMessages", () => ({
    loadV3SpecificThreadMessages: (...args: unknown[]) => loadThreadMessages(...args),
}));

// Both panes report the focus key from the chat they were handed. The
// modal overrides `useCM.currentMainChat` / `.currentThreadChat`, which is
// where the real panes read it from too.
vi.mock("../features/chat/MainChatPane", () => ({
    MessagesPane: ({ useCM }: { useCM: ChatManagementState }) => (
        <div data-testid="main-focus">{useCM.currentMainChat?.moveToSpecificIndex ?? "none"}</div>
    ),
}));
vi.mock("../features/chat/ThreadChatPane", () => ({
    ThreadPane: ({ useCM }: { useCM: ChatManagementState }) => (
        <div data-testid="thread-focus">
            {useCM.currentThreadChat?.moveToSpecificIndex ?? "none"}
        </div>
    ),
}));
vi.mock("../features/chat/context/ChatContext", () => ({
    ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mainMessage = (seq: number, uuid: string, taskId: number | null = null): MessageProps =>
    ({
        chatId: CHANNEL as unknown as number,
        chatType: 1,
        contentText: `message ${seq}`,
        messageId: seq,
        messageIdWithChatId: uuid,
        sender: { userId: "u2", userName: "Alice" },
        taskId,
    }) as unknown as MessageProps;

const threadReply = (seq: number, uuid: string): ThreadMessageProps =>
    ({
        chatId: CHANNEL as unknown as number,
        chatType: 1,
        contentText: `reply ${seq}`,
        messageId: seq,
        messageIdWithChatIdAndThreadId: uuid,
        sender: { userId: "u2", userName: "Alice" },
        taskId: null,
    }) as unknown as ThreadMessageProps;

const summary = {
    chatId: CHANNEL,
    chatName: "Alice",
    chatType: 1,
    dmPartnerUser: { userId: "u2", userName: "Alice" },
    isPrivate: false,
    latestMessage: undefined,
    latestMessageText: "",
    profileImagePath: "",
    project: undefined,
    systemUserId: undefined,
    TSLastMessage: "",
};

const renderView = (target: ChatMainTarget | ChatThreadTarget) =>
    render(
        <ModalChatView
            accessToken="token"
            myself={{ teamId: "team-1", userId: "u1" } as never}
            setMyself={vi.fn()}
            socket={null}
            target={target}
            useCM={{ allChats: [summary] } as unknown as ChatManagementState}
            useNM={{} as never}
            usePM={{} as never}
            useTEM={{} as never}
            useTM={{} as never}
            useUISM={{} as never}
        />
    );

const mainTarget = (messageId?: number | string): ChatMainTarget => ({
    chatId: CHANNEL as unknown as number,
    chatType: 1,
    kind: "chatMain",
    messageId,
});

describe("ModalChatView — main-channel message focus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadMessages.mockResolvedValue([mainMessage(109, MSG_109), mainMessage(111, MSG_111)]);
    });

    it("focuses the message a /message/<seq> link names", async () => {
        // The reported case: .../chat/dm/<channel>/message/111 opened the
        // chat but highlighted nothing.
        renderView(mainTarget(111));

        expect((await screen.findByTestId("main-focus")).textContent).toBe(MSG_111);
    });

    it("focuses the message a /message/<uuid> link names (Spotlight chips)", async () => {
        renderView(mainTarget(MSG_109));

        expect((await screen.findByTestId("main-focus")).textContent).toBe(MSG_109);
    });

    it("leaves the focus key unset for a chat link with no message", async () => {
        renderView(mainTarget(undefined));

        expect((await screen.findByTestId("main-focus")).textContent).toBe("none");
    });

    it("leaves it unset rather than synthesizing a key for an unloaded message", async () => {
        // A key that matches nothing would strand `useScrollManagement`:
        // it would neither resolve nor fall back to the newest message.
        renderView(mainTarget(9999));

        expect((await screen.findByTestId("main-focus")).textContent).toBe("none");
    });
});

describe("ModalChatView — thread reply focus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadMessages.mockResolvedValue([mainMessage(2, ROOT)]);
        loadThreadMessages.mockResolvedValue([threadReply(2, ROOT), threadReply(3, REPLY_3)]);
    });

    const threadTarget = (messageId?: number | string): ChatThreadTarget => ({
        chatId: CHANNEL as unknown as number,
        chatType: 1,
        kind: "chatThread",
        messageId,
        threadId: ROOT as unknown as number,
    });

    it("focuses the reply a thread link names", async () => {
        renderView(threadTarget(3));

        expect((await screen.findByTestId("thread-focus")).textContent).toBe(REPLY_3);
    });

    it("falls back to the top of the thread when the link names no reply", async () => {
        renderView(threadTarget(undefined));

        expect((await screen.findByTestId("thread-focus")).textContent).toBe(ROOT);
    });
});
