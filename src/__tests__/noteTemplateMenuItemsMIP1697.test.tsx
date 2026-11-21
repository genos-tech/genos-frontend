import { describe, expect, it, vi } from "vitest";

import {
    buildTemplateMenuItems,
    resolveTemplate,
} from "../features/notes/templates/templateMenuItems";
import { en } from "../i18n/locales/en";

const copy = en.notes.noteTemplates;

describe("template menu items (MIP-1697)", () => {
    it("lists the three built-ins as newNoteFromTemplate rows with a prefixed id", () => {
        const items = buildTemplateMenuItems({ copy, idPrefix: "f7", onPick: vi.fn() });
        expect(items.map((i) => i.id)).toEqual([
            "f7-tpl-meeting",
            "f7-tpl-decision",
            "f7-tpl-brief",
        ]);
        expect(new Set(items.map((i) => i.kind))).toEqual(new Set(["newNoteFromTemplate"]));
        expect(items.map((i) => i.label)).toEqual([
            "Meeting notes",
            "Decision record",
            "Project brief",
        ]);
    });

    it("hands the chosen pick to onPick", () => {
        const onPick = vi.fn();
        const items = buildTemplateMenuItems({ copy, idPrefix: "x", onPick });
        items[1].onClick?.();
        expect(onPick).toHaveBeenCalledWith({ kind: "builtin", id: "decision" });
    });

    it("resolves a built-in pick to a title and blocks", async () => {
        const out = await resolveTemplate({ kind: "builtin", id: "meeting" }, copy);
        expect(out?.title).toMatch(/^Meeting notes \d{4}-\d{2}-\d{2}$/);
        expect(out?.blocks.length).toBeGreaterThan(5);
    });
});
