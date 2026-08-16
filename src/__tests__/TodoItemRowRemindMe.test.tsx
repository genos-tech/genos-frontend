/**
 * TodoItemRow — "Remind me…" in the ⋮ menu.
 *
 * The whole point of the option is that a to-do you have to remember to LOOK
 * at is the case the pane can't cover on its own, so what's asserted here is
 * mostly about when it is offered and what it says: it is absent on a
 * completed row (the server refuses a reminder there, and nagging about
 * something already dealt with is what gets notifications switched off), it
 * names the time once one is pending, and the picker's commit reaches the
 * hook with the row's own item id.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TodoItemProps, TodoReminderProps } from "../types/chat";

const ITEM_ID = 88;

const makeItem = (overrides: Partial<TodoItemProps> = {}): TodoItemProps => ({
    itemId: ITEM_ID,
    groupId: 1,
    categoryId: null,
    parentItemId: null,
    title: "ship the fix",
    notes: null,
    isCompleted: false,
    sortOrder: 0,
    tsCreatedAt: "2026-07-12T00:00:00Z",
    tsUpdatedAt: "2026-07-12T00:00:00Z",
    tsCompletedAt: null,
    ...overrides,
});

const makeReminder = (remindAt: string): TodoReminderProps => ({
    id: "r-1",
    itemId: ITEM_ID,
    remindAt,
    tsCreated: "2026-07-12T00:00:00Z",
});

type Handlers = {
    onSetReminder?: (itemId: number, at: Date) => Promise<unknown>;
    onCancelReminder?: (itemId: number) => Promise<unknown>;
};

const renderRow = (
    item: TodoItemProps,
    reminder: TodoReminderProps | null,
    handlers: Handlers = {}
) => {
    const onSetReminder = handlers.onSetReminder ?? vi.fn().mockResolvedValue(undefined);
    const onCancelReminder = handlers.onCancelReminder ?? vi.fn().mockResolvedValue(undefined);
    render(
        <CssVarsProvider>
            <TodoItemRow
                categories={[]}
                item={item}
                localDate="2026-07-12"
                myself={{} as UserProps}
                reminderByItemId={new Map(reminder ? [[reminder.itemId, reminder]] : [])}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as unknown as ChatManagementState}
                useTEM={{} as unknown as TeamManagementState}
                useUISM={{} as unknown as UIStateManagementState}
                onCancelReminder={onCancelReminder}
                onCategoryChange={vi.fn()}
                onCategoryCreate={vi.fn()}
                onDelete={vi.fn()}
                onNotesCommit={vi.fn()}
                onSetReminder={onSetReminder}
                onTitleCommit={vi.fn()}
                onToggleComplete={vi.fn()}
            />
        </CssVarsProvider>
    );
    return { onSetReminder, onCancelReminder };
};

const openMenu = () => fireEvent.click(screen.getByLabelText("More options"));

describe("TodoItemRow — remind me", () => {
    beforeEach(() => vi.clearAllMocks());

    it("offers the option on an open row", async () => {
        renderRow(makeItem(), null);
        openMenu();
        expect(await screen.findByText("Remind me…")).toBeTruthy();
    });

    it("offers it on a CHILD row too — a step of a task is still forgettable", async () => {
        renderRow(makeItem({ parentItemId: 5 }), null);
        openMenu();
        expect(await screen.findByText("Remind me…")).toBeTruthy();
    });

    it("hides it on a completed row", async () => {
        renderRow(makeItem({ isCompleted: true }), null);
        openMenu();
        // Wait for the menu itself before asserting an absence, or the
        // assertion would pass against an unopened menu.
        await screen.findByText("Delete");
        expect(screen.queryByText("Remind me…")).toBeNull();
    });

    it("hides it when the surface didn't wire the handlers up", async () => {
        render(
            <CssVarsProvider>
                <TodoItemRow
                    categories={[]}
                    item={makeItem()}
                    localDate="2026-07-12"
                    myself={{} as UserProps}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useUISM={{} as unknown as UIStateManagementState}
                    onCategoryChange={vi.fn()}
                    onCategoryCreate={vi.fn()}
                    onDelete={vi.fn()}
                    onNotesCommit={vi.fn()}
                    onTitleCommit={vi.fn()}
                    onToggleComplete={vi.fn()}
                />
            </CssVarsProvider>
        );
        openMenu();
        await screen.findByText("Delete");
        expect(screen.queryByText("Remind me…")).toBeNull();
    });

    it("names the pending time in the menu, so 'when?' costs no click", async () => {
        renderRow(makeItem(), makeReminder("2026-07-12T15:00:00Z"));
        openMenu();
        // The exact rendering is the locale's business (`formatReminderTime`);
        // what matters is that the label stopped being the generic invite.
        expect(await screen.findByText(/^Reminder: /)).toBeTruthy();
        expect(screen.queryByText("Remind me…")).toBeNull();
    });

    it("marks the row with a bell once a reminder is pending", async () => {
        // The ⋮ menu is closed at rest, so before this a resting list looked
        // identical whether a to-do was coming back on its own or not.
        renderRow(makeItem(), makeReminder("2026-07-12T15:00:00Z"));
        const bell = screen.getByRole("img", { name: /^Reminder: / });
        expect(bell).toBeTruthy();
        // Same string the menu's label uses — one source, so the row and the
        // menu can't disagree about a time the user is relying on.
        openMenu();
        expect((await screen.findByText(/^Reminder: /)).textContent).toBe(
            bell.getAttribute("aria-label")
        );
    });

    it("leaves an unscheduled row unmarked", () => {
        renderRow(makeItem(), null);
        expect(screen.queryByRole("img", { name: /^Reminder: / })).toBeNull();
    });

    it("still marks a completed row that a reminder outlived", () => {
        // Completion cancels the reminder, but a row completed on another
        // device can arrive with one still attached. Hiding the bell there
        // would deny something that exists; the server retires it as moot.
        renderRow(makeItem({ isCompleted: true }), makeReminder("2026-07-12T15:00:00Z"));
        expect(screen.getByRole("img", { name: /^Reminder: / })).toBeTruthy();
    });

    it("commits a preset through to the hook with this row's item id", async () => {
        const { onSetReminder } = renderRow(makeItem(), null);
        openMenu();
        fireEvent.click(await screen.findByText("Remind me…"));
        fireEvent.click(await screen.findByText("In 1 hour"));

        await waitFor(() => expect(onSetReminder).toHaveBeenCalledTimes(1));
        const [itemId, at] = onSetReminder.mock.calls[0];
        expect(itemId).toBe(ITEM_ID);
        // An absolute instant, resolved in the BROWSER — the server is never
        // asked to work out what "in 1 hour" means.
        expect(at).toBeInstanceOf(Date);
        expect((at as Date).getTime()).toBeGreaterThan(Date.now());
    });

    it("offers removal only once something is pending", async () => {
        const { onCancelReminder } = renderRow(makeItem(), makeReminder("2026-07-12T15:00:00Z"));
        openMenu();
        fireEvent.click(await screen.findByText(/^Reminder: /));
        fireEvent.click(await screen.findByText("Remove reminder"));
        await waitFor(() => expect(onCancelReminder).toHaveBeenCalledWith(ITEM_ID));
    });

    it("has no remove button when nothing is pending", async () => {
        renderRow(makeItem(), null);
        openMenu();
        fireEvent.click(await screen.findByText("Remind me…"));
        await screen.findByText("In 1 hour");
        expect(screen.queryByText("Remove reminder")).toBeNull();
    });

    it("keeps the picker open and says so when the server refuses the time", async () => {
        // The to-do reminder service THROWS (unlike its fire-and-forget
        // siblings) precisely so this can happen: closing on a rejected
        // promise would tell the user a reminder exists when none does.
        const onSetReminder = vi.fn().mockRejectedValue(new Error("400"));
        renderRow(makeItem(), null, { onSetReminder });
        openMenu();
        fireEvent.click(await screen.findByText("Remind me…"));
        fireEvent.click(await screen.findByText("In 1 hour"));

        expect(await screen.findByText(/Couldn't update the reminder/)).toBeTruthy();
        expect(screen.getByText("In 1 hour")).toBeTruthy();
    });
});
