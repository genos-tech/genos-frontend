/**
 * useTodoGroups — completing a PARENT cascades completion to its
 * still-open children (ToDoPane request): closing a parent should never
 * leave open subitems behind. A todo's done-state follows its parent; we
 * don't hold a parent open on account of its children, and we don't
 * propagate upward from children. The cascade fires only on completion —
 * re-opening a parent leaves children as they are.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTodoGroups } from "../../features/chat/components/todo/services/loadTodoGroups";
import { updateTodoItem } from "../../features/chat/components/todo/services/todoItems";
import { useTodoGroups } from "../../hooks/useTodoGroups";
import { UserProps } from "../../types/admin";
import { TodoGroupProps, TodoItemProps } from "../../types/chat";

vi.mock("../../features/chat/components/todo/services/loadTodoGroups", () => ({
    loadTodoGroups: vi.fn(),
}));
vi.mock("../../features/chat/components/todo/services/todoItems", () => ({
    createTodoItem: vi.fn(),
    updateTodoItem: vi.fn(),
    deleteTodoItem: vi.fn(),
}));
vi.mock("../../features/chat/components/todo/services/todoCategories", () => ({
    loadTodoCategories: vi.fn().mockResolvedValue([]),
    createTodoCategory: vi.fn(),
    updateTodoCategory: vi.fn(),
    deleteTodoCategory: vi.fn(),
}));
vi.mock("../../features/chat/components/todo/services/todoSchedules", () => ({
    loadTodoSchedules: vi.fn().mockResolvedValue([]),
    createTodoSchedule: vi.fn(),
    updateTodoSchedule: vi.fn(),
    deleteTodoSchedule: vi.fn(),
}));
vi.mock("../../db/services/todo.service", () => ({
    TodoService: class {
        async getGroupsByUser() {
            return [];
        }
        async cacheGroups() {}
        async deleteGroup() {}
    },
}));

const loadTodoGroupsMock = loadTodoGroups as unknown as ReturnType<typeof vi.fn>;
const updateTodoItemMock = updateTodoItem as unknown as ReturnType<typeof vi.fn>;

const myself = {
    userId: "u1",
    teamId: "t1",
    userName: "Me",
    userEmail: "me@example.com",
} as UserProps;

const mkItem = (
    itemId: number,
    parentItemId: number | null,
    isCompleted = false
): TodoItemProps => ({
    itemId,
    groupId: 100,
    categoryId: null,
    parentItemId,
    title: `Item ${itemId}`,
    notes: null,
    isCompleted,
    sortOrder: itemId,
    tsCreatedAt: "2026-01-01T00:00:00Z",
    tsUpdatedAt: "2026-01-01T00:00:00Z",
    tsCompletedAt: null,
});

// parent(1) -> children 2,3 ; plus an unrelated top-level item 4.
const seedGroup = (childrenCompleted = false): TodoGroupProps => ({
    groupId: 100,
    localDate: "2026-07-08",
    isCompleted: false,
    items: [
        mkItem(1, null, childrenCompleted),
        mkItem(2, 1, childrenCompleted),
        mkItem(3, 1, childrenCompleted),
        mkItem(4, null, false),
    ],
    tsCreatedAt: "2026-01-01T00:00:00Z",
    tsUpdatedAt: "2026-01-01T00:00:00Z",
});

const parentOf = (itemId: number): number | null => (itemId === 2 || itemId === 3 ? 1 : null);

// updateTodoItem echoes the patched row back (what the real service returns).
const echoUpdate = () =>
    updateTodoItemMock.mockImplementation(async (_t: unknown, itemId: number, patch: object) => ({
        ...mkItem(itemId, parentOf(itemId)),
        ...patch,
    }));

const flush = () =>
    act(async () => {
        await new Promise((r) => setTimeout(r, 0));
    });

const completionById = (items: TodoItemProps[]): Record<number, boolean> =>
    Object.fromEntries(items.map((i) => [i.itemId, i.isCompleted]));

afterEach(() => vi.clearAllMocks());

describe("useTodoGroups — identity guard", () => {
    // Regression: since the App-root lift the hook can mount before
    // `myself` resolves; an unguarded load hit /todo/groups/?team_id=
    // and 500'd on the server's UUID validation.
    it("does not fetch (load or refresh) while myself is empty", async () => {
        const empty = { userId: "", teamId: "", userName: "", userEmail: "" } as UserProps;
        const { result } = renderHook(() => useTodoGroups(empty, "token"));
        await flush();
        expect(loadTodoGroupsMock).not.toHaveBeenCalled();
        await act(async () => {
            await result.current.refresh();
        });
        expect(loadTodoGroupsMock).not.toHaveBeenCalled();
    });

    it("fetches once myself carries user + team ids", async () => {
        loadTodoGroupsMock.mockResolvedValue([seedGroup()]);
        renderHook(() => useTodoGroups(myself, "token"));
        await flush();
        expect(loadTodoGroupsMock).toHaveBeenCalledTimes(1);
    });
});

describe("useTodoGroups — parent completion cascades to children", () => {
    it("closing a parent closes its still-open children (and only those)", async () => {
        loadTodoGroupsMock.mockResolvedValue([seedGroup()]);
        echoUpdate();
        const { result } = renderHook(() => useTodoGroups(myself, "token"));
        await flush();

        await act(async () => {
            await result.current.patchItem(1, { isCompleted: true });
        });
        await flush();

        // Parent + both children persisted as completed; unrelated item 4 not touched.
        const completedPatched = updateTodoItemMock.mock.calls
            .filter((c) => (c[2] as { isCompleted?: boolean }).isCompleted === true)
            .map((c) => c[1] as number)
            .sort();
        expect(completedPatched).toEqual([1, 2, 3]);
        expect(updateTodoItemMock.mock.calls.some((c) => c[1] === 4)).toBe(false);

        const byId = completionById(result.current.groups[0].items);
        expect(byId[1]).toBe(true);
        expect(byId[2]).toBe(true);
        expect(byId[3]).toBe(true);
        expect(byId[4]).toBe(false);
        expect(result.current.incompleteCount).toBe(1); // only item 4 remains open
    });

    it("completing a child does NOT propagate up to the parent or across siblings", async () => {
        loadTodoGroupsMock.mockResolvedValue([seedGroup()]);
        echoUpdate();
        const { result } = renderHook(() => useTodoGroups(myself, "token"));
        await flush();

        await act(async () => {
            await result.current.patchItem(2, { isCompleted: true });
        });
        await flush();

        expect(updateTodoItemMock).toHaveBeenCalledTimes(1);
        expect(updateTodoItemMock.mock.calls[0][1]).toBe(2);
        const byId = completionById(result.current.groups[0].items);
        expect(byId[1]).toBe(false); // parent stays open
        expect(byId[3]).toBe(false); // sibling stays open
    });

    it("re-opening a parent leaves its children completed (cascade is close-only)", async () => {
        loadTodoGroupsMock.mockResolvedValue([seedGroup(true)]); // parent + children all done
        echoUpdate();
        const { result } = renderHook(() => useTodoGroups(myself, "token"));
        await flush();

        await act(async () => {
            await result.current.patchItem(1, { isCompleted: false });
        });
        await flush();

        expect(updateTodoItemMock).toHaveBeenCalledTimes(1);
        expect(updateTodoItemMock.mock.calls[0][1]).toBe(1);
        const byId = completionById(result.current.groups[0].items);
        expect(byId[1]).toBe(false); // parent re-opened
        expect(byId[2]).toBe(true); // children untouched
        expect(byId[3]).toBe(true);
    });
});
