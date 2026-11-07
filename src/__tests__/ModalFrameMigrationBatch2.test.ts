/**
 * MIP-1126 batch 2: the create / manage dialogs render through `ModalFrame`.
 *
 * `ModalFrame` owns the surface, so a migrated file must not build its own
 * dialog again ("no ModalDialog with its own gradient, shadow or radius").
 * These dialogs also used to be dark in BOTH color schemes (hard-coded white
 * alphas on a dark gradient), so the scan also pins that their bodies read the
 * tokens: a stray `rgba(255,255,255,...)` would be invisible on the light
 * surface. A source scan, because several of them (create project / group /
 * DM, add members) need a deep prop tree to render; the ones with logic are
 * rendered in `ModalFrameBatch2Frames.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");

const MIGRATED = [
    "features/tasks/components/modals/ModalCreateProject.tsx",
    "features/chat/components/modals/ModalCreateGM.tsx",
    "features/chat/components/modals/ModalCreateMDM.tsx",
    "features/chat/components/modals/ModalAddMembers.tsx",
    "features/admin/components/projectLabels/ModalManageProjectLabels.tsx",
    "features/tasks/components/modals/ModalManageTaskTemplates.tsx",
    "features/tasks/components/modals/ModalManageCustomFields.tsx",
    "features/tasks/components/modals/ModalCustomizeTaskFields.tsx",
    "features/tasks/components/modals/ModalManageDependencies.tsx",
    "features/admin/components/modals/ModalInviteMembers.tsx",
    "features/tasks/components/modals/ModalJoinProject.tsx",
    "features/chat/components/modals/ModalJoinGM.tsx",
    "components/ui/misc/ModalTransferOwner.tsx",
    "features/chat/components/modals/ModalManageGMTags.tsx",
    "features/chat/components/modals/ModalAssignGMTags.tsx",
    "features/chat/components/todo/ModalManageTodoTags.tsx",
];

// Comments mention the old patterns; strip them.
const code = (file: string) =>
    readFileSync(join(src, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

describe("migrated modals (batch 2)", () => {
    for (const file of MIGRATED) {
        describe(file, () => {
            const text = code(file);

            it("renders through ModalFrame and builds no dialog of its own", () => {
                expect(text).toMatch(/<ModalFrame\b/);
                expect(text).not.toMatch(/<ModalDialog\b/);
                expect(text).not.toMatch(/<Modal\b/);
                expect(text).not.toMatch(/<ModalClose\b/);
            });

            it("has no gradient surface, blur, glow or dialog-wide scrollbar class", () => {
                expect(text).not.toMatch(/linear-gradient|radial-gradient|backdropFilter/);
                expect(text).not.toMatch(/custom-scrollbar-/);
                expect(text).not.toMatch(/keyframes/);
            });

            it("reads its colors from the tokens, not dark-only literals", () => {
                expect(text).not.toMatch(/rgba\(\s*\d/);
                expect(text).not.toMatch(/--gp-/);
                // `isDark ? "color" : "color"`; passing `isDark` to a child component, or
                // blending a data color by number (`alpha(c, isDark ? 0.5 : 1)`), is fine.
                expect(text).not.toMatch(/isDark\s*\?\s*["'`]/);
            });
        });
    }

    describe("layers are the ones the dialogs always had", () => {
        it("page-level create dialogs keep their layer", () => {
            // create project: no literal, so the frame's own 10010 (where page dialogs sit)
            expect(code(MIGRATED[0])).not.toMatch(/zIndex=/);
            expect(code(MIGRATED[1])).toMatch(/zIndex=\{10000\}/);
            expect(code(MIGRATED[2])).toMatch(/zIndex=\{10000\}/);
        });

        it("add members keeps the `zIndex` prop (default 10000) so a profile host can raise it", () => {
            const text = code(MIGRATED[3]);
            expect(text).toMatch(/zIndex = 10000,/);
            expect(text).toMatch(/zIndex=\{zIndex\}/);
        });

        it("the project labels dialog sits one above the profile modal that opens it", () => {
            expect(code(MIGRATED[4])).toMatch(/zIndex=\{PROFILE_MODAL_Z_INDEX \+ 1\}/);
        });

        it("the editor-hosting dialogs stay on Joy's modal layer (BlockNote menus are lifted for it)", () => {
            expect(code(MIGRATED[5])).toMatch(/zIndex=\{theme\.zIndex\.modal\}/);
            expect(code(MIGRATED[7])).toMatch(/zIndex=\{theme\.zIndex\.modal\}/);
        });

        it("host-derived dialogs keep deriving from the host", () => {
            // custom fields: host + 10, else 10010; dependencies: the frame's host + 2
            expect(code(MIGRATED[6])).toMatch(/hostZIndex != null \? hostZIndex \+ 10 : 10010/);
            expect(code(MIGRATED[6])).toMatch(/zIndex=\{modalZ\}/);
            expect(code(MIGRATED[8])).toMatch(/hostZIndex=\{hostZIndex\}/);
            // to-do tags: the layer of the to-do pane's host
            expect(code(MIGRATED[15])).toMatch(/useTodoDialogLayer\(10010\)/);
            expect(code(MIGRATED[15])).toMatch(/zIndex=\{layer\}/);
        });
    });

    describe("sizes keep the room the old dialogs gave their content", () => {
        it("dependencies is the wide ladder (two side-by-side pickers; 806 from md up)", () => {
            expect(code(MIGRATED[8])).toMatch(/size="wide"/);
        });

        it("templates grow to the xl ladder while a template is being authored (the body editor)", () => {
            expect(code(MIGRATED[5])).toMatch(/size=\{draft \? "xl" : "lg"\}/);
        });
    });
});
