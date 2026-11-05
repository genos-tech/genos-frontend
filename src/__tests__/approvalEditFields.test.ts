/**
 * The client's half of the edit-before-approve contract (genos-api #570):
 * which paths get which editor, and the cheap checks that mirror the server's.
 * The server stays the authority; these pin the table so a change to either
 * side is a deliberate one.
 */

import { describe, expect, it } from "vitest";

import {
    checkDraft,
    currentValue,
    EDITABLE_FIELDS,
    editableFieldsOf,
    enumOptions,
    initialDraft,
    MAX_BODY_BYTES,
    parsePath,
    showValue,
    specFor,
    toRemindInput,
    valueAt,
    withoutEditable,
} from "../features/agentQA/approval/editableFields";

describe("paths", () => {
    it("reads a top-level argument and a bulk row path as the server does", () => {
        expect(parsePath("title")).toEqual({ name: "title" });
        expect(parsePath("updates[3].priority")).toEqual({
            name: "updates",
            row: 3,
            field: "priority",
        });
    });

    it.each(["", "updates[03].priority", "updates[1]", "updates[1].a.b", "a b", "updates[-1].x"])(
        "refuses %j",
        (path) => {
            expect(parsePath(path)).toBeNull();
        }
    );

    it("finds the editor for a path on a tool, and none for a tool or path it does not know", () => {
        expect(specFor("update_task", "title")?.kind).toBe("text");
        expect(specFor("update_tasks_bulk", "updates[7].status")?.kind).toBe("enum");
        expect(specFor("update_tasks_bulk", "updates[7].tags")).toBeNull();
        expect(specFor("update_task", "task_id")).toBeNull();
        expect(specFor("delete_note", "title")).toBeNull();
        expect(specFor("some_future_tool", "title")).toBeNull();
    });
});

describe("the allow-list table (pinned to genos-api approval_edits.EDITABLE_FIELDS)", () => {
    const shape = (tool: string) =>
        Object.fromEntries(
            Object.entries(EDITABLE_FIELDS[tool]).map(([path, f]) => [
                path,
                [f.kind, f.required ?? false, f.maxLength ?? null, f.allowEmpty ?? false],
            ])
        );

    it("create_task", () => {
        expect(shape("create_task")).toEqual({
            title: ["text", true, 255, false],
            content_text: ["body", false, null, false],
            priority: ["enum", false, null, false],
            effort_level: ["enum", false, null, false],
            due_date: ["date", false, null, true],
            start_date: ["date", false, null, true],
        });
    });

    it("update_task: the other body edits need something to add; tags are a list", () => {
        expect(shape("update_task")).toEqual({
            title: ["text", true, 255, false],
            content_text: ["body", false, null, false],
            body_append: ["body", true, null, false],
            body_prepend: ["body", true, null, false],
            status: ["enum", false, null, false],
            priority: ["enum", false, null, false],
            effort_level: ["enum", false, null, false],
            due_date: ["date", false, null, true],
            start_date: ["date", false, null, true],
            tags: ["tags", false, null, false],
        });
    });

    it("update_tasks_bulk: the five row scalars, no tags and no ids", () => {
        expect(Object.keys(EDITABLE_FIELDS.update_tasks_bulk)).toEqual([
            "updates[*].status",
            "updates[*].priority",
            "updates[*].effort_level",
            "updates[*].due_date",
            "updates[*].start_date",
        ]);
    });

    it("comments, notes and to-dos", () => {
        expect(shape("add_comment")).toEqual({ body_text: ["body", true, null, false] });
        expect(shape("update_comment")).toEqual({ body_text: ["body", true, null, false] });
        expect(shape("create_note")).toEqual({
            title: ["text", true, 255, false],
            content_text: ["body", false, null, false],
        });
        expect(shape("update_note")).toEqual(shape("create_note"));
        // A to-do's day cannot be emptied; its reminder can on create only.
        expect(shape("create_todo_item")).toEqual({
            title: ["text", true, 512, false],
            notes_text: ["body", false, null, false],
            target_date: ["date", false, null, false],
            remind_at: ["remindAt", false, null, true],
        });
        expect(shape("update_todo_item")).toEqual({
            title: ["text", true, 512, false],
            notes_text: ["body", false, null, false],
            target_date: ["date", false, null, false],
            remind_at: ["remindAt", false, null, false],
        });
    });

    it("lists no target id and no tool that is not in v1", () => {
        const ids =
            /(^|_)(id|ids)$|^(task_id|note_id|project_id|assignee_id|milestone_id|folder_id|item_id|comment_id)/;
        for (const [tool, fields] of Object.entries(EDITABLE_FIELDS)) {
            for (const path of Object.keys(fields))
                expect({ tool, path, id: ids.test(path) }).toEqual({ tool, path, id: false });
        }
        expect(Object.keys(EDITABLE_FIELDS).sort()).toEqual(
            [
                "add_comment",
                "create_note",
                "create_task",
                "create_todo_item",
                "update_comment",
                "update_note",
                "update_task",
                "update_tasks_bulk",
                "update_todo_item",
            ].sort()
        );
    });
});

describe("editableFieldsOf", () => {
    it("keeps the server's order and its exact path strings", () => {
        const fields = editableFieldsOf("update_tasks_bulk", [
            "updates[0].status",
            "updates[0].priority",
            "updates[2].due_date",
        ]);
        expect(fields.map((f) => [f.path, f.row, f.field])).toEqual([
            ["updates[0].status", 0, "status"],
            ["updates[0].priority", 0, "priority"],
            ["updates[2].due_date", 2, "due_date"],
        ]);
    });

    it("drops a path this client has no editor for, and a duplicate", () => {
        const fields = editableFieldsOf("create_task", ["title", "title", "project_id", "nope"]);
        expect(fields.map((f) => f.path)).toEqual(["title"]);
    });

    it("an absent `editable` (an older backend) and an empty one both mean nothing is editable", () => {
        expect(editableFieldsOf("create_task", undefined)).toEqual([]);
        expect(editableFieldsOf("create_task", [])).toEqual([]);
    });
});

describe("what the card holds at a path", () => {
    const args = {
        title: "Fix it",
        updates: [{ priority: "High" }, { priority: "Low", current: { priority: "Normal" } }],
        current: { start_date: "2026-11-01", reminder_at: "2026-11-05T09:00:00+09:00" },
    };

    it("reads a flat path and a row path", () => {
        expect(valueAt(args, "title")).toBe("Fix it");
        expect(valueAt(args, "updates[1].priority")).toBe("Low");
        expect(valueAt(args, "updates[9].priority")).toBeUndefined();
        expect(valueAt(args, "missing")).toBeUndefined();
    });

    it("reads the present value the backend snapshotted, where it did", () => {
        expect(currentValue(args, "start_date")).toEqual({ known: true, value: "2026-11-01" });
        expect(currentValue(args, "due_date")).toEqual({ known: false, value: undefined });
        expect(currentValue(args, "priority", 1)).toEqual({ known: true, value: "Normal" });
        expect(currentValue(args, "priority", 0).known).toBe(false);
        // The argument is `remind_at`, the snapshot `reminder_at`.
        expect(currentValue(args, "remind_at").known).toBe(true);
        // null is "unset", and is known.
        expect(currentValue({ current: { start_date: null } }, "start_date")).toEqual({
            known: true,
            value: null,
        });
    });

    it("takes the editable top-level arguments off a copy, leaving the rest", () => {
        const fields = editableFieldsOf("update_task", ["title", "status"]);
        const left = withoutEditable(
            { task_id: "PRJ-1", title: "x", status: "WIP", note: 1 },
            fields
        );
        expect(left).toEqual({ task_id: "PRJ-1", note: 1 });
    });
});

describe("the editor's starting value", () => {
    const spec = (tool: string, path: string) => specFor(tool, path)!;

    it("text and enum are the proposal; a missing one is empty", () => {
        expect(initialDraft(spec("create_task", "title"), "Hello")).toBe("Hello");
        expect(initialDraft(spec("create_task", "priority"), undefined)).toBe("");
    });

    it("a date is YYYY-MM-DD; the compact spelling the tools accept is normalised, junk is empty", () => {
        const due = spec("create_task", "due_date");
        expect(initialDraft(due, "2026-11-20")).toBe("2026-11-20");
        expect(initialDraft(due, "20261120")).toBe("2026-11-20");
        expect(initialDraft(due, "")).toBe("");
        expect(initialDraft(due, "next friday")).toBe("");
    });

    it("tags are the proposed names", () => {
        expect(initialDraft(spec("update_task", "tags"), ["a", "b"])).toEqual(["a", "b"]);
        expect(initialDraft(spec("update_task", "tags"), [])).toEqual([]);
    });

    describe("a reminder, in the three spellings the server reads", () => {
        it("a local date-time keeps its clock, minus seconds", () => {
            expect(toRemindInput("2026-11-06T09:00")).toBe("2026-11-06T09:00");
            expect(toRemindInput("2026-11-06T09:30:45")).toBe("2026-11-06T09:30");
            expect(toRemindInput("2026-11-06 09:30")).toBe("2026-11-06T09:30");
        });

        it("a bare date is 09:00 that day, as the server reads it", () => {
            expect(toRemindInput("2026-11-06")).toBe("2026-11-06T09:00");
        });

        it("an instant with an offset is shown in the zone the card names, not the browser's", () => {
            expect(toRemindInput("2026-11-06T00:30:00Z", "Asia/Tokyo")).toBe("2026-11-06T09:30");
            expect(toRemindInput("2026-11-06T09:00:00+09:00", "America/New_York")).toBe(
                "2026-11-05T19:00"
            );
        });

        it("an instant with no usable zone keeps the clock it was written with", () => {
            expect(toRemindInput("2026-11-06T09:00:00+09:00")).toBe("2026-11-06T09:00");
            expect(toRemindInput("2026-11-06T09:00:00+09:00", "Not/AZone")).toBe(
                "2026-11-06T09:00"
            );
        });

        it("nothing readable is empty", () => {
            expect(toRemindInput("")).toBe("");
            expect(toRemindInput("tomorrow-ish")).toBe("");
            expect(toRemindInput(undefined)).toBe("");
        });
    });
});

describe("the cheap checks", () => {
    const title = specFor("create_task", "title")!;
    const body = specFor("create_task", "content_text")!;
    const comment = specFor("add_comment", "body_text")!;
    const due = specFor("create_task", "due_date")!;
    const day = specFor("create_todo_item", "target_date")!;
    const remindCreate = specFor("create_todo_item", "remind_at")!;
    const remindUpdate = specFor("update_todo_item", "remind_at")!;

    it("a required text cannot be blank, even if it is only spaces", () => {
        expect(checkDraft(title, "")).toBe("required");
        expect(checkDraft(title, "   ")).toBe("required");
        expect(checkDraft(title, "ok")).toBeNull();
        expect(checkDraft(comment, "  \n ")).toBe("required");
    });

    it("an optional body may be empty (it clears)", () => {
        expect(checkDraft(body, "")).toBeNull();
    });

    it("a title is capped in characters after trimming, counted as code points", () => {
        expect(checkDraft(title, "a".repeat(255))).toBeNull();
        expect(checkDraft(title, `  ${"a".repeat(255)}  `)).toBeNull();
        expect(checkDraft(title, "a".repeat(256))).toBe("tooLong");
        // 200 emoji are 400 UTF-16 units but 200 characters.
        expect(checkDraft(title, "😀".repeat(200))).toBeNull();
        expect(checkDraft(specFor("create_todo_item", "title")!, "a".repeat(512))).toBeNull();
        expect(checkDraft(specFor("create_todo_item", "title")!, "a".repeat(513))).toBe("tooLong");
    });

    it("a body is capped in UTF-8 bytes", () => {
        expect(checkDraft(body, "a".repeat(MAX_BODY_BYTES))).toBeNull();
        expect(checkDraft(body, "a".repeat(MAX_BODY_BYTES + 1))).toBe("bodyTooLong");
        // 3 bytes each: under the cap in characters, over it in bytes.
        expect(checkDraft(body, "あ".repeat(Math.floor(MAX_BODY_BYTES / 3) + 1))).toBe(
            "bodyTooLong"
        );
        expect(checkDraft(body, "あ".repeat(Math.floor(MAX_BODY_BYTES / 3)))).toBeNull();
    });

    it("a date is a real YYYY-MM-DD; empty only where the field clears", () => {
        expect(checkDraft(due, "2026-11-20")).toBeNull();
        expect(checkDraft(due, "")).toBeNull();
        expect(checkDraft(due, "2026-02-30")).toBe("badDate");
        expect(checkDraft(due, "2026-1-5")).toBe("badDate");
        expect(checkDraft(due, "20261120")).toBe("badDate");
        expect(checkDraft(day, "")).toBe("dateRequired");
        expect(checkDraft(day, "2026-11-20")).toBeNull();
    });

    it("half a date in the input is a problem, not a clear", () => {
        expect(checkDraft(due, "", true)).toBe("badDate");
        expect(checkDraft(remindCreate, "", true)).toBe("badReminder");
    });

    it("a reminder is a real local date-time; empty only on create", () => {
        expect(checkDraft(remindUpdate, "2026-11-06T09:00")).toBeNull();
        expect(checkDraft(remindUpdate, "2026-11-06")).toBe("badReminder");
        expect(checkDraft(remindUpdate, "2026-11-06T25:00")).toBe("badReminder");
        expect(checkDraft(remindUpdate, "")).toBe("reminderRequired");
        expect(checkDraft(remindCreate, "")).toBeNull();
    });

    it("does not judge whether a reminder is in the future (the browser's zone is not the user's)", () => {
        expect(checkDraft(remindUpdate, "2001-01-01T09:00")).toBeNull();
    });

    it("tags and choices have no cheap check", () => {
        expect(checkDraft(specFor("update_task", "tags")!, ["a"])).toBeNull();
        expect(checkDraft(specFor("create_task", "priority")!, "Whatever")).toBeNull();
    });
});

describe("enum options", () => {
    it("are the API's own words, from the task meta constants", () => {
        expect(enumOptions("priority")).toEqual(["Minimal", "Low", "Normal", "High", "Critical"]);
        expect(enumOptions("effort")).toEqual(["Minimal", "Low", "Moderate", "High", "Extensive"]);
    });

    it("a status never offers Deleted: an edit is not a delete", () => {
        expect(enumOptions("status")).toEqual(["Open", "WIP", "Blocked", "Pending", "Closed"]);
    });
});

describe("saying a value", () => {
    const words = {
        cleared: "none",
        noTags: "no tags",
        meta: { high: "HIGH!" } as never,
    };

    it("empty is `cleared`, a list is its names, a choice is the app's word", () => {
        const priority = specFor("create_task", "priority")!;
        expect(showValue(priority, "", words)).toBe("none");
        expect(showValue(priority, null, words)).toBe("none");
        expect(showValue(priority, "High", words)).toBe("HIGH!");
        expect(showValue(specFor("update_task", "tags")!, ["a", "b"], words)).toBe("a, b");
        expect(showValue(specFor("update_task", "tags")!, [], words)).toBe("no tags");
    });

    it("a reminder reads as the user's clock", () => {
        const r = specFor("update_todo_item", "remind_at")!;
        expect(showValue(r, "2026-11-06T09:00:00+09:00", words, "Asia/Tokyo")).toBe(
            "2026-11-06 09:00"
        );
        expect(showValue(r, "2026-11-06T09:00", words)).toBe("2026-11-06 09:00");
    });
});
