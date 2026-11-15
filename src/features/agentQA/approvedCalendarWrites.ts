import type { ToolResultCalendarEventRef } from "../../services/agentApi";
import { emitCalendarChanged } from "../calendar/calendarChanges";

// What an approved agent write to a Google Calendar changes in the browser, beyond the transcript
// (MIP-1059, genos-api AGENT_PARITY_TOOLS). `emitCalendarEventToolResult` is called once per tool
// result by the handler in `useAgentQA`.
//
// Nothing is pushed when a calendar changes: no socket event exists for it. The approved write's
// `tool_call_result` carries a `calendar_event` ref instead (the event, its account and calendar, and
// for a create or an update its new times), and this turns it into the signal the open calendar grid
// listens for. The grid drops what it fetched for that source and, when that source is on screen,
// reads the visible window again (`CalendarModal`, `onCalendarChanged`). A closed calendar needs
// nothing: it drops everything on close and reads afresh on open. No new event type is involved.
//
// Not done here: the grid reads the visible window again as a whole, not just the one source. The
// aggregate endpoint takes any set of sources, so a one-source read is possible, but the grid's
// window cache is keyed by the whole selection and a partial merge into it is a second code path for
// a rare event (an agent write while the calendar is open).

// The three writes, and the action each one's ref must name: a ref is taken only from the tool that
// sends it and only when it is consistent with it, since it comes off the wire.
const ACTION_OF_TOOL: Record<string, ToolResultCalendarEventRef["action"]> = {
    create_calendar_event: "create",
    update_calendar_event: "update",
    delete_calendar_event: "delete",
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export const emitCalendarEventToolResult = (
    toolName: string,
    ref?: ToolResultCalendarEventRef
): void => {
    const action = ACTION_OF_TOOL[toolName];
    if (!action || !ref || ref.action !== action) return;
    const accountId = text(ref.account_id);
    // `calendar_id` is `primary` when the call named none; a ref without one is not a ref.
    const calendarId = text(ref.calendar_id);
    if (!accountId || !calendarId) return;
    emitCalendarChanged({
        action,
        accountId,
        calendarId,
        ...(text(ref.event_id) ? { eventId: text(ref.event_id) as string } : {}),
    });
};
