/**
 * The To-do page follows `todo.changed` pushes (MIP-1626).
 *
 * A to-do made over MCP, by the in-app agent or from another device is saved on the server and
 * announced to the owner's open apps. The page must show it without a reload, and must not pay for
 * the echo of its own saves: no replaced rows, no reset editor, no re-read while typing.
 *
 * (The socket router turning `todo.changed` into this window event is in
 * `services/socketRouter.test.ts`.)
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadTodoGroups } from "../../features/chat/components/todo/services/loadTodoGroups";
import { loadTodoCategories } from "../../features/chat/components/todo/services/todoCategories";
import { loadTodoReminders } from "../../features/chat/components/todo/services/todoReminders";
import {
    isTypingInTodoPane,
    mergeFreshGroups,
    PUSH_REFRESH_DELAY_MS,
} from "../../features/chat/components/todo/todoPushSync";
import {
    handleV3TodoChanged,
    V3_TODO_CHANGED_EVENT,
} from "../../features/chat/services/handleV3Todo";
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
    deleteTodoItemOnExit: vi.fn(),
}));
vi.mock("../../features/chat/components/todo/services/todoCategories", () => ({
    loadTodoCategories: vi.fn(),
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
    loadTodoReminders: vi.fn(),
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

const loadGroups = vi.mocked(loadTodoGroups);
const loadCategories = vi.mocked(loadTodoCategories);
const loadReminders = vi.mocked(loadTodoReminders);

const myself = { userId: "u1", teamId: "t1", userName: "Me", userEmail: "m@x.io" } as UserProps;

const mkItem = (itemId: number, over: Partial<TodoItemProps> = {}): TodoItemProps => ({
    itemId,
    groupId: 100,
    categoryId: null,
    parentItemId: null,
    title: `Item ${itemId}`,
    notes: null,
    isCompleted: false,
    sortOrder: itemId,
    tsCreatedAt: "2026-01-01T00:00:00Z",
    tsUpdatedAt: "2026-01-01T00:00:00Z",
    tsCompletedAt: null,
    ...over,
});

// Always a deep copy: a real re-read hands back new objects every time.
const group = (items: TodoItemProps[]): TodoGroupProps =>
    JSON.parse(
        JSON.stringify({
            groupId: 100,
            localDate: "2026-07-08",
            isCompleted: false,
            items,
            tsCreatedAt: "2026-01-01T00:00:00Z",
            tsUpdatedAt: "2026-01-01T00:00:00Z",
        })
    );

const ids = (result: { current: { groups: TodoGroupProps[] } }) =>
    result.current.groups.flatMap((g) => g.items.map((i) => i.itemId));

const tick = (ms: number) =>
    act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });

const push = (detail?: unknown) =>
    act(() => {
        handleV3TodoChanged(detail);
    });

const boot = async () => {
    const hook = renderHook(() => useTodoGroups(myself, "token"));
    await tick(0);
    return hook;
};

beforeEach(() => {
    vi.useFakeTimers();
    loadGroups.mockResolvedValue([group([mkItem(1), mkItem(2)])]);
    loadCategories.mockResolvedValue([]);
    loadReminders.mockResolvedValue([]);
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = "";
});

describe("a pushed to-do change reaches the open page", () => {
    it("a to-do added elsewhere appears with no reload", async () => {
        const { result } = await boot();
        expect(ids(result)).toEqual([1, 2]);

        // MCP / the agent / another device adds item 3; the server tells us.
        loadGroups.mockResolvedValue([
            group([mkItem(1), mkItem(2), mkItem(3, { title: "From MCP" })]),
        ]);
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);

        expect(ids(result)).toEqual([1, 2, 3]);
        expect(result.current.groups[0].items[2].title).toBe("From MCP");
    });

    it("an edit, a tick-off and a delete made elsewhere all show up", async () => {
        const { result } = await boot();
        loadGroups.mockResolvedValue([
            group([
                mkItem(1, {
                    title: "Renamed",
                    isCompleted: true,
                    tsUpdatedAt: "2026-02-02T00:00:00Z",
                }),
            ]),
        ]);
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);

        expect(ids(result)).toEqual([1]);
        expect(result.current.groups[0].items[0]).toMatchObject({
            title: "Renamed",
            isCompleted: true,
        });
    });

    it("a new tag and a new reminder arrive with the to-do that uses them", async () => {
        const { result } = await boot();
        loadCategories.mockResolvedValue([
            {
                categoryId: 7,
                name: "Ops",
                sortOrder: 0,
                color: "#1dc200",
                textColor: "black",
            } as never,
        ]);
        loadReminders.mockResolvedValue([
            { reminderId: 9, itemId: 1, remindAt: "2099-01-01T00:00:00Z" } as never,
        ]);
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);

        expect(result.current.categories.map((c) => c.name)).toEqual(["Ops"]);
        expect(result.current.reminderByItemId.get(1)?.reminderId).toBe(9);
    });

    it("a reconnect (no team in the event) re-reads too", async () => {
        const { result } = await boot();
        loadGroups.mockResolvedValue([group([mkItem(1), mkItem(2), mkItem(5)])]);
        await push({});
        await tick(PUSH_REFRESH_DELAY_MS);
        expect(ids(result)).toEqual([1, 2, 5]);
    });

    it("another team's change is ignored", async () => {
        await boot();
        loadGroups.mockClear();
        await push({ teamId: "some-other-team" });
        await tick(PUSH_REFRESH_DELAY_MS * 3);
        expect(loadGroups).not.toHaveBeenCalled();
    });

    it("a burst of pushes is one re-read", async () => {
        await boot();
        loadGroups.mockClear();
        for (let n = 0; n < 6; n += 1) {
            await push({ teamId: "t1" });
            await tick(50);
        }
        await tick(PUSH_REFRESH_DELAY_MS);
        expect(loadGroups).toHaveBeenCalledTimes(1);
    });

    it("the answer of an older, slower read never lands over a newer one", async () => {
        const { result } = await boot();
        let releaseOld: (g: TodoGroupProps[]) => void = () => {};
        loadGroups.mockImplementationOnce(() => new Promise((r) => (releaseOld = r)));
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);

        loadGroups.mockResolvedValueOnce([group([mkItem(1), mkItem(2), mkItem(3)])]);
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);
        expect(ids(result)).toEqual([1, 2, 3]);

        await act(async () => releaseOld([group([mkItem(1)])]));
        expect(ids(result)).toEqual([1, 2, 3]);
    });

    it("an edit made while the re-read is in flight is not overwritten by the older answer", async () => {
        const { result } = await boot();
        let release: (g: TodoGroupProps[]) => void = () => {};
        loadGroups.mockImplementationOnce(() => new Promise((r) => (release = r)));
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);

        // The person ticks item 1 off while the read is out; the read answers with the old state.
        act(() => {
            result.current.setGroups((prev) =>
                prev.map((g) => ({
                    ...g,
                    items: g.items.map((i) => (i.itemId === 1 ? { ...i, isCompleted: true } : i)),
                }))
            );
        });
        await act(async () => release([group([mkItem(1), mkItem(2)])]));
        expect(result.current.groups[0].items[0].isCompleted).toBe(true);

        // It re-reads once more, and the server (which has the tick by now) is what lands.
        loadGroups.mockResolvedValue([group([mkItem(1, { isCompleted: true }), mkItem(2)])]);
        await tick(PUSH_REFRESH_DELAY_MS * 2);
        expect(result.current.groups[0].items[0].isCompleted).toBe(true);
        expect(loadGroups.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("a loader that fails does not lose the others or raise", async () => {
        const { result } = await boot();
        loadReminders.mockRejectedValue(new Error("boom"));
        loadGroups.mockResolvedValue([group([mkItem(1), mkItem(2), mkItem(3)])]);
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);
        expect(ids(result)).toEqual([1, 2, 3]);
    });

    it("stops listening when the page unmounts", async () => {
        const { unmount } = await boot();
        loadGroups.mockClear();
        unmount();
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS * 2);
        expect(loadGroups).not.toHaveBeenCalled();
    });

    it("the window event is the one the socket router dispatches", () => {
        expect(V3_TODO_CHANGED_EVENT).toBe("v3:todo:changed");
    });
});

describe("the echo of the page's own save costs nothing", () => {
    it("an unchanged list keeps every object identity, so no row re-renders or resets", async () => {
        const { result } = await boot();
        const before = result.current.groups;
        const row = before[0].items[0];

        // What the server answers after the page's own save: the same rows, new objects.
        loadGroups.mockResolvedValue([group([mkItem(1), mkItem(2)])]);
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);

        expect(loadGroups).toHaveBeenCalledTimes(2);
        expect(result.current.groups).toBe(before);
        expect(result.current.groups[0].items[0]).toBe(row);
    });

    it("only the row that changed is replaced; its neighbours keep their identity", () => {
        const prev = [group([mkItem(1), mkItem(2, { notes: [{ type: "paragraph" }] as never })])];
        const fresh = [
            group([
                mkItem(1, { title: "Changed" }),
                mkItem(2, { notes: [{ type: "paragraph" }] as never }),
            ]),
        ];
        const merged = mergeFreshGroups(prev, fresh);
        expect(merged).not.toBe(prev);
        expect(merged[0].items[0].title).toBe("Changed");
        // The row whose notes editor is open is untouched: same object, so no draft reset.
        expect(merged[0].items[1]).toBe(prev[0].items[1]);
    });

    it("a row that is new, and a group that is gone, are taken as the server says", () => {
        const prev = [group([mkItem(1)])];
        const fresh = [{ ...group([mkItem(1), mkItem(9)]), groupId: 100 }];
        expect(mergeFreshGroups(prev, fresh)[0].items.map((i) => i.itemId)).toEqual([1, 9]);
        expect(mergeFreshGroups(prev, [])).toEqual([]);
    });
});

describe("a re-read never replaces what is being typed", () => {
    const pane = () => {
        const root = document.createElement("div");
        root.setAttribute("data-todo-pane", "");
        const editor = document.createElement("div");
        editor.contentEditable = "true";
        // jsdom has no layout, so it does not derive `isContentEditable`.
        Object.defineProperty(editor, "isContentEditable", { value: true });
        editor.tabIndex = 0;
        root.appendChild(editor);
        document.body.appendChild(root);
        return { root, editor };
    };

    it("while focus is in an editor of the pane the re-read waits, then runs once they leave", async () => {
        await boot();
        const { editor } = pane();
        editor.focus();
        expect(isTypingInTodoPane()).toBe(true);

        loadGroups.mockClear();
        loadGroups.mockResolvedValue([group([mkItem(1), mkItem(2), mkItem(3)])]);
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS * 5);
        expect(loadGroups).not.toHaveBeenCalled();

        editor.blur();
        await tick(PUSH_REFRESH_DELAY_MS * 2);
        expect(loadGroups).toHaveBeenCalledTimes(1);
    });

    it("typing in the chat composer, outside the pane, does not hold the list back", async () => {
        await boot();
        const composer = document.createElement("textarea");
        document.body.appendChild(composer);
        composer.focus();
        expect(isTypingInTodoPane()).toBe(false);

        loadGroups.mockClear();
        await push({ teamId: "t1" });
        await tick(PUSH_REFRESH_DELAY_MS);
        expect(loadGroups).toHaveBeenCalledTimes(1);
    });

    it("a non-editable element of the pane (a button) is not typing", () => {
        const { root } = pane();
        const button = document.createElement("button");
        root.appendChild(button);
        button.focus();
        expect(isTypingInTodoPane()).toBe(false);
    });
});
