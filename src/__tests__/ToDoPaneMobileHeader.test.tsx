/**
 * The To-do pane's header on a phone (MIP-979).
 *
 * The header was the tallest thing in the mobile pane, so two things go on a
 * phone and nothing else changes:
 *   - the "N of M items completed" line under "My Todos";
 *   - the label on "Start tomorrow", which becomes a small add-icon button that
 *     keeps its name (aria-label) and its click behaviour.
 *
 * Desktop keeps both. The switch is `useIsMobile()` (a JS media query), not an
 * `sx` breakpoint, because jsdom can't evaluate the latter — see
 * `mobile-layout-overflow-patterns`. `useIsMobile` is mocked the way
 * `ToDoPaneLayout.test.tsx` does it.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToDoPane } from "../features/chat/ToDoPane";
import type { TodoGroupProps } from "../types/chat";
import { getLocalCurrentDate, getLocalTomorrowDate } from "../utils/dateUtils";

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));

vi.mock("../features/chat/components/todo/TodoGroupCard", () => ({
    TodoGroupCard: () => null,
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

// Two items, one done: "1 of 2 items completed".
const groupOn = (localDate: string) =>
    ({
        groupId: 1,
        localDate,
        items: [
            { itemId: 1, categoryId: null, parentItemId: null, isCompleted: true },
            { itemId: 2, categoryId: null, parentItemId: null, isCompleted: false },
        ],
    }) as unknown as TodoGroupProps;

const renderPane = (groups: TodoGroupProps[]) => {
    const addItem = vi.fn().mockResolvedValue(undefined);
    const props = {
        useCM: {
            isSubChatVisible: false,
            showOnlyInCompleteTodos: false,
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
        <CssVarsProvider>
            <ToDoPane {...(props as unknown as React.ComponentProps<typeof ToDoPane>)} />
        </CssVarsProvider>
    );
    return { addItem };
};

// Neither today's nor tomorrow's list exists, so both Start buttons show.
const OLD_DAY = "2020-01-01";

describe("To-do pane header on mobile", () => {
    beforeEach(() => {
        isMobileViewport = false;
        window.sessionStorage.clear();
        window.localStorage.clear();
    });

    it("keeps the title and the progress line on desktop", () => {
        renderPane([groupOn(OLD_DAY)]);

        expect(screen.getByText("My Todos")).toBeInTheDocument();
        expect(screen.getByText("1 of 2 items completed")).toBeInTheDocument();
    });

    it("drops the progress line on mobile, and keeps the title", () => {
        isMobileViewport = true;
        renderPane([groupOn(OLD_DAY)]);

        expect(screen.getByText("My Todos")).toBeInTheDocument();
        expect(screen.queryByText(/items completed/)).toBeNull();
    });

    it("shows Start tomorrow with its label on desktop", () => {
        renderPane([groupOn(OLD_DAY)]);

        expect(screen.getByText("Start tomorrow")).toBeInTheDocument();
    });

    it("shows Start tomorrow as an icon-only button on mobile, still named", () => {
        isMobileViewport = true;
        renderPane([groupOn(OLD_DAY)]);

        // The name is the old label, so the meaning isn't lost to assistive tech.
        const button = screen.getByRole("button", { name: "Start tomorrow" });
        // No printed text, just the add icon.
        expect(button.textContent).toBe("");
        expect(button.querySelector('[data-testid="AddIcon"]')).not.toBeNull();
        expect(screen.queryByText("Start tomorrow")).toBeNull();
    });

    it("still creates tomorrow's list when the icon-only button is pressed", () => {
        isMobileViewport = true;
        const { addItem } = renderPane([groupOn(OLD_DAY)]);

        fireEvent.click(screen.getByRole("button", { name: "Start tomorrow" }));

        expect(addItem).toHaveBeenCalledTimes(1);
        expect(addItem).toHaveBeenCalledWith({
            localDate: getLocalTomorrowDate(),
            title: "Untitled to-do",
        });
    });

    it("creates tomorrow's list from the labelled button on desktop too", () => {
        const { addItem } = renderPane([groupOn(OLD_DAY)]);

        fireEvent.click(screen.getByText("Start tomorrow"));

        expect(addItem).toHaveBeenCalledWith({
            localDate: getLocalTomorrowDate(),
            title: "Untitled to-do",
        });
    });

    it("leaves Start today with its label on mobile (only tomorrow's button shrinks)", () => {
        isMobileViewport = true;
        renderPane([groupOn(OLD_DAY)]);

        expect(screen.getByText("Start today")).toBeInTheDocument();
    });

    it("offers no Start tomorrow at all once tomorrow's list exists, mobile or not", () => {
        isMobileViewport = true;
        renderPane([groupOn(getLocalTomorrowDate()), groupOn(getLocalCurrentDate())]);

        expect(screen.queryByRole("button", { name: "Start tomorrow" })).toBeNull();
    });
});
