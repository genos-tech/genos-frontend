/**
 * The calendar event chip and the dialog it opens (MIP-1059, genos-api AGENT_PARITY_TOOLS).
 *
 * A chip names an event by `(account_id, calendar_id, event_id)`. Its text is the event's title and
 * start in the viewer's language; one made by a delete the run never read an event for says so; a click
 * on the chip or on the inline citation of the same event opens ONE dialog, which reads the event with
 * the account and calendar of the chip and lands on the "deleted" notice when Google says it is gone.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentQAConversation } from "../features/agentQA/AgentQAConversation";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { SourceChipRow } from "../features/agentQA/AgentTurnSources";
import { sourceChipLabel } from "../features/agentQA/sourceChipLabel";
import {
    EMPTY_ASK_STATE,
    type CompletedTurn,
    type UseAgentQAReturn,
} from "../features/agentQA/types";
import {
    calendarEventRefFromSource,
    onOpenCalendarEvent,
    requestOpenCalendarEvent,
    type CalendarEventRef,
} from "../features/calendar/calendarEventLink";
import { CalendarEventLinkHost } from "../features/calendar/components/CalendarEventLinkHost";
import type { SpotlightResult } from "../features/spotlight/types";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { getMessages } from "../i18n";

const ACCOUNT = "8f5e4733-1a2b-4c3d-8e9f-0123456789ab";
const TOKEN = `calendar_event:${ACCOUNT}:abc123def`;

const chip = (over: Partial<SpotlightResult> = {}): SpotlightResult =>
    ({
        entity_type: "calendar_event",
        entity_id: TOKEN,
        title: "Standup",
        snippet: null,
        task_id: null,
        note_id: null,
        project_id: null,
        account_id: ACCOUNT,
        calendar_id: "me@work.com",
        event_id: "abc123def",
        event_start: "2026-12-01T10:00:00+09:00",
        event_end: "2026-12-01T10:30:00+09:00",
        event_all_day: false,
        operated: true,
        ...over,
    }) as unknown as SpotlightResult;

const labels = buildAgentTurnLabels(getMessages("en"), "spotlight");

beforeEach(() => {
    document.documentElement.lang = "en-US";
});
afterEach(() => {
    cleanup();
    document.documentElement.lang = "";
});

describe("the chip's words", () => {
    it("is the event's title and start", () => {
        const text = sourceChipLabel(chip(), labels);
        expect(text).toMatch(/^Event: Standup · Dec 1, /);
        // no weekday: a chip has little room
        expect(text).not.toMatch(/Tue/);
        // the end is not on a chip: it is a line of text, not a range
        expect(text).not.toContain("–");
    });

    it("says an all-day event's day, not a time", () => {
        const text = sourceChipLabel(
            chip({ event_start: "2026-12-24", event_end: "2026-12-25", event_all_day: true }),
            labels
        );
        expect(text).toContain("Dec 24");
        expect(text).not.toMatch(/\d:\d\d/);
    });

    it("words a delete the run never read (no title, no time) instead of showing an id", () => {
        const text = sourceChipLabel(
            chip({ title: "", event_start: null, event_end: null, event_all_day: null }),
            labels
        );
        expect(text).toBe("Deleted calendar event");
        expect(text).not.toContain(TOKEN);
    });

    it("calls a real event with no title untitled, and keeps its time", () => {
        const text = sourceChipLabel(chip({ title: "", operated: false }), labels);
        expect(text).toContain("(no title)");
        expect(text).toContain("Dec 1");
    });

    it("truncates a long title like every other chip", () => {
        const text = sourceChipLabel(chip({ title: "A".repeat(80) }), labels);
        expect(text).toContain("A".repeat(32) + "…");
        expect(text).not.toContain("A".repeat(33));
    });
});

describe("the chip row", () => {
    it("draws the event chip with the calendar icon and opens it on a click", async () => {
        const onOpen = vi.fn();
        render(
            <CssVarsProvider>
                <SourceChipRow labels={labels} query="" sources={[chip()]} onOpen={onOpen} />
            </CssVarsProvider>
        );
        const button = screen.getByRole("button", { name: /Event: Standup/ });
        // (the chip's button is Joy's action overlay: the icon sits beside it, in the chip)
        expect(screen.getByTestId("EventRoundedIcon")).toBeTruthy();
        await userEvent.click(button);
        expect(onOpen).toHaveBeenCalledWith(chip());
    });
});

describe("calendarEventRefFromSource", () => {
    it("reads the plain fields, never entity_id", () => {
        expect(calendarEventRefFromSource(chip({ entity_id: "calendar_event:garbage" }))).toEqual({
            accountId: ACCOUNT,
            calendarId: "me@work.com",
            eventId: "abc123def",
        });
    });

    it("defaults the calendar to the account's primary", () => {
        expect(calendarEventRefFromSource(chip({ calendar_id: null }))).toEqual({
            accountId: ACCOUNT,
            calendarId: "primary",
            eventId: "abc123def",
        });
    });

    it("is null for another kind, or a chip with no account or event", () => {
        expect(calendarEventRefFromSource(chip({ entity_type: "task" }))).toBeNull();
        expect(calendarEventRefFromSource(chip({ account_id: null }))).toBeNull();
        expect(calendarEventRefFromSource(chip({ event_id: "  " }))).toBeNull();
    });
});

describe("a click inside the Ask dialogs", () => {
    const turn: CompletedTurn = {
        id: 1,
        askedQuery: "what is on tomorrow?",
        answer: `See [the standup](${TOKEN}) and [${TOKEN}].`,
        answerSources: [chip()],
        toolEvents: [],
        askError: null,
        runId: null,
    };

    it.each([
        ["chip", () => screen.getByRole("button", { name: /Event: Standup/ })],
        ["inline link", () => screen.getByRole("button", { name: "the standup" })],
    ] as const)("opens the event dialog from a %s, not a URL preview", async (_name, find) => {
        const opened: CalendarEventRef[] = [];
        const stop = onOpenCalendarEvent((r) => opened.push(r));
        const onSelectSource = vi.fn();
        const openModalByHref = vi.fn();
        const state = {
            ask: { ...EMPTY_ASK_STATE },
            turns: [turn],
            onAsk: vi.fn(),
            submitFeedback: vi.fn(),
        } as unknown as UseAgentQAReturn;
        render(
            <CssVarsProvider>
                <UrlLinkModalProvider value={{ openModalByHref }}>
                    <AgentQAConversation
                        state={state}
                        turnLabels={buildAgentTurnLabels(getMessages("en"), "threadAsk")}
                        labels={{
                            conversation: { empty: "", placeholder: "", send: "", cancel: "" },
                            mentions: { ariaLabel: "" },
                        }}
                        onSelectSource={onSelectSource}
                    />
                </UrlLinkModalProvider>
            </CssVarsProvider>
        );
        await userEvent.click(find());
        stop();
        expect(opened).toEqual([
            { accountId: ACCOUNT, calendarId: "me@work.com", eventId: "abc123def" },
        ]);
        expect(openModalByHref).not.toHaveBeenCalled();
        expect(onSelectSource).not.toHaveBeenCalled();
    });
});

// ---- the dialog -------------------------------------------------------------------------------

const getEvent = vi.hoisted(() => vi.fn());
vi.mock("../features/integrations/services/calendar", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/integrations/services/calendar")>();
    return { ...actual, getEvent };
});
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const GOOGLE_EVENT = {
    id: "abc123def",
    summary: "Standup",
    description: "Daily sync",
    start: { dateTime: "2026-12-01T10:00:00+09:00" },
    end: { dateTime: "2026-12-01T10:30:00+09:00" },
};

const mountHost = () =>
    render(
        <CssVarsProvider>
            <CalendarEventLinkHost />
        </CssVarsProvider>
    );
const open = (over: Partial<CalendarEventRef> = {}) =>
    act(() =>
        requestOpenCalendarEvent({
            accountId: ACCOUNT,
            calendarId: "me@work.com",
            eventId: "abc123def",
            ...over,
        })
    );

describe("the event dialog a chip opens", () => {
    beforeEach(() => getEvent.mockReset());

    it("renders nothing until a chip is clicked", () => {
        mountHost();
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(getEvent).not.toHaveBeenCalled();
    });

    it("reads the event with the chip's account and calendar and opens it for editing", async () => {
        getEvent.mockResolvedValue(GOOGLE_EVENT);
        mountHost();
        open();
        await screen.findByDisplayValue("Standup");
        expect(getEvent).toHaveBeenCalledWith(
            "tok",
            "abc123def",
            { accountId: ACCOUNT, calendarId: "me@work.com" },
            expect.any(Function)
        );
        // the edit dialog, so a save goes to the right account
        expect(screen.getByText("Edit event")).toBeTruthy();
    });

    it("lands on the deleted notice when Google says the event is gone", async () => {
        getEvent.mockResolvedValue("event_deleted_upstream");
        mountHost();
        open();
        await screen.findByText("This event was deleted");
        expect(screen.getByText(/nothing left to open/)).toBeTruthy();
        expect(screen.queryByDisplayValue("Standup")).toBeNull();
    });

    it("says it could not open the event, and Retry reads it again", async () => {
        getEvent.mockResolvedValueOnce(null).mockResolvedValueOnce(GOOGLE_EVENT);
        mountHost();
        open();
        await screen.findByText("Couldn't open this event");
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        await screen.findByDisplayValue("Standup");
        expect(getEvent).toHaveBeenCalledTimes(2);
    });

    it("shows the service's own sentence for a sign-in that expired", async () => {
        getEvent.mockImplementation(async (_t, _id, _o, setErrorMessage) => {
            setErrorMessage?.("Reconnect Google Calendar.");
            return "google_reauth_required";
        });
        mountHost();
        open();
        await screen.findByText("Reconnect Google Calendar.");
    });

    it("ignores a slow answer for an event the person has since closed", async () => {
        let resolve: (v: unknown) => void = () => undefined;
        getEvent.mockReturnValue(new Promise((r) => (resolve = r)));
        mountHost();
        open();
        await screen.findByText("Calendar event");
        await userEvent.click(screen.getByRole("button", { name: "Close" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        await act(async () => resolve(GOOGLE_EVENT));
        expect(screen.queryByDisplayValue("Standup")).toBeNull();
    });
});
