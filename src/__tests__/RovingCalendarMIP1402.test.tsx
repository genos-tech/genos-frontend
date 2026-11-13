import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, waitFor } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MonthView } from "../features/calendar/components/MonthView";
import { TimelineView } from "../features/calendar/components/TimelineView";
import type { CalendarEvent } from "../features/integrations/services/calendar";

// MIP-1402: the REAL month grid and the REAL timeline with their roving tab stops. jsdom has
// no layout; the walk through a browser (Tab counts, focus ring, the month change) is in
// genos-docs design/evidence/MIP-1402.md.

const SRC = { account_id: "a", account_email: null, calendar_id: "c" };
const timed = (id: string, summary: string, day: number, h: number, m = 0): CalendarEvent => ({
    id,
    summary,
    _source: SRC,
    start: { dateTime: new Date(2026, 10, day, h, m).toISOString() },
    end: { dateTime: new Date(2026, 10, day, h + 1, m).toISOString() },
});
const allDay = (id: string, summary: string, from: number, to: number): CalendarEvent => ({
    id,
    summary,
    _source: SRC,
    start: { date: `2026-11-${String(from).padStart(2, "0")}` },
    end: { date: `2026-11-${String(to).padStart(2, "0")}` },
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 11, 12, 0));
});
afterEach(() => vi.useRealTimers());

const flush = () => new Promise<void>((r) => setTimeout(r, 40));
const tabbable = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
        (el) =>
            el.tabIndex >= 0 &&
            (el.matches("button, [role=button], [role=gridcell], a[href], input") ||
                el.hasAttribute("tabindex"))
    );

describe("MonthView", () => {
    const events = [
        timed("1", "Dentist", 3, 9),
        timed("2", "Planning", 11, 9),
        timed("3", "Retro", 11, 11),
        timed("4", "Lunch", 11, 12),
        allDay("5", "Trip", 16, 20),
    ];
    const eventsByDay: Record<string, CalendarEvent[]> = {
        "2026-11-03": [events[0]],
        "2026-11-11": [events[1], events[2], events[3]],
    };
    const handlers = () => ({
        onCellClick: vi.fn(),
        onEventClick: vi.fn(),
        onShowMore: vi.fn(),
        onNavigateToDay: vi.fn(),
    });
    const setup = (h = handlers()) => {
        const view = render(
            <CssVarsProvider>
                <MonthView
                    busyLabel="Busy"
                    colorBySource={{}}
                    events={events}
                    eventsByDay={eventsByDay}
                    focused={dayjs("2026-11-01")}
                    freeBusySources={new Set()}
                    {...h}
                />
            </CssVarsProvider>
        );
        return { ...view, h };
    };
    const cell = (c: HTMLElement, day: string) =>
        c.querySelector<HTMLElement>(`[data-roving-item="${day}"]`)!;

    it("is one Tab stop for the whole month: today's cell, no chip, bar or +N", async () => {
        const { container } = setup();
        await flush();
        const stops = tabbable(container);
        expect(stops.map((s) => s.getAttribute("data-roving-item"))).toEqual(["2026-11-11"]);
        // the chips and the span bar are still there for the mouse
        expect(container.textContent).toContain("Dentist");
        expect(container.textContent).toContain("Trip");
    });

    it("starts on the 1st when today is not in the month", async () => {
        vi.setSystemTime(new Date(2026, 4, 5));
        const { container } = setup();
        await flush();
        expect(tabbable(container).map((s) => s.getAttribute("data-roving-item"))).toEqual([
            "2026-11-01",
        ]);
    });

    it("is a named grid of rows and cells, each cell named by its date and how many events it has", () => {
        const { container, getByRole } = setup();
        expect(getByRole("grid").getAttribute("aria-label")).toBe("November 2026");
        expect(container.querySelectorAll('[role="row"]')).toHaveLength(6);
        expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(42);
        // MIP-1405: a count, not every title (long on a busy day), and what Enter does
        expect(cell(container, "2026-11-11").getAttribute("aria-label")).toBe(
            "Wednesday, November 11, 2026, 3 events"
        );
        expect(cell(container, "2026-11-11").getAttribute("aria-description")).toBe(
            "Press Enter to see the day's events."
        );
        expect(cell(container, "2026-11-03").getAttribute("aria-label")).toBe(
            "Tuesday, November 3, 2026, 1 event"
        );
        // a day only a span covers counts the span
        expect(cell(container, "2026-11-18").getAttribute("aria-label")).toBe(
            "Wednesday, November 18, 2026, 1 event"
        );
        expect(cell(container, "2026-11-13").getAttribute("aria-label")).toBe(
            "Friday, November 13, 2026"
        );
        expect(cell(container, "2026-11-13").getAttribute("aria-description")).toBe(
            "Press Enter to create an event."
        );
        expect(cell(container, "2026-11-11").getAttribute("aria-current")).toBe("date");
        expect(cell(container, "2026-11-10").hasAttribute("aria-current")).toBe(false);
    });

    it("arrows move by day and week, Home / End the week, and the stop follows", async () => {
        const { container } = setup();
        await flush();
        const wed = cell(container, "2026-11-11");
        wed.focus();
        fireEvent.keyDown(wed, { key: "ArrowRight" });
        expect(document.activeElement).toBe(cell(container, "2026-11-12"));
        fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
        expect(document.activeElement).toBe(cell(container, "2026-11-19"));
        fireEvent.keyDown(document.activeElement!, { key: "Home" });
        expect(document.activeElement).toBe(cell(container, "2026-11-15"));
        fireEvent.keyDown(document.activeElement!, { key: "End" });
        expect(document.activeElement).toBe(cell(container, "2026-11-21"));
        await flush();
        expect(tabbable(container).map((s) => s.getAttribute("data-roving-item"))).toEqual([
            "2026-11-21",
        ]);
    });

    it("PageDown, and an arrow off the edge, ask the host to show the other month", () => {
        const { container, h } = setup();
        const wed = cell(container, "2026-11-11");
        wed.focus();
        fireEvent.keyDown(wed, { key: "PageDown" });
        // A month on screen: Dec 11 is on this grid too, but the host shows December.
        expect(h.onNavigateToDay).toHaveBeenCalledTimes(1);
        expect(h.onNavigateToDay.mock.calls[0][0].format("YYYY-MM-DD")).toBe("2026-12-11");
        fireEvent.keyDown(wed, { key: "PageUp" });
        expect(h.onNavigateToDay.mock.calls[1][0].format("YYYY-MM-DD")).toBe("2026-10-11");
        const first = cell(container, "2026-11-01");
        first.focus();
        fireEvent.keyDown(first, { key: "ArrowLeft" });
        expect(h.onNavigateToDay.mock.calls[2][0].format("YYYY-MM-DD")).toBe("2026-10-31");
    });

    it("Enter opens the list of a day that has events, creates on an empty one", () => {
        const { container, h } = setup();
        const busy = cell(container, "2026-11-11");
        busy.focus();
        fireEvent.keyDown(busy, { key: "Enter" });
        expect(h.onShowMore).toHaveBeenCalledWith("2026-11-11");
        expect(h.onCellClick).not.toHaveBeenCalled();
        // a day only a span covers is busy too
        const spanDay = cell(container, "2026-11-18");
        spanDay.focus();
        fireEvent.keyDown(spanDay, { key: "Enter" });
        expect(h.onShowMore).toHaveBeenLastCalledWith("2026-11-18");
        const empty = cell(container, "2026-11-13");
        empty.focus();
        fireEvent.keyDown(empty, { key: "Enter" });
        expect(h.onCellClick).toHaveBeenCalledTimes(1);
        expect(h.onCellClick.mock.calls[0][0].format("YYYY-MM-DD")).toBe("2026-11-13");
    });

    it("a click on a chip still edits that event, a click on the cell still creates", () => {
        const { container, getByText, h } = setup();
        // Joy's clickable chip is a button over its label.
        fireEvent.click(getByText("Dentist").closest(".MuiChip-root")!.querySelector("button")!);
        expect(h.onEventClick).toHaveBeenCalledTimes(1);
        fireEvent.click(cell(container, "2026-11-13"));
        expect(h.onCellClick).toHaveBeenCalledTimes(1);
    });

    it("the cell focused by a click becomes the stop", async () => {
        const { container } = setup();
        await flush();
        cell(container, "2026-11-20").focus();
        await waitFor(() =>
            expect(tabbable(container).map((s) => s.getAttribute("data-roving-item"))).toEqual([
                "2026-11-20",
            ])
        );
    });
});

describe("TimelineView", () => {
    const events = [
        timed("a", "Standup", 9, 10),
        timed("b", "Design", 9, 14),
        allDay("c", "Offsite", 11, 12),
        timed("d", "Planning", 11, 9),
        timed("e", "Lunch", 11, 12),
        allDay("f", "Trip", 12, 14),
    ];
    const setup = (view: "week" | "day" | "3day" = "week", anchor = "2026-11-11") => {
        const onEventClick = vi.fn();
        const onCreateAt = vi.fn();
        const utils = render(
            <CssVarsProvider>
                <TimelineView
                    anchor={dayjs(anchor)}
                    busyLabel="Busy"
                    colorBySource={{}}
                    events={events}
                    freeBusySources={new Set()}
                    view={view}
                    onCreateAt={onCreateAt}
                    onEventClick={onEventClick}
                />
            </CssVarsProvider>
        );
        return { ...utils, onEventClick, onCreateAt };
    };
    const createStop = (c: HTMLElement, day: string) =>
        c.querySelector<HTMLElement>(`[data-roving-item="create|${day}"]`)!;
    const byName = (c: HTMLElement, text: string) =>
        Array.from(c.querySelectorAll<HTMLElement>("[data-roving-item]")).find((el) =>
            el.textContent?.startsWith(text)
        )!;

    it("is one Tab stop per day, empty or not, and not one per event", async () => {
        const { container } = setup();
        await flush();
        const stops = tabbable(container).map((s) => s.getAttribute("data-roving-group"));
        // 7 days of the week of Nov 8; MIP-1402 had 3 (the days with events), an empty day had none
        expect(new Set(stops)).toEqual(
            new Set([
                "2026-11-08",
                "2026-11-09",
                "2026-11-10",
                "2026-11-11",
                "2026-11-12",
                "2026-11-13",
                "2026-11-14",
            ])
        );
        expect(stops).toHaveLength(7);
        // 6 events + a "New event" item for each of the 7 days
        expect(container.querySelectorAll("[data-roving-item]")).toHaveLength(13);
    });

    it("an empty day's only stop is its New event item, named by the day", async () => {
        const { container } = setup();
        await flush();
        const stop = createStop(container, "2026-11-10");
        expect(stop.getAttribute("tabindex")).toBe("0");
        expect(stop.getAttribute("role")).toBe("button");
        expect(stop.getAttribute("aria-label")).toBe("New event, Tuesday, November 10, 2026");
    });

    it("a day with events starts on New event too, its events are one ArrowDown away", async () => {
        const { container } = setup();
        await flush();
        // Tab walks the day headers left to right; the events are inside the day
        expect(createStop(container, "2026-11-11").getAttribute("tabindex")).toBe("0");
        const offsite = byName(container, "Offsite");
        expect(offsite.getAttribute("tabindex")).toBe("-1");
        createStop(container, "2026-11-11").focus();
        fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
        expect(document.activeElement).toBe(offsite);
        await flush();
        // the stop followed the focus
        expect(offsite.getAttribute("tabindex")).toBe("0");
        expect(createStop(container, "2026-11-11").getAttribute("tabindex")).toBe("-1");
        fireEvent.keyDown(offsite, { key: "ArrowUp" });
        expect(document.activeElement).toBe(createStop(container, "2026-11-11"));
    });

    it("Enter and Space on New event create at 9:00 of that day, on an empty day too", () => {
        const { container, onCreateAt, onEventClick } = setup();
        const empty = createStop(container, "2026-11-10");
        empty.focus();
        fireEvent.keyDown(empty, { key: "Enter" });
        expect(onCreateAt).toHaveBeenCalledTimes(1);
        expect(onCreateAt.mock.calls[0][0].format("YYYY-MM-DD HH:mm")).toBe("2026-11-10 09:00");
        fireEvent.keyDown(empty, { key: " " });
        expect(onCreateAt).toHaveBeenCalledTimes(2);
        const busy = createStop(container, "2026-11-11");
        busy.focus();
        fireEvent.keyDown(busy, { key: "Enter" });
        expect(onCreateAt.mock.calls[2][0].format("YYYY-MM-DD HH:mm")).toBe("2026-11-11 09:00");
        expect(onEventClick).not.toHaveBeenCalled();
    });

    it("is one stop in the day view, empty or not", async () => {
        for (const day of ["2026-11-10", "2026-11-11"]) {
            const { container } = setup("day", day);
            await flush();
            expect(tabbable(container).map((s) => s.getAttribute("data-roving-item"))).toEqual([
                `create|${day}`,
            ]);
        }
    });

    it("the New event item does not take mouse clicks (the header stays inert)", () => {
        const { container, onCreateAt } = setup();
        const stop = createStop(container, "2026-11-10");
        expect(getComputedStyle(stop).pointerEvents).toBe("none");
        expect(onCreateAt).not.toHaveBeenCalled();
    });

    it("after New event a day has its all-day items, then its events by start time", async () => {
        const { container } = setup();
        await flush();
        expect(byName(container, "Offsite").getAttribute("tabindex")).toBe("-1");
        expect(byName(container, "Planning").getAttribute("tabindex")).toBe("-1");
        byName(container, "Offsite").focus();
        fireEvent.keyDown(byName(container, "Offsite"), { key: "ArrowDown" });
        expect(document.activeElement).toBe(byName(container, "Planning"));
        fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
        expect(document.activeElement).toBe(byName(container, "Lunch"));
        fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" }); // the end
        expect(document.activeElement).toBe(byName(container, "Lunch"));
    });

    it("Left / Right go to the neighbouring day (an empty one too), Home / End to the day's ends", async () => {
        const { container } = setup();
        await flush();
        // Nov 11: New event, Offsite, Planning, Lunch. Nov 10 is empty: its last item is New event.
        byName(container, "Planning").focus();
        fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
        expect(document.activeElement).toBe(createStop(container, "2026-11-10"));
        fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
        // Nov 9: New event, Standup, Design: index 0 of the empty day
        expect(document.activeElement).toBe(createStop(container, "2026-11-09"));
        fireEvent.keyDown(document.activeElement!, { key: "End" });
        expect(document.activeElement).toBe(byName(container, "Design"));
        fireEvent.keyDown(document.activeElement!, { key: "Home" });
        expect(document.activeElement).toBe(createStop(container, "2026-11-09"));
        fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
        expect(document.activeElement).toBe(byName(container, "Standup"));
    });

    it("a multi-day bar belongs to its first day's column", async () => {
        const { container } = setup();
        expect(byName(container, "Trip").getAttribute("data-roving-group")).toBe("2026-11-12");
    });

    it("Enter on an event opens it (the block's own handler)", () => {
        const { container, onEventClick } = setup();
        const lunch = byName(container, "Lunch");
        lunch.focus();
        fireEvent.keyDown(lunch, { key: "Enter" });
        expect(onEventClick).toHaveBeenCalledTimes(1);
        expect(onEventClick.mock.calls[0][0].id).toBe("e");
    });

    it("names each day's column", () => {
        const { getByRole } = setup();
        expect(getByRole("group", { name: "Wednesday, November 11, 2026" })).toBeTruthy();
    });
});
