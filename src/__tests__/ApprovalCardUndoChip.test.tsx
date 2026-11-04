/**
 * "Can't be undone" on the approval card, BEFORE the person approves.
 *
 *   - Only `undoable === false` is a claim. Absent (an older backend) or `true`
 *     shows nothing, and the card is exactly what it was.
 *   - The reason is worded per `undo_reason`; a code this client has no copy for
 *     reads as the generic one. `irreversible_delete` is the stronger of them.
 *   - The previews that used to say "cannot be undone" themselves stop when the
 *     backend speaks, so the card does not say it twice (and still say it when
 *     the backend is older and silent).
 *   - The edit-before-approve layout is undisturbed: the chip is its own row between
 *     the fields and the buttons, in edit mode too.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import { getMessages } from "../i18n";
import { UNDO_REASONS, type PendingApprovalPayload } from "../services/agentApi";

const mount = (over: Partial<PendingApprovalPayload>, isDark = false) => {
    const pending: PendingApprovalPayload = {
        step: 1,
        tool_name: "delete_note",
        arguments: { note_id: 5, note_type: 1 },
        approval_token: "tok",
        run_id: "run",
        ...over,
    };
    return render(
        <CssVarsProvider>
            <ApprovalCard
                approveLabel="Approve"
                isDark={isDark}
                pending={pending}
                rejectLabel="Reject"
                titleText="Approval required"
                onApprove={vi.fn()}
                onReject={vi.fn()}
            />
        </CssVarsProvider>
    );
};

const u = getMessages("en").agentApproval.undo;
const chip = () => screen.queryByTestId("undo-chip");

afterEach(cleanup);

describe("when it shows", () => {
    it("`undoable: false` shows the chip", () => {
        mount({ undoable: false, undo_reason: "no_snapshot" });
        expect(within(chip()!).getByText("Can't be undone")).toBeTruthy();
    });

    it("`undoable: true` shows nothing", () => {
        mount({ undoable: true });
        expect(chip()).toBeNull();
        expect(screen.queryByText("Can't be undone")).toBeNull();
    });

    it("no `undoable` at all (an older backend) shows nothing", () => {
        mount({});
        expect(chip()).toBeNull();
    });

    it("a reason on an undoable write is ignored: the claim is `undoable`", () => {
        mount({ undoable: true, undo_reason: "irreversible_delete" });
        expect(chip()).toBeNull();
    });
});

describe("the reason", () => {
    it.each(UNDO_REASONS)("%s has its own sentence", (code) => {
        mount({ undoable: false, undo_reason: code });
        expect(chip()!.textContent).toContain(u.reasons[code]);
        expect(chip()!.getAttribute("data-undo-reason")).toBe(code);
    });

    it("the five sentences are different", () => {
        expect(new Set(UNDO_REASONS.map((c) => u.reasons[c])).size).toBe(5);
    });

    it("says the real thing for each: delete for good / other people / old values / fields / not yet", () => {
        mount({ undoable: false, undo_reason: "irreversible_delete" });
        expect(chip()!.textContent).toContain("deletes it for good");
        cleanup();
        mount({ undoable: false, undo_reason: "notified_people" });
        expect(chip()!.textContent).toContain("other people");
        cleanup();
        mount({ undoable: false, undo_reason: "no_snapshot" });
        expect(chip()!.textContent).toContain("old values aren't kept");
        cleanup();
        mount({ undoable: false, undo_reason: "unsupported_fields" });
        expect(chip()!.textContent).toContain("undo can't put back");
    });

    it("a code it has no copy for, or none at all, reads as the generic `not_yet`", () => {
        mount({ undoable: false, undo_reason: "something_new" });
        expect(chip()!.textContent).toContain(u.reasons.not_yet);
        cleanup();
        mount({ undoable: false });
        expect(chip()!.textContent).toContain(u.reasons.not_yet);
    });

    it("`notified_people` does not claim anyone is told: it must not contradict a share card that says they are not", () => {
        expect(u.reasons.notified_people).not.toMatch(/\btold\b|notif/i);
    });
});

describe("the previews that said it themselves", () => {
    const PREVIEWS: Array<[string, Record<string, unknown>]> = [
        ["delete_comment", { task_id: 12, comment_id: 3 }],
        ["delete_sprint", { sprint_id: 4 }],
        ["delete_project", { project_id: 9, confirm_name: "x" }],
    ];

    it.each(PREVIEWS)("%s: says it once when the backend speaks", (tool, args) => {
        mount({
            tool_name: tool,
            arguments: args,
            undoable: false,
            undo_reason: "irreversible_delete",
        });
        expect(screen.getAllByText(/can't be undone|cannot be undone/i)).toHaveLength(1);
        expect(chip()).toBeTruthy();
        expect(screen.queryByText("This action cannot be undone")).toBeNull();
    });

    it.each(PREVIEWS)(
        "%s: an older, silent backend keeps the preview's own words",
        (tool, args) => {
            mount({ tool_name: tool, arguments: args });
            expect(screen.getByText("This action cannot be undone")).toBeTruthy();
            expect(chip()).toBeNull();
        }
    );
});

describe("the card around it", () => {
    it("sits between the content and the buttons", () => {
        mount({ undoable: false, undo_reason: "irreversible_delete" });
        const approve = screen.getByRole("button", { name: "Approve" });
        const position = chip()!.compareDocumentPosition(approve);
        expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("leaves edit before approve alone: Edit still opens, in edit mode the chip stays", () => {
        mount({
            tool_name: "update_task",
            arguments: { task_id: "PRJ-1", title: "Old", milestone_id: 3 },
            editable: ["title"],
            undoable: false,
            undo_reason: "unsupported_fields",
        });
        expect(chip()).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Edit" }));
        expect(screen.getByLabelText("Title")).toBeTruthy();
        expect(chip()).toBeTruthy();
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    });

    it("renders in dark mode too", () => {
        mount({ undoable: false, undo_reason: "irreversible_delete" }, true);
        expect(chip()).toBeTruthy();
    });
});
