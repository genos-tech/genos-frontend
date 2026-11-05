/**
 * A dialog opened from a bubble's More menu must outlive the hover that
 * summoned the menu.
 *
 * Both bubble toolbars are mounted on hover and unmounted on mouse-out, so
 * everything rendered inside them — the More menu AND the dialogs below it —
 * dies with the hover. The parent's escape hatch is `onMenuOpenChange`: while
 * it reports `true`, the toolbar stays mounted after the cursor leaves. The
 * menus used to forward the MENU's open state, which goes false the instant an
 * item is clicked, leaving an open dialog with nothing holding it up. The
 * reminder dialog made it visible in production: its `datetime-local` field
 * opens the browser's own date picker OUTSIDE the bubble, so moving the mouse
 * towards a date tore the whole dialog away before it could be clicked.
 *
 * Two invariants keep it fixed, one per test below.
 */

import fs from "node:fs";
import path from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BubbleMoreMenu } from "../features/chat/components/bubbles/BubbleMoreMenu";
import { BubbleThreadMoreMenu } from "../features/chat/components/bubbles/BubbleThreadMoreMenu";
import { BubbleActionsPreferenceProvider } from "../hooks/common/useBubbleActionsPreference";

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
    sender: { userId: "u-2", userName: "Alice", isSystemUser: false },
};

const myself = { userId: "u-1", teamId: "t-1" };

/** Mounts one of the two menus; `pinned` is what the user ticked in Settings. */
const renderMenu = (kind: "main" | "thread", extra: { sender?: string } = {}) => {
    const onMenuOpenChange = vi.fn();
    const common = {
        accessToken: "tok",
        flaggedMessages: [],
        isSent: false,
        message: {
            ...message,
            sender: { ...message.sender, userId: extra.sender ?? message.sender.userId },
        } as never,
        myself: myself as never,
        setEditTargetMessage: vi.fn(),
        setFlaggedMessages: vi.fn(),
        setIsInEdit: vi.fn(),
        setUnwrapAll: vi.fn(),
        setUnwrapCode: vi.fn(),
        socket: null,
        unwrapAll: false,
        unwrapCode: false,
        useCM: { flaggedMessages: [] } as never,
        onMenuOpenChange,
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
    return onMenuOpenChange;
};

beforeEach(() => window.localStorage.clear());

/** Opens the menu, clicks "Remind me", and returns the lock reports so far. */
const openReminderDialogFrom = (kind: "main" | "thread") => {
    const onMenuOpenChange = renderMenu(kind);
    // The trigger is the only button on screen until the menu opens.
    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByText(/^Remind me/i));
    return onMenuOpenChange;
};

describe.each(["main", "thread"] as const)("%s bubble More menu", (kind) => {
    it("still holds the toolbar open after the menu closes behind the dialog", () => {
        const onMenuOpenChange = openReminderDialogFrom(kind);

        // The menu itself is gone (clicking an item closes it) — but the
        // reminder dialog it opened is on screen, so the last thing the
        // parent heard must keep the toolbar mounted.
        expect(screen.getByText(/Remind me about this/i)).toBeTruthy();
        expect(onMenuOpenChange.mock.calls.at(-1)?.[0]).toBe(true);
    });
});

/**
 * The second invariant can't be reached through the rendered bubbles — it is
 * about component IDENTITY, and both bubbles are far too entangled (BlockNote
 * previews, socket plumbing, chat management state) to mount here.
 *
 * `BubbleActions` is declared inside the bubble, so as a JSX element
 * (`<BubbleActions />`) it is a brand-new component type on every render:
 * React remounts the whole toolbar subtree, resetting the menu's state and
 * closing any dialog, on any re-render of the bubble — including the very
 * hover change the lock above is meant to survive. Called as a function it
 * inlines into the bubble's own element tree and nothing remounts.
 */
describe("bubble toolbars", () => {
    const bubbles = ["MessageBubble.tsx", "ThreadMessageBubble.tsx"];

    it.each(bubbles)("%s invokes BubbleActions instead of mounting it", (file) => {
        const source = fs.readFileSync(
            path.resolve(__dirname, "../features/chat/components/bubbles", file),
            "utf8"
        );
        expect(source).toContain("const BubbleActions = () => (");
        expect(source).not.toMatch(/<BubbleActions\b/);
    });
});

/**
 * Actions pinned in Settings → Chat sit on the toolbar and leave the "…" menu
 * (MIP-803). The dialogs belong to the menu component, so a pinned button must
 * open the same one AND hold the toolbar up behind it.
 */
describe.each(["main", "thread"] as const)("%s bubble pinned actions", (kind) => {
    const pin = (...ids: string[]) =>
        window.localStorage.setItem("genos-bubble-pinned-actions-v1", JSON.stringify(ids));

    it("shows a pinned action as its own button and takes it out of the menu", () => {
        pin("flag");
        renderMenu(kind);

        // Flag is a button on the toolbar already...
        expect(screen.getByRole("button", { name: /Flag for later/i })).toBeTruthy();
        // ...and no longer in the menu once it opens (the trigger is the last button).
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[buttons.length - 1]);
        expect(screen.queryAllByRole("menuitem", { name: /Flag for later/i })).toHaveLength(0);
        expect(screen.getByText(/^Remind me/i)).toBeTruthy();
    });

    it("keeps today's toolbar when nothing is pinned", () => {
        renderMenu(kind);
        expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("opens the reminder dialog from a pinned button and holds the toolbar open", () => {
        pin("remindMe");
        const onMenuOpenChange = renderMenu(kind);

        fireEvent.click(screen.getByRole("button", { name: /^Remind me/i }));

        expect(screen.getByText(/Remind me about this/i)).toBeTruthy();
        expect(onMenuOpenChange.mock.calls.at(-1)?.[0]).toBe(true);
    });

    it("shows pinned Edit and Delete on your own message", () => {
        pin("edit", "delete");
        renderMenu(kind, { sender: "u-1" });
        expect(screen.getByRole("button", { name: /Edit message/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Delete message/i })).toBeTruthy();
    });

    it("leaves out a pinned action that does not apply to this message", () => {
        pin("edit", "delete");
        // Someone else's message: neither Edit nor Delete is offered, pinned or not.
        renderMenu(kind, { sender: "u-2" });
        expect(screen.queryByRole("button", { name: /Edit message/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /Delete message/i })).toBeNull();
    });
});
