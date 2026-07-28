/**
 * MonthView renders a multi-day event exactly ONCE.
 *
 * The failure this guards is silent and looks plausible: the modal
 * buckets events into every day they touch for the "+N more" popover,
 * and MonthView draws spanning bars from the raw event list. If the
 * chip bucket isn't filtered, a three-day trip renders SIX times — a
 * bar plus a chip on each of its three days — and the grid still looks
 * like a calendar, just a wrong one.
 *
 * Rendered rather than unit-tested because the bug lives in the seam
 * between the two data paths, which is exactly what a unit test on
 * either side would miss.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { describe, expect, it, vi } from "vitest";

import { MonthView } from "../features/calendar/components/MonthView";
import { isMultiDaySpan } from "../features/calendar/utils/multiDay";
import { CalendarEvent } from "../features/integrations/services/calendar";

const FOCUSED = dayjs("2026-07-01");

const allDay = (id: string, start: string, endExclusive: string): CalendarEvent => ({
    id,
    summary: id,
    start: { date: start },
    end: { date: endExclusive },
});

const timed = (id: string, startISO: string): CalendarEvent => ({
    id,
    summary: id,
    start: { dateTime: startISO },
    end: { dateTime: dayjs(startISO).add(1, "hour").toISOString() },
});

/** Mirrors what CalendarModal passes down: chips exclude spans. */
const chipBuckets = (events: CalendarEvent[]): Record<string, CalendarEvent[]> => {
    const out: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
        if (isMultiDaySpan(e)) continue;
        const raw = e.start?.date || e.start?.dateTime;
        if (!raw) continue;
        const key = dayjs(raw).format("YYYY-MM-DD");
        (out[key] ??= []).push(e);
    }
    return out;
};

/** Joy's `useColorScheme` requires the CssVars provider. */
const renderMonth = (events: CalendarEvent[], handlers: Partial<Handlers> = {}) => {
    const onCellClick = handlers.onCellClick ?? vi.fn();
    const onEventClick = handlers.onEventClick ?? vi.fn();
    const onShowMore = handlers.onShowMore ?? vi.fn();
    const result = render(
        <CssVarsProvider>
            <MonthView
                busyLabel="Busy"
                colorBySource={{}}
                events={events}
                eventsByDay={chipBuckets(events)}
                focused={FOCUSED}
                freeBusySources={new Set()}
                onCellClick={onCellClick}
                onEventClick={onEventClick}
                onShowMore={onShowMore}
            />
        </CssVarsProvider>
    );
    return { ...result, onCellClick, onEventClick, onShowMore };
};

interface Handlers {
    onCellClick: () => void;
    onEventClick: (e: CalendarEvent) => void;
    onShowMore: (key: string) => void;
}

describe("MonthView multi-day spans", () => {
    it("renders a 3-day event once, not once per day", () => {
        // 6th → 9th exclusive = the 6th, 7th and 8th.
        renderMonth([allDay("Trip", "2026-07-06", "2026-07-09")]);
        expect(screen.getAllByText("Trip")).toHaveLength(1);
    });

    it("still renders single-day events as chips", () => {
        renderMonth([allDay("Solo", "2026-07-06", "2026-07-07")]);
        expect(screen.getAllByText("Solo")).toHaveLength(1);
    });

    it("renders a timed event once on its start day", () => {
        renderMonth([timed("Standup", "2026-07-06T09:00:00Z")]);
        expect(screen.getAllByText("Standup")).toHaveLength(1);
    });

    it("renders a span once PER WEEK it crosses", () => {
        // A 10-day event covers two week rows, and each row draws its own
        // clipped segment — two bars total, not ten chips and not one
        // bar that impossibly wraps.
        renderMonth([allDay("LongTrip", "2026-07-06", "2026-07-16")]);
        expect(screen.getAllByText("LongTrip")).toHaveLength(2);
    });

    it("keeps spans and chips from colliding on the same day", () => {
        renderMonth([
            allDay("Trip", "2026-07-06", "2026-07-09"),
            timed("Standup", "2026-07-07T09:00:00Z"),
        ]);
        expect(screen.getAllByText("Trip")).toHaveLength(1);
        expect(screen.getAllByText("Standup")).toHaveLength(1);
    });

    it("shows Busy for a title-less event on a free/busy calendar", () => {
        const shared: CalendarEvent = {
            id: "fb",
            start: { dateTime: "2026-07-06T09:00:00Z" },
            end: { dateTime: "2026-07-06T10:00:00Z" },
            _source: { account_id: "a", account_email: "me@work.com", calendar_id: "teammate" },
        };
        render(
            <CssVarsProvider>
                <MonthView
                    busyLabel="Busy"
                    colorBySource={{}}
                    events={[shared]}
                    eventsByDay={{ "2026-07-06": [shared] }}
                    focused={FOCUSED}
                    freeBusySources={new Set(["a:teammate"])}
                    onCellClick={vi.fn()}
                    onEventClick={vi.fn()}
                    onShowMore={vi.fn()}
                />
            </CssVarsProvider>
        );
        expect(screen.getAllByText("Busy").length).toBeGreaterThan(0);
        expect(screen.queryByText("(no title)")).toBeNull();
    });

    it("lets you click a multi-day bar to edit it", () => {
        // Regression: the content layer is `pointerEvents: none` so
        // empty space falls through to the day cell. Chips opted back in
        // with `pointerEvents: auto`, the span bars did NOT — so they
        // rendered perfectly and were completely inert. Asserting the
        // element exists would not have caught it; only a click does.
        const trip = allDay("Trip", "2026-07-06", "2026-07-09");
        const { onEventClick } = renderMonth([trip]);

        fireEvent.click(screen.getByText("Trip"));

        expect(onEventClick).toHaveBeenCalledTimes(1);
        expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: "Trip" }));
    });

    it("lets you click a single-day chip to edit it", () => {
        // Joy puts a clickable Chip's handler on an absolutely
        // positioned sibling <button class="MuiChip-action">, not on the
        // label. jsdom does no hit-testing, so clicking the label text
        // never reaches that button even though a real click does —
        // hence targeting the button by role rather than by text.
        const { onEventClick } = renderMonth([timed("Standup", "2026-07-06T09:00:00Z")]);

        fireEvent.click(screen.getByRole("button", { name: /Standup/ }));

        expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: "Standup" }));
    });

    it("does not fire the create-on-day handler when a bar is clicked", () => {
        // The bar sits above the cell; a click must not ALSO open the
        // create modal for the day underneath it.
        const { onCellClick, onEventClick } = renderMonth([
            allDay("Trip", "2026-07-06", "2026-07-09"),
        ]);

        fireEvent.click(screen.getByText("Trip"));

        expect(onEventClick).toHaveBeenCalledTimes(1);
        expect(onCellClick).not.toHaveBeenCalled();
    });

    it("renders an empty month without crashing", () => {
        const { container } = renderMonth([]);
        expect(container).toBeTruthy();
    });
});
