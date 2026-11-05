/**
 * Guards the hover family-focus feature (MIP-963).
 *
 * It used to be 152 generated `:has()` rules, which made the browser's style
 * recalculation for a freshly mounted 950-task table cost about 1 s. It is now
 * two static rules plus one delegated pointer handler. The rules' text and the
 * handler's behaviour together ARE the feature, so each test below pins a
 * property a plausible "simplification" would quietly break.
 */

import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    applyFamilyFocus,
    DIM_ATTR,
    DND_ACTIVE_ATTR,
    FAMILY_ATTR,
    FAMILY_FOCUS_CSS,
    installFamilyFocusStyles,
    onFamilyFocusPointerLeave,
    onFamilyFocusPointerOver,
    TASK_BODY_CLASS,
    TASK_ROW_CLASS,
} from "../features/tasks/utils/familyFocusCss";

const rules = FAMILY_FOCUS_CSS.split("\n");

describe("FAMILY_FOCUS_CSS", () => {
    it("is two static rules and uses no :has()", () => {
        // `:has()` is what cost ~1 s of style recalculation per table mount.
        expect(rules).toHaveLength(2);
        expect(FAMILY_FOCUS_CSS).not.toContain(":has(");
        expect(FAMILY_FOCUS_CSS).not.toContain(":hover");
    });

    it("dims the rows the handler marked, and only those", () => {
        expect(rules[0].startsWith(`.${TASK_BODY_CLASS}:not([${DND_ACTIVE_ATTR}]) `)).toBe(true);
        expect(rules[0]).toContain(`.${TASK_ROW_CLASS}[${DIM_ATTR}="true"]`);
    });

    it("exempts the selected row from dimming", () => {
        // Dimming the open preview's row would hide which task the pane is
        // showing whenever the cursor rests on an unrelated family.
        for (const rule of rules) expect(rule).toContain(':not([data-task-selected="true"])');
    });

    it("gates every rule on no drag being in progress", () => {
        // During a reparent drag the dragged row sits under the cursor, so its
        // family would be the hovered one and the very rows you drag onto
        // would dim.
        for (const rule of rules) {
            expect(rule.startsWith(`.${TASK_BODY_CLASS}:not([${DND_ACTIVE_ATTR}])`)).toBe(true);
        }
    });

    it("keeps dimmed rows readable rather than near-invisible", () => {
        // Regression: at 0.38 this read as "the subtasks are gone". `opacity`
        // multiplies down the tree and a subtask title already carries 0.85.
        const opacity = Number(/opacity: ([0-9.]+);/.exec(FAMILY_FOCUS_CSS)?.[1]);
        expect(opacity).toBeGreaterThanOrEqual(0.6);
        expect(opacity).toBeLessThan(1);
    });

    it("resets the subtask title's own opacity so the two don't multiply", () => {
        expect(rules[1]).toContain(".task-row-title { opacity: 1 !important; }");
    });

    it("never sets pointer-events, so the highlight follows the cursor", () => {
        // A dimmed row must still receive the pointer, or the cursor would
        // cross it with the previous family still lit.
        expect(FAMILY_FOCUS_CSS).not.toContain("pointer-events");
    });

    it("delays dimming on the way in but not on the way out, and says !important", () => {
        // The row's inline `transition` SHORTHAND pins `transition-delay` to 0s,
        // and only an important author declaration outranks inline.
        expect(rules[0]).toContain("transition-delay: 120ms !important");
        expect(FAMILY_FOCUS_CSS).not.toContain("transition-delay: 0");
    });
});

describe("installFamilyFocusStyles", () => {
    afterEach(() => {
        document.head.innerHTML = "";
    });

    it("adds the stylesheet once, however often it is called", () => {
        installFamilyFocusStyles();
        installFamilyFocusStyles();
        installFamilyFocusStyles();
        const styles = document.querySelectorAll("style#genos-task-family-focus");
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe(FAMILY_FOCUS_CSS);
    });
});

const buildTable = (families: Array<string | undefined>) => {
    const { container } = render(
        <div className={TASK_BODY_CLASS} data-testid="body">
            {families.map((family, i) => (
                <div
                    key={i}
                    className={TASK_ROW_CLASS}
                    data-testid={`row-${i}`}
                    {...(family === undefined ? {} : { [FAMILY_ATTR]: family })}
                >
                    <span data-testid={`cell-${i}`}>cell</span>
                </div>
            ))}
            <div data-testid="gap" />
        </div>
    );
    const body = container.querySelector(`.${TASK_BODY_CLASS}`) as HTMLElement;
    const row = (i: number) => body.querySelector(`[data-testid="row-${i}"]`) as HTMLElement;
    const dimmed = () =>
        [...body.querySelectorAll(`.${TASK_ROW_CLASS}`)]
            .map((r, i) => (r.getAttribute(DIM_ATTR) === "true" ? i : -1))
            .filter((i) => i >= 0);
    return { body, row, dimmed };
};

describe("applyFamilyFocus", () => {
    it("dims every row outside the focused family and none inside it", () => {
        const { body, dimmed } = buildTable(["10", "10", "20", "30", "20"]);
        applyFamilyFocus(body, "20");
        expect(dimmed()).toEqual([0, 1, 3]);
    });

    it("moves the focus when the family changes and clears it with null", () => {
        const { body, dimmed } = buildTable(["10", "10", "20"]);
        applyFamilyFocus(body, "10");
        expect(dimmed()).toEqual([2]);
        applyFamilyFocus(body, "20");
        expect(dimmed()).toEqual([0, 1]);
        applyFamilyFocus(body, null);
        expect(dimmed()).toEqual([]);
    });

    it("dims nothing when only one family is in view", () => {
        // Every row is "family", which the old generated sheet expressed by
        // emitting no rules at all.
        const { body, dimmed } = buildTable(["10", "10", "10"]);
        applyFamilyFocus(body, "10");
        expect(dimmed()).toEqual([]);
    });

    it("does not touch the DOM when the family has not changed", () => {
        // The pointer crosses many cells inside one family; each crossing must
        // cost a lookup, not a pass over the rows.
        const { body } = buildTable(["10", "20", "20"]);
        applyFamilyFocus(body, "10");
        const set = vi.spyOn(Element.prototype, "setAttribute");
        const remove = vi.spyOn(Element.prototype, "removeAttribute");
        const query = vi.spyOn(body, "querySelectorAll");
        applyFamilyFocus(body, "10");
        applyFamilyFocus(body, "10");
        expect(set).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect(query).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it("writes only the rows whose state changes", () => {
        const { body } = buildTable(["10", "20", "20", "30"]);
        applyFamilyFocus(body, "10");
        const set = vi.spyOn(Element.prototype, "setAttribute");
        applyFamilyFocus(body, "20"); // row 0 gains dim; rows 1-2 lose it; row 3 stays dimmed
        expect(set).toHaveBeenCalledTimes(1);
        vi.restoreAllMocks();
    });

    it("treats a row with no family as outside every family", () => {
        // The old rule's `:not([data-task-family="k"])` matched it too.
        const { body, dimmed } = buildTable(["10", undefined, "20"]);
        applyFamilyFocus(body, "10");
        expect(dimmed()).toEqual([1, 2]);
    });

    it("keeps separate tables separate", () => {
        const a = buildTable(["10", "20"]);
        const b = buildTable(["10", "20"]);
        applyFamilyFocus(a.body, "10");
        expect(a.dimmed()).toEqual([1]);
        expect(b.dimmed()).toEqual([]);
    });
});

describe("pointer handlers on the table body", () => {
    const mount = (families: Array<string | undefined>) => {
        const { container } = render(
            <div
                className={TASK_BODY_CLASS}
                data-testid="body"
                onPointerLeave={onFamilyFocusPointerLeave}
                onPointerOver={onFamilyFocusPointerOver}
            >
                {families.map((family, i) => (
                    <div
                        key={i}
                        className={TASK_ROW_CLASS}
                        {...(family === undefined ? {} : { [FAMILY_ATTR]: family })}
                    >
                        <span data-testid={`cell-${i}`}>cell</span>
                    </div>
                ))}
                <div data-testid="gap" />
            </div>
        );
        const body = container.querySelector(`.${TASK_BODY_CLASS}`) as HTMLElement;
        const dimmed = () =>
            [...body.querySelectorAll(`.${TASK_ROW_CLASS}`)]
                .map((r, i) => (r.getAttribute(DIM_ATTR) === "true" ? i : -1))
                .filter((i) => i >= 0);
        return {
            body,
            dimmed,
            cell: (i: number) => body.querySelector(`[data-testid="cell-${i}"]`)!,
        };
    };

    it("dims the other families when the pointer enters a cell of a row", () => {
        const { cell, dimmed } = mount(["10", "20", "20"]);
        fireEvent.pointerOver(cell(1));
        expect(dimmed()).toEqual([0]);
    });

    it("follows the pointer from one family to another", () => {
        const { cell, dimmed } = mount(["10", "20", "30"]);
        fireEvent.pointerOver(cell(0));
        expect(dimmed()).toEqual([1, 2]);
        fireEvent.pointerOver(cell(2));
        expect(dimmed()).toEqual([0, 1]);
    });

    it("clears when the pointer is over the gap between or below the rows", () => {
        const { body, cell, dimmed } = mount(["10", "20"]);
        fireEvent.pointerOver(cell(0));
        expect(dimmed()).toEqual([1]);
        fireEvent.pointerOver(body.querySelector('[data-testid="gap"]')!);
        expect(dimmed()).toEqual([]);
    });

    it("clears when the pointer leaves the table", () => {
        const { body, cell, dimmed } = mount(["10", "20"]);
        fireEvent.pointerOver(cell(0));
        fireEvent.pointerLeave(body);
        expect(dimmed()).toEqual([]);
    });

    it("ignores touch, which has no hover and would leave a family dimmed", () => {
        const { cell, dimmed } = mount(["10", "20"]);
        fireEvent.pointerOver(cell(0), { pointerType: "touch" });
        expect(dimmed()).toEqual([]);
    });
});
