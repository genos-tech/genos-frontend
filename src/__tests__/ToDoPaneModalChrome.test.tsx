/**
 * MIP-1044: the to-do pane's header clears the modal's floating buttons.
 *
 * Inside UrlLinkModal the "open full page" and ✕ buttons float over the top
 * right corner (right: 56 and 12, 36px wide). The pane's header action row
 * (tags, schedules, "Start tomorrow") ends 20px from the edge, so they sat
 * on top of it and hid "Start tomorrow". Hosted in a modal the title row
 * keeps that corner free; on the page it is unchanged.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToDoPane } from "../features/chat/ToDoPane";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../features/chat/components/todo/TodoGroupCard", () => ({ TodoGroupCard: () => null }));
vi.mock("../features/chat/components/todo/titleMentions", () => ({
    TodoMentionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../features/chat/components/todo/ModalManageTodoTags", () => ({
    ModalManageTodoTags: () => null,
}));
vi.mock("../features/chat/components/todo/ModalScheduledTodos", () => ({
    ModalScheduledTodos: () => null,
}));

afterEach(cleanup);

const renderPane = (hostedInModal: boolean) => {
    const props = {
        useCM: {
            isSubChatVisible: false,
            showOnlyInCompleteTodos: false,
            setShowOnlyInCompleteTodos: vi.fn(),
        },
        useTG: {
            groups: [],
            categories: [],
            schedules: [],
            incompleteCount: 0,
            reminderByItemId: new Map(),
        },
        myself: {},
        useTEM: {},
        useUISM: {},
        setMyself: vi.fn(),
        socket: null,
        hostedInModal,
    };
    render(
        <CssVarsProvider>
            <ToDoPane {...(props as unknown as React.ComponentProps<typeof ToDoPane>)} />
        </CssVarsProvider>
    );
    return document.querySelector("[data-todo-header-row]") as HTMLElement;
};

describe("ToDoPane header row", () => {
    it("in a modal, leaves room on the right for the two floating buttons", () => {
        const row = renderPane(true);
        // Floating buttons reach 92px from the dialog edge; the header box
        // already pads 20px, so the row adds at least the rest.
        expect(parseFloat(getComputedStyle(row).paddingRight)).toBeGreaterThanOrEqual(72);
    });

    it("on the page, adds nothing", () => {
        const row = renderPane(false);
        expect(parseFloat(getComputedStyle(row).paddingRight || "0")).toBe(0);
    });
});
