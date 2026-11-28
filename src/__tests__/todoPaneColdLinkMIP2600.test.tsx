/**
 * MIP-2600: a fresh load of a to-do item link hands the target to the pane through
 * sessionStorage. React may throw a first render away (here: a sibling suspends before
 * anything is committed), so rendering must not consume it: the pane that does mount
 * still needs it, or the list opens at the top with nothing highlighted.
 */

import { Suspense, use } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, render, screen } from "@testing-library/react";
import { VirtuosoMockContext } from "react-virtuoso";
import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
    cleanup();
    sessionStorage.clear();
});

const KEY = "todoDeepLinkTarget";
const Late = ({ ready }: { ready: Promise<void> }) => {
    use(ready);
    return null;
};
const pane = (ready: Promise<void>) => (
    <VirtuosoMockContext.Provider value={{ viewportHeight: 1000, itemHeight: 100 }}>
        <CssVarsProvider>
            <Suspense fallback={null}>
                <ToDoPane {...props} />
                <Late ready={ready} />
            </Suspense>
        </CssVarsProvider>
    </VirtuosoMockContext.Provider>
);

describe("the link target of a fresh load", () => {
    it("survives a render React throws away, and is used up once the pane is on screen", async () => {
        sessionStorage.setItem(KEY, JSON.stringify({ itemId: 42, localDate: "2026-08-16" }));
        let finish = () => {};
        const ready = new Promise<void>((resolve) => {
            finish = resolve;
        });
        await act(async () => {
            render(pane(ready));
        });
        // Nothing is on screen yet, so nothing may have been taken.
        expect(screen.queryByTestId("highlight")).toBeNull();
        expect(sessionStorage.getItem(KEY)).not.toBeNull();

        await act(async () => {
            finish();
            await ready;
        });
        expect(screen.getByTestId("highlight").textContent).toBe("42");
        // A later visit must not jump again.
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });
});
