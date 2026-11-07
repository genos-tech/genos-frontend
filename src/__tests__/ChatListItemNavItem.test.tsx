/**
 * MIP-1127: the chat row is a two-line NavItem.
 *
 * Pinned here: selection is the shared tint (no brand gradient), the unread
 * bar and dot, the click goes through the LIVE handler ref, the row's actions
 * are beside the row button and not inside it, a pinned chat keeps its pin,
 * and the hover-prefetch timer from the chat-switch work is intact (delayed,
 * cancelled when the pointer leaves). The avatar, title, actions menu and
 * modals are stubbed: they are covered by their own tests.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { ChatListItem } from "../features/chat/components/sidebar/chatListItem";
import type { ChatListItemProps } from "../features/chat/components/sidebar/ChatListItem.types";
import type { AllChatProps } from "../types/chat";

const onClickHandler = vi.fn();
const prefetchChannel = vi.fn();

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../services/channel/channelPrefetch", () => ({
    prefetchChannel: (id: string) => prefetchChannel(id),
}));
vi.mock("../features/chat/hooks/useChatListItem", () => ({
    useChatListItem: ({ isPinnedChat }: { isPinnedChat: boolean }) => ({
        isPinned: isPinnedChat,
        setIsPinned: vi.fn(),
        isYou: false,
        onClickHandler,
        splitOpenHandler: vi.fn(),
        pinChatHandler: vi.fn(),
    }),
}));
vi.mock("../features/chat/components/sidebar/ChatListItemAvatar", () => ({
    ChatListItemAvatar: () => <span data-testid="avatar" />,
}));
vi.mock("../features/chat/components/sidebar/ChatListItemTitle", () => ({
    ChatListItemTitle: ({ chat }: { chat: AllChatProps }) => <span>{chat.chatName}</span>,
}));
vi.mock("../features/chat/components/sidebar/ChatListItemActions", () => ({
    ChatListItemActions: () => (
        <button aria-label="Pin chat" type="button">
            pin
        </button>
    ),
    ChatListItemMeta: ({ chat }: { chat: AllChatProps }) => (
        <span data-testid="meta">{chat.latestMessage ? "time" : ""}</span>
    ),
}));
vi.mock("../features/chat/components/modals/ModalAddMembers", () => ({
    ModalAddMembers: () => null,
}));
vi.mock("../features/chat/components/modals/ModalAssignGMTags", () => ({
    ModalAssignGMTags: () => null,
}));

const chat = (over: Partial<AllChatProps> = {}): AllChatProps =>
    ({
        chatId: "c1",
        chatType: 1,
        chatName: "Ada",
        isPinned: false,
        isPrivate: false,
        lastReadMessageId: "10",
        latestMessageText: "hello there",
        latestMessage: { messageId: 10, tsSent: "2026-07-20 10:00:00" },
        dmPartnerUser: { userId: "u2", userName: "Ada" },
        ...over,
    }) as unknown as AllChatProps;

const live = { current: { tag: "live" } };

const mount = (over: Partial<ChatListItemProps> = {}, c: AllChatProps = chat()) =>
    render(
        <CssVarsProvider>
            <ChatListItem
                chat={c}
                incompleteTodoCount={0}
                isPinnedChat={false}
                isToDoVisible={false}
                liveRef={live as unknown as ChatListItemProps["liveRef"]}
                myself={{ userId: "u1", customStatus: "" } as ChatListItemProps["myself"]}
                selected={false}
                setIsToDoVisible={vi.fn()}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as ChatListItemProps["useCM"]}
                useTEM={{} as ChatListItemProps["useTEM"]}
                useTM={{} as ChatListItemProps["useTM"]}
                useUISM={{} as ChatListItemProps["useUISM"]}
                {...over}
            />
        </CssVarsProvider>
    );

const row = () => button().parentElement as HTMLElement;
const button = () => screen.getByText("Ada").closest('[role="button"]') as HTMLElement;

beforeEach(() => {
    onClickHandler.mockClear();
    prefetchChannel.mockClear();
});
afterEach(cleanup);

describe("ChatListItem on NavItem", () => {
    it("is a two-line row: the documented multiple of the density row", () => {
        mount();
        expect(cssOf(row())).toContain("min-height: calc(var(--g-row) * 1.5)");
    });

    it("selected is the shared accent tint, with no brand gradient or literal colour", () => {
        mount({ selected: true });
        expect(row().getAttribute("data-selected")).toBe("true");
        expect(button().getAttribute("aria-current")).toBe("true");
        const css = cssOf(row());
        expect(css).toContain("var(--g-accent-subtle)");
        expect(css).not.toMatch(/gradient|--gp-brand|rgba?\(\s*\d/);
    });

    it("shows the unread bar when the latest message is newer than the read cursor", () => {
        const { container } = mount({}, chat({ lastReadMessageId: "3" }));
        expect(container.querySelector(".NavItem-unread")).not.toBeNull();
        cleanup();
        const read = mount();
        expect(read.container.querySelector(".NavItem-unread")).toBeNull();
    });

    it("clicking goes through the LIVE ref, not the possibly stale captured props", () => {
        mount();
        fireEvent.click(button());
        expect(onClickHandler).toHaveBeenCalledWith(live.current);
    });

    it("keeps the actions beside the row button, never inside it", () => {
        mount();
        const pin = screen.getByRole("button", { name: "Pin chat" });
        expect(button().contains(pin)).toBe(false);
        expect(row().contains(pin)).toBe(true);
    });

    it("the time and unread dot live in the always-visible trailing slot", () => {
        mount();
        expect(button().contains(screen.getByTestId("meta"))).toBe(true);
    });

    describe("hover prefetch (chat-switch perf work)", () => {
        it("moving from the row button onto its actions does not cancel the prefetch", () => {
            vi.useFakeTimers();
            mount();
            fireEvent.mouseEnter(row());
            // Pointer slides from the button to the pin beside it: still the row.
            fireEvent.mouseOver(screen.getByRole("button", { name: "Pin chat" }));
            act(() => {
                vi.advanceTimersByTime(130);
            });
            expect(prefetchChannel).toHaveBeenCalledWith("c1");
            vi.useRealTimers();
        });

        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it("warms the channel only once the hover has persisted", () => {
            mount();
            fireEvent.mouseEnter(row());
            expect(prefetchChannel).not.toHaveBeenCalled();
            act(() => {
                vi.advanceTimersByTime(130);
            });
            expect(prefetchChannel).toHaveBeenCalledWith("c1");
        });

        it("sweeping the cursor across the row does not prefetch", () => {
            mount();
            fireEvent.mouseEnter(row());
            fireEvent.mouseLeave(row());
            act(() => {
                vi.advanceTimersByTime(500);
            });
            expect(prefetchChannel).not.toHaveBeenCalled();
        });
    });
});
