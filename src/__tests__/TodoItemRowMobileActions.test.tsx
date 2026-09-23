// TodoItemRow — where the notes toggle and "add subitem" live per
// viewport. A phone row can't carry four-plus icon buttons next to the
// title, so on mobile both fold into the ⋮ more-options menu and render
// nowhere else; desktop keeps them inline and keeps them OUT of the menu,
// so each action has exactly one affordance at any width.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TodoItemProps } from "../types/chat";

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));

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

const renderRow = (item: TodoItemProps, onAddSubitem = vi.fn()) =>
    render(
        <CssVarsProvider>
            <TodoItemRow
                categories={[]}
                item={item}
                localDate="2026-07-12"
                myself={{} as UserProps}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as unknown as ChatManagementState}
                useTEM={{} as unknown as TeamManagementState}
                useUISM={{} as unknown as UIStateManagementState}
                onAddSubitem={onAddSubitem}
                onCategoryChange={vi.fn()}
                onCategoryCreate={vi.fn()}
                onDelete={vi.fn()}
                onNotesCommit={vi.fn()}
                onTitleCommit={vi.fn()}
                onToggleComplete={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("TodoItemRow — notes / subitem actions by viewport", () => {
    beforeEach(() => vi.clearAllMocks());

    it("keeps both actions as inline buttons on desktop, out of the menu", async () => {
        isMobileViewport = false;
        renderRow(makeItem());

        // Inline: the tooltip titles double as the buttons' accessible names.
        expect(screen.getByLabelText("Expand notes")).toBeTruthy();
        expect(screen.getByLabelText("Add subitem")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("More options"));
        await screen.findByText("Delete");
        expect(screen.queryByText("Expand notes")).toBeNull();
        expect(screen.queryByText("Add subitem")).toBeNull();
    });

    it("moves both actions into the more-options menu on mobile", async () => {
        isMobileViewport = true;
        renderRow(makeItem());

        // Gone from the row itself — that's the point of the change.
        expect(screen.queryByLabelText("Expand notes")).toBeNull();
        expect(screen.queryByLabelText("Add subitem")).toBeNull();

        fireEvent.click(screen.getByLabelText("More options"));
        expect(await screen.findByText("Expand notes")).toBeTruthy();
        expect(screen.getByText("Add subitem")).toBeTruthy();
    });

    it("opens the notes editor from the mobile menu item", async () => {
        isMobileViewport = true;
        renderRow(makeItem());

        fireEvent.click(screen.getByLabelText("More options"));
        fireEvent.click(await screen.findByText("Expand notes"));

        // Reopening the menu shows the inverse label — the toggle ran.
        fireEvent.click(screen.getByLabelText("More options"));
        expect(await screen.findByText("Collapse notes")).toBeTruthy();
    });

    it("opens the subitem input from the mobile menu item", async () => {
        isMobileViewport = true;
        renderRow(makeItem());

        expect(screen.queryByPlaceholderText("+ Add subitem")).toBeNull();
        fireEvent.click(screen.getByLabelText("More options"));
        fireEvent.click(await screen.findByText("Add subitem"));

        expect(screen.getByPlaceholderText("+ Add subitem")).toBeTruthy();
    });

    it("offers neither action on a mobile child row (no nested subitems)", async () => {
        isMobileViewport = true;
        renderRow(makeItem({ parentItemId: 5 }));

        fireEvent.click(screen.getByLabelText("More options"));
        await screen.findByText("Delete");
        // Notes still reachable on a child; a second nesting level is not.
        expect(screen.getByText("Expand notes")).toBeTruthy();
        expect(screen.queryByText("Add subitem")).toBeNull();
    });
});
