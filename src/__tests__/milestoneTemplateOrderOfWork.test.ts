/**
 * The house milestone template has an "Order of work" section (MIP-782):
 * dependencies say what blocks what, not where to begin, and agents and
 * people only write that guidance when the template asks for it.
 */

import { describe, expect, it } from "vitest";

import { TASK_TEMPLATES } from "../features/tasks/utils/taskTemplates";

const headings = (id: "milestone" | "default" | "bug" | "spike") =>
    TASK_TEMPLATES[id].blocks
        .filter((b) => b.type === "heading")
        .map((b) => (b.content as { text: string }[])[0].text);

describe("milestone template", () => {
    it("ends with an Order of work section after the risks", () => {
        const h = headings("milestone");
        expect(h).toEqual([
            "🎯 Goal",
            "✅ Success criteria",
            "📦 In scope",
            "🚫 Out of scope",
            "⚠️ Risks & dependencies",
            "🧭 Order of work",
        ]);
    });

    it("leaves the other templates alone", () => {
        for (const id of ["default", "bug", "spike"] as const) {
            expect(headings(id)).not.toContain("🧭 Order of work");
        }
    });
});
