/**
 * MIP-2005: a session's consecutive agent rows fold into one block, collapsed by
 * default from 3 rows, keyboard operable; a status row shows its reason inline.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskActivityFeed } from "../features/tasks/components/contents/base/sub/TaskActivityFeed";
import { groupAgentSessions, statusReasonOf } from "../features/tasks/utils/agentSessionGroups";
import type { TaskActivityProps, TaskCommentProps } from "../types/tasks";

vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));

const VIA_CLAUDE = { kind: "oauth", app: "claude" };
const BASE = Date.parse("2026-11-23T10:00:00Z");
const at = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString();

const row = (
    id: number,
    minutes: number,
    overrides: Partial<TaskActivityProps> = {}
): TaskActivityProps => ({
    activityId: id,
    actionType: "priority_changed",
    fieldName: "priority",
    oldValue: "Low",
    newValue: "High",
    metadata: { via: VIA_CLAUDE },
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: at(minutes),
    ...overrides,
});

// Newest first, as the API returns them.
const agentRows = (n: number, start = 0) =>
    Array.from({ length: n }, (_, i) => row(100 + start + i, 14 - i));

const renderFeed = (activities: TaskActivityProps[], comments?: TaskCommentProps[]) =>
    render(
        <CssVarsProvider>
            <TaskActivityFeed
                activities={activities}
                allTasks={[]}
                comments={comments}
                isLoading={false}
                loadFailed={false}
                myself={{ userId: "u1" } as never}
                setMyself={() => {}}
                socket={null}
                useCM={{} as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
                onRetry={() => {}}
            />
        </CssVarsProvider>
    );

describe("groupAgentSessions", () => {
    it("groups 3 or more consecutive rows of one app, leaves fewer as rows", () => {
        expect(groupAgentSessions(agentRows(3), "u1").map((e) => e.kind)).toEqual(["session"]);
        expect(groupAgentSessions(agentRows(2), "u1").map((e) => e.kind)).toEqual(["row", "row"]);
    });

    it("splits on a long quiet gap, a person's own row and another app", () => {
        const rows = [
            row(1, 60),
            row(2, 59),
            row(3, 58),
            row(4, 10), // 48 min earlier: a new session
            row(5, 9),
            row(6, 8),
            row(7, 7, { metadata: {} }), // typed by a person: ends the group
            row(8, 6, { metadata: { via: { kind: "oauth", app: "chatgpt" } } }),
        ];
        expect(groupAgentSessions(rows, "u1").map((e) => e.kind)).toEqual([
            "session",
            "session",
            "row",
            "row",
        ]);
    });

    it("keys on run_id when a row carries one, whatever the gap", () => {
        const rows = [60, 30, 0].map((m, i) =>
            row(i + 1, m, { metadata: { via: VIA_CLAUDE, run_id: "r1" } })
        );
        expect(groupAgentSessions(rows, "u1").map((e) => e.kind)).toEqual(["session"]);
        const mixed = [
            row(1, 3, { metadata: { via: VIA_CLAUDE, run_id: "r1" } }),
            row(2, 2, { metadata: { via: VIA_CLAUDE, run_id: "r2" } }),
            row(3, 1, { metadata: { via: VIA_CLAUDE, run_id: "r1" } }),
        ];
        expect(groupAgentSessions(mixed, "u1").map((e) => e.kind)).toEqual(["row", "row", "row"]);
    });
});

describe("statusReasonOf", () => {
    const status = row(1, 0, {
        actionType: "status_changed",
        fieldName: "status",
        oldValue: "Open",
        newValue: "Pending",
    });
    const comment = (text: string, minutes = 0, senderId = "u1") =>
        ({
            senderId,
            tsSent: at(minutes),
            commentBody: [{ type: "paragraph", content: [{ type: "text", text }] }],
        }) as unknown as TaskCommentProps;

    it("reads metadata.reason first", () => {
        const stamped = { ...status, metadata: { via: VIA_CLAUDE, reason: "waits for QA" } };
        expect(statusReasonOf(stamped, undefined)).toBe("waits for QA");
    });

    it("reads the connector's status comment for the same person and statuses", () => {
        const c = comment("Status: Open → Pending: waits for the release window");
        expect(statusReasonOf(status, [c])).toBe("waits for the release window");
        expect(statusReasonOf(status, [comment("Status: Open → Closed: done")])).toBeNull();
        expect(statusReasonOf(status, [{ ...c, senderId: "u2" }])).toBeNull();
        expect(statusReasonOf(status, [{ ...c, tsSent: at(30) }])).toBeNull();
    });
});

describe("TaskActivityFeed: session block", () => {
    it("is collapsed by default and opens with the keyboard-reachable button", () => {
        renderFeed(agentRows(6));
        const button = screen.getByRole("button", { name: /Claude · 6 changes/ });
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryAllByText("changed priority from")).toHaveLength(0);
        fireEvent.click(button);
        expect(button.getAttribute("aria-expanded")).toBe("true");
        expect(screen.getAllByText("changed priority from")).toHaveLength(6);
        fireEvent.click(button);
        expect(screen.queryAllByText("changed priority from")).toHaveLength(0);
    });

    it("shows two rows plainly", () => {
        renderFeed(agentRows(2));
        expect(screen.queryByRole("button", { name: /changes/ })).toBeNull();
        expect(screen.getAllByText("changed priority from")).toHaveLength(2);
    });

    it("shows the status reason inline on the status row", () => {
        const status = row(1, 0, {
            actionType: "status_changed",
            fieldName: "status",
            oldValue: "Open",
            newValue: "Pending",
        });
        const c = {
            senderId: "u1",
            tsSent: at(0),
            commentBody: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "Status: Open → Pending: waits for QA" }],
                },
            ],
        } as unknown as TaskCommentProps;
        renderFeed([status], [c]);
        expect(screen.getByText("Reason: waits for QA")).toBeTruthy();
    });
});
