/**
 * Cmd/Ctrl+K opens Spotlight everywhere, the editors included (MIP-1310), so BlockNote's
 * "Mod+K" hint under its link button must be gone in every locale it ships.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBlockNoteDictionary } from "../components/editors/blockNoteI18n";

const LOCALES = ["en", "ja", "zh", "es", "fr", "hi", "ar"] as const;

let locale = "en";
vi.mock("../i18n", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../i18n")>();
    return {
        ...actual,
        useTranslation: () => ({ ...actual.useTranslation(), locale }),
    };
});

describe("BlockNote link button hint", () => {
    it.each(LOCALES)("%s: the link button prints no keyboard hint, the tooltip stays", (l) => {
        locale = l;
        const { result } = renderHook(() => useBlockNoteDictionary());
        const link = result.current.formatting_toolbar.link;
        expect(link.secondary_tooltip).toBe("");
        expect(link.tooltip.length).toBeGreaterThan(0);
        // The other buttons keep theirs (bold still says Mod+B).
        expect(result.current.formatting_toolbar.bold.secondary_tooltip).not.toBe("");
    });
});
