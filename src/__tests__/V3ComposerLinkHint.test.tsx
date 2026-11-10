/**
 * MIP-1392 (b): Cmd/Ctrl+K opens Spotlight everywhere (MIP-1310), so BlockNote's "Mod+K" hint
 * under the link button is blanked in `useBlockNoteDictionary`. `MessageComposerV3` used to hand
 * BlockNote a dictionary with only `placeholders`, so its toolbar never saw that change (and
 * none of the translated toolbar strings either). It now builds on the shared dictionary.
 * The editor's options are captured where the composer creates it.
 */
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageComposerV3 } from "../features/channel/components/MessageComposerV3";

const captured = vi.hoisted(() => ({ dictionaries: [] as Array<Record<string, any>> }));
vi.mock("../components/editors/genos/useGenosEditor", async (orig) => {
    const actual = await orig<typeof import("../components/editors/genos/useGenosEditor")>();
    return {
        ...actual,
        useGenosEditor: (options: Parameters<typeof actual.useGenosEditor>[0]) => {
            captured.dictionaries.push(options.dictionary as Record<string, any>);
            return actual.useGenosEditor(options);
        },
    };
});

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
beforeEach(() => {
    console.warn = vi.fn();
    captured.dictionaries.length = 0;
});
afterEach(() => {
    console.warn = _origWarn;
});

describe("MessageComposerV3's BlockNote dictionary", () => {
    it("prints no keyboard hint under the link button, keeps the other buttons' hints", () => {
        render(<MessageComposerV3 channelId="c-1" currentUserId="u-1" placeholder="Say hi" />);
        const dictionary = captured.dictionaries[0];
        expect(dictionary.formatting_toolbar.link.secondary_tooltip).toBe("");
        expect(dictionary.formatting_toolbar.link.tooltip.length).toBeGreaterThan(0);
        expect(dictionary.formatting_toolbar.bold.secondary_tooltip).not.toBe("");
    });

    it("keeps its own placeholders: the hint in an empty editor, none on a line or heading", () => {
        render(<MessageComposerV3 channelId="c-1" currentUserId="u-1" placeholder="Say hi" />);
        const { placeholders } = captured.dictionaries[0];
        expect(placeholders.emptyDocument).toBe("Say hi");
        expect(placeholders.default).toBe("");
        expect(placeholders.heading).toBe("");
    });
});
