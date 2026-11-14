/**
 * What an approved agent calendar write changes in the browser (MIP-1059, genos-api
 * AGENT_PARITY_TOOLS).
 *
 * No socket event exists for a calendar. The approved write's `tool_call_result` carries a
 * `calendar_event` ref (the event, its account and calendar, and for a create or an update its new
 * times), and:
 *   1. the stream client passes it through (`dispatchLine` copies fields one by one, so a new field is
 *      silently dropped until it is added there);
 *   2. `emitCalendarEventToolResult` takes it only from the three calendar writes, only when the ref is
 *      consistent with the tool, and turns it into the window event the calendar listens for;
 *   3. an OPEN calendar grid drops every window it fetched for that source (exactly: not a substring
 *      of the selection) and reads the visible one again when its selection holds the source. The
 *      agent says `primary`; the grid's ids are the account's address, so `primary` is mapped.
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

import { emitCalendarEventToolResult } from "../features/agentQA/approvedCalendarWrites";
import { useAgentQA } from "../features/agentQA/useAgentQA";
import {
    emitCalendarChanged,
    onCalendarChanged,
    type CalendarChange,
} from "../features/calendar/calendarChanges";
import { CalendarModal } from "../features/calendar/components/CalendarModal";
import { resolveCalendarId } from "../features/calendar/utils/primaryCalendar";
import type { ToolResultCalendarEventRef } from "../services/agentApi";

const A = "8f5e4733-1a2b-4c3d-8e9f-0123456789ab";
const B = "11111111-2222-3333-4444-555555555555";

const REF: ToolResultCalendarEventRef = {
    action: "update",
    account_id: A,
    calendar_id: "primary",
    event_id: "evt1",
    start: "2026-12-01T10:00:00+09:00",
    end: "2026-12-01T10:30:00+09:00",
    all_day: false,
};

const listen = () => {
    const seen: CalendarChange[] = [];
    const stop = onCalendarChanged((c) => seen.push(c));
    return { seen, stop };
};

afterEach(cleanup);

describe("emitCalendarEventToolResult", () => {
    it.each([
        ["create_calendar_event", "create"],
        ["update_calendar_event", "update"],
        ["delete_calendar_event", "delete"],
    ] as const)("signals the calendar for an approved %s", (tool, action) => {
        const { seen, stop } = listen();
        emitCalendarEventToolResult(tool, { ...REF, action });
        stop();
        expect(seen).toEqual([{ action, accountId: A, calendarId: "primary", eventId: "evt1" }]);
    });

    it.each([
        ["no ref (the flag is off, or an older backend)", "update_calendar_event", undefined],
        ["a ref on another tool", "update_task", REF],
        ["a read tool", "get_calendar_event", REF],
        ["an action that is not the tool's", "create_calendar_event", REF],
        ["a ref with no account", "update_calendar_event", { ...REF, account_id: "" }],
        ["a ref with no calendar", "update_calendar_event", { ...REF, calendar_id: " " }],
        ["a ref with a number for an account", "update_calendar_event", { ...REF, account_id: 7 }],
    ])("does nothing for %s", (_label, tool, ref) => {
        const { seen, stop } = listen();
        emitCalendarEventToolResult(tool, ref as ToolResultCalendarEventRef | undefined);
        stop();
        expect(seen).toEqual([]);
    });
});

describe("resolveCalendarId", () => {
    const calendars = [
        { id: "me@work.com", account_id: A, primary: true },
        { id: "team@group.calendar.google.com", account_id: A, primary: false },
        { id: "me@gmail.com", account_id: B, primary: true },
    ];

    it("maps the agent's `primary` to the account's own calendar id", () => {
        expect(resolveCalendarId(calendars, A, "primary")).toBe("me@work.com");
        expect(resolveCalendarId(calendars, B, "primary")).toBe("me@gmail.com");
    });

    it("leaves any other id, an unknown account and an unloaded list as they are", () => {
        expect(resolveCalendarId(calendars, A, "team@group.calendar.google.com")).toBe(
            "team@group.calendar.google.com"
        );
        expect(resolveCalendarId(calendars, "nobody", "primary")).toBe("primary");
        expect(resolveCalendarId([], A, "primary")).toBe("primary");
    });
});

// ---- the stream client keeps the ref ----------------------------------------------------------

function ndjsonResponse(events: unknown[]): Response {
    const payload = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + "\n").join(""));
    let sent = false;
    return {
        ok: true,
        body: {
            getReader() {
                return {
                    read: async () =>
                        sent
                            ? { value: undefined, done: true as const }
                            : ((sent = true), { value: payload, done: false as const }),
                    releaseLock() {},
                };
            },
        },
    } as unknown as Response;
}

describe("the stream client", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("hands the calendar_event ref of a tool result to the handler", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                ndjsonResponse([
                    {
                        type: "tool_call_result",
                        step: 2,
                        tool_name: "update_calendar_event",
                        summary: "Updated event evt1",
                        calendar_event: REF,
                    },
                    { type: "done", session_id: "s", run_id: "r" },
                ])
            )
        );
        const onToolResult = vi.fn();
        // The real client: this file mocks the module for the hook tests below.
        const { askAgentStream } =
            await vi.importActual<typeof import("../services/agentApi")>("../services/agentApi");
        await askAgentStream({
            query: "q",
            teamId: "team-1",
            accessToken: "token",
            onSources: vi.fn(),
            onDelta: vi.fn(),
            onDone: vi.fn(),
            onError: vi.fn(),
            onToolResult,
        });
        expect(onToolResult).toHaveBeenCalledTimes(1);
        expect(onToolResult.mock.calls[0][0].calendar_event).toEqual(REF);
    });
});

// ---- useAgentQA reaches the calendar ----------------------------------------------------------

const agentApi = vi.hoisted(() => ({ askAgentStream: vi.fn() }));
vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: agentApi.askAgentStream,
        decideAgent: vi.fn(),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        fetchAgentUsage: vi.fn(async () => null),
        submitAgentFeedback: vi.fn(async () => true),
    };
});
vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));
vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

describe("useAgentQA passes an approved calendar write on", () => {
    const streamResult = (tool_name: string, calendar_event?: ToolResultCalendarEventRef) =>
        agentApi.askAgentStream.mockImplementation(async (args) => {
            args.onToolStart?.({ step: 0, tool_name, arguments: {} });
            args.onToolResult?.({ step: 0, tool_name, summary: "ok", calendar_event });
            args.onDelta("answer");
            args.onDone("sess-1", "run-1");
        });
    const runTurn = async () => {
        const { result } = renderHook(() =>
            useAgentQA({ accessToken: "test-token", teamId: "team-1" })
        );
        act(() => {
            result.current.onAsk("q");
        });
        await waitFor(() => expect(result.current.turns).toHaveLength(1));
    };

    it("signals the calendar when an approved update result carries the ref", async () => {
        const { seen, stop } = listen();
        streamResult("update_calendar_event", REF);
        await runTurn();
        stop();
        expect(seen).toEqual([
            { action: "update", accountId: A, calendarId: "primary", eventId: "evt1" },
        ]);
    });

    it("does nothing for a calendar tool that sent no ref", async () => {
        const { seen, stop } = listen();
        streamResult("update_calendar_event");
        await runTurn();
        stop();
        expect(seen).toEqual([]);
    });
});

// ---- the open calendar grid -------------------------------------------------------------------

const calendarApi = vi.hoisted(() => ({
    listCalendars: vi.fn(),
    listEventsAggregate: vi.fn(),
}));
vi.mock("../features/integrations/services/calendar", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/integrations/services/calendar")>();
    return { ...actual, ...calendarApi };
});
vi.mock("../features/integrations/services/connections", () => ({
    listConnections: vi.fn(async () => ({ connections: [] })),
    findGoogleConnections: () => [
        { id: A, label: "me@work.com" },
        { id: B, label: "me@gmail.com" },
    ],
    hasAnyCalendarScope: () => true,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const cal = (account_id: string, id: string, ticked: boolean) => ({
    id,
    account_id,
    account_email: id,
    summary: id,
    // The grid ticks what Google shows or a primary calendar: the personal one is neither.
    primary: ticked,
    access_role: "owner",
    selected: ticked,
});

describe("the open calendar grid", () => {
    beforeEach(() => {
        window.localStorage.clear();
        calendarApi.listCalendars.mockReset().mockResolvedValue({
            // Only the work account is ticked; the personal one is a source nobody is looking at.
            calendars: [cal(A, "me@work.com", true), cal(B, "me@gmail.com", false)],
            failed_accounts: [],
            accounts: [],
        });
        calendarApi.listEventsAggregate
            .mockReset()
            .mockResolvedValue({ items: [], failed_sources: [] });
    });

    const mount = async () => {
        render(
            <CssVarsProvider>
                <CalendarModal open onClose={() => undefined} />
            </CssVarsProvider>
        );
        await waitFor(() => expect(calendarApi.listEventsAggregate).toHaveBeenCalledTimes(1));
    };
    const reads = () => calendarApi.listEventsAggregate.mock.calls.length;

    it("reads the window again when the changed source is on screen (primary is mapped)", async () => {
        await mount();
        expect(calendarApi.listEventsAggregate.mock.calls[0][1].sources).toEqual([
            { accountId: A, calendarId: "me@work.com" },
        ]);
        act(() => emitCalendarChanged({ action: "update", accountId: A, calendarId: "primary" }));
        await waitFor(() => expect(reads()).toBe(2));
        expect(calendarApi.listEventsAggregate.mock.calls[1][1].sources).toEqual([
            { accountId: A, calendarId: "me@work.com" },
        ]);
    });

    it("does not read anything for a source that is not selected", async () => {
        await mount();
        act(() => emitCalendarChanged({ action: "create", accountId: B, calendarId: "primary" }));
        act(() => emitCalendarChanged({ action: "delete", accountId: "nobody", calendarId: "x" }));
        await new Promise((r) => setTimeout(r, 30));
        expect(reads()).toBe(1);
    });

    it("drops the windows it cached for that source, so paging back re-reads", async () => {
        await mount();
        // Page forward and back: the first window comes from the cache (no read).
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await waitFor(() => expect(reads()).toBe(2));
        fireEvent.click(screen.getByRole("button", { name: "Previous" }));
        await new Promise((r) => setTimeout(r, 30));
        expect(reads()).toBe(2);
        // The agent changes an event of the selected source: the window on screen is read again, and
        // the other cached window is gone, so paging to it reads once more (not served stale).
        act(() => emitCalendarChanged({ action: "update", accountId: A, calendarId: "primary" }));
        await waitFor(() => expect(reads()).toBe(3));
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await waitFor(() => expect(reads()).toBe(4));
    });

    it("keeps the windows of a change to a source it does not hold", async () => {
        await mount();
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await waitFor(() => expect(reads()).toBe(2));
        act(() => emitCalendarChanged({ action: "update", accountId: B, calendarId: "primary" }));
        fireEvent.click(screen.getByRole("button", { name: "Previous" }));
        await new Promise((r) => setTimeout(r, 30));
        // still served from the cache
        expect(reads()).toBe(2);
    });
});
