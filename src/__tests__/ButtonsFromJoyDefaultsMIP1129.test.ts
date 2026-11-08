// @vitest-environment node
/**
 * MIP-1129: buttons come from Joy's defaults (`variant` / `color` / `size`), not from
 * per-call styling. The brand gradient is carried by the primary solid Button in the
 * theme (`joyComponents.ts`), so a call site must not rebuild it, and the old
 * per-surface button palettes (`primaryButtonBg`, `buttonBg`, `dangerBg`, ...) are not
 * read by any component any more. `ActionButtonStyles` is gone.
 *
 * (`purplePalette.ts` and `commonStyle.ts` still DEFINE the palette fields: they feed
 * non-button surfaces and the sign-in cards; reading them for a button is what this
 * fails on.)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");

const collect = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (entry.name === "__tests__" || entry.name === "node_modules") continue;
            collect(path.join(dir, entry.name), out);
        } else if (/\.tsx?$/.test(entry.name)) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
};

const FILES = collect(SRC_ROOT).map((file) => ({
    rel: path.relative(SRC_ROOT, file).split(path.sep).join("/"),
    source: fs.readFileSync(file, "utf8"),
}));

/** A component reading a button field from a style/palette object. */
export const PALETTE_BUTTON_READ =
    /\b(?:styles|palette|S|P)\.(?:primaryButtonBg|primaryButtonHover|createButtonBg|createButtonHover|buttonBg|buttonHover|dangerBg|dangerHover)\b/;

describe("buttons come from Joy defaults", () => {
    it("no component reads a button background from a style or palette object", () => {
        const offenders = FILES.filter((f) => PALETTE_BUTTON_READ.test(f.source)).map(
            (f) => f.rel
        );
        expect(offenders).toEqual([]);
    });

    it("ActionButtonStyles is gone", () => {
        const offenders = FILES.filter((f) => f.source.includes("ActionButtonStyles")).map(
            (f) => f.rel
        );
        expect(offenders).toEqual([]);
    });

    it("the header icon buttons no longer carry style objects", () => {
        const offenders = FILES.filter((f) =>
            /const (?:action|primary|danger)ButtonStyle\b/.test(f.source)
        ).map((f) => f.rel);
        expect(offenders).toEqual([]);
    });

    it("the status buttons are flat warning / success, not hex gradients", () => {
        for (const rel of [
            "features/tasks/components/contents/TaskPreview.tsx",
            "features/tasks/components/contents/base/TaskTitleBlock.tsx",
        ]) {
            const source = FILES.find((f) => f.rel === rel)?.source ?? "";
            expect(source, rel).not.toContain("#ff9500");
            expect(source, rel).not.toContain("#4caf50");
            expect(source, rel).toContain('color="warning"');
            expect(source, rel).toContain('color="success"');
        }
    });

    it("a primary Button is the one place the brand gradient is drawn (theme default)", () => {
        const theme = fs.readFileSync(
            path.join(SRC_ROOT, "theme/tokens/joyComponents.ts"),
            "utf8"
        );
        expect(theme).toContain("var(--g-brand-gradient)");
        expect(theme).toMatch(/ownerState\.variant === "solid"/);
        expect(theme).toMatch(/ownerState\.color === "primary"/);
    });
});
