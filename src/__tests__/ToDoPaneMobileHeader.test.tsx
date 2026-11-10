/**
 * The To-do pane's header on a phone (MIP-979).
 *
 * The header was the tallest thing in the mobile pane, so the "N of M items
 * completed" line under "My Todos" goes on a phone; desktop keeps it.
 *
 * "Start tomorrow" is a small add-icon button at EVERY width (MIP-1051; it was
 * phone-only, MIP-979). It keeps its name (aria-label) and its click behaviour.
 * On a phone (MIP-1219) the labelled "Start today" goes and that one add icon takes
 * its place while today has no list; once today has one, it starts tomorrow.
 *
 * The phone switch is `useIsMobile()` (a JS media query), not an
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

    // MIP-1051: "Start tomorrow" is an icon-only button; MIP-1219: on a phone the one add icon
    // starts today while today has no list, and tomorrow once today has one.
    it("on desktop, with neither list, keeps the labelled Start today and the Start tomorrow icon", () => {
        renderPane([groupOn(OLD_DAY)]);

        expect(screen.getByText("Start today")).toBeInTheDocument();
        const tomorrow = screen.getByRole("button", { name: "Start tomorrow" });
        // The name is the label, so the meaning isn't lost to assistive tech; no printed text.
        expect(tomorrow.textContent).toBe("");
        expect(tomorrow.querySelector('[data-testid="AddIcon"]')).not.toBeNull();
    });

    it("on a phone, with no list for today, shows ONE add icon named Start today and no label", () => {
        isMobileViewport = true;
        renderPane([groupOn(OLD_DAY)]);

        const button = screen.getByRole("button", { name: "Start today" });
        expect(button.textContent).toBe("");
        expect(button.querySelector('[data-testid="AddIcon"]')).not.toBeNull();
        // Nothing prints "Start today" or "Start tomorrow", and tomorrow isn't offered yet.
        expect(screen.queryByText("Start today")).toBeNull();
        expect(screen.queryByRole("button", { name: "Start tomorrow" })).toBeNull();
    });

    it("on a phone, pressing it creates TODAY's list", () => {
        isMobileViewport = true;
        const { addItem } = renderPane([groupOn(OLD_DAY)]);

        fireEvent.click(screen.getByRole("button", { name: "Start today" }));

        expect(addItem).toHaveBeenCalledTimes(1);
        expect(addItem).toHaveBeenCalledWith({
            localDate: getLocalCurrentDate(),
            title: "Untitled to-do",
        });
    });

    it("on a phone, once today has a list, the same icon starts TOMORROW", () => {
        isMobileViewport = true;
        const { addItem } = renderPane([groupOn(getLocalCurrentDate())]);

        expect(screen.queryByRole("button", { name: "Start today" })).toBeNull();
        const button = screen.getByRole("button", { name: "Start tomorrow" });
        expect(button.textContent).toBe("");
        fireEvent.click(button);

        expect(addItem).toHaveBeenCalledTimes(1);
        expect(addItem).toHaveBeenCalledWith({
            localDate: getLocalTomorrowDate(),
            title: "Untitled to-do",
        });
    });

    it("on a phone, a list for tomorrow alone still leaves Start today", () => {
        isMobileViewport = true;
        renderPane([groupOn(getLocalTomorrowDate())]);

        expect(screen.getByRole("button", { name: "Start today" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Start tomorrow" })).toBeNull();
    });

    it("on a phone, with lists for today and tomorrow, offers no add button", () => {
        isMobileViewport = true;
        renderPane([groupOn(getLocalTomorrowDate()), groupOn(getLocalCurrentDate())]);

        expect(screen.queryByRole("button", { name: "Start today" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Start tomorrow" })).toBeNull();
    });

    it("creates tomorrow's list from the icon button on desktop", () => {
        const { addItem } = renderPane([groupOn(OLD_DAY)]);

        fireEvent.click(screen.getByRole("button", { name: "Start tomorrow" }));

        expect(addItem).toHaveBeenCalledWith({
            localDate: getLocalTomorrowDate(),
            title: "Untitled to-do",
        });
    });

    it("creates today's list from the labelled button on desktop", () => {
        const { addItem } = renderPane([groupOn(OLD_DAY)]);

        fireEvent.click(screen.getByText("Start today"));

        expect(addItem).toHaveBeenCalledWith({
            localDate: getLocalCurrentDate(),
            title: "Untitled to-do",
        });
    });

    it("on desktop, once today has a list, only the Start tomorrow icon remains", () => {
        renderPane([groupOn(getLocalCurrentDate())]);

        expect(screen.queryByText("Start today")).toBeNull();
        expect(screen.getByRole("button", { name: "Start tomorrow" })).toBeInTheDocument();
    });

    it("offers no Start tomorrow at all once tomorrow's list exists, on desktop", () => {
        renderPane([groupOn(getLocalTomorrowDate()), groupOn(getLocalCurrentDate())]);

        expect(screen.queryByRole("button", { name: "Start tomorrow" })).toBeNull();
        expect(screen.queryByText("Start today")).toBeNull();
    });
});
