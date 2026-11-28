/**
 * MIP-2221: a tomorrow list with nothing in it is not shown. The server keeps a day once it
 * exists, so deleting tomorrow's only to-do left an empty "Tomorrow" card nobody had asked for.
 * "Start tomorrow" comes back with it. Today's empty list still shows, on both tabs.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { VirtuosoMockContext } from "react-virtuoso";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToDoPane } from "../features/chat/ToDoPane";
import type { TodoGroupProps } from "../types/chat";
import { getLocalCurrentDate, getLocalTomorrowDate } from "../utils/dateUtils";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../features/chat/components/todo/TodoGroupCard", () => ({
    TodoGroupCard: ({ group }: { group: TodoGroupProps }) => (
        <div data-testid="day">{group.localDate}</div>
    ),
}));
vi.mock("../features/chat/components/todo/titleMentions", () => ({
    TodoMentionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../features/chat/components/todo/ModalManageTodoTags", () => ({
    ModalManageTodoTags: () => null,
}));
vi.mock("../features/chat/components/todo/ModalScheduledTodos", () => ({
    ModalScheduledTodos: () => null,
}));

const day = (groupId: number, localDate: string, items: number) =>
    ({
        groupId,
        localDate,
        items: Array.from({ length: items }, (_, i) => ({
            itemId: groupId * 10 + i,
            categoryId: null,
            parentItemId: null,
            isCompleted: false,
        })),
    }) as unknown as TodoGroupProps;

const renderPane = (groups: TodoGroupProps[], incompleteTab: boolean) => {
    const addItem = vi.fn().mockResolvedValue(undefined);
    const props = {
        useCM: {
            isSubChatVisible: false,
            showOnlyInCompleteTodos: incompleteTab,
            setShowOnlyInCompleteTodos: vi.fn(),
        },
        useTG: {
            groups,
            categories: [],
            schedules: [],
            incompleteCount: 1,
            reminderByItemId: new Map(),
            addItem,
        },
        myself: {},
        useTEM: {},
        useUISM: {},
        setMyself: vi.fn(),
        socket: null,
    };
    render(
        <VirtuosoMockContext.Provider value={{ viewportHeight: 1000, itemHeight: 100 }}>
            <CssVarsProvider>
                <ToDoPane {...(props as unknown as React.ComponentProps<typeof ToDoPane>)} />
            </CssVarsProvider>
        </VirtuosoMockContext.Provider>
    );
    return { addItem };
};

const shownDays = () => screen.queryAllByTestId("day").map((n) => n.textContent);

describe.each([
    ["All", false],
    ["Incomplete", true],
])("an empty tomorrow list on the %s tab", (_tab, incompleteTab) => {
    beforeEach(() => {
        window.sessionStorage.clear();
        window.localStorage.clear();
    });

    it("is not shown, and Start tomorrow is offered again", async () => {
        const { addItem } = renderPane(
            [day(2, getLocalTomorrowDate(), 0), day(1, getLocalCurrentDate(), 1)],
            incompleteTab
        );

        expect(shownDays()).toEqual([getLocalCurrentDate()]);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Start tomorrow" }));
        });
        expect(addItem).toHaveBeenCalledWith(
            expect.objectContaining({ localDate: getLocalTomorrowDate() })
        );
    });

    it("is shown once it holds a to-do, with no second Start button", () => {
        renderPane([day(2, getLocalTomorrowDate(), 1)], incompleteTab);

        expect(shownDays()).toEqual([getLocalTomorrowDate()]);
        expect(screen.queryByRole("button", { name: "Start tomorrow" })).toBeNull();
    });

    it("leaves an empty today list on screen", () => {
        renderPane([day(1, getLocalCurrentDate(), 0)], incompleteTab);

        expect(shownDays()).toEqual([getLocalCurrentDate()]);
    });
});
