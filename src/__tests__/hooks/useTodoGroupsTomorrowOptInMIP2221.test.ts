/**
 * MIP-2221: tomorrow's to-do is opt-in. Nothing for tomorrow is created until
 * the person clicks "Start tomorrow" (or "Move to tomorrow"); loading the page,
 * a recurring schedule and the midnight tick must never file anything under
 * tomorrow's date.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTodoGroups } from "../../features/chat/components/todo/services/loadTodoGroups";
import { createTodoItem } from "../../features/chat/components/todo/services/todoItems";
import { loadTodoSchedules } from "../../features/chat/components/todo/services/todoSchedules";
import { useTodoGroups } from "../../hooks/useTodoGroups";
import { UserProps } from "../../types/admin";
import { TodoItemProps, TodoScheduleProps } from "../../types/chat";
import { getLocalCurrentDate, getLocalTomorrowDate } from "../../utils/dateUtils";

vi.mock("../../features/chat/components/todo/services/loadTodoGroups", () => ({
    loadTodoGroups: vi.fn(),
}));
vi.mock("../../features/chat/components/todo/services/todoItems", () => ({
    createTodoItem: vi.fn(),
    updateTodoItem: vi.fn(),
    deleteTodoItem: vi.fn(),
    deleteTodoItemOnExit: vi.fn(),
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
    updateTodoSchedule: vi.fn().mockResolvedValue(undefined),
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

const loadGroupsMock = loadTodoGroups as unknown as ReturnType<typeof vi.fn>;
const createItemMock = createTodoItem as unknown as ReturnType<typeof vi.fn>;
const loadSchedulesMock = loadTodoSchedules as unknown as ReturnType<typeof vi.fn>;

const myself = { userId: "u1", teamId: "t1", userName: "Me", userEmail: "m@x.io" } as UserProps;

const schedule: TodoScheduleProps = {
    scheduleId: 1,
    categoryId: null,
    title: "Daily standup",
    rrule: "RRULE:FREQ=DAILY",
    startDate: "2020-01-01",
    isActive: true,
    lastMaterializedDate: null,
    tsCreatedAt: "2020-01-01T00:00:00Z",
    tsUpdatedAt: "2020-01-01T00:00:00Z",
};

const created = (localDate: string): TodoItemProps => ({
    itemId: 50,
    groupId: 500,
    categoryId: null,
    parentItemId: null,
    title: "typed",
    notes: null,
    isCompleted: false,
    sortOrder: 1,
    tsCreatedAt: `${localDate}T00:00:00Z`,
    tsUpdatedAt: `${localDate}T00:00:00Z`,
    tsCompletedAt: null,
});

const flush = () =>
    act(async () => {
        await new Promise((r) => setTimeout(r, 0));
    });

const createdDates = (): string[] =>
    createItemMock.mock.calls.map((c) => (c[2] as { localDate: string }).localDate);

afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
});

describe("tomorrow's to-do is opt-in (MIP-2221)", () => {
    it("loading the page with a daily schedule creates nothing for tomorrow", async () => {
        loadGroupsMock.mockResolvedValue([]);
        loadSchedulesMock.mockResolvedValue([schedule]);
        createItemMock.mockImplementation(async () => created(getLocalCurrentDate()));

        const { result } = renderHook(() => useTodoGroups(myself, "token"));
        await flush();

        const tomorrow = getLocalTomorrowDate();
        expect(createdDates()).not.toContain(tomorrow);
        expect(result.current.groups.some((g) => g.localDate === tomorrow)).toBe(false);
    });

    it("an empty page creates no group at all until the person asks", async () => {
        loadGroupsMock.mockResolvedValue([]);
        loadSchedulesMock.mockResolvedValue([]);
        const { result } = renderHook(() => useTodoGroups(myself, "token"));
        await flush();
        expect(createItemMock).not.toHaveBeenCalled();
        expect(result.current.groups).toEqual([]);
    });

    it("the midnight tick re-evaluates today but does not create tomorrow's entry", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
        vi.setSystemTime(new Date(2026, 5, 10, 23, 59, 30));
        loadGroupsMock.mockResolvedValue([]);
        loadSchedulesMock.mockResolvedValue([]);

        const { result } = renderHook(() => useTodoGroups(myself, "token"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });

        expect(createItemMock).not.toHaveBeenCalled();
        expect(result.current.groups).toEqual([]);
    });

    it("the click path still works: addItem for tomorrow files it under tomorrow", async () => {
        loadGroupsMock.mockResolvedValue([]);
        loadSchedulesMock.mockResolvedValue([]);
        const tomorrow = getLocalTomorrowDate();
        createItemMock.mockImplementation(async () => created(tomorrow));

        const { result } = renderHook(() => useTodoGroups(myself, "token"));
        await flush();
        await act(async () => {
            await result.current.addItem({ localDate: tomorrow, title: "Untitled" });
        });

        expect(createdDates()).toEqual([tomorrow]);
    });
});
