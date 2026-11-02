/**
 * How the To-do pane sizes its list (MIP-932).
 *
 * The desktop list used to be `currentWindowHeight - 250` pixels (`* 0.43` in a
 * split view): the 250 was the chat header + the pane header + the Pro Tip
 * footer, worked out by hand. The tag filter bar then made the pane header
 * taller, so the list ran past the box that clips it and its last rows were cut
 * off. The list now fills whatever the pane is given (`100%`) on every surface,
 * and the Pro Tip footer is gone, so nothing has to add up any more.
 *
 * jsdom has no layout, so what can be held here is the contract that makes the
 * browser do the sums: the list is `100%`, never a pixel height, and no footer
 * is rendered. The pixel numbers were measured in Chrome (see the PR).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToDoPane } from "../features/chat/ToDoPane";
import type { TodoGroupProps } from "../types/chat";

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));

// The cards, the mention pool and the two modals are not what is under test and
// each pulls in a good part of the app; the list that holds the cards is.
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

const group = {
    groupId: 1,
    localDate: "2026-11-02",
    items: [{ itemId: 1, categoryId: null, parentItemId: null, isCompleted: false }],
} as unknown as TodoGroupProps;

const renderPane = (opts: { hostedInModal?: boolean; isSubChatVisible?: boolean }) => {
    const useCM = {
        isSubChatVisible: opts.isSubChatVisible ?? false,
        showOnlyInCompleteTodos: false,
        setShowOnlyInCompleteTodos: vi.fn(),
    };
    const useTG = {
        groups: [group],
        categories: [],
        schedules: [],
        incompleteCount: 1,
        reminderByItemId: new Map(),
    };
    const props = {
        useCM,
        useTG,
        myself: {},
        useTEM: {},
        useUISM: {},
        setMyself: vi.fn(),
        socket: null,
        hostedInModal: opts.hostedInModal,
        // What the unfixed pane sized its list from. Gone from the props once it
        // stops doing sums, and the cast below lets this stand either way.
        currentWindowHeight: 800,
    };
    return render(
        <CssVarsProvider>
            <ToDoPane {...(props as unknown as React.ComponentProps<typeof ToDoPane>)} />
        </CssVarsProvider>
    );
};

const list = () => screen.getByTestId("virtuoso-scroller");

describe("ToDoPane layout", () => {
    beforeEach(() => {
        isMobileViewport = false;
        window.sessionStorage.clear();
        window.localStorage.clear();
    });

    it("has no Pro Tip footer on desktop", () => {
        renderPane({});

        expect(screen.queryByText("Pro Tip")).toBeNull();
        expect(screen.queryByText(/Spotlight can read, add, and toggle/)).toBeNull();
        // The pane itself is there, list and all.
        expect(screen.getByText("My Todos")).toBeInTheDocument();
        expect(list()).toBeInTheDocument();
    });

    it("fills the pane with the list on desktop, whatever the window height", () => {
        renderPane({});

        expect(list().style.height).toBe("100%");
    });

    it("fills the pane in a split view too, where the old code took 43% of the window", () => {
        renderPane({ isSubChatVisible: true });

        expect(list().style.height).toBe("100%");
    });

    it("is unchanged in the modal and on mobile: the list fills the pane", () => {
        renderPane({ hostedInModal: true });
        expect(list().style.height).toBe("100%");
        expect(screen.queryByText("Pro Tip")).toBeNull();
    });

    it("is unchanged on mobile", () => {
        isMobileViewport = true;
        renderPane({});

        expect(list().style.height).toBe("100%");
        expect(screen.queryByText("Pro Tip")).toBeNull();
    });
});
