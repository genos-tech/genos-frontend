/**
 * The start/end auto-shift, wired up in the modal.
 *
 * `timedRange.test.ts` covers the arithmetic. This covers the part that
 * arithmetic can't: that the two inputs are actually connected to it,
 * and that the all-day branch is NOT — all-day inputs hold date-only
 * values, where the same math would shift dates across timezones.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarEventModal } from "../features/integrations/components/CalendarEventModal";

const updateEvent = vi.hoisted(() => vi.fn());
const createEvent = vi.hoisted(() => vi.fn());
const deleteEvent = vi.hoisted(() => vi.fn());
const getEvent = vi.hoisted(() => vi.fn());

vi.mock("../features/integrations/services/calendar", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/integrations/services/calendar")>();
    return { ...actual, updateEvent, createEvent, deleteEvent, getEvent };
});

/** 9pm–10pm local, the shape the create paths seed. */
const timedInitial = {
    account_id: "acct-1",
    calendar_id: "primary",
    summary: "Design review",
    start: new Date(2026, 6, 29, 21, 0).toISOString(),
    end: new Date(2026, 6, 29, 22, 0).toISOString(),
};

const renderModal = (initial: Record<string, unknown> = timedInitial) => {
    const utils = render(
        <CssVarsProvider>
            <CalendarEventModal accessToken="tok" initial={initial} open onClose={vi.fn()} />
        </CssVarsProvider>
    );
    // Joy's Modal portals its content, so it is not under `container`.
    const inputs = document.body.querySelectorAll<HTMLInputElement>(
        'input[type="datetime-local"], input[type="date"]'
    );
    return { ...utils, start: inputs[0], end: inputs[1] };
};

beforeEach(() => {
    vi.clearAllMocks();
    createEvent.mockResolvedValue({ id: "new" });
    updateEvent.mockResolvedValue({ id: "evt" });
});

describe("CalendarEventModal — start/end auto-shift", () => {
    it("moves the end when the start is changed", () => {
        const { start, end } = renderModal();
        expect(start.value).toBe("2026-07-29T21:00");
        expect(end.value).toBe("2026-07-29T22:00");

        fireEvent.change(start, { target: { value: "2026-07-29T23:00" } });

        expect(end.value).toBe("2026-07-30T00:00");
    });

    it("backs the start up when the end is set before it", () => {
        const { start, end } = renderModal();

        fireEvent.change(end, { target: { value: "2026-07-29T20:00" } });

        expect(start.value).toBe("2026-07-29T19:00");
        expect(end.value).toBe("2026-07-29T20:00");
    });

    it("leaves the start alone when the end is simply extended", () => {
        const { start, end } = renderModal();

        fireEvent.change(end, { target: { value: "2026-07-29T23:30" } });

        expect(start.value).toBe("2026-07-29T21:00");
        expect(end.value).toBe("2026-07-29T23:30");
    });

    it("keeps a 30-minute event 30 minutes long", () => {
        const { start, end } = renderModal({
            ...timedInitial,
            end: new Date(2026, 6, 29, 21, 30).toISOString(),
        });

        fireEvent.change(start, { target: { value: "2026-07-29T14:00" } });

        expect(end.value).toBe("2026-07-29T14:30");
    });

    it("does not touch the partner field while a value is mid-edit", () => {
        // `datetime-local` fires onChange with "" as the user clears it;
        // the other field must not go blank or jump.
        const { start, end } = renderModal();

        fireEvent.change(start, { target: { value: "" } });

        expect(end.value).toBe("2026-07-29T22:00");
    });

    it("leaves all-day dates alone in both directions", () => {
        // Date-only values: the timed math would shift these across
        // timezones. All-day keeps its `min` constraint + submit clamp.
        const { start, end } = renderModal({
            ...timedInitial,
            all_day: true,
            start: "2026-07-29",
            end: "2026-07-31",
        });

        fireEvent.change(start, { target: { value: "2026-08-05" } });
        expect(end.value).toBe("2026-07-30");

        fireEvent.change(end, { target: { value: "2026-08-01" } });
        expect(start.value).toBe("2026-08-05");
    });
});
