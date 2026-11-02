/**
 * The two message bubbles list their shared actions in the same order (MIP-903).
 *
 * Chat messages and thread replies are different components (the thread one is
 * not even built on `MoreMenu`), and they used to disagree: Copy link sat
 * between Remind me and Edit in one and first in the other. They now both
 * order by the shared table, and so does the pinned toolbar beside the "…".
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { orderMoreMenuItems } from "../components/ui/moreMenuOrder";
import { BubbleMoreMenu } from "../features/chat/components/bubbles/BubbleMoreMenu";
import { BubbleThreadMoreMenu } from "../features/chat/components/bubbles/BubbleThreadMoreMenu";
import {
    BubbleActionsPreferenceProvider,
    normalizePinnedBubbleActions,
    PINNABLE_BUBBLE_ACTIONS,
} from "../hooks/common/useBubbleActionsPreference";

vi.mock("../features/chat/components/modals/ModalDeleteMessage", () => ({
    ModalDeleteMessage: () => null,
}));

const message = {
    messageId: "m-1",
    messageIdWithChatId: "ch-1#m-1",
    messageIdWithChatIdAndThreadId: "ch-1#th-1#m-1",
    content: "hello",
    numReplies: 0,
    taskId: null,
    isFlagged: false,
    // The viewer's own message, so Edit and Delete are on offer too.
    sender: { userId: "u-1", userName: "Me", isSystemUser: false },
};

const renderMenu = (kind: "main" | "thread") => {
    const common = {
        accessToken: "tok",
        flaggedMessages: [],
        isSent: false,
        message: message as never,
        myself: { userId: "u-1", teamId: "t-1" } as never,
        setEditTargetMessage: vi.fn(),
        setFlaggedMessages: vi.fn(),
        setIsInEdit: vi.fn(),
        setUnwrapAll: vi.fn(),
        setUnwrapCode: vi.fn(),
        socket: null,
        unwrapAll: false,
        unwrapCode: false,
        useCM: { flaggedMessages: [] } as never,
    };

    render(
        <CssVarsProvider>
            <BubbleActionsPreferenceProvider>
                {kind === "main" ? (
                    <BubbleMoreMenu
                        {...common}
                        chat={{ chatId: "ch-1", chatType: 2 } as never}
                        replyHandler={vi.fn()}
                        setCurrentChat={vi.fn()}
                        usePM={{} as never}
                        useTM={{} as never}
                    />
                ) : (
                    <BubbleThreadMoreMenu
                        {...common}
                        currentMessageIndex={0}
                        setCurrentThreadChat={vi.fn()}
                        setTargetMessageIndex={vi.fn()}
                        thread={{ chatId: "ch-1", threadId: "th-1", chatType: 2 } as never}
                    />
                )}
            </BubbleActionsPreferenceProvider>
        </CssVarsProvider>
    );
};

/** The "…" is the last button: pinned actions render before it. */
const trigger = () => screen.getAllByRole("button").at(-1) as HTMLElement;
const pinnedButtons = () =>
    screen
        .getAllByRole("button")
        .slice(0, -1)
        .map((b) => b.getAttribute("aria-label"));
const menuLabels = () => {
    fireEvent.click(trigger());
    return screen.getAllByRole("menuitem").map((el) => el.textContent);
};

beforeEach(() => window.localStorage.clear());

const SHARED = [
    "Copy message link",
    "Flag for later",
    "Remind me…",
    "Unwrap content",
    "Edit message",
    "Delete message",
];

describe("message bubble menus", () => {
    it("list the chat message's actions in the shared order", () => {
        renderMenu("main");
        expect(menuLabels()).toEqual(["Reply in thread", ...SHARED]);
    });

    it("list the thread reply's actions in the shared order", () => {
        renderMenu("thread");
        const labels = menuLabels();
        // Unwrap code blocks only exists on thread replies; it sits with Unwrap.
        expect(labels.filter((l) => l !== "Unwrap code blocks")).toEqual(SHARED);
        expect(labels.indexOf("Unwrap code blocks")).toBe(labels.indexOf("Unwrap content") + 1);
    });

    it("agree on the order of everything they share", () => {
        renderMenu("main");
        const main = menuLabels();
        cleanup();
        renderMenu("thread");
        const thread = menuLabels();

        const inBoth = (list: (string | null)[], other: (string | null)[]) =>
            list.filter((l) => other.includes(l));
        expect(inBoth(main, thread)).toEqual(inBoth(thread, main));
        expect(inBoth(main, thread).length).toBeGreaterThan(4);
    });
});

describe("pinned bubble actions", () => {
    const pin = (...ids: string[]) =>
        window.localStorage.setItem("genos-bubble-pinned-actions-v1", JSON.stringify(ids));

    it("sit on the toolbar in the menu's order, however they were stored", () => {
        // Stored back to front, and in the order the menu used to have.
        pin("edit", "flag", "copyLink", "reply");
        renderMenu("main");
        expect(pinnedButtons()).toEqual([
            "Reply in thread",
            "Copy message link",
            "Flag for later",
            "Edit message",
        ]);
        // What is left stays in the menu, still in order.
        expect(menuLabels()).toEqual(["Remind me…", "Unwrap content", "Delete message"]);
    });

    it("do the same on a thread reply", () => {
        pin("edit", "flag", "copyLink");
        renderMenu("thread");
        expect(pinnedButtons()).toEqual(["Copy message link", "Flag for later", "Edit message"]);
    });

    it("keep working when saved in the order the menu had before", () => {
        // Same ids, so nothing a user pinned is lost; only the order they read in moves.
        expect(normalizePinnedBubbleActions(["reply", "flag", "remindMe", "copyLink"])).toEqual([
            "reply",
            "copyLink",
            "flag",
            "remindMe",
        ]);
    });

    it("are listed for choosing in the menu's order", () => {
        const asKinds = [...PINNABLE_BUBBLE_ACTIONS].reverse().map((id) => ({ id, kind: id }));
        expect(orderMoreMenuItems(asKinds).map((i) => i.id)).toEqual([...PINNABLE_BUBBLE_ACTIONS]);
    });
});
