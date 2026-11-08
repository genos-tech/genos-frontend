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

    it("reserves at least the width of the dialog's two floating buttons", () => {
        // Move to page sits at `right: 56`, 36px wide: its outer edge is 92px from the corner.
        expect(modal).toMatch(/right: 56,/);
        expect(modal).toMatch(/size="md"/);
        const clearance = Number(header.match(/MODAL_CHROME_CLEARANCE = "(\d+)px"/)![1]);
        expect(clearance).toBeGreaterThanOrEqual(56 + 36);
        expect(header).toMatch(/isModalHosted && \{ pr: MODAL_CHROME_CLEARANCE \}/);
    });

    it("draws no second Close of its own while hosted", () => {
        expect(header).toMatch(
            /\{!isModalHosted && \(\s*<AppTooltip title=\{t\.tasks\.titleBlock\.closeTooltip\}>/
        );
    });
});
