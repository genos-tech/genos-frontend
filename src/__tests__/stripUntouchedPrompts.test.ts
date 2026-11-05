/**
 * Template prompts the author never filled in are not saved as content
 * (MIP-825). A prompt only counts as untouched if its text is a built-in
 * prompt AND it still has the prompt styling.
 */
import { PartialBlock } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import { stripUntouchedPrompts, TASK_TEMPLATES } from "../features/tasks/utils/taskTemplates";

const text = (b: PartialBlock) =>
    (Array.isArray(b.content) ? b.content : []).map((r) => ("text" in r ? r.text : "")).join("");
const headings = (blocks: PartialBlock[]) =>
    blocks.filter((b) => b.type === "heading").map((b) => text(b));

// Fill one prompt the way typing does: new plain text replaces the prompt run.
const fill = (blocks: PartialBlock[], promptText: string, typed: string): PartialBlock[] =>
    blocks.map((b) =>
        text(b) === promptText ? { ...b, content: [{ type: "text", text: typed, styles: {} }] } : b
    ) as PartialBlock[];

describe("stripUntouchedPrompts", () => {
    it("leaves a body with nothing to write as one empty paragraph, for every built-in template", () => {
        for (const tpl of Object.values(TASK_TEMPLATES)) {
            const out = stripUntouchedPrompts(tpl.blocks);
            expect(out).toHaveLength(1);
            expect(out[0].type).toBe("paragraph");
            expect(text(out[0])).toBe("");
        }
    });

    it("keeps a filled section with its heading and drops the untouched ones", () => {
        const body = fill(
            TASK_TEMPLATES.default.blocks,
            "Why does this matter? What problem are we solving?",
            "Users lose their draft."
        );
        const out = stripUntouchedPrompts(body);
        expect(headings(out)).toEqual(["🪜 Motivation"]);
        expect(out.map(text)).toContain("Users lose their draft.");
        expect(out.map(text).join(" ")).not.toContain("First condition");
        expect(out.map(text).join(" ")).not.toContain("Anything else worth pinning");
    });

    it("keeps a bullet list the author edited and drops the bullets they left", () => {
        const body = fill(
            TASK_TEMPLATES.default.blocks,
            "First condition that must be true when this is done.",
            "Saving keeps the draft."
        );
        const out = stripUntouchedPrompts(body);
        const bullets = out.filter((b) => b.type === "bulletListItem").map(text);
        // The two untouched bullets are dropped; the heading stays because
        // its section still has content.
        expect(bullets).toEqual(["Saving keeps the draft."]);
        expect(headings(out)).toEqual(["✅ Acceptance criteria"]);
    });

    it("does not drop an author's line that repeats a prompt without the prompt styling", () => {
        const body = TASK_TEMPLATES.default.blocks.map((b) =>
            text(b) === "Anything else worth pinning here."
                ? ({
                      ...b,
                      content: [
                          { type: "text", text: "Anything else worth pinning here.", styles: {} },
                      ],
                  } as PartialBlock)
                : b
        );
        const out = stripUntouchedPrompts(body);
        expect(out.map(text)).toContain("Anything else worth pinning here.");
        expect(headings(out)).toEqual(["🎯 Notes & links"]);
    });

    it("keeps content that sits before the first heading", () => {
        const intro = {
            type: "paragraph",
            content: [{ type: "text", text: "Context first.", styles: {} }],
        } as PartialBlock;
        const out = stripUntouchedPrompts([intro, ...TASK_TEMPLATES.bug.blocks]);
        expect(text(out[0])).toBe("Context first.");
        expect(headings(out)).toEqual([]);
    });

    it("works for the milestone template, Order of work included", () => {
        const body = fill(
            TASK_TEMPLATES.milestone.blocks,
            "What outcome does this milestone deliver, and for whom?",
            "Ship v1."
        );
        const out = stripUntouchedPrompts(body);
        expect(headings(out)).toEqual(["🎯 Goal"]);
    });

    it("does not touch a custom template's text", () => {
        const custom = [
            {
                type: "heading",
                content: [{ type: "text", text: "Checklist", styles: {} }],
            },
            {
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        text: "Fill this in.",
                        styles: { italic: true, textColor: "gray" },
                    },
                ],
            },
        ] as PartialBlock[];
        expect(stripUntouchedPrompts(custom)).toEqual(custom);
    });

    it("does not mutate its input", () => {
        const before = JSON.stringify(TASK_TEMPLATES.default.blocks);
        stripUntouchedPrompts(TASK_TEMPLATES.default.blocks);
        expect(JSON.stringify(TASK_TEMPLATES.default.blocks)).toBe(before);
    });
});
