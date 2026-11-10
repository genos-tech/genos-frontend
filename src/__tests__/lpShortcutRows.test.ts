/**
 * The landing page's shortcut list is generated from the registry (MIP-1313): the keys are the
 * visitor's own system's, the catalogs hold only the labels, in `LP_SHORTCUT_ORDER` order.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { LP_SHORTCUT_ORDER, shortcutRows } from "../lp/shortcutRows";
import { SHORTCUT_IDS, SHORTCUTS } from "../shortcuts";

const CYCLE = en.settings.shortcuts.global.cycleCombo;
const rows = (platform: "mac" | "other") =>
    shortcutRows(en.featuresPage.shortcuts.items, CYCLE, platform);

describe("landing page shortcut rows", () => {
    it("print the Mac keys on a Mac", () => {
        const keys = rows("mac").map((r) => r.keys);
        expect(keys).toEqual([
            "⌘ + K",
            "Hold ⌘ + Tap Ctrl to cycle",
            "Ctrl + ⌘ + T",
            "Ctrl + ⌘ + N",
            "Ctrl + ⌘ + C",
            "Ctrl + ⌘ + M",
            "Ctrl + ⌘ + H",
            "Ctrl + ⌘ + G",
            "Ctrl + ⌘ + X",
            "↑ / ↓, Enter",
        ]);
    });

    it("print Ctrl+K and Ctrl+Alt on Windows and Linux, not 'Alt in place of ⌘' (the old note was wrong for K)", () => {
        const keys = rows("other").map((r) => r.keys);
        expect(keys[0]).toBe("Ctrl + K");
        expect(keys[1]).toBe("Hold Alt + Tap Ctrl to cycle");
        expect(keys[2]).toBe("Ctrl + Alt + T");
        expect(keys.slice(2, 9).every((k) => k.startsWith("Ctrl + Alt + "))).toBe(true);
    });

    it("the To-Do row is the key the app really binds (X), not the stale O", () => {
        expect(rows("other")[8].keys).toBe("Ctrl + Alt + X");
    });

    it("every global chord the page lists exists in the registry, and the order names no gap", () => {
        for (const id of LP_SHORTCUT_ORDER) if (id) expect(SHORTCUT_IDS).toContain(id);
        expect(LP_SHORTCUT_ORDER.filter((id) => id === null)).toHaveLength(1);
        expect(LP_SHORTCUT_ORDER.at(-1)).toBeNull();
        // it lists every global chord that opens something (undo and the editors' own keys are not marketing)
        const globalChords = SHORTCUT_IDS.filter(
            (id) => SHORTCUTS[id].scope === "global" && id !== "global.undo"
        );
        for (const id of globalChords) expect(LP_SHORTCUT_ORDER, id).toContain(id);
    });

    it.each(Object.entries({ en, ja, zh, es, fr, hi, ar }))(
        "%s has one label per row and keeps the Spotlight-list keys in the last row",
        (_locale, cat) => {
            const items = cat.featuresPage?.shortcuts?.items ?? [];
            expect(items).toHaveLength(LP_SHORTCUT_ORDER.length);
            for (const item of items) expect(item.label.trim().length).toBeGreaterThan(0);
            expect(items.at(-1)).toHaveProperty("keys");
            // the generated rows carry no keys of their own any more
            for (const item of items.slice(0, -1)) expect(item).not.toHaveProperty("keys");
        }
    );
});
