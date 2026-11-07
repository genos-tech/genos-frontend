/**
 * MIP-1127: what a chat row's action cluster keeps showing.
 *
 * The cluster sits in NavItem's `actions` slot, whose children fade in on
 * hover. State must not fade: a pinned chat's pin and the open to-do count on
 * your own DM row. The "..." menu and an unpinned pin are plain actions.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NavItem } from "../components/ui/nav/NavItem";
import { ChatListItemActions } from "../features/chat/components/sidebar/ChatListItemActions";
import type { UserProps } from "../types/admin";
import type { AllChatProps } from "../types/chat";

afterEach(cleanup);

const mount = ({ pinned = false, todos = 0 }: { pinned?: boolean; todos?: number }) => {
    const chat = {
        chatId: "c1",
        chatType: 1,
        isPinned: pinned,
        dmPartnerUser: { userId: "u1" },
    } as unknown as AllChatProps;
    return render(
        <CssVarsProvider>
            <NavItem
                as="div"
                label="Me"
                actions={
                    <ChatListItemActions
                        chat={chat}
                        incompleteTodoCount={todos}
                        isPinned={pinned}
                        isToDoVisible={false}
                        myself={{ userId: "u1", customStatus: "" } as UserProps}
                        setIsToDoVisible={vi.fn()}
                        onPinClick={vi.fn()}
                        onSplitClick={vi.fn()}
                    />
                }
            />
        </CssVarsProvider>
    );
};

const slot = (c: HTMLElement) => c.querySelector(".NavItem-actions") as HTMLElement;
const kept = (c: HTMLElement) => slot(c).querySelectorAll(":scope > .NavItem-keep").length;

describe("chat row actions", () => {
    it("fade when there is no state to show", () => {
        const { container } = mount({});
        expect(kept(container)).toBe(0);
        // To-do, pin and the menu are all direct children of the slot.
        expect(slot(container).children.length).toBeGreaterThanOrEqual(3);
    });

    it("a pinned chat keeps its pin and nothing else", () => {
        const { container } = mount({ pinned: true });
        expect(kept(container)).toBe(1);
        expect(slot(container).querySelector(":scope > .NavItem-keep svg")).not.toBeNull();
    });

    it("open to-dos keep their count showing", () => {
        const { container } = mount({ todos: 3 });
        expect(kept(container)).toBe(1);
        expect(slot(container).textContent).toContain("3");
    });
});
