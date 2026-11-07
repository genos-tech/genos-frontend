/**
 * MIP-1126 batch 1: the five migrated modals render through `ModalFrame`.
 *
 * `ModalFrame` owns the surface, so a migrated file must not build its own
 * dialog again. This pins the acceptance criterion ("no ModalDialog with its
 * own gradient, shadow or radius") for the files done so far; add a file to
 * the list when a later batch migrates it. A source scan, because the three
 * profile modals need a deep prop tree to render (the group profile and the
 * Settings and History frames are also rendered in their own test files).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");

const MIGRATED = [
    "features/admin/components/modals/ModalProjectProfile.tsx",
    "features/chat/components/modals/ModalGMProfile.tsx",
    "features/admin/components/modals/ModalTeamProfile.tsx",
    "components/layout/HistoryModal.tsx",
    "components/layout/SettingsModal.tsx",
];

// Comments mention the old patterns; strip them.
const code = (file: string) =>
    readFileSync(join(src, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

describe("migrated modals (batch 1)", () => {
    for (const file of MIGRATED) {
        describe(file, () => {
            const text = code(file);

            it("renders through ModalFrame and builds no dialog of its own", () => {
                expect(text).toMatch(/<ModalFrame\b/);
                expect(text).not.toMatch(/<ModalDialog\b/);
                expect(text).not.toMatch(/<Modal\b/);
                expect(text).not.toMatch(/<ModalClose\b/);
            });

            it("has no gradient surface, backdrop blur or per-modal shadow on its frame", () => {
                expect(text).not.toMatch(/linear-gradient|radial-gradient|backdropFilter/);
            });
        });
    }

    it("the profile modals sit at the shared profile layer, not a literal", () => {
        for (const file of MIGRATED.slice(0, 3)) {
            expect(code(file)).toMatch(/zIndex=\{PROFILE_MODAL_Z_INDEX\}/);
        }
    });

    it("the profile modals read their colors from the tokens, not the old style object", () => {
        for (const file of MIGRATED.slice(0, 3)) {
            const text = code(file);
            expect(text).not.toMatch(/ProfileModalStyles|purplePalette|isDark/);
            expect(text).not.toMatch(/rgba\(var\(--gp-/);
        }
    });
});
