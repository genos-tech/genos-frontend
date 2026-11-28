/**
 * MIP-2611: a thread reply opens its action toolbar on a long press, as a main chat
 * message does. Both bubbles run through `useBubbleToolbar`, so both are pinned here.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageBubble } from "../features/chat/components/bubbles/MessageBubble";
import { ThreadMessageBubble } from "../features/chat/components/bubbles/ThreadMessageBubble";

vi.mock("../components/messageBody/MessageBody", () => ({
    MessageBody: () => <div data-testid="body" />,
}));
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
const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
let isMobile = true;
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => isMobile }));
// The toolbar's contents are not what is under test: a marker says it is on screen.
vi.mock("../components/ui/emoji/EmojiReaction", () => ({
    EmojiReaction: () => <div data-testid="toolbar" />,
}));
vi.mock("../features/chat/components/bubbles/BubbleMoreMenu", () => ({
    BubbleMoreMenu: () => null,
}));
vi.mock("../features/chat/components/bubbles/BubbleThreadMoreMenu", () => ({
    BubbleThreadMoreMenu: () => null,
}));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

let style: "compact" | "bubble" = "compact";
vi.mock("../hooks/common/bubbleStylePreferenceState", () => ({
    useBubbleStylePreference: () => ({ setStyle: () => {}, style }),
}));

const mouseWindow = (hasMouse: boolean) => {
    window.matchMedia = ((query: string) => ({
        matches: !hasMouse && query === "(hover: none)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
    })) as typeof window.matchMedia;
};
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
    isMobile = true;
    mouseWindow(false);
    vi.useFakeTimers();
    navigate.mockClear();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
});

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
    useCM: {
        flaggedMessages: [],
        setFlaggedMessages: vi.fn(),
        setCurrentThreadChat: vi.fn(),
    } as never,
    useTEM: {} as never,
    useUISM: {} as never,
    variant: "received" as const,
    isFocused: false as const,
    isSimpleBubble: false,
    myself,
};

const main = () => (
    <CssVarsProvider>
        <MessageBubble
            {...stores}
            chat={{ chatId: "ch", chatType: 1, chatName: "Ann", messages: [] } as never}
            message={{ ...base, messageIdWithChatId: "ch#7" } as never}
            usePM={{} as never}
            useTM={{} as never}
        />
    </CssVarsProvider>
);
const thread = () => (
    <CssVarsProvider>
        <ThreadMessageBubble
            {...stores}
            currentMessageIndex={0}
            message={{ ...base, messageIdWithChatIdAndThreadId: "ch#t#7" } as never}
            setTargetMessageIndex={vi.fn()}
            thread={{ chatId: "ch", threadId: "t", chatType: 2, messages: [] } as never}
            usePM={{} as never}
            useTM={{} as never}
        />
    </CssVarsProvider>
);

/** The element that takes the mouse; a touch starts on the text and bubbles up to its row. */
const root = () => screen.getByTestId("body").closest("[data-bubble-layout]") as HTMLElement;
const row = () => screen.getByTestId("body");
const toolbar = () => screen.queryByTestId("toolbar");
const touch = { touches: [{ clientX: 10, clientY: 10 }] };
const press = (el: HTMLElement, ms: number) => {
    fireEvent.touchStart(el, touch);
    act(() => {
        vi.advanceTimersByTime(ms);
    });
    fireEvent.touchEnd(el);
};

describe.each(["compact", "bubble"] as const)("bubble long press (%s)", (s) => {
    beforeEach(() => {
        style = s;
    });

    describe.each([
        ["MessageBubble", main],
        ["ThreadMessageBubble", thread],
    ] as const)("%s", (_n, make) => {
        it("opens the toolbar on a long press and closes it on a tap elsewhere", () => {
            render(make());
            const el = row();
            press(el, 200);
            expect(toolbar()).toBeNull();
            press(el, 600);
            expect(toolbar()).not.toBeNull();
            fireEvent.touchStart(document.body, touch);
            expect(toolbar()).toBeNull();
        });

        it("does not follow the click that ends a long press", () => {
            render(make());
            const el = row();
            press(el, 600);
            fireEvent.click(el);
            expect(navigate).not.toHaveBeenCalled();
            fireEvent.click(el);
            expect(navigate).toHaveBeenCalledTimes(1);
        });

        it("ignores the mouse-enter a phone sends on tap", () => {
            render(make());
            fireEvent.mouseEnter(root());
            expect(toolbar()).toBeNull();
        });

        it("still shows on hover in a narrow window that has a mouse", () => {
            mouseWindow(true);
            render(make());
            const el = root();
            fireEvent.mouseEnter(el);
            expect(toolbar()).not.toBeNull();
            fireEvent.mouseLeave(el);
            expect(toolbar()).toBeNull();
        });

        it("shows on hover on desktop", () => {
            isMobile = false;
            render(make());
            fireEvent.mouseEnter(root());
            expect(toolbar()).not.toBeNull();
        });
    });
});
