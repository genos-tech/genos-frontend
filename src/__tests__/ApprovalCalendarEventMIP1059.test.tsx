/**
 * The approval cards of the three calendar writes (MIP-1059, genos-api AGENT_PARITY_TOOLS).
 *
 * With the server's flag on, the pending event's `arguments` carry the facts a real card needs
 * (`account_label`, `account_default`, `account_count`, `member_time_zone`, and for an update or a
 * delete `current` or `event_found: false`) as data; the client words them. With the flag OFF the
 * three tools still pause for approval and the card must stay the key:value fallback it is today.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getApprovalRenderer } from "../features/agentQA/approval/approvalRenderers";
import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import type { PendingApprovalPayload } from "../services/agentApi";

const ACCOUNT = "8f5e4733-1a2b-4c3d-8e9f-0123456789ab";

const mount = (
    tool: string,
    args: Record<string, unknown>,
    over: Partial<PendingApprovalPayload> = {}
) => {
    const pending: PendingApprovalPayload = {
        step: 1,
        tool_name: tool,
        arguments: args,
        approval_token: "tok",
        run_id: "run",
        ...over,
    };
    return render(
        <CssVarsProvider>
            <ApprovalCard
                approveLabel="Approve"
                pending={pending}
                rejectLabel="Reject"
                titleText="Approval required"
                onApprove={vi.fn()}
                onReject={vi.fn()}
            />
        </CssVarsProvider>
    );
};

const text = (container: HTMLElement) => (container.textContent ?? "").replace(/\s+/g, " ");

// What the server adds for a member with one account that is not named.
const ONE = {
    account_label: "me@work.com",
    account_default: true,
    account_count: 1,
    member_time_zone: "Asia/Tokyo",
};
const TWO = { ...ONE, account_count: 2 };

const CURRENT = {
    summary: "Standup",
    start_iso: "2026-12-01T10:00:00+09:00",
    end_iso: "2026-12-01T10:30:00+09:00",
    all_day: false,
    time_zone: "Asia/Tokyo",
    location: "Room 4",
    description: "Daily sync",
    attendees: ["Ann@x.com", "bob@x.com"],
    add_meet: false,
};

afterEach(cleanup);

describe("the flag gate", () => {
    it("has a structured card for each tool only when the facts are there", () => {
        for (const tool of [
            "create_calendar_event",
            "update_calendar_event",
            "delete_calendar_event",
        ]) {
            expect(getApprovalRenderer(tool)).toBeDefined();
            expect(getApprovalRenderer(tool, { summary: "x" })).toBeUndefined();
            expect(getApprovalRenderer(tool, { account_count: 1 })).toBeDefined();
        }
    });

    it("keeps today's key:value card when the server sent none of the new keys", () => {
        const { container } = mount("create_calendar_event", {
            summary: "Standup",
            start_iso: "2026-12-01T10:00:00",
            end_iso: "2026-12-01T10:30:00",
        });
        expect(text(container)).toContain("summary:");
        expect(text(container)).toContain("start_iso:");
        expect(text(container)).not.toContain("New calendar event");
    });

    it("leaves every other tool's card alone", () => {
        expect(getApprovalRenderer("create_task", { account_count: 3 })).toBeDefined();
    });
});

describe("create_calendar_event", () => {
    const args = {
        ...ONE,
        summary: "Standup",
        start_iso: "2026-12-01T10:00:00",
        end_iso: "2026-12-01T10:30:00",
        location: "Room 4",
        attendees: ["ann@x.com", "bob@x.com"],
        add_meet: true,
        description: "Daily sync\nSecond line",
    };

    it("says what is made, when (in the member's zone) and where", () => {
        const { container } = mount("create_calendar_event", args);
        const t = text(container);
        expect(t).toContain("New calendar event");
        expect(t).toContain("Standup");
        expect(t).toContain("Dec 1");
        expect(t).toMatch(/10:00\s?AM/);
        expect(t).toContain("Times in Asia/Tokyo");
        expect(t).toContain("Room 4");
        expect(t).toContain("ann@x.com, bob@x.com");
        expect(t).toContain("Daily sync");
        // structured: the raw fallback does not render
        expect(t).not.toContain("start_iso:");
    });

    it("reads the proposed time in the zone the call names, not the member's", () => {
        const { container } = mount("create_calendar_event", {
            ...args,
            time_zone: "America/New_York",
        });
        expect(text(container)).toContain("Times in America/New_York");
    });

    it("says nothing of the account for one account taken by default", () => {
        const { container } = mount("create_calendar_event", args);
        expect(text(container)).not.toContain("Google account");
    });

    it("names the account when the member has several, saying it is the default", () => {
        const { container } = mount("create_calendar_event", { ...args, ...TWO });
        expect(text(container)).toContain("Google account: me@work.com (default)");
    });

    it("names the account when the call chose one, even for a single account", () => {
        const { container } = mount("create_calendar_event", {
            ...args,
            account: ACCOUNT,
            account_default: false,
        });
        const t = text(container);
        expect(t).toContain("Google account: me@work.com");
        expect(t).not.toContain("(default)");
    });

    it("says an account that is not the member's will be refused", () => {
        const { container } = mount("create_calendar_event", {
            ...args,
            account: "someone-elses",
            account_label: null,
            account_default: false,
        });
        expect(text(container)).toContain("not one of your connected Google accounts");
        expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("shows an all-day event as a day, with no zone line", () => {
        const { container } = mount("create_calendar_event", {
            ...ONE,
            summary: "Holiday",
            start_iso: "2026-12-24",
            end_iso: "2026-12-25",
        });
        const t = text(container);
        expect(t).toContain("Dec 24");
        expect(t).not.toContain("Dec 25");
        expect(t).not.toContain("Times in");
    });

    it("prints a title that is a link as text, never an anchor", () => {
        const { container } = mount("create_calendar_event", {
            ...args,
            summary: "[click](javascript:alert(1))",
            description: "https://evil.example/x",
        });
        expect(container.querySelector("a")).toBeNull();
    });
});

describe("update_calendar_event", () => {
    const base = { ...ONE, event_id: "evt1", current: CURRENT };

    it("names the event and shows only what changes, before and after", () => {
        const { container } = mount("update_calendar_event", {
            ...base,
            summary: "Weekly standup",
            location: "Room 4",
        });
        const t = text(container);
        expect(t).toContain("Update calendar event: Standup");
        expect(t).toContain("Title");
        expect(t).toContain("Standup → Weekly standup");
        // location is already "Room 4": not a change, so not a row
        expect(t).not.toContain("Location");
        expect(t).not.toContain("event_id");
    });

    it("compares times as instants: the same moment in another spelling is no change", () => {
        // 10:00 in Tokyo is exactly what the event has (10:00+09:00).
        const { container } = mount("update_calendar_event", {
            ...base,
            summary: "Weekly standup",
            start_iso: "2026-12-01T10:00:00",
            end_iso: "2026-12-01T10:30:00",
        });
        // no time row (the "Times in" caption is the zone line, which stays for the event's own time)
        expect(text(container)).not.toMatch(/Time(?!s in)/);
    });

    it("shows a moved event before and after, in one zone", () => {
        const { container } = mount("update_calendar_event", {
            ...base,
            start_iso: "2026-12-02T14:00:00",
            end_iso: "2026-12-02T14:30:00",
        });
        const t = text(container);
        expect(t).toMatch(/Time(?!s in)/);
        expect(t).toMatch(/Dec 1, 10:00\s?AM/);
        expect(t).toMatch(/Dec 2, 2:00\s?PM/);
        expect(t).toContain("Times in Asia/Tokyo");
    });

    it("compares only the side of the time the call sent", () => {
        // only the start is sent, and it is the event's own start: nothing changes
        const { container } = mount("update_calendar_event", {
            ...base,
            start_iso: "2026-12-01T10:00:00",
        });
        const t = text(container);
        expect(t).not.toMatch(/Time(?!s in)/);
        expect(t).toContain("already has these values");
    });

    it("compares only the end when only the end was sent", () => {
        const { container } = mount("update_calendar_event", {
            ...base,
            end_iso: "2026-12-01T10:30:00",
        });
        const t = text(container);
        expect(t).not.toMatch(/Time(?!s in)/);
        expect(t).toContain("already has these values");
    });

    it("has no empty account in a not-found sentence for an account that is not the member's", () => {
        const { container } = mount("update_calendar_event", {
            ...TWO,
            account: "made-up",
            account_label: null,
            account_default: false,
            event_id: "evt1",
            event_found: false,
            summary: "Weekly standup",
        });
        const t = text(container);
        expect(t).toContain("not one of your connected Google accounts");
        expect(t).not.toContain("No event with this id is on .");
    });

    it("compares guests ignoring case and order, and shows 'cleared' for an empty list", () => {
        const same = mount("update_calendar_event", {
            ...base,
            attendees: ["BOB@x.com", "ann@x.com"],
            summary: "Weekly standup",
        });
        expect(text(same.container)).not.toContain("Guests");
        cleanup();
        const clear = mount("update_calendar_event", { ...base, attendees: [] });
        const t = text(clear.container);
        expect(t).toContain("Guests");
        expect(t).toContain("Ann@x.com, bob@x.com");
        expect(t).toContain("none");
    });

    it("says so when nothing would change", () => {
        const { container } = mount("update_calendar_event", {
            ...base,
            summary: "Standup",
            location: "Room 4",
            add_meet: false,
        });
        expect(text(container)).toContain("already has these values");
    });

    it("shows the new description as text, and a Meet change", () => {
        const { container } = mount("update_calendar_event", {
            ...base,
            description: "New agenda",
            add_meet: true,
        });
        const t = text(container);
        expect(t).toContain("New agenda");
        expect(t).toContain("Google Meet link");
        expect(t).toContain("add");
    });

    it("says the event is not on that account, naming the account", () => {
        const { container } = mount("update_calendar_event", {
            ...TWO,
            event_id: "evt1",
            summary: "Weekly standup",
            event_found: false,
        });
        const t = text(container);
        expect(t).toContain("No event with this id is on me@work.com");
        // with no `current`, the id is what names the event
        expect(t).toContain("Event id: evt1");
        // the proposal is still shown, as it is
        expect(t).toContain("Weekly standup");
    });

    it("still works when Google could not be read (no current, no event_found)", () => {
        const { container } = mount("update_calendar_event", {
            ...ONE,
            event_id: "evt1",
            summary: "Weekly standup",
        });
        const t = text(container);
        expect(t).toContain("Update a calendar event");
        expect(t).toContain("Event id: evt1");
        expect(t).toContain("Weekly standup");
    });
});

describe("delete_calendar_event", () => {
    const IRREVERSIBLE = { undoable: false, undo_reason: "irreversible_delete" } as const;

    it("names the event, when it is, and who is on it, and says it cannot be undone", () => {
        const { container } = mount(
            "delete_calendar_event",
            { ...TWO, event_id: "evt1", current: CURRENT },
            IRREVERSIBLE
        );
        const t = text(container);
        expect(t).toContain("Delete calendar event: Standup");
        expect(t).toContain("Dec 1");
        expect(t).toContain("Room 4");
        expect(t).toContain("Ann@x.com, bob@x.com");
        expect(t).toContain("Google account: me@work.com (default)");
        // the card's own chip says it, once
        expect(screen.getByTestId("undo-chip")).toBeTruthy();
        expect(t).not.toContain("This action cannot be undone");
    });

    it("adds its own can't-be-undone chip only for a backend that predicted nothing", () => {
        const { container } = mount("delete_calendar_event", {
            ...ONE,
            event_id: "evt1",
            current: CURRENT,
        });
        expect(text(container)).toContain("This action cannot be undone");
    });

    it("warns that the delete reads as already done when the event is not on that account", () => {
        const { container } = mount(
            "delete_calendar_event",
            { ...TWO, event_id: "evt1", event_found: false },
            IRREVERSIBLE
        );
        const t = text(container);
        expect(t).toContain("No event with this id is on me@work.com");
        expect(t).toContain("reads as already done");
        expect(t).toContain("Delete a calendar event");
    });
});
