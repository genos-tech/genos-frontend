/**
 * Editing and deleting one occurrence of a repeating series.
 *
 * The bug this exists for is silent and destructive: the modal holds the
 * start/end of the INSTANCE the user opened. Sending those to the series
 * MASTER moves the entire series onto that occurrence's date — open the
 * third standup, fix a typo, choose "all events", and every occurrence
 * jumps two weeks forward. The UI gives no hint that it happened.
 *
 * Its mirror image: `recurrence` only means anything on the master, so a
 * single-occurrence edit must omit it. Sending `[]` there would end the
 * repetition.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const MASTER_ID = "master-abc";
const INSTANCE_ID = "master-abc_20260817T090000Z";

const instanceInitial = {
    account_id: "acct-1",
    calendar_id: "primary",
    recurring_event_id: MASTER_ID,
    summary: "Standup",
    start: "2026-08-17T09:00:00.000Z",
    end: "2026-08-17T09:15:00.000Z",
};

const renderModal = (props: Record<string, unknown> = {}) =>
    render(
        <CssVarsProvider>
            <CalendarEventModal
                accessToken="tok"
                editingEventId={INSTANCE_ID}
                initial={instanceInitial}
                open
                onClose={vi.fn()}
                {...props}
            />
        </CssVarsProvider>
    );

const chooseScope = (label: RegExp) => fireEvent.click(screen.getByRole("radio", { name: label }));

beforeEach(() => {
    vi.clearAllMocks();
    updateEvent.mockResolvedValue({ id: INSTANCE_ID });
    createEvent.mockResolvedValue({ id: "new" });
    deleteEvent.mockResolvedValue(true);
    getEvent.mockResolvedValue({
        id: MASTER_ID,
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
    });
});

describe("editing one occurrence of a series", () => {
    it("offers a scope choice", async () => {
        renderModal();
        expect(await screen.findByRole("radio", { name: /this event/i })).toBeTruthy();
        expect(screen.getByRole("radio", { name: /all events/i })).toBeTruthy();
    });

    it("shows no scope choice for a one-off event", () => {
        renderModal({ initial: { ...instanceInitial, recurring_event_id: undefined } });
        expect(screen.queryByRole("radio", { name: /all events/i })).toBeNull();
    });

    it("loads the master's rule, since an instance carries none", async () => {
        renderModal();
        await waitFor(() =>
            expect(getEvent).toHaveBeenCalledWith("tok", MASTER_ID, {
                accountId: "acct-1",
                calendarId: "primary",
            })
        );
    });

    it("patches the INSTANCE by default", async () => {
        renderModal();
        fireEvent.click(screen.getByText("Save"));
        await waitFor(() => expect(updateEvent).toHaveBeenCalled());
        expect(updateEvent.mock.calls[0][1]).toBe(INSTANCE_ID);
    });

    it("patches the MASTER when scope is all events", async () => {
        renderModal();
        chooseScope(/all events/i);
        fireEvent.click(screen.getByText("Save"));
        await waitFor(() => expect(updateEvent).toHaveBeenCalled());
        expect(updateEvent.mock.calls[0][1]).toBe(MASTER_ID);
    });

    it("does NOT send start/end when patching the master", async () => {
        // The whole point. With start/end included, the series relocates
        // to the opened occurrence's date.
        renderModal();
        chooseScope(/all events/i);
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(updateEvent).toHaveBeenCalled());
        const payload = updateEvent.mock.calls[0][2];
        expect(payload).not.toHaveProperty("start");
        expect(payload).not.toHaveProperty("end");
    });

    it("DOES send start/end when patching a single occurrence", async () => {
        // Moving one occurrence is a legitimate, common edit.
        renderModal();
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(updateEvent).toHaveBeenCalled());
        const payload = updateEvent.mock.calls[0][2];
        expect(payload).toHaveProperty("start");
        expect(payload).toHaveProperty("end");
    });

    it("does NOT send recurrence when patching a single occurrence", async () => {
        // An empty array here would silently end the repetition.
        renderModal();
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(updateEvent).toHaveBeenCalled());
        expect(updateEvent.mock.calls[0][2]).not.toHaveProperty("recurrence");
    });

    it("sends the rule when patching the master", async () => {
        renderModal();
        await waitFor(() => expect(getEvent).toHaveBeenCalled());
        chooseScope(/all events/i);
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(updateEvent).toHaveBeenCalled());
        expect(updateEvent.mock.calls[0][2].recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
    });
});

describe("deleting one occurrence of a series", () => {
    const armAndConfirmDelete = () => {
        fireEvent.click(screen.getByText("Delete"));
        fireEvent.click(screen.getByText(/Confirm delete\?|Delete all events\?/));
    };

    it("cancels only the instance by default", async () => {
        renderModal();
        armAndConfirmDelete();
        await waitFor(() => expect(deleteEvent).toHaveBeenCalled());
        expect(deleteEvent.mock.calls[0][1]).toBe(INSTANCE_ID);
    });

    it("removes the whole series when scope is all events", async () => {
        renderModal();
        chooseScope(/all events/i);
        armAndConfirmDelete();
        await waitFor(() => expect(deleteEvent).toHaveBeenCalled());
        expect(deleteEvent.mock.calls[0][1]).toBe(MASTER_ID);
    });

    it("warns explicitly before deleting a whole series", async () => {
        renderModal();
        chooseScope(/all events/i);
        fireEvent.click(screen.getByText("Delete"));
        expect(screen.getByText("Delete all events?")).toBeTruthy();
    });
});

describe("creating a repeating event", () => {
    it("sends no recurrence for a one-off", async () => {
        renderModal({
            editingEventId: undefined,
            // Title/start/end are all required, or the form blocks the
            // submit before any request is made.
            initial: {
                summary: "One-off",
                start: "2026-08-17T09:00:00.000Z",
                end: "2026-08-17T10:00:00.000Z",
            },
        });
        fireEvent.click(screen.getByText("Create"));
        await waitFor(() => expect(createEvent).toHaveBeenCalled());
        expect(createEvent.mock.calls[0][1].recurrence).toEqual([]);
    });
});
