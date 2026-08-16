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
import {
    createTodoItem,
    deleteTodoItem,
    updateTodoItem,
} from "../../features/chat/components/todo/services/todoItems";
import {
    cancelTodoReminder,
    loadTodoReminders,
} from "../../features/chat/components/todo/services/todoReminders";
import {
    loadTodoSchedules,
    updateTodoSchedule,
} from "../../features/chat/components/todo/services/todoSchedules";
import { useTodoGroups } from "../../hooks/useTodoGroups";
import { UserProps } from "../../types/admin";
import { TodoGroupProps, TodoItemProps, TodoScheduleProps } from "../../types/chat";
import { getLocalCurrentDate } from "../../utils/dateUtils";

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
vi.mock("../../features/chat/components/todo/services/todoReminders", () => ({
    loadTodoReminders: vi.fn().mockResolvedValue([]),
    setTodoReminder: vi.fn(),
    cancelTodoReminder: vi.fn(),
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
const createTodoItemMock = createTodoItem as unknown as ReturnType<typeof vi.fn>;
const loadTodoSchedulesMock = loadTodoSchedules as unknown as ReturnType<typeof vi.fn>;
const updateTodoScheduleMock = updateTodoSchedule as unknown as ReturnType<typeof vi.fn>;
const deleteTodoItemMock = deleteTodoItem as unknown as ReturnType<typeof vi.fn>;
const loadTodoRemindersMock = loadTodoReminders as unknown as ReturnType<typeof vi.fn>;
const cancelTodoReminderMock = cancelTodoReminder as unknown as ReturnType<typeof vi.fn>;

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

describe("useTodoGroups — reminders follow the to-do they are about", () => {
    /**
     * Reminders live in THIS hook rather than a store of their own because
     * completing a to-do cancels its reminder server-side. Split across two
     * owners, a ticked-off row would go on promising a nudge that will never
     * arrive — so the local map has to move with the completion, and move
     * back if the completion didn't land.
     */
    const reminder = {
        id: "r-1",
        itemId: 2,
        remindAt: "2099-01-01T09:00:00Z",
        tsCreated: "2026-01-01T00:00:00Z",
    };

    const bootWithReminder = async () => {
        loadTodoGroupsMock.mockResolvedValue([seedGroup()]);
        loadTodoRemindersMock.mockResolvedValue([reminder]);
        const hook = renderHook(() => useTodoGroups(myself, "token"));
        await flush();
        return hook;
    };

    it("loads the pending set on boot — nothing else announces reminders", async () => {
        const { result } = await bootWithReminder();
        expect(result.current.reminderByItemId.get(2)).toEqual(reminder);
    });

    it("keeps what it had when the read FAILS (undefined ≠ none)", async () => {
        const { result } = await bootWithReminder();
        loadTodoRemindersMock.mockResolvedValue(undefined);
        await act(async () => {
            await result.current.refreshReminders();
        });
        expect(result.current.reminderByItemId.get(2)).toEqual(reminder);
    });

    it("drops the reminder when the to-do is completed (the server cancels it)", async () => {
        echoUpdate();
        const { result } = await bootWithReminder();
        await act(async () => {
            await result.current.patchItem(2, { isCompleted: true });
        });
        expect(result.current.reminderByItemId.has(2)).toBe(false);
    });

    it("keeps it on any other patch — renaming a to-do cancels nothing", async () => {
        echoUpdate();
        const { result } = await bootWithReminder();
        await act(async () => {
            await result.current.patchItem(2, { title: "renamed" });
        });
        expect(result.current.reminderByItemId.get(2)).toEqual(reminder);
    });

    it("puts it back when the completion PATCH never landed", async () => {
        // No server-side cancellation happened, so a dropped local copy
        // would be a reminder the user still has and can no longer see.
        updateTodoItemMock.mockResolvedValue(undefined);
        const { result } = await bootWithReminder();
        await act(async () => {
            await result.current.patchItem(2, { isCompleted: true });
        });
        expect(result.current.reminderByItemId.get(2)).toEqual(reminder);
    });

    it("drops it when the row is deleted, so its sweep can't re-arm forever", async () => {
        deleteTodoItemMock.mockResolvedValue(true);
        const { result } = await bootWithReminder();
        await act(async () => {
            await result.current.removeItem(2);
        });
        expect(result.current.reminderByItemId.has(2)).toBe(false);
    });

    it("restores the row's reminder when a cancel is refused", async () => {
        cancelTodoReminderMock.mockRejectedValue(new Error("500"));
        const { result } = await bootWithReminder();
        await act(async () => {
            await expect(result.current.cancelItemReminder(2)).rejects.toThrow();
        });
        expect(result.current.reminderByItemId.get(2)).toEqual(reminder);
    });
});

describe("useTodoGroups — scheduled-todo materialization is not duplicated", () => {
    // Regression: a scheduled todo appeared TWICE in the morning. The
    // `lastMaterializedDate` cursor and the title-match set are both only
    // observable after their awaited writes land, so two materialize passes
    // that start before either commits (the midnight timer firing while a
    // token-refresh re-runs the load effect) each created the item. A
    // synchronous in-session claim, taken before any await, closes the gap.
    const mkSchedule = (over: Partial<TodoScheduleProps> = {}): TodoScheduleProps => ({
        scheduleId: 1,
        categoryId: null,
        title: "Daily standup",
        rrule: "RRULE:FREQ=DAILY",
        startDate: "2020-01-01",
        isActive: true,
        lastMaterializedDate: null,
        tsCreatedAt: "2020-01-01T00:00:00Z",
        tsUpdatedAt: "2020-01-01T00:00:00Z",
        ...over,
    });

    it("creates the item once when two materialize passes race", async () => {
        const today = getLocalCurrentDate();
        loadTodoGroupsMock.mockResolvedValue([]); // no group for today yet
        loadTodoSchedulesMock.mockResolvedValue([mkSchedule()]);
        // Cursor write echoes the row back (what the real service returns),
        // preserving lastMaterializedDate=null on an isActive-only patch so
        // the second pass still passes the cursor guard and reaches the claim.
        updateTodoScheduleMock.mockImplementation(
            async (_t: unknown, id: number, patch: Partial<TodoScheduleProps>) => ({
                ...mkSchedule({ scheduleId: id }),
                ...patch,
            })
        );

        // Hold createTodoItem pending so the load-effect's pass is suspended
        // mid-flight — exactly the window a second pass must not race through.
        let resolveCreate: ((v: TodoItemProps) => void) | undefined;
        createTodoItemMock.mockImplementation(
            () =>
                new Promise<TodoItemProps>((res) => {
                    resolveCreate = res;
                })
        );

        const { result } = renderHook(() => useTodoGroups(myself, "token"));
        await flush();
        // Pass A (load effect) is now suspended inside createTodoItem.
        expect(createTodoItemMock).toHaveBeenCalledTimes(1);

        // Pass B fires while A is still in flight (stands in for the midnight
        // timer / token-refresh re-run). Without the claim it would create a
        // second identical item.
        await act(async () => {
            await result.current.updateSchedule(1, { isActive: true });
        });
        expect(createTodoItemMock).toHaveBeenCalledTimes(1);

        // Let A finish; still exactly one create.
        await act(async () => {
            resolveCreate?.({
                ...mkItem(999, null),
                groupId: 100,
                title: "Daily standup",
            });
            await flush();
        });
        expect(createTodoItemMock).toHaveBeenCalledTimes(1);
    });
});
