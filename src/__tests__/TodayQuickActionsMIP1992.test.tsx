/**
 * MIP-1992: Today quick actions. The pure rules (next working day, what the briefing looks like
 * after "done" / "tomorrow"), then the hook: the row leaves at once, Undo sends nothing, the
 * commit is ONE partial PUT, a failed write puts the row back, and the row's buttons.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetToasts, toast, useToasts } from "../components/ui/feedback/toastStore";
import { BriefingToday, normaliseBriefing } from "../features/today/briefingToday";
import type { TodayCopy } from "../features/today/briefingWords";
import { applyTodayAction, nextWorkingDay } from "../features/today/todayActions";
import { TodayTaskRow } from "../features/today/TodayTaskRow";
import type { BriefingTodayView } from "../features/today/useBriefingToday";
import {
    __resetQuickActions,
    useQuickActionView,
    useTodayQuickActions,
} from "../features/today/useTodayQuickActions";
import { __resetUndoables, flushUndoables } from "../hooks/common/useUndoableAction";
import { en } from "../i18n/locales/en";

const patch = vi.hoisted(() => vi.fn());
vi.mock("../features/tasks/diagram/services/patchTaskFields", () => ({ patchTaskFields: patch }));
vi.mock("../features/tasks/services/deleteTaskCommit", () => ({
    afterTaskDeleted: vi.fn(),
    syncDeletedTaskCard: vi.fn(async () => undefined),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/components/TaskMentionHoverCard", () => ({
    TaskMentionHoverCard: () => null,
}));

const copy = en.tasks.dashboard.today as unknown as TodayCopy;

const task = (id: number, over = {}) => ({
    taskId: id,
    projectId: 3,
    displayId: `WEB-${id}`,
    title: `Task ${id}`,
    status: "WIP",
    dueDate: "2026-11-20",
    daysUntilDue: -2,
    ...over,
});

const day = (over: Partial<BriefingToday> = {}): BriefingToday =>
    normaliseBriefing({
        window: { since: "x", until: "y", timeZone: "UTC", localDate: "2026-11-20" },
        overdue: [task(1)],
        overdueCount: 1,
        dueToday: [task(2, { daysUntilDue: 0, dueDate: "2026-11-20" })],
        dueTodayCount: 1,
        suggestedNext: [task(2, { daysUntilDue: 0 })],
        doneToday: { count: 2 },
        ...over,
    });

describe("nextWorkingDay", () => {
    it("is the next calendar day on a weekday", () => {
        expect(nextWorkingDay("2026-11-19")).toBe("2026-11-20"); // Thu -> Fri
    });
    it("skips the weekend: Friday, Saturday and Sunday give Monday", () => {
        expect(nextWorkingDay("2026-11-20")).toBe("2026-11-23");
        expect(nextWorkingDay("2026-11-21")).toBe("2026-11-23");
        expect(nextWorkingDay("2026-11-22")).toBe("2026-11-23");
    });
    it("crosses a month end and says null for a date it cannot read", () => {
        expect(nextWorkingDay("2026-12-31")).toBe("2027-01-01");
        expect(nextWorkingDay("soon")).toBeNull();
        expect(nextWorkingDay(undefined)).toBeNull();
    });
});

describe("applyTodayAction", () => {
    it("done: leaves every list, drops the count and moves the done count up", () => {
        const out = applyTodayAction(day(), 2, "done", null);
        expect(out.dueToday).toHaveLength(0);
        expect(out.dueTodayCount).toBe(0);
        expect(out.suggestedNext).toHaveLength(0);
        expect(out.overdueCount).toBe(1);
        expect(out.doneToday?.count).toBe(3);
    });
    it("tomorrow: leaves Overdue / Due today only, the suggestion keeps its row with the new day", () => {
        const out = applyTodayAction(day(), 2, "tomorrow", "2026-11-23");
        expect(out.dueTodayCount).toBe(0);
        expect(out.doneToday?.count).toBe(2);
        expect(out.suggestedNext[0]).toMatchObject({ dueDate: "2026-11-23", daysUntilDue: 3 });
    });
    it("never counts below zero, is a no-op for a task that is on no list and adds no bar on an old server", () => {
        const d = day({ doneToday: undefined, overdueCount: 0 });
        expect(applyTodayAction(d, 1, "done", null).overdueCount).toBe(0);
        expect(applyTodayAction(d, 1, "done", null).doneToday).toBeUndefined();
        expect(applyTodayAction(d, 99, "done", null)).toBe(d);
    });
});

const setup = () => {
    const setAllTasks = vi.fn();
    const useTM = {
        allTasks: [],
        setAllTasks,
        currentPreviewTask: undefined,
        setCurrentPreviewTask: vi.fn(),
    } as never;
    const data = day();
    const view = { status: "ready", data, since: "x", refresh: vi.fn() } as BriefingTodayView;
    return renderHook(
        () => {
            const run = useTodayQuickActions({
                useTM,
                myself: { userId: "u" } as never,
                localDate: "2026-11-20",
            });
            const shown = useQuickActionView(view);
            const toasts = useToasts();
            return { run, shown, toasts };
        },
        { wrapper: ({ children }) => <CssVarsProvider>{children}</CssVarsProvider> }
    );
};

beforeEach(() => {
    patch.mockReset();
    patch.mockResolvedValue({ ok: true });
});
afterEach(() => {
    __resetUndoables();
    __resetQuickActions();
    __resetToasts();
});

describe("useTodayQuickActions", () => {
    it("hides the row and moves the counts at once, and writes nothing until the toast is over", () => {
        const h = setup();
        act(() => h.result.current.run(task(2) as never, "done"));
        expect(h.result.current.shown.view.data?.dueTodayCount).toBe(0);
        expect(h.result.current.shown.view.data?.doneToday?.count).toBe(3);
        expect(patch).not.toHaveBeenCalled();
        expect(h.result.current.toasts).toHaveLength(1);
    });

    it("Undo brings the row back and sends nothing", () => {
        const h = setup();
        act(() => h.result.current.run(task(2) as never, "done"));
        act(() => h.result.current.toasts[0].action?.onClick());
        expect(h.result.current.shown.view.data?.dueTodayCount).toBe(1);
        expect(h.result.current.shown.view.data?.doneToday?.count).toBe(2);
        act(() => flushUndoables("next"));
        expect(patch).not.toHaveBeenCalled();
    });

    it("commits ONE partial PUT: status only for done, due date only for tomorrow", async () => {
        const h = setup();
        act(() => h.result.current.run(task(1) as never, "done"));
        await act(async () => flushUndoables("next"));
        expect(patch).toHaveBeenCalledTimes(1);
        expect(patch).toHaveBeenCalledWith(1, { status: "Closed", status_code: 0 }, "tok");

        patch.mockClear();
        act(() => h.result.current.run(task(2) as never, "tomorrow"));
        await act(async () => flushUndoables("next"));
        expect(patch).toHaveBeenCalledWith(2, { due_date: "2026-11-23" }, "tok");
    });

    it("a refused write puts the row back and says so", async () => {
        patch.mockResolvedValue({ ok: false, error: "no" });
        const h = setup();
        act(() => h.result.current.run(task(1) as never, "done"));
        expect(h.result.current.shown.view.data?.overdueCount).toBe(0);
        await act(async () => flushUndoables("next"));
        expect(h.result.current.shown.view.data?.overdueCount).toBe(1);
        expect(h.result.current.toasts.some((t) => t.tone === "danger")).toBe(true);
    });

    it("gives a milestone no action", () => {
        const h = setup();
        act(() => h.result.current.run(task(1, { isMilestone: true }) as never, "done"));
        expect(h.result.current.toasts).toHaveLength(0);
        void toast;
    });

    it("is one action per task: a second click on it changes nothing", async () => {
        const h = setup();
        act(() => h.result.current.run(task(2) as never, "done"));
        act(() => h.result.current.run(task(2) as never, "tomorrow"));
        expect(h.result.current.toasts).toHaveLength(1);
        await act(async () => flushUndoables("next"));
        expect(patch).toHaveBeenCalledTimes(1);
        expect(patch).toHaveBeenCalledWith(2, { status: "Closed", status_code: 0 }, "tok");
    });
});

describe("the row's buttons", () => {
    const row = (props: Partial<Parameters<typeof TodayTaskRow>[0]>) =>
        render(
            <CssVarsProvider>
                <ul>
                    <TodayTaskRow
                        copy={copy}
                        href="/x"
                        task={task(5) as never}
                        onOpen={vi.fn()}
                        {...props}
                    />
                </ul>
            </CssVarsProvider>
        );

    it("shows both actions as sibling buttons named after the task, and calls them", () => {
        const onAction = vi.fn();
        row({ onAction });
        fireEvent.click(screen.getByRole("button", { name: "Mark done: WEB-5" }));
        fireEvent.click(screen.getByRole("button", { name: "Move to tomorrow: WEB-5" }));
        expect(onAction.mock.calls).toEqual([["done"], ["tomorrow"]]);
    });

    it("shows none without a handler and none on a milestone", () => {
        row({});
        expect(screen.queryByRole("button", { name: /Mark done/ })).toBeNull();
    });

    it("shows none on a milestone", () => {
        row({ onAction: vi.fn(), task: task(6, { isMilestone: true }) as never });
        expect(screen.queryByRole("button", { name: /Mark done/ })).toBeNull();
    });
});
