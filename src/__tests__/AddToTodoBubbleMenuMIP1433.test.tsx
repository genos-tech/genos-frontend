/**
 * "Add to To-Do" in the message "…" menu (MIP-1433).
 *
 *   - it is in the menu of a chat message AND of a thread reply, whether or not the
 *     double-click setting is on (the menu does not read that setting), and makes the same
 *     to-do the double-click makes;
 *   - it can be pinned to the hover toolbar like the other actions;
 *   - it is kept apart from "Flag for later": Flag is a message to READ AGAIN, this is one to
 *     ACT ON. Its own glyph (the To-Do list's checklist), a label with no "later" in it, and
 *     a rule above it in the menu.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MORE_MENU_GROUPS } from "../components/ui/moreMenuOrder";
import { BubbleMoreMenu } from "../features/chat/components/bubbles/BubbleMoreMenu";
import { BubbleThreadMoreMenu } from "../features/chat/components/bubbles/BubbleThreadMoreMenu";
import {
    BubbleActionsPreferenceProvider,
    normalizePinnedBubbleActions,
    PINNABLE_BUBBLE_ACTIONS,
} from "../hooks/common/useBubbleActionsPreference";
import { en } from "../i18n/locales/en";

vi.mock("../features/chat/components/modals/ModalDeleteMessage", () => ({
    ModalDeleteMessage: () => null,
}));

const ADD_TO_TODO = en.chat.messageActions.addToTodo;
const FLAG = en.chat.messageActions.flagForLater;

const baseMessage = {
    messageId: "m-1",
    messageIdWithChatId: "ch-1#m-1",
    messageIdWithChatIdAndThreadId: "ch-1#th-1#m-1",
    content: "hello",
    numReplies: 0,
    taskId: null,
    isFlagged: false,
    sender: { userId: "u-2", userName: "Other", isSystemUser: false },
};

const renderMenu = (kind: "main" | "thread", onAddToTodo?: () => void) => {
    const common = {
        accessToken: "tok",
        flaggedMessages: [],
        isSent: false,
        message: baseMessage as never,
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
        onAddToTodo,
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

const pin = (...ids: string[]) =>
    window.localStorage.setItem("genos-bubble-pinned-actions-v1", JSON.stringify(ids));
const trigger = () => screen.getAllByRole("button").at(-1) as HTMLElement;
const toolbar = () =>
    screen
        .getAllByRole("button")
        .slice(0, -1)
        .map((b) => b.getAttribute("aria-label"));
const openMenu = () => {
    fireEvent.click(trigger());
    return screen.getAllByRole("menuitem");
};

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe.each(["main", "thread"] as const)("the %s bubble menu", (kind) => {
    it("offers Add to To-Do, and picking it makes the to-do from this message", () => {
        const onAddToTodo = vi.fn();
        renderMenu(kind, onAddToTodo);
        const item = openMenu().find((el) => el.textContent === ADD_TO_TODO)!;
        expect(item).toBeTruthy();
        fireEvent.click(item);
        expect(onAddToTodo).toHaveBeenCalledTimes(1);
    });

    it("offers nothing when the host has no to-do to add to", () => {
        renderMenu(kind, undefined);
        expect(openMenu().map((el) => el.textContent)).not.toContain(ADD_TO_TODO);
    });

    it("lists it right after the flag and the reminder, ahead of the wrap toggles", () => {
        renderMenu(kind, vi.fn());
        const labels = openMenu().map((el) => el.textContent as string);
        const flagAt = labels.findIndex((l) => l.startsWith(FLAG));
        expect(labels.slice(flagAt, flagAt + 3)).toEqual([
            FLAG,
            en.chat.messageActions.remindMe,
            ADD_TO_TODO,
        ]);
    });

    it("is set apart from the flag and the reminder by a rule", () => {
        renderMenu(kind, vi.fn());
        const todo = openMenu().find((el) => el.textContent === ADD_TO_TODO)!;
        const before = todo.previousElementSibling;
        expect(before?.getAttribute("role")).toBe("separator");
    });

    it("can be pinned to the toolbar, and then leaves the menu", () => {
        pin("addToTodo");
        const onAddToTodo = vi.fn();
        renderMenu(kind, onAddToTodo);
        expect(toolbar()).toEqual([ADD_TO_TODO]);
        fireEvent.click(screen.getByRole("button", { name: ADD_TO_TODO }));
        expect(onAddToTodo).toHaveBeenCalledTimes(1);
        expect(openMenu().map((el) => el.textContent)).not.toContain(ADD_TO_TODO);
    });

    it("is not confused with the flag: another glyph, and 'later' is only the flag's word", () => {
        renderMenu(kind, vi.fn());
        const items = openMenu();
        const todo = items.find((el) => el.textContent === ADD_TO_TODO)!;
        const flag = items.find((el) => el.textContent?.startsWith(FLAG))!;
        const iconOf = (el: HTMLElement) =>
            within(el).getAllByTestId(/Icon$/)[0].getAttribute("data-testid");
        expect(iconOf(todo)).toBe("ChecklistRoundedIcon");
        expect(iconOf(flag)).toBe("FlagRoundedIcon");
        expect(ADD_TO_TODO.toLowerCase()).not.toContain("later");
        expect(FLAG.toLowerCase()).toContain("later");
    });
});

describe("the shared menu order", () => {
    it("puts addToTodo in the personal group, last, after the flag and its reminder", () => {
        const personal = MORE_MENU_GROUPS.find((g) => g.group === "personal")!;
        expect(personal.kinds).toEqual(["favorite", "flag", "remindMe", "addToTodo"]);
    });
});

describe("the pin preference", () => {
    it("lists Add to To-Do after Remind me, in the menu's order", () => {
        const order = [...PINNABLE_BUBBLE_ACTIONS];
        expect(order.indexOf("addToTodo")).toBe(order.indexOf("remindMe") + 1);
    });

    it("keeps an old saved list and accepts the new id", () => {
        expect(normalizePinnedBubbleActions(["flag", "copyLink"])).toEqual(["copyLink", "flag"]);
        expect(normalizePinnedBubbleActions(["addToTodo", "flag"])).toEqual(["flag", "addToTodo"]);
    });

    it("is not pinned for anyone by default", () => {
        expect(normalizePinnedBubbleActions([])).toEqual([]);
    });
});

describe("the definition, said in Settings", () => {
    it("says what each of the two is for, in every locale", async () => {
        const locales = await Promise.all(
            ["en", "ja", "zh", "es", "fr", "hi", "ar"].map(
                async (l) => (await import(`../i18n/locales/${l}`))[l] as typeof en
            )
        );
        for (const messages of locales) {
            const a = messages.settings.messageActions;
            expect(a.flagHint.length).toBeGreaterThan(5);
            expect(a.addToTodoHint.length).toBeGreaterThan(5);
            expect(a.flagHint).not.toBe(a.addToTodoHint);
            expect(messages.chat.messageActions.addToTodo.length).toBeGreaterThan(2);
        }
    });

    it("English: Flag is to read again, To-Do is to act on", () => {
        const a = en.settings.messageActions;
        expect(a.flagHint).toMatch(/read again/i);
        expect(a.addToTodoHint).toMatch(/do something/i);
        expect(a.addToTodoHint.toLowerCase()).not.toContain("later");
    });
});
