// TodoItemRow — the per-item "Copy link" affordance. Top-level items
// copy their /workspace/todo/:localDate/item/:itemId deep link to the
// clipboard; child rows (subitems) have no link of their own, so the
// button must not render on them.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TodoItemProps } from "../types/chat";

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

const renderRow = (item: TodoItemProps) =>
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
                onCategoryChange={vi.fn()}
                onCategoryCreate={vi.fn()}
                onDelete={vi.fn()}
                onNotesCommit={vi.fn()}
                onTitleCommit={vi.fn()}
                onToggleComplete={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("TodoItemRow — copy link", () => {
    beforeEach(() => vi.clearAllMocks());

    it("copies the item's deep link on a top-level row", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        });

        renderRow(makeItem());
        fireEvent.click(screen.getByLabelText("Copy link"));

        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith(
                `${window.location.origin}/workspace/todo/2026-07-12/item/88`
            )
        );
    });

    it("does not render the button on a child row (subitems have no own link)", () => {
        renderRow(makeItem({ parentItemId: 5 }));
        expect(screen.queryByLabelText("Copy link")).toBeNull();
    });
});
