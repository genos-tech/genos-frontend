/**
 * A reason on Reject (MIP-889), on the approval card itself. Rendered bare, as
 * the Spotlight overlay mounts it (the card reads the English catalog).
 *
 *   - Reject stays ONE click and calls exactly `onReject()`, as before.
 *   - "Reject with a reason" opens a field; its Reject sends the reason
 *     trimmed, or a plain `onReject()` when nothing (or only spaces) was typed.
 *   - The server's cap (500) holds in the field.
 *   - Keys follow edit mode: Escape closes the field and goes no further, Enter
 *     is a new line and rejects nothing; an IME's own keys are left alone.
 *   - Edit mode and the reason field never show together.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import type { PendingApprovalPayload } from "../services/agentApi";
import { REJECT_REASON_MAX } from "../services/agentRejectReason";

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "update_task",
    arguments: { task_id: "PRJ-1", title: "Old title", priority: "High" },
    editable: ["title", "priority"],
    approval_token: "tok",
    run_id: "run",
};

const mount = (pending: PendingApprovalPayload = PENDING) => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const outerKey = vi.fn();
    render(
        <CssVarsProvider>
            <div onKeyDown={outerKey}>
                <ApprovalCard
                    approveLabel="Approve"
                    pending={pending}
                    rejectLabel="Reject"
                    titleText="Approval required"
                    onApprove={onApprove}
                    onReject={onReject}
                />
            </div>
        </CssVarsProvider>
    );
    return { onApprove, onReject, outerKey };
};

const ADD = "Reject with a reason";
const openReason = () => fireEvent.click(screen.getByRole("button", { name: ADD }));
const field = () => screen.getByLabelText("Reason (optional)") as HTMLTextAreaElement;
const typeReason = (value: string) => fireEvent.change(field(), { target: { value } });
const reject = () => fireEvent.click(screen.getByRole("button", { name: "Reject" }));

afterEach(cleanup);

describe("plain Reject is unchanged", () => {
    it("is one click and calls onReject with nothing at all", () => {
        const { onReject } = mount();
        reject();
        expect(onReject).toHaveBeenCalledTimes(1);
        expect(onReject.mock.calls[0]).toEqual([]);
    });

    it("shows no field until asked", () => {
        mount();
        expect(screen.queryByLabelText("Reason (optional)")).toBeNull();
        expect(screen.getByRole("button", { name: ADD })).toBeTruthy();
    });

    it("is offered on a tool with nothing editable too", () => {
        const { onReject } = mount({ ...PENDING, tool_name: "delete_note", editable: [] });
        expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
        openReason();
        typeReason("Not this one");
        reject();
        expect(onReject.mock.calls[0]).toEqual(["Not this one"]);
    });
});

describe("the reason field", () => {
    it("opens focused, and hides Approve and Edit (the person is rejecting)", () => {
        mount();
        openReason();
        expect(document.activeElement).toBe(field());
        expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
        expect(screen.queryByRole("button", { name: ADD })).toBeNull();
        // Exactly one Reject on screen at any time.
        expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(1);
        expect(field().getAttribute("aria-describedby")).toBeTruthy();
    });

    it("sends the reason trimmed", () => {
        const { onReject, onApprove } = mount();
        openReason();
        typeReason("   Wrong project, use Website Redesign.  \n");
        reject();
        expect(onReject).toHaveBeenCalledTimes(1);
        expect(onReject.mock.calls[0]).toEqual(["Wrong project, use Website Redesign."]);
        expect(onApprove).not.toHaveBeenCalled();
    });

    it("an empty or blank field is exactly a plain reject", () => {
        const { onReject } = mount();
        openReason();
        reject();
        expect(onReject.mock.calls[0]).toEqual([]);
        cleanup();
        const second = mount();
        openReason();
        typeReason("   \n  ");
        reject();
        expect(second.onReject.mock.calls[0]).toEqual([]);
    });

    it("holds the server's cap of 500, with a counter near it", () => {
        const { onReject } = mount();
        openReason();
        expect(field().maxLength).toBe(REJECT_REASON_MAX);
        expect(screen.queryByText(/\/500$/)).toBeNull();
        // A paste longer than the cap (jsdom does not apply maxLength to it).
        typeReason("x".repeat(REJECT_REASON_MAX + 120));
        expect(field().value).toHaveLength(REJECT_REASON_MAX);
        expect(screen.getByText(`${REJECT_REASON_MAX}/${REJECT_REASON_MAX}`)).toBeTruthy();
        reject();
        expect((onReject.mock.calls[0][0] as string).length).toBe(REJECT_REASON_MAX);
    });

    it("never cuts an emoji in half at the cap", () => {
        const { onReject } = mount();
        openReason();
        typeReason("a".repeat(REJECT_REASON_MAX - 1) + "😀");
        expect(field().value).toBe("a".repeat(REJECT_REASON_MAX - 1));
        reject();
        expect(onReject.mock.calls[0][0]).toBe("a".repeat(REJECT_REASON_MAX - 1));
    });

    it("Back closes it, drops what was typed, and returns focus to its button", () => {
        const { onReject } = mount();
        openReason();
        typeReason("half a thought");
        fireEvent.click(screen.getByRole("button", { name: "Back" }));
        expect(screen.queryByLabelText("Reason (optional)")).toBeNull();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: ADD }));
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
        openReason();
        expect(field().value).toBe("");
        expect(onReject).not.toHaveBeenCalled();
    });
});

describe("keys, as in edit mode", () => {
    it("Escape closes the field and goes no further (a host's own Escape must not fire)", () => {
        const { outerKey, onReject } = mount();
        openReason();
        const notPrevented = fireEvent.keyDown(field(), { key: "Escape" });
        expect(notPrevented).toBe(false);
        expect(screen.queryByLabelText("Reason (optional)")).toBeNull();
        expect(outerKey).not.toHaveBeenCalled();
        expect(onReject).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: ADD }));
    });

    it("Escape with the field closed is left alone for the host", () => {
        const { outerKey } = mount();
        fireEvent.keyDown(screen.getByRole("button", { name: ADD }), { key: "Escape" });
        expect(outerKey).toHaveBeenCalledTimes(1);
    });

    it("Enter is a new line: it rejects nothing, is not prevented, and does not reach the host", () => {
        const { outerKey, onReject } = mount();
        openReason();
        typeReason("Wrong project");
        const notPrevented = fireEvent.keyDown(field(), { key: "Enter" });
        expect(notPrevented).toBe(true);
        expect(onReject).not.toHaveBeenCalled();
        expect(outerKey).not.toHaveBeenCalled();
        expect(field()).toBeTruthy();
    });

    it("an Escape that belongs to an IME composition keeps the field open", () => {
        mount();
        openReason();
        fireEvent.keyDown(field(), { key: "Escape", isComposing: true });
        expect(field()).toBeTruthy();
    });
});

describe("edit mode and the reason field", () => {
    it("edit mode offers no reason: its Reject is the plain one", () => {
        const { onReject } = mount();
        fireEvent.click(screen.getByRole("button", { name: "Edit" }));
        expect(screen.queryByRole("button", { name: ADD })).toBeNull();
        reject();
        expect(onReject.mock.calls[0]).toEqual([]);
    });

    it("after Cancel edit the reason is offered again", () => {
        mount();
        fireEvent.click(screen.getByRole("button", { name: "Edit" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
        openReason();
        expect(field()).toBeTruthy();
    });
});
