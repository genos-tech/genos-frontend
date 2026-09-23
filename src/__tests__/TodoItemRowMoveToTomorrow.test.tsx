// TodoItemRow — where "Move to tomorrow" is offered, and where it isn't.
//
// The action carries a leftover to-do over to the next day. It's gated on
// three things, each because offering it there would be a no-op or a lie:
//   * a to-do already ON tomorrow has nowhere to go;
//   * a subitem's day IS its parent's group (the server refuses a lone
//     child), so the action belongs on the parent's row;
//   * a surface that doesn't wire the move up gets no menu item at all,
//     the same convention the reminder item follows.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TodoItemProps } from "../types/chat";
import { getLocalCurrentDate, getLocalTomorrowDate } from "../utils/dateUtils";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));

const makeItem = (overrides: Partial<TodoItemProps> = {}): TodoItemProps => ({
    itemId: 88,
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

const renderRow = (
    item: TodoItemProps,
    localDate: string,
    onMoveToTomorrow: ((itemId: number) => void) | undefined
) =>
    render(
        <CssVarsProvider>
            <TodoItemRow
                categories={[]}
                item={item}
                localDate={localDate}
                myself={{} as UserProps}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as unknown as ChatManagementState}
                useTEM={{} as unknown as TeamManagementState}
                useUISM={{} as unknown as UIStateManagementState}
                onAddSubitem={vi.fn()}
                onCategoryChange={vi.fn()}
                onCategoryCreate={vi.fn()}
                onDelete={vi.fn()}
                onMoveToTomorrow={onMoveToTomorrow}
                onNotesCommit={vi.fn()}
                onTitleCommit={vi.fn()}
                onToggleComplete={vi.fn()}
            />
        </CssVarsProvider>
    );

/** Open the ⋮ menu and wait for it to be populated. "Delete" is the one item
 *  present on every row, child included, so it's the readiness marker. */
const openMenu = async () => {
    fireEvent.click(screen.getByLabelText("More options"));
    await screen.findByText("Delete");
};

describe("TodoItemRow — move to tomorrow", () => {
    beforeEach(() => vi.clearAllMocks());

    it("offers the move on a to-do from an earlier day", async () => {
        const onMove = vi.fn();
        renderRow(makeItem(), "2026-07-12", onMove);

        await openMenu();
        fireEvent.click(screen.getByText("Move to tomorrow"));

        expect(onMove).toHaveBeenCalledWith(88);
    });

    it("offers it on today's to-do — the leftovers case", async () => {
        const onMove = vi.fn();
        renderRow(makeItem(), getLocalCurrentDate(), onMove);

        await openMenu();
        fireEvent.click(screen.getByText("Move to tomorrow"));

        expect(onMove).toHaveBeenCalledWith(88);
    });

    it("hides it on a to-do already on tomorrow", async () => {
        // Nowhere to go: the server would re-home it into the group it's
        // already in, so the menu item would do nothing visible.
        renderRow(makeItem(), getLocalTomorrowDate(), vi.fn());

        await openMenu();
        expect(screen.queryByText("Move to tomorrow")).toBeNull();
    });

    it("hides it on a subitem", async () => {
        // A child's day is its parent's group; the server refuses a lone
        // child move, so offering it here would only ever produce an error.
        renderRow(makeItem({ parentItemId: 87 }), "2026-07-12", vi.fn());

        await openMenu();
        expect(screen.queryByText("Move to tomorrow")).toBeNull();
    });

    it("hides it where the surface doesn't wire the move up", async () => {
        renderRow(makeItem(), "2026-07-12", undefined);

        await openMenu();
        expect(screen.queryByText("Move to tomorrow")).toBeNull();
    });

    // The gate compares against the LOCAL tomorrow rather than a UTC-derived
    // one — a distinction that matters because a to-do's day is whatever date
    // the client says it is. That property belongs to `getLocalTomorrowDate`
    // and is pinned in `getLocalTomorrowDate.test.ts`; asserting it again
    // here would need fake timers, which deadlock Testing Library's
    // real-timer polling in `findByText`.
});
