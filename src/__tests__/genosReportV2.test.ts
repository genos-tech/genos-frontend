/**
 * MIP-1208: the typed report body (`version: 2`). The server whitelists every field, and the
 * client checks each one again: a value that fails its check is dropped (the line keeps its
 * text), never repaired, and never reaches the DOM as anything but text.
 */
import { describe, expect, it } from "vitest";

import {
    isReportV2,
    parseGenosReportV2,
    REPORT_EMOJI,
} from "../features/inbox/utils/genosReportV2";

const task = (over: Record<string, unknown> = {}) => ({
    text: "MIP-7 · Fix the login",
    kind: "task",
    display_id: "MIP-7",
    title: "Fix the login",
    status: "WIP",
    ...over,
});

const body = (items: unknown[], extra: Record<string, unknown> = {}) => ({
    version: 2,
    title: "t",
    text: "s",
    sections: [{ heading: "Overdue", key: "overdue", emoji: "🔥", items }],
    ...extra,
});

const firstItem = (items: unknown[]) => parseGenosReportV2(body(items))!.sections[0].items[0];

describe("isReportV2", () => {
    it("version 2 is typed", () => expect(isReportV2({ version: 2, sections: [] })).toBe(true));
    it.each([
        [{}],
        [{ version: 1 }],
        [{ version: 3 }],
        [{ version: "2" }],
        [{ version: 2.5 }],
        [null],
        [[]],
        ["x"],
    ])("%j is not", (value) => expect(isReportV2(value)).toBe(false));
    it("returns null from the parser for a body without a version", () => {
        expect(parseGenosReportV2({ title: "t", text: "s", sections: [] })).toBeNull();
    });
});

describe("parseGenosReportV2: order and shape", () => {
    it("keeps the server's section and item order", () => {
        const report = parseGenosReportV2({
            version: 2,
            title: "T",
            text: "S",
            sections: [
                {
                    heading: "Z last alphabetically",
                    key: "blocked",
                    items: [{ text: "b" }, { text: "a" }],
                },
                { heading: "A first alphabetically", key: "overdue", items: [{ text: "c" }] },
            ],
        })!;
        expect(report.sections.map((s) => s.key)).toEqual(["blocked", "overdue"]);
        expect(report.sections[0].items.map((i) => i.text)).toEqual(["b", "a"]);
    });

    it("drops a section with no usable item and caps sections at 12", () => {
        const sections = Array.from({ length: 15 }, (_, i) => ({
            heading: `h${i}`,
            items: [{ text: `i${i}` }],
        }));
        const report = parseGenosReportV2({
            version: 2,
            sections: [{ heading: "e", items: [] }, ...sections],
        })!;
        expect(report.sections).toHaveLength(11); // 12 read, the empty one dropped
        expect(report.sections[0].heading).toBe("h0");
    });

    it("collapses whitespace and cuts to the server's caps", () => {
        const item = firstItem([{ text: "a\n\n  b\t" + "x".repeat(400) }]);
        expect(item.text.startsWith("a b x")).toBe(true);
        expect(item.text.length).toBe(240);
    });
});

describe("parseGenosReportV2: text caps", () => {
    it("cuts by code point, so a cap never splits an emoji", () => {
        const item = firstItem([{ text: "a".repeat(239) + "😀" }]);
        expect(item.text).toBe("a".repeat(239) + "😀");
        expect(Array.from(item.text)).toHaveLength(240);
    });
});

describe("parseGenosReportV2: emoji", () => {
    it("keeps the server's emoji when it is only an emoji", () => {
        expect(parseGenosReportV2(body([{ text: "a" }]))!.sections[0].emoji).toBe("🔥");
    });

    it.each(["<img src=x>", "fire", "🔥 fire", "🔥".repeat(20), "", 5, null])(
        "replaces %j with the table's emoji for the key",
        (emoji) => {
            const report = parseGenosReportV2({
                version: 2,
                sections: [{ heading: "h", key: "overdue", emoji, items: [{ text: "a" }] }],
            })!;
            expect(report.sections[0].emoji).toBe(REPORT_EMOJI.overdue);
        }
    );

    it("has none for a key the table does not know", () => {
        const report = parseGenosReportV2({
            version: 2,
            sections: [{ heading: "h", key: "made_up", emoji: "bad", items: [{ text: "a" }] }],
        })!;
        expect(report.sections[0].emoji).toBe("");
    });

    it.each(["Bad Key", "UPPER", "a-b", "<b>", "", 5, "x".repeat(40)])(
        "refuses the key %j",
        (key) => {
            const report = parseGenosReportV2({
                version: 2,
                sections: [{ heading: "h", key, items: [{ text: "a" }] }],
            })!;
            expect(report.sections[0].key).toBeNull();
        }
    );
});

describe("parseGenosReportV2: stats", () => {
    it("keeps each key once, drops a bad count, and stops at 8", () => {
        const stats = [
            { key: "overdue", count: 2, emoji: "🔥" },
            { key: "overdue", count: 9, emoji: "🔥" },
            { key: "due_today", count: 0 },
            { key: "closed", count: 1.5 },
            { key: "closed", count: 100000 },
            { key: "closed", count: "3" },
            ...Array.from({ length: 12 }, (_, i) => ({
                key: `k${"abcdefghijkl"[i]}`,
                count: i + 1,
            })),
        ];
        const report = parseGenosReportV2({ version: 2, sections: [], stats })!;
        expect(report.stats).toHaveLength(8);
        expect(report.stats[0]).toEqual({ key: "overdue", count: 2, emoji: "🔥" });
        expect(report.stats.map((s) => s.key)).not.toContain("due_today");
        expect(report.stats.map((s) => s.key)).not.toContain("closed");
    });

    it("is empty when stats is not a list", () => {
        expect(parseGenosReportV2({ version: 2, sections: [], stats: "x" })!.stats).toEqual([]);
    });
});

describe("parseGenosReportV2: item fields", () => {
    it("reads a whole task line", () => {
        const item = firstItem([
            task({
                project: { id: 3, name: "Genos", code: "MIP" },
                priority: "High",
                due_date: "2026-11-04",
                overdue_days: 4,
                detail: "2 comments from others",
                link: "/workspace/tasks/project/3/task/812",
            }),
        ]);
        expect(item).toMatchObject({
            kind: "task",
            displayId: "MIP-7",
            title: "Fix the login",
            status: "WIP",
            priority: "High",
            dueDate: "2026-11-04",
            overdueDays: 4,
            detail: "2 comments from others",
            link: "/workspace/tasks/project/3/task/812",
            project: { id: 3, name: "Genos", code: "MIP" },
        });
    });

    it.each(["Deleted", "Hacked", "open", "constructor", "__proto__", "toString"])(
        "an unknown status %j is plain text, not a status",
        (status) => {
            const item = firstItem([task({ status })]);
            expect(item.status).toBeNull();
            expect(item.statusOther).toBe(status);
        }
    );

    it.each(["urgent", "high", "constructor", 3, null])(
        "an unknown priority %j is dropped",
        (priority) => {
            expect(firstItem([task({ priority })]).priority).toBeNull();
        }
    );

    it.each(["Task", "script", "constructor", "__proto__", 4, null])(
        "an unknown kind %j is none",
        (kind) => {
            expect(firstItem([{ text: "line", kind }]).kind).toBeNull();
        }
    );

    it.each([
        { id: 0, name: "n" },
        { id: -1, name: "n" },
        { id: 1.5, name: "n" },
        { id: "3", name: "n" },
        { id: 3, name: "" },
        { id: 3 },
        "Genos",
        [],
        null,
    ])("refuses the project %j", (project) => {
        expect(firstItem([task({ project })]).project).toBeNull();
    });

    it("cuts a project's name and code to their caps", () => {
        const item = firstItem([
            task({ project: { id: 1, name: "n".repeat(300), code: "ABCDEFGHIJ" } }),
        ]);
        expect(item.project!.name).toHaveLength(100);
        expect(item.project!.code).toBe("ABCDEF");
    });

    it.each([
        "2026-02-31",
        "2026-13-01",
        "2026-11-8",
        "11/08/2026",
        "2026-11-08T00:00",
        "",
        20261108,
        null,
    ])("refuses the due date %j", (due_date) => {
        expect(firstItem([task({ due_date })]).dueDate).toBeNull();
    });

    it.each([0, -3, 1.5, "4", 36501, null])("refuses overdue_days %j", (overdue_days) => {
        expect(firstItem([task({ overdue_days })]).overdueDays).toBeNull();
    });

    it("keeps the extremes of overdue_days", () => {
        expect(firstItem([task({ overdue_days: 1 })]).overdueDays).toBe(1);
        expect(firstItem([task({ overdue_days: 36500 })]).overdueDays).toBe(36500);
    });

    it("ignores task fields on a line that is not a task", () => {
        const item = firstItem([
            {
                text: "Call the bank",
                kind: "todo",
                status: "WIP",
                priority: "High",
                due_date: "2026-11-04",
                overdue_days: 3,
                display_id: "X-1",
                project: { id: 1, name: "p" },
            },
        ]);
        expect(item).toMatchObject({
            kind: "todo",
            status: null,
            priority: null,
            dueDate: null,
            overdueDays: null,
            displayId: "",
            project: null,
        });
    });

    it("builds a task line's text from its id and title when text is missing", () => {
        expect(firstItem([task({ text: undefined })]).text).toBe("MIP-7 · Fix the login");
    });

    it("drops a line with no text at all and any non-object entry", () => {
        const report = parseGenosReportV2(
            body([{ kind: "todo" }, null, "x", 5, [], { text: "kept" }])
        )!;
        expect(report.sections[0].items.map((i) => i.text)).toEqual(["kept"]);
    });

    it.each([
        "javascript:alert(1)",
        "http://example.com",
        "/workspace/../admin",
        "//evil.example/x",
        "data:text/html,x",
    ])("drops the unsafe link %j and keeps the line", (link) => {
        const item = firstItem([task({ link })]);
        expect(item.link).toBeNull();
        expect(item.title).toBe("Fix the login");
    });

    it("keeps markup as the text it is", () => {
        const item = firstItem([
            task({ title: "<img src=x onerror=alert(1)> **x**", detail: "<script>x()</script>" }),
        ]);
        expect(item.title).toBe("<img src=x onerror=alert(1)> **x**");
        expect(item.detail).toBe("<script>x()</script>");
    });
});

describe("parseGenosReportV2: answer fields (MIP-1211)", () => {
    it("reads task_id, why and can_answer from a task line", () => {
        const item = firstItem([task({ task_id: 2195, why: "due_soon", can_answer: true })]);
        expect(item.taskId).toBe(2195);
        expect(item.why).toBe("due_soon");
        expect(item.canAnswer).toBe(true);
    });

    it("an old line has none of them: no id, no why, no buttons", () => {
        const item = firstItem([task()]);
        expect(item.taskId).toBeNull();
        expect(item.why).toBe("");
        expect(item.canAnswer).toBe(false);
    });

    it.each([
        ["a string", "7"],
        ["a float", 7.5],
        ["zero", 0],
        ["negative", -3],
        ["beyond a safe integer", 2 ** 60],
        ["a boolean", true],
        ["null", null],
        ["an object", { id: 7 }],
        ["a path-like string", "7/../../x"],
    ])("drops a task_id that is %s, and with it can_answer", (_name, task_id) => {
        const item = firstItem([task({ task_id, can_answer: true })]);
        expect(item.taskId).toBeNull();
        expect(item.canAnswer).toBe(false);
    });

    it.each([["true"], [1], ["yes"], [{}], [null]])(
        "only a JSON true is can_answer, not %j",
        (can_answer) => {
            expect(firstItem([task({ task_id: 5, can_answer })]).canAnswer).toBe(false);
        }
    );

    it("a line that is not a task never carries them", () => {
        const item = firstItem([
            { text: "Standup", kind: "event", task_id: 5, can_answer: true, why: "new" },
        ]);
        expect(item.taskId).toBeNull();
        expect(item.canAnswer).toBe(false);
        expect(item.why).toBe("");
    });

    it("keeps why as plain text, capped", () => {
        expect(firstItem([task({ why: "<b>x</b>" })]).why).toBe("<b>x</b>");
        expect(firstItem([task({ why: "x".repeat(500) })]).why.length).toBe(120);
        expect(firstItem([task({ why: 7 })]).why).toBe("");
    });

    it("has an emoji for the two stats the server adds", () => {
        expect(REPORT_EMOJI.still_same).toBe("🔁");
        expect(REPORT_EMOJI.quieted).toBe("🔕");
    });
});
