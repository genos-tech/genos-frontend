/**
 * The approval card under edit before approve: the editors, the payload and
 * the keyboard. Rendered bare (no I18nProvider: the card reads the English
 * catalog without one), as the Spotlight overlay mounts it.
 *
 *   - An Edit button only where the server listed editable paths we know.
 *   - Approve sends ONLY the fields that changed, by the server's own path
 *     strings; nothing changed is a plain `onApprove()`.
 *   - A reject never carries edits.
 *   - Escape cancels the edit and goes no further; Enter approves nothing.
 *   - A field the person edited no longer shows the snapshot of its old value.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import type { PendingApprovalPayload } from "../services/agentApi";

interface Opts {
    tool: string;
    args: Record<string, unknown>;
    editable?: string[];
    fieldErrors?: Record<string, string> | null;
    restoredEdits?: Record<string, unknown> | null;
}

const mount = ({ tool, args, editable, fieldErrors, restoredEdits }: Opts) => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const pending: PendingApprovalPayload = {
        step: 1,
        tool_name: tool,
        arguments: args,
        ...(editable ? { editable } : {}),
        approval_token: "tok",
        run_id: "run",
    };
    const outerKey = vi.fn();
    const view = render(
        <CssVarsProvider>
            <div onKeyDown={outerKey}>
                <ApprovalCard
                    approveLabel="Approve"
                    fieldErrors={fieldErrors}
                    pending={pending}
                    rejectLabel="Reject"
                    restoredEdits={restoredEdits}
                    titleText="Approval required"
                    onApprove={onApprove}
                    onReject={onReject}
                />
            </div>
        </CssVarsProvider>
    );
    return { ...view, onApprove, onReject, outerKey };
};

const UPDATE_TASK = {
    task_id: "PRJ-1",
    title: "Old title",
    content_text: "The body.",
    status: "WIP",
    priority: "High",
    due_date: "2026-11-20",
    start_date: "2026-11-01",
    current: { start_date: "2026-10-30" },
};
const UPDATE_TASK_EDITABLE = [
    "title",
    "content_text",
    "status",
    "priority",
    "due_date",
    "start_date",
];

const openEdit = () => fireEvent.click(screen.getByRole("button", { name: "Edit" }));
const type = (label: string | RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
const approve = () => fireEvent.click(screen.getByRole("button", { name: /^Approve/ }));

afterEach(cleanup);

describe("when the Edit button is offered", () => {
    it("on a tool with editable paths the server listed", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    });

    it("not when `editable` is empty (a tool with nothing editable), and the card is as before", () => {
        mount({ tool: "manage_milestone", args: { action: "create", title: "M" }, editable: [] });
        expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    });

    it("not when an older backend sends no `editable` at all", () => {
        mount({ tool: "update_task", args: UPDATE_TASK });
        expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    });

    it("not for paths this client has no editor for", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: ["project_id", "task_id"] });
        expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    });

    it("a plain approve calls onApprove with nothing, and Reject with nothing", () => {
        const { onApprove, onReject } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        approve();
        expect(onApprove).toHaveBeenCalledTimes(1);
        expect(onApprove.mock.calls[0]).toEqual([]);
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(onReject.mock.calls[0]).toEqual([]);
    });
});

describe("edit mode", () => {
    it("turns the values into labelled inputs, focuses the first, and shows what is not editable", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        openEdit();
        const title = screen.getByLabelText("Title") as HTMLInputElement;
        expect(title.value).toBe("Old title");
        expect(document.activeElement).toBe(title);
        expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe(
            "The body."
        );
        expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("WIP");
        expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-11-20");
        expect(screen.getByRole("group", { name: "Edit before approving" })).toBeTruthy();
        // The preview keeps what is not being changed: the header names the task.
        expect(screen.getByText("Update task: PRJ-1")).toBeTruthy();
    });

    it("says nothing twice: the title is in its input, not also in the preview", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        expect(screen.getAllByText("Old title")).toHaveLength(1);
        openEdit();
        expect(screen.queryByText("Old title")).toBeNull();
        expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Old title");
    });

    it("a plain `Approve` while nothing is changed", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
        approve();
        expect(onApprove.mock.calls[0]).toEqual([]);
    });

    it("sends ONLY the changed fields, keyed by the server's paths", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        type("Title", "New title");
        type("Priority", "Critical");
        expect(screen.getByRole("button", { name: "Approve with your changes" })).toBeTruthy();
        approve();
        expect(onApprove).toHaveBeenCalledTimes(1);
        expect(onApprove.mock.calls[0][0]).toEqual({ title: "New title", priority: "Critical" });
    });

    it("counts the changes, politely", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        openEdit();
        type("Title", "New title");
        expect(screen.getByText("1 change")).toBeTruthy();
        type("Priority", "Low");
        expect(screen.getByText("2 changes").getAttribute("aria-live")).toBe("polite");
    });

    it("putting a field back to what it was is not an edit", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        type("Title", "Something else");
        type("Title", "Old title");
        approve();
        expect(onApprove.mock.calls[0]).toEqual([]);
    });

    it("Reset puts one field back and leaves the others", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        type("Title", "New title");
        type("Priority", "Low");
        fireEvent.click(screen.getByRole("button", { name: "Reset Title" }));
        expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Old title");
        expect(screen.queryByRole("button", { name: "Reset Title" })).toBeNull();
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ priority: "Low" });
    });

    it("shows what Genos proposed beside a field once it is changed", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        openEdit();
        expect(screen.queryByText(/Genos proposed/)).toBeNull();
        type("Title", "New title");
        expect(screen.getByText("Genos proposed: Old title")).toBeTruthy();
    });

    it("Cancel edit discards every change and gives the Edit button back, focused", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        type("Title", "New title");
        fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
        expect(screen.queryByLabelText("Title")).toBeNull();
        const edit = screen.getByRole("button", { name: "Edit" });
        expect(document.activeElement).toBe(edit);
        approve();
        expect(onApprove.mock.calls[0]).toEqual([]);
        // And re-opening starts from the proposal, not from the discarded edit.
        openEdit();
        expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Old title");
    });

    it("Reject in edit mode rejects, and carries nothing", () => {
        const { onApprove, onReject } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        type("Title", "New title");
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(onReject).toHaveBeenCalledTimes(1);
        expect(onReject.mock.calls[0]).toEqual([]);
        expect(onApprove).not.toHaveBeenCalled();
    });
});

describe("the keyboard", () => {
    it("Escape cancels the edit and goes no further (a host's own Escape must not also fire)", () => {
        const { outerKey } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        const before = outerKey.mock.calls.length;
        fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
        expect(screen.queryByLabelText("Title")).toBeNull();
        expect(outerKey.mock.calls.length).toBe(before);
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }));
    });

    it("Escape outside edit mode is left alone for the host", () => {
        const { outerKey } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        fireEvent.keyDown(screen.getByRole("button", { name: "Edit" }), { key: "Escape" });
        expect(outerKey).toHaveBeenCalledTimes(1);
    });

    it("Enter in a single-line input does not approve, and does not reach the host", () => {
        const { onApprove, outerKey } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        type("Title", "New title");
        const before = outerKey.mock.calls.length;
        const notPrevented = fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });
        expect(notPrevented).toBe(false); // default prevented: no implicit form submit
        expect(onApprove).not.toHaveBeenCalled();
        expect(outerKey.mock.calls.length).toBe(before);
    });

    it("an Escape or Enter that belongs to an IME composition is not the card's (Japanese input)", () => {
        const { outerKey } = mount({
            tool: "update_task",
            args: { ...UPDATE_TASK, tags: ["bug"] },
            editable: [...UPDATE_TASK_EDITABLE, "tags"],
        });
        openEdit();
        const title = screen.getByLabelText("Title");
        fireEvent.keyDown(title, { key: "Escape", isComposing: true });
        expect(screen.queryByLabelText("Title")).toBe(title);
        const notPrevented = fireEvent.keyDown(title, { key: "Enter", isComposing: true });
        expect(notPrevented).toBe(true);
        // The composition's Enter must not add the half-typed tag either.
        const input = screen.getByPlaceholderText("Add a tag") as HTMLInputElement;
        input.value = "ぱふ";
        fireEvent.keyDown(input, { key: "Enter", isComposing: true });
        expect(input.value).toBe("ぱふ");
        expect(screen.queryByText("ぱふ")).toBeNull();
        expect(outerKey).toHaveBeenCalled();
    });

    it("Enter in the textarea is a new line: it is not prevented", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        openEdit();
        const notPrevented = fireEvent.keyDown(screen.getByLabelText("Description"), {
            key: "Enter",
        });
        expect(notPrevented).toBe(true);
    });
});

describe("the cheap checks keep Approve off, and say why next to the field", () => {
    it("a blank title", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        type("Title", "   ");
        const button = screen.getByRole("button", { name: "Approve with your changes" });
        expect((button as HTMLButtonElement).disabled).toBe(true);
        const title = screen.getByLabelText("Title");
        expect(title.getAttribute("aria-invalid")).toBe("true");
        const message = document.getElementById(title.getAttribute("aria-describedby")!)!;
        expect(message.textContent).toBe("Title can't be empty.");
        expect(message.getAttribute("aria-live")).toBe("polite");
        fireEvent.click(button);
        expect(onApprove).not.toHaveBeenCalled();
        // Fixing it turns Approve back on.
        type("Title", "Fixed");
        expect(
            (
                screen.getByRole("button", {
                    name: "Approve with your changes",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(false);
        expect(title.getAttribute("aria-invalid")).toBeNull();
    });

    it("a title over the limit, counted after trimming", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        openEdit();
        type("Title", "a".repeat(255));
        expect(
            (
                screen.getByRole("button", {
                    name: "Approve with your changes",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(false);
        type("Title", "a".repeat(256));
        expect(screen.getByText("Title is too long (at most 255 characters).")).toBeTruthy();
    });

    it("half a date typed into a clearable date field is a problem, not a clear", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        const due = screen.getByLabelText("Due date") as HTMLInputElement;
        // A native date input reports '' (and badInput) while a date is half typed.
        Object.defineProperty(due, "validity", { value: { badInput: true }, configurable: true });
        fireEvent.change(due, { target: { value: "" } });
        expect(screen.getByText("Due date: enter a real date.")).toBeTruthy();
        expect(
            (
                screen.getByRole("button", {
                    name: "Approve with your changes",
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        expect(onApprove).not.toHaveBeenCalled();
    });

    it("a due date may be cleared on purpose: '' is sent", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
        });
        openEdit();
        type("Due date", "");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ due_date: "" });
    });

    it("a required body (the text to add) cannot be blanked", () => {
        mount({
            tool: "update_task",
            args: { task_id: "PRJ-1", body_append: "More." },
            editable: ["body_append"],
        });
        openEdit();
        type("Text to add at the end", "  ");
        expect(screen.getByText("Text to add at the end can't be empty.")).toBeTruthy();
    });
});

describe("a choice", () => {
    it("is a select of the app's own words: never Deleted, values are the API's", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        openEdit();
        const status = screen.getByLabelText("Status") as HTMLSelectElement;
        expect(Array.from(status.options).map((o) => o.value)).toEqual([
            "Open",
            "WIP",
            "Blocked",
            "Pending",
            "Closed",
        ]);
        const effort = mount({
            tool: "create_task",
            args: { project_id: "P", title: "T", effort_level: "Moderate" },
            editable: ["title", "effort_level"],
        });
        fireEvent.click(within(effort.container).getByRole("button", { name: "Edit" }));
        const levels = within(effort.container).getByLabelText("Effort") as HTMLSelectElement;
        expect(Array.from(levels.options).map((o) => o.value)).toEqual([
            "Minimal",
            "Low",
            "Moderate",
            "High",
            "Extensive",
        ]);
    });

    it("keeps a proposed value outside the list selectable, so the select never lies", () => {
        const { onApprove } = mount({
            tool: "update_task",
            args: { task_id: "PRJ-1", status: "Deleted" },
            editable: ["status"],
        });
        openEdit();
        const status = screen.getByLabelText("Status") as HTMLSelectElement;
        expect(status.value).toBe("Deleted");
        expect(status.options[0].textContent).toBe("Deleted (as proposed)");
        // Left alone it is not an edit (the server would refuse Deleted as one).
        approve();
        expect(onApprove.mock.calls[0]).toEqual([]);
    });
});

describe("a reminder", () => {
    const TODO = {
        item_id: "Call Sam",
        title: "Call Sam",
        target_date: "2026-11-05",
        remind_at: "2026-11-06",
        time_zone: "Asia/Tokyo",
        current: { target_date: "2026-11-04", reminder_at: "2026-11-05T09:00:00+09:00" },
    };
    const EDITABLE = ["title", "target_date", "remind_at"];

    it("starts as the user's clock in a datetime-local input (a bare date is 09:00 that day)", () => {
        mount({ tool: "update_todo_item", args: TODO, editable: EDITABLE });
        openEdit();
        const reminder = screen.getByLabelText("Reminder") as HTMLInputElement;
        expect(reminder.type).toBe("datetime-local");
        expect(reminder.value).toBe("2026-11-06T09:00");
    });

    it("untouched it is NOT an edit, even though the input shows a different string than the proposal", () => {
        const { onApprove } = mount({ tool: "update_todo_item", args: TODO, editable: EDITABLE });
        openEdit();
        type("Title", "Call Sam back");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ title: "Call Sam back" });
    });

    it("a changed one is sent as the local date-time typed", () => {
        const { onApprove } = mount({ tool: "update_todo_item", args: TODO, editable: EDITABLE });
        openEdit();
        type("Reminder", "2026-11-07T15:30");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ remind_at: "2026-11-07T15:30" });
    });

    it("cannot be emptied on an update (it would mean 'leave it alone'), but can on a create", () => {
        mount({ tool: "update_todo_item", args: TODO, editable: EDITABLE });
        openEdit();
        type("Reminder", "");
        expect(screen.getByText("Reminder: choose a date and a time.")).toBeTruthy();
        cleanup();

        const { onApprove } = mount({
            tool: "create_todo_item",
            args: { title: "Call Sam", target_date: "2026-11-05", remind_at: "2026-11-06T09:00" },
            editable: EDITABLE,
        });
        openEdit();
        type("Reminder", "");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ remind_at: "" });
    });

    it("a to-do's day cannot be emptied on either tool", () => {
        mount({ tool: "update_todo_item", args: TODO, editable: EDITABLE });
        openEdit();
        type("Day", "");
        expect(screen.getByText("Day: choose a date.")).toBeTruthy();
    });

    it("an instant with an offset is shown in the zone the card names", () => {
        mount({
            tool: "update_todo_item",
            args: { ...TODO, remind_at: "2026-11-06T00:30:00Z" },
            editable: EDITABLE,
        });
        openEdit();
        expect((screen.getByLabelText("Reminder") as HTMLInputElement).value).toBe(
            "2026-11-06T09:30"
        );
    });
});

describe("the snapshot of the old value (`current`) is hidden for a field the person edited", () => {
    const TODO = {
        item_id: "Call Sam",
        target_date: "2026-11-05",
        remind_at: "2026-11-06T09:00",
        time_zone: "Asia/Tokyo",
        current: { target_date: "2026-11-04", reminder_at: "2026-11-05T09:00:00+09:00" },
    };
    const EDITABLE = ["target_date", "remind_at"];

    it("shown while the field is untouched, replaced by what Genos proposed once it is edited", () => {
        mount({ tool: "update_todo_item", args: TODO, editable: EDITABLE });
        openEdit();
        expect(screen.getByText("Now: 2026-11-04")).toBeTruthy();
        expect(screen.getByText("Now: 2026-11-05 09:00")).toBeTruthy();

        type("Day", "2026-11-09");
        expect(screen.queryByText("Now: 2026-11-04")).toBeNull();
        expect(screen.getByText("Genos proposed: 2026-11-05")).toBeTruthy();
        // The other field is still untouched: its snapshot is still true.
        expect(screen.getByText("Now: 2026-11-05 09:00")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Reset Day" }));
        expect(screen.getByText("Now: 2026-11-04")).toBeTruthy();
    });

    it("a task's start date, the same", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        openEdit();
        expect(screen.getByText("Now: 2026-10-30")).toBeTruthy();
        type("Start date", "2026-11-02");
        expect(screen.queryByText("Now: 2026-10-30")).toBeNull();
    });

    it("the read-only card still shows old → new for the proposal (edit mode closed)", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        expect(screen.getByText(/Start: 2026-10-30 → 2026-11-01/)).toBeTruthy();
    });
});

describe("tags", () => {
    const TAGGED = { task_id: "PRJ-1", tags: ["bug", "ui"] };

    it("shows the proposed names, and the note that each must already exist", () => {
        mount({ tool: "update_task", args: TAGGED, editable: ["tags"] });
        openEdit();
        const list = screen.getByRole("list", { name: "Tags" });
        expect(
            within(list)
                .getAllByRole("listitem")
                .map((x) => x.textContent)
        ).toEqual(["bug", "ui"]);
        expect(screen.getByText(/Each tag must already exist in the project/)).toBeTruthy();
    });

    it("removes one, and sends the list that is left", () => {
        const { onApprove } = mount({ tool: "update_task", args: TAGGED, editable: ["tags"] });
        openEdit();
        fireEvent.click(screen.getByRole("button", { name: "Remove tag ui" }));
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ tags: ["bug"] });
    });

    it("removing them all sends [] (it clears the tags)", () => {
        const { onApprove } = mount({ tool: "update_task", args: TAGGED, editable: ["tags"] });
        openEdit();
        fireEvent.click(screen.getByRole("button", { name: "Remove tag ui" }));
        fireEvent.click(screen.getByRole("button", { name: "Remove tag bug" }));
        expect(screen.getByText("No tags (this clears them)")).toBeTruthy();
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ tags: [] });
    });

    it("adds one on Enter, and Enter does not approve", () => {
        const { onApprove } = mount({ tool: "update_task", args: TAGGED, editable: ["tags"] });
        openEdit();
        const input = screen.getByPlaceholderText("Add a tag") as HTMLInputElement;
        input.value = "perf";
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onApprove).not.toHaveBeenCalled();
        expect(input.value).toBe("");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ tags: ["bug", "ui", "perf"] });
    });

    it("a name typed and left in the box is added when the box loses focus, not lost", () => {
        const { onApprove } = mount({ tool: "update_task", args: TAGGED, editable: ["tags"] });
        openEdit();
        const input = screen.getByPlaceholderText("Add a tag") as HTMLInputElement;
        input.value = "perf";
        fireEvent.blur(input);
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ tags: ["bug", "ui", "perf"] });
    });

    it("ignores a blank and a duplicate", () => {
        const { onApprove } = mount({ tool: "update_task", args: TAGGED, editable: ["tags"] });
        openEdit();
        const input = screen.getByPlaceholderText("Add a tag") as HTMLInputElement;
        for (const value of ["  ", "bug"]) {
            input.value = value;
            fireEvent.keyDown(input, { key: "Enter" });
        }
        approve();
        expect(onApprove.mock.calls[0]).toEqual([]);
    });

    it("update_task now shows the tags and the passage it adds (it never did)", () => {
        mount({
            tool: "update_task",
            args: { task_id: "PRJ-1", tags: ["bug"], body_append: "Appended text." },
            editable: ["tags", "body_append"],
        });
        expect(screen.getByText("Tags: bug")).toBeTruthy();
        expect(screen.getByText("Text to add at the end")).toBeTruthy();
        expect(screen.getByText("Appended text.")).toBeTruthy();
    });
});

describe("a long body", () => {
    it("is shown as a one-line caption beside the editor, not printed in full a second time", () => {
        const long = `${"word ".repeat(200)}\n\nEND`;
        mount({
            tool: "update_note",
            args: { note_id: 7, content_text: long },
            editable: ["content_text"],
        });
        openEdit();
        type("Content", "short");
        const caption = screen.getByText(/^Genos proposed: word word/);
        expect(caption.textContent!.endsWith("…")).toBe(true);
        expect(caption.textContent).not.toContain("END");
        expect(caption.textContent!.length).toBeLessThan(170);
    });
});

describe("an empty proposal", () => {
    it("says that Genos proposed to clear it, since an empty box would not", () => {
        mount({
            tool: "update_task",
            args: { task_id: "PRJ-1", content_text: "" },
            editable: ["content_text"],
        });
        openEdit();
        expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("");
        expect(screen.getByText("Genos proposed: none")).toBeTruthy();
    });
});

describe("a bulk update", () => {
    const BULK = {
        updates: [
            {
                task_id: 5,
                display_id: "PRJ-5",
                title: "Login bug",
                priority: "High",
                due_date: "2026-11-20",
                milestone_id: "Beta",
                rationale: "It blocks the beta.",
                current: { priority: "Low", due_date: "2026-12-01", milestone_id: "Alpha" },
            },
            {
                task_id: 6,
                display_id: "PRJ-6",
                title: "Signup bug",
                status: "Closed",
                current: { status: "WIP" },
            },
        ],
    };
    const EDITABLE = ["updates[0].priority", "updates[0].due_date", "updates[1].status"];

    it("an inline editor per row, the row's own header and its non-editable lines kept", () => {
        mount({ tool: "update_tasks_bulk", args: BULK, editable: EDITABLE });
        openEdit();
        expect(screen.getByText(/PRJ-5/)).toBeTruthy();
        expect(screen.getByText(/PRJ-6/)).toBeTruthy();
        expect(screen.getByText("It blocks the beta.")).toBeTruthy();
        // The milestone move has no editor: it keeps its old → new line.
        expect(screen.getByText(/Milestone:/).textContent).toMatch(/Alpha.*→.*Beta/);
        const priorities = screen.getAllByLabelText("Priority") as HTMLSelectElement[];
        expect(priorities).toHaveLength(1);
        expect(priorities[0].value).toBe("High");
        expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("Closed");
    });

    it("sends the row path of the row that changed, and nothing for the others", () => {
        const { onApprove } = mount({ tool: "update_tasks_bulk", args: BULK, editable: EDITABLE });
        openEdit();
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Open" } });
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ "updates[1].status": "Open" });
    });

    it("two rows at once", () => {
        const { onApprove } = mount({ tool: "update_tasks_bulk", args: BULK, editable: EDITABLE });
        openEdit();
        fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "Critical" } });
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Open" } });
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({
            "updates[0].priority": "Critical",
            "updates[1].status": "Open",
        });
    });

    it("two rows with the same field: each editor writes to its OWN row", () => {
        const { onApprove } = mount({
            tool: "update_tasks_bulk",
            args: {
                updates: [
                    { task_id: 1, display_id: "PRJ-1", title: "One", priority: "High" },
                    { task_id: 2, display_id: "PRJ-2", title: "Two", priority: "Low" },
                    { task_id: 3, display_id: "PRJ-3", title: "Three", priority: "Normal" },
                ],
            },
            editable: ["updates[0].priority", "updates[1].priority", "updates[2].priority"],
        });
        openEdit();
        const selects = screen.getAllByLabelText("Priority") as HTMLSelectElement[];
        expect(selects.map((s) => s.value)).toEqual(["High", "Low", "Normal"]);
        fireEvent.change(selects[1], { target: { value: "Critical" } });
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ "updates[1].priority": "Critical" });
    });

    it("hides the row's `current` snapshot once that field is edited", () => {
        mount({ tool: "update_tasks_bulk", args: BULK, editable: EDITABLE });
        openEdit();
        expect(screen.getByText("Now: Low")).toBeTruthy();
        fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "Critical" } });
        expect(screen.queryByText("Now: Low")).toBeNull();
        expect(screen.getByText("Genos proposed: High")).toBeTruthy();
    });

    it("closed, the card is the same preview as before: no editor, old → new", () => {
        mount({ tool: "update_tasks_bulk", args: BULK, editable: EDITABLE });
        expect(screen.queryByLabelText("Priority")).toBeNull();
        expect(screen.getByText(/Priority:/).textContent).toMatch(/Low.*→.*High/);
    });

    it("a row with no editable path gets no editor", () => {
        mount({
            tool: "update_tasks_bulk",
            args: BULK,
            editable: ["updates[1].status"],
        });
        openEdit();
        expect(screen.queryByLabelText("Priority")).toBeNull();
        expect(screen.getByLabelText("Status")).toBeTruthy();
    });
});

describe("a body", () => {
    it("is a plain multiline textarea (a note body is markdown SOURCE)", () => {
        const { onApprove } = mount({
            tool: "update_note",
            args: {
                note_id: 7,
                note_title: "Plan",
                title: "Plan",
                content_text: "# Heading\n\n- a",
            },
            editable: ["title", "content_text"],
        });
        openEdit();
        const body = screen.getByLabelText("Content") as HTMLTextAreaElement;
        expect(body.tagName).toBe("TEXTAREA");
        expect(body.value).toBe("# Heading\n\n- a");
        type("Content", "# Heading\n\n- a\n- b");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ content_text: "# Heading\n\n- a\n- b" });
    });

    it("an optional body may be emptied: '' clears it", () => {
        const { onApprove } = mount({
            tool: "update_note",
            args: { note_id: 7, content_text: "text" },
            editable: ["content_text"],
        });
        openEdit();
        type("Content", "");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ content_text: "" });
    });

    it("a comment body", () => {
        const { onApprove } = mount({
            tool: "add_comment",
            args: { task_id: "PRJ-1", body_text: "Looks good" },
            editable: ["body_text"],
        });
        openEdit();
        type("Comment", "Looks great");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({ body_text: "Looks great" });
    });
});

describe("after the server refused the edits (a restored card)", () => {
    const refused = () =>
        mount({
            tool: "update_task",
            args: UPDATE_TASK,
            editable: UPDATE_TASK_EDITABLE,
            fieldErrors: {
                due_date: "Due date: that date is not allowed here.",
                project_id: "This can't be edited.",
            },
            restoredEdits: { due_date: "2026-12-25", title: "New title" },
        });

    it("opens in edit mode on what was typed, and announces that nothing was approved", () => {
        refused();
        expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("New title");
        expect((screen.getByLabelText("Due date") as HTMLInputElement).value).not.toBe(
            "2026-11-20"
        );
        const alert = screen.getByRole("alert");
        expect(alert.textContent).toContain("Some of your changes can't be applied");
        expect(alert.textContent).toContain("Nothing was approved or run");
    });

    it("puts the server's sentence next to its field, and focuses the first field with a problem", () => {
        refused();
        const due = screen.getByLabelText("Due date");
        expect(due.getAttribute("aria-invalid")).toBe("true");
        expect(document.getElementById(due.getAttribute("aria-describedby")!)!.textContent).toBe(
            "Due date: that date is not allowed here."
        );
        expect(document.activeElement).toBe(due);
    });

    it("a sentence for a path with no editor is still shown, not dropped", () => {
        refused();
        expect(screen.getByRole("alert").textContent).toContain(
            "project_id: This can't be edited."
        );
    });

    it("touching a field takes its refusal off (it was about the old value)", () => {
        refused();
        type("Due date", "2026-02-28");
        expect(screen.queryByText("Due date: that date is not allowed here.")).toBeNull();
        expect(screen.getByLabelText("Due date").getAttribute("aria-invalid")).toBeNull();
    });

    it("Approve sends what was typed again, together with whatever is changed now", () => {
        const { onApprove } = refused();
        type("Due date", "2026-02-28");
        type("Priority", "Low");
        approve();
        expect(onApprove.mock.calls[0][0]).toEqual({
            title: "New title",
            due_date: "2026-02-28",
            priority: "Low",
        });
    });

    it("Cancel edit leaves it all behind: a plain approve, no notice", () => {
        const { onApprove } = refused();
        fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
        expect(screen.queryByRole("alert")).toBeNull();
        approve();
        expect(onApprove.mock.calls[0]).toEqual([]);
    });
});

describe("the narrow screen", () => {
    it("uses native controls (the browser draws the pickers: no portal under a 13100 overlay)", () => {
        mount({ tool: "update_task", args: UPDATE_TASK, editable: UPDATE_TASK_EDITABLE });
        openEdit();
        expect(screen.getByLabelText("Status").tagName).toBe("SELECT");
        expect((screen.getByLabelText("Due date") as HTMLInputElement).type).toBe("date");
        // Nothing was portalled out of the card.
        expect(document.querySelector('[role="listbox"]')).toBeNull();
    });
});
