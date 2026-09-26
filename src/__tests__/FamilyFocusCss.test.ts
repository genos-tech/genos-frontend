/**
 * Guards the hover family-focus stylesheet.
 *
 * The generated text is the whole feature — there is no React state and no
 * handler to assert against, so the selectors ARE the behaviour. Each test
 * below pins a property that a plausible "simplification" would quietly break.
 */

import { describe, expect, it } from "vitest";

import {
    buildFamilyFocusCss,
    DND_ACTIVE_ATTR,
    TASK_BODY_CLASS,
    TASK_ROW_CLASS,
} from "../features/tasks/utils/familyFocusCss";

describe("buildFamilyFocusCss", () => {
    it("emits one rule per distinct family, not per row", () => {
        // The real input is one key per visible row, so a 3-row subtree
        // repeats its root's key three times. Each family emits two rules:
        // the row dim, plus the title's opacity reset.
        const css = buildFamilyFocusCss(["10", "10", "10", "20", "20"]);
        expect(css.split("\n")).toHaveLength(4);
        expect(css).toContain('[data-task-family="10"]:hover');
        expect(css).toContain('[data-task-family="20"]:hover');
    });

    it("dims every row outside the hovered family", () => {
        const css = buildFamilyFocusCss(["10", "20"]);
        expect(css).toContain(
            `.${TASK_BODY_CLASS}:not([${DND_ACTIVE_ATTR}]):has(.${TASK_ROW_CLASS}` +
                '[data-task-family="10"]:hover) ' +
                `.${TASK_ROW_CLASS}:not([data-task-family="10"])`
        );
    });

    it("returns nothing when fewer than two families are in view", () => {
        // One family means every row is family — the `:not()` would match
        // nothing, so the <style> element is skipped entirely. This is the
        // milestone-scoped view's steady state.
        expect(buildFamilyFocusCss([])).toBe("");
        expect(buildFamilyFocusCss(["10"])).toBe("");
        expect(buildFamilyFocusCss(["10", "10", "10"])).toBe("");
    });

    it("exempts the selected row from dimming", () => {
        // Dimming the open preview's row would hide which task the pane is
        // showing whenever the cursor rests on an unrelated family.
        expect(buildFamilyFocusCss(["10", "20"])).toContain(':not([data-task-selected="true"])');
    });

    it("gates every rule on no drag being in progress", () => {
        // During a reparent drag the dragged row sits under the cursor, so
        // `:hover` resolves to it and would dim the very rows you drag onto.
        const rules = buildFamilyFocusCss(["10", "20"]).split("\n");
        expect(rules).toHaveLength(4);
        for (const rule of rules) {
            expect(rule.startsWith(`.${TASK_BODY_CLASS}:not([${DND_ACTIVE_ATTR}])`)).toBe(true);
        }
    });

    it("keeps dimmed rows readable rather than near-invisible", () => {
        // Regression: at 0.38 this read as "the subtasks are gone". `opacity`
        // multiplies down the tree and a subtask title already carries 0.85,
        // so the effective value was ~0.32 for exactly the nested rows this
        // feature is meant to clarify. These rows are still clickable, so they
        // must not look disabled either.
        const css = buildFamilyFocusCss(["10", "20"]);
        const opacity = Number(/opacity: ([0-9.]+);/.exec(css)?.[1]);
        expect(opacity).toBeGreaterThanOrEqual(0.6);
        expect(opacity).toBeLessThan(1);
    });

    it("resets the subtask title's own opacity so the two don't multiply", () => {
        // Without this the row dim compounds with the title's 0.85 and nested
        // rows fade far harder than root rows — the bug that made subtasks and
        // milestones look absent from the table.
        const css = buildFamilyFocusCss(["10", "20"]);
        expect(css).toContain(".task-row-title { opacity: 1 !important; }");
    });

    it("never sets pointer-events, so the highlight follows the cursor", () => {
        // Ghost rows use `pointer-events: none` alongside their opacity, but
        // copying that here would swallow the mouse-enter of the dimmed row
        // being approached — the cursor would cross it with the previous
        // family still lit.
        expect(buildFamilyFocusCss(["10", "20"])).not.toContain("pointer-events");
    });

    it("delays dimming on the way in but not on the way out", () => {
        // Sweeping the cursor down the table would otherwise strobe. Exit is
        // instant because the row's own transition carries no delay.
        const css = buildFamilyFocusCss(["10", "20"]);
        expect(css).toContain("transition-delay: 120ms");
        expect(css).not.toContain("transition-delay: 0");
    });

    it("marks the delay !important so the row's inline shorthand can't reset it", () => {
        // `getTableRowStyles` sets a `transition` SHORTHAND in the row's inline
        // style. A shorthand resets every longhand it omits, so it pins
        // `transition-delay` to 0s inline — and a normal declaration here would
        // lose to that, silently dropping the delay. This assertion is the only
        // thing standing between that and a strobing table.
        expect(buildFamilyFocusCss(["10", "20"])).toContain("transition-delay: 120ms !important");
    });

    it("drops keys that could break out of the attribute selector", () => {
        // Keys are interpolated into a quoted attribute selector. A stray
        // quote would terminate it and corrupt every following rule, so
        // anything outside [A-Za-z0-9_-] is discarded rather than escaped.
        const css = buildFamilyFocusCss(['10" ], .x {color:red}', "20", "30"]);
        expect(css).not.toContain("color:red");
        // Only "20" and "30" survive — two families, two rules each.
        expect(css.split("\n")).toHaveLength(4);
        expect(css).not.toContain('data-task-family="10');
    });

    it("keeps UUID family keys (v3 surfaces) intact", () => {
        // v3 chat/task ids are UUID strings in `number`-typed slots; hyphens
        // must survive the safety filter or those rows would lose the feature.
        const uuid = "3f1a9c22-7b10-4d5e-8a6f-0b2c4d6e8f10";
        expect(buildFamilyFocusCss([uuid, "20"])).toContain(`[data-task-family="${uuid}"]`);
    });
});
