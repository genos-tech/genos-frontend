/**
 * Keeps React fragments out of the direct children of Joy components that
 * clone their children.
 *
 * `ModalDialog` (and `Card`, `Accordion`, `Stepper`, the button groups…) run
 * `React.Children.map` + `cloneElement` over their DIRECT children to inject
 * `data-first-child` / `data-last-child`, and `inset`/`orientation` into a
 * `Divider`. `React.Fragment` accepts only `key` and `children`, so a fragment
 * sitting in that position makes React log:
 *
 *     Invalid prop `data-last-child` supplied to `React.Fragment`.
 *
 * Two things make this easy to ship by accident:
 *
 *  - it is DEV-only and merely noisy, so nothing breaks visibly; and
 *  - it does NOT fire on mount. Joy clones the fragment fine the first time;
 *    the warning comes from `validateFragmentProps` on the UPDATE path
 *    (`updateSlot`), so it only appears once the component re-renders with the
 *    fragment still in place. A quick manual open of the modal can miss it.
 *
 * Reproduced and fixed 2026-09-26 in `ModalRemindMe` and `ModalInviteMembers`
 * (both conditionally rendered a fragment as ModalDialog's last child). Two
 * other modals had already hit it and worked around it with a `Box`; this test
 * is what stops the next one from relearning it.
 *
 * NOTE the wrapper must keep the parent's own flex column — ModalDialog
 * extends Card's root (`display: flex; flexDirection: column` plus a gap), so
 * a bare `<Box>` would collapse the wrapped children into a single flex item
 * and drop the gap between them.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");

/**
 * Joy components that clone their direct children. Verified against the
 * installed package rather than hardcoded from memory — `List`, for one, looks
 * like it should inject and does not.
 */
const CLONING_PARENTS = [
    "ModalDialog",
    "Card",
    "CardOverflow",
    "Accordion",
    "AccordionGroup",
    "Step",
    "Stepper",
    "RadioGroup",
    "ButtonGroup",
    "ToggleButtonGroup",
];

const collectTsx = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        // Worktree copies are stale duplicates CI never sees.
        if (entry === "node_modules" || entry === ".claude" || entry === "worktrees") continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) collectTsx(path, out);
        else if (path.endsWith(".tsx")) out.push(path);
    }
    return out;
};

describe("Joy cloning parents get element children, never fragments", () => {
    const files = collectTsx(SRC);

    it("finds the components to scan", () => {
        // Guards against a broken walker silently passing everything.
        expect(files.length).toBeGreaterThan(100);
    });

    for (const parent of CLONING_PARENTS) {
        it(`no fragment sits directly inside <${parent}>`, () => {
            // A fragment close immediately before the parent's close tag, with
            // only JSX punctuation between (the `)}` of a conditional branch).
            const closing = new RegExp(
                `(?:<\\/>|<\\/Fragment>|<\\/React\\.Fragment>)\\s*(?:[)}]\\s*)*<\\/${parent}>`,
                "g"
            );
            // A fragment opened as the parent's first child.
            const opening = new RegExp(
                `<${parent}(?:\\s[^>]*)?>\\s*(?:\\{[^}]{0,80}\\}\\s*)?(?:<>|<Fragment>)`,
                "g"
            );

            const offenders: string[] = [];
            for (const file of files) {
                const src = readFileSync(file, "utf8");
                for (const re of [closing, opening]) {
                    re.lastIndex = 0;
                    let match: RegExpExecArray | null;
                    while ((match = re.exec(src)) !== null) {
                        const line = src.slice(0, match.index).split("\n").length;
                        offenders.push(`${relative(SRC, file)}:${line}`);
                    }
                }
            }

            expect(
                offenders,
                offenders.length === 0
                    ? ""
                    : `<${parent}> clones its direct children to inject` +
                          ` data-first-child/data-last-child, which React.Fragment` +
                          ` cannot accept. Wrap the branch in` +
                          ` <Box sx={{ display: "flex", flexDirection: "column" }}>` +
                          ` instead (a bare Box would drop the parent's gap).\n  ` +
                          offenders.join("\n  ")
            ).toEqual([]);
        });
    }

    it("ModalDialog really does inject the attribute (the premise)", () => {
        // If a Joy upgrade stops cloning children, these tests are obsolete
        // rather than broken — this assertion says which it is.
        const dialog = readFileSync(
            join(SRC, "..", "node_modules/@mui/joy/ModalDialog/ModalDialog.js"),
            "utf8"
        );
        expect(dialog).toContain("data-last-child");
        expect(dialog).toContain("React.Children.map");
    });
});
