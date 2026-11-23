/**
 * MIP-2213: a Today task row has the SAME geometry with or without quick actions. The actions are
 * over the row's end edge and reserve no width, so the title truncates the same on every row. The
 * pixels are read in a real browser (see the PR: screenshots at 1440, 1024 and 390, light and
 * dark); jsdom has no layout, so these tests pin the STRUCTURE that makes it true: the row button
 * is the li's only in-flow child, the actions are absolutely positioned and out of the flow, they
 * stay in the tab order, and a long press shows them on a screen with no hover.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normaliseBriefing, type BriefingTask } from "../features/today/briefingToday";
import type { TodayCopy } from "../features/today/briefingWords";
import { ROW_MIN_HEIGHT } from "../features/today/rowDivider";
import { TodayBriefing } from "../features/today/TodayBriefing";
import { TodayTaskRow, type TodayTaskRowProps } from "../features/today/TodayTaskRow";
import { en } from "../i18n/locales/en";

vi.mock("../features/tasks/components/TaskMentionHoverCard", () => ({
    TaskMentionHoverCard: () => null,
}));

const copy = en.tasks.dashboard.today as unknown as TodayCopy;

const task = (over: Partial<BriefingTask> = {}): BriefingTask => ({
    taskId: 5,
    projectId: 3,
    displayId: "WEB-5",
    title: "Fix the empty gap on Today rows",
    status: "WIP",
    daysUntilDue: -2,
    dueDate: "2026-11-20",
    ...over,
});

const row = (props: Partial<TodayTaskRowProps> = {}) =>
    render(
        <CssVarsProvider>
            <ul>
                <TodayTaskRow
                    copy={copy}
                    href="/x"
                    task={task()}
                    onOpen={props.onOpen ?? vi.fn()}
                    {...props}
                />
            </ul>
        </CssVarsProvider>
    );

const rowEl = (container: HTMLElement) => container.querySelector("li") as HTMLLIElement;
const actionsEl = (container: HTMLElement) =>
    container.querySelector("[data-today-actions]") as HTMLElement | null;

const setHover = (hover: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(hover: none)" ? !hover : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
    }));
};

beforeEach(() => setHover(true));
afterEach(() => vi.useRealTimers());

describe("one row geometry, with or without quick actions", () => {
    it("lays the row out the same: the button is the only in-flow child, the li is not a flex row", () => {
        const plain = row();
        const plainLi = rowEl(plain.container);
        const plainButton = plainLi.querySelector("button")!;
        plain.unmount();

        const acting = row({ onAction: vi.fn() });
        const actingLi = rowEl(acting.container);
        const actingButton = actingLi.querySelector(":scope > button") as HTMLElement;

        // The same children in the same place: the row button, then (only with actions) the group.
        expect(plainLi.children).toHaveLength(1);
        expect(actingLi.children).toHaveLength(2);
        expect(actingLi.children[0]).toBe(actingButton);
        // No flex row around the button (a flex row is what reserved the actions' width).
        expect(getComputedStyle(actingLi).display).not.toBe("flex");
        expect(getComputedStyle(plainLi).display).toBe(getComputedStyle(actingLi).display);
        // The button takes the full row width and the same height rule in both.
        expect(getComputedStyle(actingButton).width).toBe("100%");
        expect(getComputedStyle(plainButton).width).toBe("100%");
        expect(getComputedStyle(actingButton).minHeight).toBe(`${ROW_MIN_HEIGHT}px`);
        expect(getComputedStyle(actingButton).minHeight).toBe(
            getComputedStyle(plainButton).minHeight
        );
    });

    it("puts the actions over the row's end edge, out of the flow, hidden at rest", () => {
        const { container } = row({ onAction: vi.fn() });
        const group = actionsEl(container)!;
        const style = getComputedStyle(group);
        expect(style.position).toBe("absolute");
        expect(style.opacity).toBe("0");
        // Hidden, they must not catch a click meant for the row (its due text, its avatar).
        expect(style.pointerEvents).toBe("none");
        expect(getComputedStyle(rowEl(container)).position).toBe("relative");
        // Opaque, with a fade of the same colour (a shadow, no gradient), so the title under it is
        // hidden and never ends in a hard cut.
        expect(style.background).toContain("--joy-palette-neutral-softbg");
        expect(style.boxShadow).toContain("--joy-palette-neutral-softbg");
    });

    it("keeps the hidden actions in the tab order, named after the task (visible on focus)", () => {
        const { container } = row({ onAction: vi.fn() });
        const group = actionsEl(container)!;
        expect(group.getAttribute("role")).toBe("group");
        expect(group.getAttribute("aria-label")).toContain("WEB-5");
        for (const button of group.querySelectorAll("button")) {
            // Not display:none, not hidden, not tabindex -1: opacity alone hides them.
            expect(button.getAttribute("tabindex")).toBeNull();
            expect(button.closest("[hidden],[aria-hidden='true']")).toBeNull();
        }
        screen.getByRole("button", { name: "Mark done: WEB-5" }).focus();
        expect(document.activeElement).toBe(
            screen.getByRole("button", { name: "Mark done: WEB-5" })
        );
    });

    it("gives a milestone and an action-less row the same single-button structure", () => {
        const milestone = row({ task: task({ isMilestone: true }), onAction: vi.fn() });
        expect(actionsEl(milestone.container)).toBeNull();
        expect(rowEl(milestone.container).children).toHaveLength(1);
        milestone.unmount();
        const none = row();
        expect(actionsEl(none.container)).toBeNull();
        expect(rowEl(none.container).children).toHaveLength(1);
    });
});

describe("touch: no hover, a long press shows the actions", () => {
    beforeEach(() => {
        setHover(false);
        vi.useFakeTimers();
    });

    const press = (button: HTMLElement) => {
        fireEvent.touchStart(button, { touches: [{ clientX: 10, clientY: 10 }] });
        act(() => {
            vi.advanceTimersByTime(600);
        });
        fireEvent.touchEnd(button);
    };

    it("opens on a long press without opening the task, and closes on a touch elsewhere", () => {
        const onOpen = vi.fn();
        const { container } = row({ onAction: vi.fn(), onOpen });
        const li = rowEl(container);
        const button = li.querySelector(":scope > button") as HTMLElement;
        expect(li.getAttribute("data-actions-open")).toBeNull();

        press(button);
        fireEvent.click(button); // the click that follows a long press
        expect(li.getAttribute("data-actions-open")).toBe("true");
        expect(onOpen).not.toHaveBeenCalled();

        fireEvent.touchStart(document.body);
        expect(li.getAttribute("data-actions-open")).toBeNull();
    });

    it("closes on Escape, and a plain tap still opens the task", () => {
        const onOpen = vi.fn();
        const { container } = row({ onAction: vi.fn(), onOpen });
        const li = rowEl(container);
        const button = li.querySelector(":scope > button") as HTMLElement;
        press(button);
        fireEvent.click(button);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(li.getAttribute("data-actions-open")).toBeNull();

        fireEvent.click(button);
        expect(onOpen).toHaveBeenCalledWith("/x");
    });

    it("does nothing on a long press for a row without actions", () => {
        const { container } = row();
        const li = rowEl(container);
        press(li.querySelector("button") as HTMLElement);
        expect(li.getAttribute("data-actions-open")).toBeNull();
    });
});

describe("the Today sections", () => {
    it("are ONE grid in reading order, each a titled card, the lists inside the same row", () => {
        const data = normaliseBriefing({
            window: { since: "x", until: "y", timeZone: "UTC", localDate: "2026-11-20" },
            overdue: [task()],
            overdueCount: 1,
            suggestedNext: [task({ taskId: 6, displayId: "WEB-6", reasons: ["Blocks 2"] })],
            requests: [{ itemId: 1, type: "review", at: null, text: "Review it", from: "Aiko" }],
            changed: {
                total: 1,
                truncated: false,
                items: [
                    {
                        type: "task",
                        taskId: 7,
                        displayId: "WEB-7",
                        title: "Moved",
                        latestAt: "2026-11-20T08:00:00Z",
                        eventsTotal: 1,
                        latest: {},
                    },
                ],
            },
            blocked: [
                { taskId: 8, displayId: "WEB-8", title: "Stuck", waitingFor: [], projectId: 3 },
            ],
            delegatedTotal: 1,
            delegated: [task({ taskId: 9, displayId: "WEB-9" })],
        });
        render(
            <CssVarsProvider>
                <TodayBriefing
                    view={{ status: "ready", data, since: null, refresh: vi.fn() }}
                    onAction={vi.fn()}
                />
            </CssVarsProvider>
        );
        const grid = screen.getByTestId("today-sections");
        // No side column, no second band: every section is a direct child of the one grid.
        const titles = Array.from(grid.children).map(
            (c) => c.querySelector("h3")?.firstChild?.textContent
        );
        expect(titles).toEqual([
            copy.sections.due,
            copy.sections.next,
            copy.sections.waiting,
            copy.sections.changed,
            copy.sections.blocked,
            copy.sections.delegated,
        ]);
        expect(getComputedStyle(grid).display).toBe("grid");
        // Every task row of every list is the same structure.
        for (const li of grid.querySelectorAll("li[data-kind]")) {
            // The row's body (a button, or a plain block for a row with no path) fills the width.
            expect(getComputedStyle(li.firstElementChild as Element).width).toBe("100%");
            expect(getComputedStyle(li).display).not.toBe("flex");
        }
    });
});
