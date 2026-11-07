import { describe, expect, it } from "vitest";

import {
    GENOS_REPORT_ITEM_TYPE,
    parseGenosReport,
    safeReportLink,
} from "../features/inbox/utils/genosReport";
import { ACTIVITY_ITEM_TYPES, isActivityItemType } from "../features/inbox/utils/inboxItemTypes";

describe("report item type", () => {
    it("is 10 and is an activity, as on the server", () => {
        expect(GENOS_REPORT_ITEM_TYPE).toBe(10);
        expect(isActivityItemType(10)).toBe(true);
        expect([...ACTIVITY_ITEM_TYPES].sort((a, b) => a - b)).toEqual([0, 6, 9, 10]);
    });
});

describe("safeReportLink", () => {
    it.each([
        "/workspace/tasks/KDS-1",
        "/workspace/notes/1?x=1#y",
        "https://example.com/a?b=1",
        "https://sub.example.com",
    ])("keeps %s", (link) => expect(safeReportLink(link)).toBe(link));

    it.each([
        "",
        null,
        5,
        "/x",
        "/workspace",
        "//evil.com/workspace/x",
        "http://example.com",
        "javascript:alert(1)",
        "JAVASCRIPT:alert(1)",
        "data:text/html,x",
        "https://",
        "https://user:pw@example.com",
        "https://example.com/a b",
        "/workspace/../admin",
        "/workspace/a/../../b",
        "/workspace/\\evil",
        "/workspace/a\tb",
        "/workspace/" + "a".repeat(600),
        "mailto:a@b.c",
    ])("drops %j", (link) => expect(safeReportLink(link)).toBeNull());
});

describe("parseGenosReport", () => {
    it("reads title, summary and sections", () => {
        expect(
            parseGenosReport({
                title: "T",
                text: "S",
                sections: [
                    { heading: "H", items: [{ text: "a", link: "/workspace/x" }, { text: "b" }] },
                ],
            })
        ).toEqual({
            title: "T",
            summary: "S",
            sections: [
                {
                    heading: "H",
                    items: [
                        { text: "a", link: "/workspace/x" },
                        { text: "b", link: null },
                    ],
                },
            ],
        });
    });

    it("applies the server's caps again", () => {
        const sections = Array.from({ length: 40 }, (_, n) => ({
            heading: `S${n}`,
            items: Array.from({ length: 100 }, () => ({ text: "x".repeat(1000) })),
        }));
        const report = parseGenosReport({ title: "t", text: "s", sections });
        expect(report?.sections).toHaveLength(12);
        expect(report?.sections.every((s) => s.items.length === 30)).toBe(true);
        expect(report?.sections[0].items[0].text.length).toBe(240);
    });

    it("collapses whitespace and drops wrong types and empty items or sections", () => {
        const report = parseGenosReport({
            title: 5,
            text: ["x"],
            sections: [
                "no",
                { heading: 3, items: "no" },
                {
                    heading: " a \n b ",
                    items: [null, 7, { text: 9 }, { text: " " }, { text: " ok \n there " }],
                },
                { items: [] },
            ],
        });
        expect(report).toEqual({
            title: "",
            summary: "",
            sections: [{ heading: "a b", items: [{ text: "ok there", link: null }] }],
        });
    });

    it("is null for a body that is not an object", () => {
        for (const body of [null, undefined, "x", 3, []])
            expect(parseGenosReport(body)).toBeNull();
    });
});
