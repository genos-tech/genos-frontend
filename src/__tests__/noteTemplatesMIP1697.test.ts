import type { PartialBlock } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import { buildNoteTemplate, NOTE_TEMPLATE_IDS } from "../features/notes/templates/noteTemplates";
import { en } from "../i18n/locales/en";

const copy = en.notes.noteTemplates;
const day = new Date(2026, 10, 22);

type Blk = { type: string; content?: { text?: string }[]; children?: unknown[] };
const textOf = (b: PartialBlock) => ((b as Blk).content ?? []).map((c) => c.text ?? "").join("");

describe("note templates (MIP-1697)", () => {
    it("offers meeting notes, decision record and project brief", () => {
        expect(NOTE_TEMPLATE_IDS).toEqual(["meeting", "decision", "brief"]);
    });

    it("meeting notes: dated title and the five sections", () => {
        const { title, blocks } = buildNoteTemplate("meeting", copy, day);
        expect(title).toBe("Meeting notes 2026-11-22");
        const heads = blocks.filter((b) => b.type === "heading").map(textOf);
        expect(heads).toEqual(["Attendees", "Agenda", "Notes", "Decisions", "Action items"]);
        expect(blocks.some((b) => b.type === "checkListItem")).toBe(true);
    });

    it("decision record matches the genos-workflow template headings", () => {
        const { title, blocks } = buildNoteTemplate("decision", copy, day);
        expect(title).toBe("Decision: ");
        const heads = blocks.filter((b) => b.type === "heading").map(textOf);
        expect(heads).toEqual([
            "Decision",
            "Why",
            "Context",
            "Options considered",
            "Consequences",
            "Links",
        ]);
        expect(textOf(blocks[0])).toContain("2026-11-22");
    });

    it("project brief sections", () => {
        const heads = buildNoteTemplate("brief", copy, day)
            .blocks.filter((b) => b.type === "heading")
            .map(textOf);
        expect(heads).toEqual([
            "Goal",
            "Background",
            "Scope",
            "Success criteria",
            "Milestones",
            "Risks and open questions",
            "People",
        ]);
    });

    it("every block is valid BlockNote shape and the doc ends with an empty paragraph", () => {
        for (const id of NOTE_TEMPLATE_IDS) {
            const { blocks } = buildNoteTemplate(id, copy, day);
            for (const b of blocks as Blk[]) {
                expect(typeof b.type).toBe("string");
                expect(Array.isArray(b.children)).toBe(true);
            }
            const last = blocks[blocks.length - 1] as Blk;
            expect(last.type).toBe("paragraph");
            expect(last.content).toEqual([]);
        }
    });
});
