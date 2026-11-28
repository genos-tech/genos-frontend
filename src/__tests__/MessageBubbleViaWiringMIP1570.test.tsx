/**
 * MIP-1570: both chat bubbles hand `message.viaApp` to the author line, in the compact
 * and the bubble look. `BubbleUserName` is replaced by a probe that prints what it was
 * given, so this pins the wiring only; the header's own output is in
 * MessageViaMarkMIP1570.test.tsx.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageBubble } from "../features/chat/components/bubbles/MessageBubble";
import { ThreadMessageBubble } from "../features/chat/components/bubbles/ThreadMessageBubble";

vi.mock("../components/messageBody/MessageBody", () => ({ MessageBody: () => <div /> }));
vi.mock("../features/chat/components/bubbles/BubbleUnderBar", () => ({
    BubbleUnderBar: () => null,
}));
vi.mock("../features/chat/components/bubbles/BubbleUserName", () => ({
    BubbleUserName: (p: { viaApp?: string }) => (
        <div data-testid="user-name" data-via-app={p.viaApp ?? "none"} />
    ),
}));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({ EmojiPicker: () => null }));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <div /> }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

let style: "compact" | "bubble" = "compact";
vi.mock("../hooks/common/bubbleStylePreferenceState", () => ({
    useBubbleStylePreference: () => ({ setStyle: () => {}, style }),
}));

afterEach(cleanup);

const base = {
    messageId: 7,
    content: [{ type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] }],
    numReplies: 0,
    taskId: null,
    reactions: [],
    sender: { userId: "u2", userName: "Ann", isSystemUser: false },
    tsSent: "2026-07-20T09:12:00Z",
    tsUpdated: "2026-07-20T09:12:00Z",
};
const myself = { userId: "u1", teamId: "t1" } as never;
const stores = {
    setMyself: vi.fn(),
    setEditTargetMessage: vi.fn(),
    setIsInEdit: vi.fn(),
    setTodoFromMessageBubble: vi.fn(),
    socket: null,
    useCM: { flaggedMessages: [], setFlaggedMessages: vi.fn() } as never,
    useTEM: {} as never,
    useUISM: {} as never,
    variant: "received" as const,
    isFocused: false as const,
    isSimpleBubble: false,
    myself,
};

const main = (viaApp?: string) => (
    <CssVarsProvider>
        <MessageBubble
            {...stores}
            chat={{ chatId: "ch", chatType: 1, chatName: "Ann", messages: [] } as never}
            message={{ ...base, messageIdWithChatId: "ch#7", viaApp } as never}
            usePM={{} as never}
            useTM={{} as never}
        />
    </CssVarsProvider>
);
const thread = (viaApp?: string) => (
    <CssVarsProvider>
        <ThreadMessageBubble
            {...stores}
            currentMessageIndex={0}
            message={{ ...base, messageIdWithChatIdAndThreadId: "ch#t#7", viaApp } as never}
            setTargetMessageIndex={vi.fn()}
            thread={{ chatId: "ch", threadId: "t", chatType: 3, taskId: 5, messages: [] } as never}
            usePM={{} as never}
            useTM={{} as never}
        />
    </CssVarsProvider>
);

describe.each(["compact", "bubble"] as const)("bubble wiring (%s)", (s) => {
    it.each([
        ["MessageBubble", main],
        ["ThreadMessageBubble", thread],
    ] as const)("%s passes the app family to the author line", (_n, make) => {
        style = s;
        const { unmount } = render(make("claude"));
        expect(screen.getByTestId("user-name")).toHaveAttribute("data-via-app", "claude");
        unmount();
        render(make("chatgpt"));
        expect(screen.getByTestId("user-name")).toHaveAttribute("data-via-app", "chatgpt");
    });

    it.each([
        ["MessageBubble", main],
        ["ThreadMessageBubble", thread],
    ] as const)("%s passes nothing for a person's message", (_n, make) => {
        style = s;
        render(make(undefined));
        expect(screen.getByTestId("user-name")).toHaveAttribute("data-via-app", "none");
    });
});
