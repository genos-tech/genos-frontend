/**
 * The chat row's render budget on the shared Bubble frame (MIP-1130, MIP-904).
 *
 * A conversation mounts one `MessageBubble` per visible row, each with a
 * BlockNote-backed body, and the live-update bridge hands every row a NEW `chat`
 * object (same fields) and new state-manager objects on each arrival. So:
 *   - a parent re-render with the same message must not re-render the body;
 *   - a row at rest must not even build the emoji row and the More menu (they
 *     mount only while the hover toolbar is shown);
 *   - hovering mounts them.
 * `MessageBody`, the emoji row and the menu are replaced by counters.
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessageBubble } from "../features/chat/components/bubbles/MessageBubble";

const counts = vi.hoisted(() => ({ body: 0, emoji: 0, menu: 0 }));
vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => {
        counts.body++;
        return <div data-testid="body" />;
    },
}));
vi.mock("../components/ui/emoji/EmojiReaction", () => ({
    EmojiReaction: () => {
        counts.emoji++;
        return <div data-testid="emoji-reaction" />;
    },
}));
vi.mock("../features/chat/components/bubbles/BubbleMoreMenu", () => ({
    BubbleMoreMenu: () => {
        counts.menu++;
        return <div data-testid="more-menu" />;
    },
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
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

let style: "compact" | "bubble" = "compact";
vi.mock("../hooks/common/useBubbleStylePreference", () => ({
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

const bubble = (over: Record<string, unknown> = {}) => (
    <MessageBubble
        chat={over.chat ?? chatOf()}
        isFocused={false}
        isSimpleBubble={false}
        message={over.message ?? message}
        myself={myself}
        setEditTargetMessage={vi.fn()}
        setIsInEdit={vi.fn()}
        setMyself={vi.fn()}
        setTodoFromMessageBubble={vi.fn()}
        socket={null}
        useCM={{ flaggedMessages: [], setFlaggedMessages: vi.fn() } as never}
        usePM={{} as never}
        useTEM={{} as never}
        useTM={{} as never}
        useUISM={{} as never}
        variant="received"
        {...over}
    />
);

// The Joy provider sits at the app root and does not re-render when a chat
// updates, so it is mounted once here and only the row's PARENT re-renders
// (`update`), exactly as the list does. Re-rendering the provider itself would
// hand every `useTheme()` consumer a new theme object and re-render the row.
let update: (over: Record<string, unknown>) => void = () => {};
const Parent = () => {
    const [over, setOver] = useState<Record<string, unknown>>({});
    update = (o) => setOver(o);
    return bubble(over);
};
const mount = () =>
    render(
        <CssVarsProvider>
            <Parent />
        </CssVarsProvider>
    );

describe.each(["compact", "bubble"] as const)("MessageBubble render budget (%s)", (s) => {
    beforeEach(() => {
        counts.body = counts.emoji = counts.menu = 0;
        style = s;
    });

    it("renders on the Bubble frame in the preferred look", () => {
        const { container } = mount();
        expect(container.querySelector(`[data-bubble-layout="${s}"]`)).not.toBeNull();
        expect(screen.getByTestId("body")).toBeInTheDocument();
    });

    it("builds neither the emoji row nor the More menu while at rest", () => {
        mount();
        expect(screen.queryByTestId("emoji-reaction")).toBeNull();
        expect(screen.queryByTestId("more-menu")).toBeNull();
        expect(counts.emoji).toBe(0);
        expect(counts.menu).toBe(0);
    });

    it("mounts them while hovered and drops them on leave", () => {
        const { container } = mount();
        const root = container.querySelector("[data-bubble-layout]") as HTMLElement;
        fireEvent.mouseEnter(root);
        expect(screen.getByTestId("emoji-reaction")).toBeInTheDocument();
        expect(screen.getByTestId("more-menu")).toBeInTheDocument();
        fireEvent.mouseLeave(root);
        expect(screen.queryByTestId("more-menu")).toBeNull();
    });

    it("does not re-render the body for a new chat object with the same fields", () => {
        mount();
        const before = counts.body;
        // What the live-update bridge does on every arrival, and new state managers.
        act(() =>
            update({ chat: chatOf(), useCM: { flaggedMessages: [] } as never, useTM: {} as never })
        );
        act(() => update({ chat: chatOf() }));
        expect(counts.body).toBe(before);
    });

    it("re-renders when the message itself changes", () => {
        mount();
        const before = counts.body;
        act(() =>
            update({ message: { ...(message as object), tsUpdated: "2026-07-21T00:00:00Z" } })
        );
        expect(counts.body).toBeGreaterThan(before);
    });
});
