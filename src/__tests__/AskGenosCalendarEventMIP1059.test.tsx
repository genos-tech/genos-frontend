/**
 * "Ask Genos about this event" (MIP-1059, genos-api AGENT_PARITY_TOOLS).
 *
 * The step-5 hand-off, for a calendar event: the event dialog (edit mode, opened from the calendar)
 * offers it; the click closes the dialogs and raises the same window event a task menu raises, with
 * the event as a structured mention `{type: "calendar_event", account_id, calendar_id, event_id, label}`
 * and `#Title ` in the draft. The server drops a malformed or foreign id silently and never reads
 * Google at ask time, so the wire shape is exactly the contract's.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import {
    act,
    cleanup,
    fireEvent,
    render,
    renderHook,
    screen,
    waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    mentionKey,
    toWireMentions,
    type AgentMentionRef,
} from "../features/agentQA/mentions/types";
import { useAgentMentionDraft } from "../features/agentQA/mentions/useAgentMentionDraft";
import { CalendarModal } from "../features/calendar/components/CalendarModal";
import { CalendarEventModal } from "../features/integrations/components/CalendarEventModal";
import {
    askGenosRefForCalendarEvent,
    askGenosToken,
    onAskGenosAbout,
    takePendingAskRefs,
    withAskGenosToken,
} from "../features/spotlight/askGenosAbout";
import { en } from "../i18n/locales/en";

const ACCOUNT = "8f5e4733-1a2b-4c3d-8e9f-0123456789ab";

const EVENT = {
    accountId: ACCOUNT,
    calendarId: "me@work.com",
    eventId: "abc123def",
    summary: "Dentist appointment",
    fallbackLabel: "Untitled event",
};
const REF: AgentMentionRef = {
    kind: "calendar_event",
    accountId: ACCOUNT,
    calendarId: "me@work.com",
    eventId: "abc123def",
    label: "Dentist appointment",
};

beforeEach(() => {
    localStorage.clear();
    takePendingAskRefs();
});
afterEach(cleanup);

describe("askGenosRefForCalendarEvent", () => {
    it("names the event by its three ids and its title", () => {
        expect(askGenosRefForCalendarEvent(EVENT)).toEqual(REF);
    });

    it("cuts a long title by character, never in the middle of an emoji", () => {
        const emoji = askGenosRefForCalendarEvent({ ...EVENT, summary: "😀".repeat(80) });
        expect(Array.from(emoji?.label ?? "")).toHaveLength(60);
        expect(emoji?.label).toBe(`${"😀".repeat(59)}…`);
    });

    it("puts the title on one line and caps it, so the draft stays a line", () => {
        const long = askGenosRefForCalendarEvent({
            ...EVENT,
            summary: `  Quarterly\n  planning ${"x".repeat(100)}  `,
        });
        expect(long?.label.startsWith("Quarterly planning x")).toBe(true);
        expect(long?.label.length).toBe(60);
        expect(long?.label.endsWith("…")).toBe(true);
    });

    it("says the event is untitled when it has no title", () => {
        expect(askGenosRefForCalendarEvent({ ...EVENT, summary: "  " })?.label).toBe(
            "Untitled event"
        );
        expect(askGenosRefForCalendarEvent({ ...EVENT, summary: null })?.label).toBe(
            "Untitled event"
        );
    });

    it("takes the account's primary calendar when none is known", () => {
        expect(askGenosRefForCalendarEvent({ ...EVENT, calendarId: "" })).toMatchObject({
            calendarId: "primary",
        });
        expect(askGenosRefForCalendarEvent({ ...EVENT, calendarId: undefined })).toMatchObject({
            calendarId: "primary",
        });
    });

    it("gives nothing for an event with no account or no id", () => {
        expect(askGenosRefForCalendarEvent({ ...EVENT, accountId: "" })).toBeNull();
        expect(askGenosRefForCalendarEvent({ ...EVENT, accountId: undefined })).toBeNull();
        expect(askGenosRefForCalendarEvent({ ...EVENT, eventId: " " })).toBeNull();
    });
});

describe("the mention on the wire", () => {
    it("is exactly the contract's shape", () => {
        expect(toWireMentions([REF])).toEqual([
            {
                type: "calendar_event",
                account_id: ACCOUNT,
                calendar_id: "me@work.com",
                event_id: "abc123def",
                label: "Dentist appointment",
            },
        ]);
    });

    it("keeps two different calendar/event pairs apart even when they hold colons", () => {
        const a = { ...REF, calendarId: "a:b", eventId: "c" } as AgentMentionRef;
        const b = { ...REF, calendarId: "a", eventId: "b:c" } as AgentMentionRef;
        expect(mentionKey(a)).not.toBe(mentionKey(b));
    });

    it("is one mention per event, and two accounts' same id are two", () => {
        const other = {
            ...REF,
            accountId: "11111111-2222-3333-4444-555555555555",
        } as AgentMentionRef;
        expect(mentionKey(REF)).not.toBe(mentionKey(other));
        expect(mentionKey(REF)).toBe(
            mentionKey({ ...REF, label: "Another title" } as AgentMentionRef)
        );
    });

    it("is kept with the ask while its title, spaces and all, stands in the draft", () => {
        const draft = withAskGenosToken("", askGenosToken(REF)) + "when is it?";
        expect(draft).toBe("#Dentist appointment when is it?");
        const { result } = renderHook(() =>
            useAgentMentionDraft({ value: draft, onChange: vi.fn(), members: [], entities: [] })
        );
        act(() => result.current.adopt([REF]));
        expect(result.current.consumeMentions(draft)).toEqual([REF]);
    });

    it("is dropped when the person deletes its token", () => {
        const { result } = renderHook(() =>
            useAgentMentionDraft({ value: "", onChange: vi.fn(), members: [], entities: [] })
        );
        act(() => result.current.adopt([REF]));
        expect(result.current.consumeMentions("when is it?")).toEqual([]);
    });
});

// ---- the dialog -------------------------------------------------------------------------------

const updateEvent = vi.hoisted(() => vi.fn());

const modal = (props: Record<string, unknown> = {}) =>
    render(
        <CssVarsProvider>
            <CalendarEventModal
                accessToken="tok"
                editingEventId="abc123def"
                initial={{
                    account_id: ACCOUNT,
                    calendar_id: "me@work.com",
                    summary: "Dentist appointment",
                    start: "2026-12-01T10:00:00.000Z",
                    end: "2026-12-01T10:30:00.000Z",
                }}
                open
                onClose={vi.fn()}
                {...props}
            />
        </CssVarsProvider>
    );
const ASK = en.calendar.event.askGenos;

describe("the event dialog's Ask Genos button", () => {
    const heard = () => {
        const refs: AgentMentionRef[] = [];
        const off = onAskGenosAbout((r) => refs.push(r));
        return { refs, off };
    };

    it("is offered for an event being edited: it closes what is under it, then hands over the event", async () => {
        const closeForAsk = vi.fn();
        const { refs, off } = heard();
        modal({ closeForAsk });
        fireEvent.click(screen.getByRole("button", { name: ASK }));
        // closed first, in this tick; the hand-off follows on the next one
        expect(closeForAsk).toHaveBeenCalledTimes(1);
        expect(refs).toEqual([]);
        await waitFor(() => expect(refs).toEqual([REF]));
        off();
    });

    it("names the event that exists, not a title half-typed in the form", async () => {
        const { refs, off } = heard();
        modal({ closeForAsk: vi.fn() });
        fireEvent.change(screen.getByDisplayValue("Dentist appointment"), {
            target: { value: "Dentist, moved" },
        });
        fireEvent.click(screen.getByRole("button", { name: ASK }));
        await waitFor(() => expect(refs).toHaveLength(1));
        off();
        expect(refs[0]).toEqual(REF);
    });

    it("cannot be clicked while a save or delete is under way", async () => {
        const closeForAsk = vi.fn();
        updateEvent.mockReturnValue(new Promise(() => undefined));
        modal({ closeForAsk });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        const ask = await screen.findByRole("button", { name: ASK });
        await waitFor(() => expect((ask as HTMLButtonElement).disabled).toBe(true));
        fireEvent.click(ask);
        expect(closeForAsk).not.toHaveBeenCalled();
    });

    it("is not there unless the opener supplies the way to close (a task's linked event)", () => {
        modal();
        expect(screen.queryByRole("button", { name: ASK })).toBeNull();
    });

    it("is not there for a new event", () => {
        modal({ closeForAsk: vi.fn(), editingEventId: undefined, initial: undefined });
        expect(screen.queryByRole("button", { name: ASK })).toBeNull();
    });

    it("is not there for an event that cannot be named (no account)", () => {
        modal({
            closeForAsk: vi.fn(),
            initial: {
                summary: "Dentist appointment",
                start: "2026-12-01T10:00:00.000Z",
                end: "2026-12-01T10:30:00.000Z",
            },
        });
        expect(screen.queryByRole("button", { name: ASK })).toBeNull();
    });
});

// ---- from the calendar ------------------------------------------------------------------------

const calendarApi = vi.hoisted(() => ({ listCalendars: vi.fn(), listEventsAggregate: vi.fn() }));
vi.mock("../features/integrations/services/calendar", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/integrations/services/calendar")>();
    return { ...actual, ...calendarApi, updateEvent };
});
vi.mock("../features/integrations/services/connections", () => ({
    listConnections: vi.fn(async () => ({ connections: [] })),
    findGoogleConnections: () => [{ id: ACCOUNT, label: "me@work.com" }],
    hasAnyCalendarScope: () => true,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

describe("from the calendar", { timeout: 30_000 }, () => {
    it("closes the dialogs and raises the ask with the event", async () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0);
        calendarApi.listCalendars.mockResolvedValue({
            calendars: [
                {
                    id: "me@work.com",
                    account_id: ACCOUNT,
                    account_email: "me@work.com",
                    summary: "me",
                    primary: true,
                    access_role: "owner",
                    selected: true,
                },
            ],
            failed_accounts: [],
            accounts: [],
        });
        calendarApi.listEventsAggregate.mockResolvedValue({
            items: [
                {
                    id: "abc123def",
                    summary: "Dentist appointment",
                    start: { dateTime: start.toISOString() },
                    end: { dateTime: new Date(start.getTime() + 1800000).toISOString() },
                    _source: {
                        account_id: ACCOUNT,
                        account_email: "me@work.com",
                        calendar_id: "me@work.com",
                    },
                },
            ],
            failed_sources: [],
        });
        const heard: AgentMentionRef[] = [];
        const off = onAskGenosAbout((r) => heard.push(r));
        const onClose = vi.fn();
        render(
            <CssVarsProvider>
                <CalendarModal open onClose={onClose} />
            </CssVarsProvider>
        );
        // The event is on today's grid (month view is the default): open it.
        // (a Joy Chip's button is its own action overlay, named by the label)
        fireEvent.click(await screen.findByRole("button", { name: /Dentist appointment/ }));
        fireEvent.click(await screen.findByRole("button", { name: ASK }));
        // The calendar is closed first, and the hand-off follows on the next tick.
        expect(onClose).toHaveBeenCalled();
        await waitFor(() => expect(heard).toEqual([REF]));
        off();
        expect(takePendingAskRefs()).toEqual([REF]);
    });
});
