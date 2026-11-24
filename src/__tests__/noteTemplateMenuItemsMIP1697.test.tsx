import { describe, expect, it, vi } from "vitest";

import {
    buildTemplateMenuItems,
    resolveTemplate,
} from "../features/notes/templates/templateMenuItems";
import { en } from "../i18n/locales/en";

const copy = en.notes.noteTemplates;

describe("template menu items (MIP-1697)", () => {
    it("shows one newNoteFromTemplate row that opens the picker", () => {
        const onOpenPicker = vi.fn();
        const items = buildTemplateMenuItems({ copy, idPrefix: "f7", onOpenPicker });
        expect(items.map((i) => i.id)).toEqual(["f7-tpl-picker"]);
        expect(items[0].kind).toBe("newNoteFromTemplate");
        expect(items[0].label).toBe("New note from template…");
        items[0].onClick?.();
        expect(onOpenPicker).toHaveBeenCalled();
    });

    it("resolves a built-in pick to a title and blocks", async () => {
        const out = await resolveTemplate({ kind: "builtin", id: "meeting" }, copy);
        expect(out?.title).toMatch(/^Meeting notes \d{4}-\d{2}-\d{2}$/);
        expect(out?.blocks.length).toBeGreaterThan(5);
    });
});
