/**
 * MIP-2593: the to-do routes now reach a pane that is already mounted, so each request has to
 * start over: the same item link scrolls again, and asking for the list drops the highlight.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen } from "@testing-library/react";
import { VirtuosoMockContext } from "react-virtuoso";
import { describe, expect, it, vi } from "vitest";

import { ToDoPane } from "../features/chat/ToDoPane";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../features/chat/components/todo/TodoGroupCard", () => ({
    TodoGroupCard: ({ highlightItemId }: { highlightItemId?: number }) => (
        <div data-testid="highlight">{highlightItemId ?? "none"}</div>
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

const props = {
    useCM: {
        isSubChatVisible: false,
        showOnlyInCompleteTodos: false,
        setShowOnlyInCompleteTodos: vi.fn(),
    },
    useTG: {
        groups: [
            {
                groupId: 1,
                localDate: "2026-08-16",
                items: [{ itemId: 42, categoryId: null, parentItemId: null, isCompleted: false }],
            },
        ],
        categories: [],
        schedules: [],
        incompleteCount: 1,
        reminderByItemId: new Map(),
    },
    myself: {},
    useTEM: {},
    useUISM: {},
    setMyself: vi.fn(),
    socket: null,
} as unknown as React.ComponentProps<typeof ToDoPane>;

// Two acts: the first commits what the request does at once, the second its next tick.
const ask = async (detail: unknown) => {
    act(() => {
        window.dispatchEvent(new CustomEvent("openTodoPane", { detail }));
    });
    const atOnce = highlight();
    await act(() => new Promise<void>((r) => setTimeout(r, 5)));
    return atOnce;
};

const highlight = () => screen.getByTestId("highlight").textContent;

describe("a mounted ToDoPane", () => {
    it("lets the highlight go and come back for a repeated link, and drops it for the list", async () => {
        render(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 1000, itemHeight: 100 }}>
                <CssVarsProvider>
                    <ToDoPane {...props} />
                </CssVarsProvider>
            </VirtuosoMockContext.Provider>
        );
        const target = { itemId: 42, localDate: "2026-08-16" };
        await ask(target);
        expect(highlight()).toBe("42");

        expect(await ask(target)).toBe("none");
        expect(highlight()).toBe("42");

        await ask(null);
        expect(highlight()).toBe("none");
    });
});
