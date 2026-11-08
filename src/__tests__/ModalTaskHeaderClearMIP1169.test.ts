/**
 * A task opened in `UrlLinkModal` (from Spotlight or a chat link): the dialog floats its
 * own "Move to page" and Close at the top-right, and the task header used to draw its own
 * actions and a second Close under them (MIP-1169). Layout is not testable in jsdom, so
 * this pins the contract in the two sources; the measured result is in the PR.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("task header in a modal host", () => {
    const modal = read("components/modals/UrlLinkModal.tsx");
    const header = read("features/tasks/components/contents/base/TaskTitleBlock.tsx");
    const milestone = read("features/tasks/components/contents/TaskPreview.tsx");
    const chrome = read("components/ui/modal/modalChrome.ts");

    it("reserves at least the width of the dialog's two floating buttons", () => {
        // The dialog publishes the room (MIP-1296: `--modal-chrome-clearance`, 112px with a
        // mouse, 128px with the 44px touch buttons) and the header asks the cascade for it.
        // The numbers behind it are pinned in ModalChromeMIP1296.test.tsx.
        expect(chrome).toMatch(/MODAL_CHROME_CLEARANCE = "var\(--modal-chrome-clearance, 0px\)"/);
        expect(modal).toMatch(/\.\.\.modalChromeVarsSx,/);
        expect(modal).toMatch(/size="md"/);
        expect(header).toMatch(/isModalHosted && \{ pr: MODAL_CHROME_CLEARANCE \}/);
    });

    it("draws no second Close of its own while hosted", () => {
        expect(header).toMatch(
            /\{!isModalHosted && \(\s*<AppTooltip title=\{t\.tasks\.titleBlock\.closeTooltip\}>/
        );
    });

    it("the milestone header does the same (it had the same two Close buttons)", () => {
        expect(milestone).toMatch(/hostZIndex != null && \{ pr: MODAL_CHROME_CLEARANCE \}/);
        expect(milestone).toMatch(
            /\{hostZIndex == null && \(\s*<AppTooltip title=\{t\.tasks\.preview\.closeTooltip\}>/
        );
    });
});
