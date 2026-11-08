/**
 * MIP-1126 batch 4 (the last): the remaining hand-built dialogs render through `ModalFrame`.
 *
 * Same contract as batches 2 and 3: a migrated file builds no dialog of its own (no `Modal` /
 * `ModalDialog` / `ModalClose` / `Dialog*` pieces), has no gradient, blur or dialog-wide
 * scrollbar class, and reads its colors from the tokens. The layers are pinned too: every
 * dialog kept the layer it had (Joy's modal layer, 10010, the diagram's own, or a
 * host-derived one). A source scan, because most of these sit inside big surfaces; the ones
 * with logic are rendered in `ModalFrameBatch4Frames.test.tsx`.
 *
 * The second half is the inventory: it walks `src` and fails when a hand-built dialog frame
 * appears anywhere but in the documented list, so the migration cannot silently regress.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");

const FRAMES = {
    imageZoom: "components/messageBody/ImageZoomModal.tsx",
    importMarkdown: "features/notes/common/components/ModalImportMarkdown.tsx",
    calendar: "features/calendar/components/CalendarModal.tsx",
    pausePicker: "services/notifications/NotificationPausePicker.tsx",
    signIn: "features/admin/components/SignInForm.tsx",
    diagram: "features/tasks/diagram/components/ModalTaskDiagram.tsx",
    sprintManager: "features/tasks/sprint-milestone/components/SprintManagerDialog.tsx",
    installBanner: "components/layout/InstallBanner.tsx",
    noteSidebar: "features/notes/common/components/NoteSidebar.tsx",
} as const;

/** Surfaces that zoom an image: each used to inline its own copy of the lightbox. */
const ZOOM_HOSTS = [
    "components/editors/bnChatPreview.tsx",
    "components/editors/bnTaskPreview.tsx",
    "components/editors/genos/GenosNoteEditor.tsx",
    "features/tasks/components/contents/base/TaskTabBlock.tsx",
    "features/tasks/components/contents/base/TaskCreateAttachmentBlock.tsx",
] as const;

// Comments mention the old patterns; strip them.
const code = (file: string) =>
    readFileSync(join(src, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

const noOwnFrame = (text: string) => {
    expect(text).not.toMatch(/<Modal\b/);
    expect(text).not.toMatch(/<ModalDialog\b/);
    expect(text).not.toMatch(/<ModalClose\b/);
    expect(text).not.toMatch(/<Dialog(Title|Content|Actions)\b/);
};

describe("migrated dialogs (batch 4)", () => {
    for (const [name, file] of Object.entries(FRAMES)) {
        describe(`${name}: ${file}`, () => {
            const text = code(file);

            it("renders through ModalFrame and builds no dialog of its own", () => {
                expect(text).toMatch(/<ModalFrame\b/);
                noOwnFrame(text);
            });

            // the big hosts (the sign-in page, the note sidebar) use the class elsewhere
            if (!["signIn", "noteSidebar"].includes(name)) {
                it("has no dialog-wide scrollbar class", () => {
                    expect(text).not.toMatch(/custom-scrollbar-/);
                });
            }
        });
    }

    it("the dialog-only files read the tokens (no gradient, blur, rgba or --gp- var)", () => {
        for (const file of [
            FRAMES.imageZoom,
            FRAMES.importMarkdown,
            FRAMES.calendar,
            FRAMES.pausePicker,
            FRAMES.diagram,
            FRAMES.sprintManager,
            FRAMES.installBanner,
        ]) {
            const text = code(file);
            expect(text, file).not.toMatch(/linear-gradient|radial-gradient|backdropFilter/);
            expect(text, file).not.toMatch(/rgba\(\s*\d/);
            expect(text, file).not.toMatch(/--gp-/);
            expect(text, file).not.toMatch(/isDark\s*\?\s*["'`]/);
        }
        // the diagram dialog no longer reads the purple palette for its surface
        expect(code(FRAMES.diagram)).not.toMatch(/purplePalette/);
    });

    it("the sign-in forgot-password dialog has no bespoke surface any more", () => {
        // The page's own card keeps the sign-in look; only the dialog moved.
        const dialog = code(FRAMES.signIn).slice(code(FRAMES.signIn).indexOf("<ModalFrame"));
        expect(dialog).not.toMatch(/styles\.|palette\.|gradient/i);
        expect(dialog).not.toMatch(/borderRadius: "16px"/);
    });

    for (const file of ZOOM_HOSTS) {
        it(`${file} zooms images through the shared lightbox, with no copy of its own`, () => {
            const text = code(file);
            expect(text).toMatch(/<ImageZoomModal\b/);
            noOwnFrame(text);
            expect(text).not.toMatch(/maxWidth: "80vw"/);
        });
    }

    describe("layers are the ones the dialogs always had", () => {
        const joyLayer = /zIndex=\{theme\.zIndex\.modal\}/;

        it("dialogs that were on Joy's default layer stay there", () => {
            for (const f of [
                FRAMES.calendar,
                FRAMES.signIn,
                FRAMES.sprintManager,
                FRAMES.installBanner,
                FRAMES.noteSidebar,
            ]) {
                expect(code(f), f).toMatch(joyLayer);
            }
            // the calendar's three dialogs (itself, the day popover and, in its own file, the event editor)
            expect(code(FRAMES.calendar).match(/zIndex=\{theme\.zIndex\.modal\}/g)).toHaveLength(
                2
            );
        });

        it("the custom pause time stays above the profile dialog it opens from (10020)", () => {
            expect(code(FRAMES.pausePicker)).toMatch(/zIndex=\{10020\}/);
        });

        it("Import Markdown sits one above a UrlLinkModal host, else on Joy's layer, and owns its picker", () => {
            const text = code(FRAMES.importMarkdown);
            expect(text).toMatch(
                /zIndex=\{hostZIndex != null \? hostZIndex \+ 1 : theme\.zIndex\.modal\}/
            );
            // it carried the sibling-listbox rule by hand: opting in is parity, not a new claim
            expect(text).toMatch(/\bownsListboxPopups\b/);
        });

        it("the graph dialog keeps the layer its opener gave it, and republishes it", () => {
            const text = code(FRAMES.diagram);
            expect(text).toMatch(/const effectiveZIndex = zIndex \?\? DIAGRAM_DEFAULT_Z_INDEX/);
            expect(text).toMatch(/zIndex=\{effectiveZIndex\}/);
            expect(text).toMatch(/<DiagramZIndexProvider value=\{effectiveZIndex\}>/);
            // it owns no listbox: never the sibling rule (the fe #122 invisible-dropdown bug)
            expect(text).not.toMatch(/ownsListboxPopups/);
        });

        it("the lightbox takes the frame's page layer, raised only by an exact layer or a host", () => {
            const text = code(FRAMES.imageZoom);
            expect(text).toMatch(/zIndex=\{zIndex\}/);
            // An explicit host wins; otherwise the layer UrlLinkModal provides (MIP-1193).
            expect(text).toMatch(/hostZIndex=\{hostZIndex \?\? contextHost\}/);
            expect(text).not.toMatch(/ownsListboxPopups/);
        });

        it("only Import Markdown claims sibling listboxes in this batch", () => {
            for (const [name, file] of Object.entries(FRAMES)) {
                if (name === "importMarkdown") continue;
                expect(code(file), file).not.toMatch(/ownsListboxPopups/);
            }
        });
    });

    describe("behavior the move had to keep", () => {
        it("the forgot-password dialog still resets its transient state on every close", () => {
            const text = code(FRAMES.signIn);
            expect(text).toMatch(
                /const closeForgotPassword = \(\) => \{\s*forgotAttemptRef\.current \+= 1;\s*setOpenForgotPassword\(false\);\s*setForgotSucceeded\(false\);\s*setForgotError\(null\);\s*setForgotSubmitting\(false\);\s*\};/
            );
            expect(text.match(/onClose=\{closeForgotPassword\}/g)).toHaveLength(1);
            expect(text).toMatch(/onClick=\{closeForgotPassword\}/);
            // the submit button is outside the form now, tied to it by id
            expect(text).toMatch(/form=\{forgotFormId\}/);
            expect(text).toMatch(/id=\{forgotFormId\}/);
        });

        it("the attachment strip keeps its own download (it never fetched through downloadFile)", () => {
            expect(
                code("features/tasks/components/contents/base/TaskCreateAttachmentBlock.tsx")
            ).toMatch(/onDownload=\{handleDownload\}/);
        });

        it("each editor keeps the filename its download always had", () => {
            expect(code("components/editors/bnTaskPreview.tsx")).toMatch(
                /filenameStem="task-preview-image"/
            );
            expect(code("features/tasks/components/contents/base/TaskTabBlock.tsx")).toMatch(
                /filenameStem="task-attachment-image"/
            );
            expect(code("components/editors/genos/GenosNoteEditor.tsx")).toMatch(
                /filenameStem=\{note\.imageFilenameStem\}/
            );
        });
    });
});

/** Every `.tsx` under src outside the tests. */
const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
            if (name !== "__tests__") walk(p, out);
        } else if (p.endsWith(".tsx")) out.push(p);
    }
    return out;
};

describe("inventory: where a hand-built dialog frame may still exist", () => {
    // `ModalFrame` itself builds the frame. UrlLinkModal is the decided exception (batch 3,
    // section 4: it is the preview host, its content brings its own header and floats the
    // chrome). The rest are owned by other PRs of the milestone and are removed from this list
    // by them: the task table pilot (saved filters, column settings), the tag manager
    // (`ModalManageTags`) and the "no access to this note" card.
    const ALLOWED = new Set([
        "components/ui/modal/ModalFrame.tsx",
        "components/modals/UrlLinkModal.tsx",
        "features/tasks/components/table/SavedFiltersMenu.tsx",
        "features/tasks/components/table/TaskTableColumnSettings.tsx",
        "features/tasks/components/modals/ModalManageTags.tsx",
        "features/chat/components/sidebar/activity/chatListItemForActivity.tsx",
        // two bottom sheets, not dialogs
        "components/layout/MobileAccountSheet.tsx",
    ]);

    it("no other file builds its own <Modal> / <ModalDialog> / <Drawer>", () => {
        const offenders = walk(src)
            .map((p) => relative(src, p))
            .filter((p) => !ALLOWED.has(p))
            .filter((p) => /<(ModalDialog|Modal|Drawer)\b/.test(code(p)));
        expect(offenders).toEqual([]);
    });
});
