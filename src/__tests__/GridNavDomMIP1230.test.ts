/**
 * MIP-1230: the DOM side of the roving tabindex on a plain hand-built grid, for the
 * rules that the real rows cannot exercise one at a time: a cell with two controls,
 * an editor with several controls, a key pressed on the second control, and the
 * header taking the scroll to the top.
 */
import { afterEach, describe, expect, it } from "vitest";

import { GridNav } from "../features/tasks/components/table/useGridNav";

let cleanup: (() => void) | null = null;
afterEach(() => {
    cleanup?.();
    cleanup = null;
    document.body.innerHTML = "";
});

const cell = (col: string, inner: string, role = "gridcell") =>
    `<div role="${role}" data-grid-col="${col}">${inner}</div>`;
const row = (id: string, cells: string) => `<div role="row" data-grid-row="${id}">${cells}</div>`;

const mount = (html: string) => {
    const grid = document.createElement("div");
    grid.setAttribute("role", "treegrid");
    grid.innerHTML = html;
    document.body.appendChild(grid);
    const nav = new GridNav();
    cleanup = nav.attach(grid);
    return { grid, nav };
};

const stops = (grid: HTMLElement) =>
    [...grid.querySelectorAll<HTMLElement>("button, input, [tabindex]")].filter(
        (e) => e.tabIndex >= 0
    );
const press = (el: Element, key: string) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
};

const BASE = [
    row("__header", cell("a", "<button>A</button>", "columnheader")),
    row("1", cell("a", '<button id="first">one</button><button id="second">two</button>')),
    row("2", cell("a", "<button>x</button>")),
].join("");

describe("GridNav on a hand-built grid", () => {
    it("a cell with two controls has one stop: the first; the second is not a stop", () => {
        const { grid } = mount(BASE);
        expect(stops(grid)).toHaveLength(1);
        expect(grid.querySelector("#second")!.getAttribute("tabindex")).toBe("-1");
    });

    it("arrows work from the second control of a cell (reached by a click), and are handled", () => {
        const { grid } = mount(BASE);
        const second = grid.querySelector<HTMLElement>("#second")!;
        second.focus();
        const event = press(second, "ArrowDown");
        expect(event.defaultPrevented).toBe(true);
        expect(
            document.activeElement?.closest("[data-grid-row]")?.getAttribute("data-grid-row")
        ).toBe("2");
    });

    it("an editor keeps its own controls in the Tab order and its own arrow keys", () => {
        const { grid } = mount(
            [
                row("__header", cell("a", "<button>A</button>", "columnheader")),
                row("1", cell("a", '<input id="in"><button id="clear">x</button>')),
                row("2", cell("a", "<button>y</button>")),
            ].join("")
        );
        const clear = grid.querySelector<HTMLElement>("#clear")!;
        // The extra-control rule does not run on an editor: the clear button was not forced to -1.
        expect(clear.getAttribute("tabindex")).toBeNull();
        const input = grid.querySelector<HTMLElement>("#in")!;
        input.focus();
        expect(press(input, "ArrowDown").defaultPrevented).toBe(false);
        // Not even from the editor's other control.
        clear.focus();
        expect(press(clear, "ArrowDown").defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(clear);
    });

    it("moving to the header takes the scroll to the top (the header is sticky, focus alone scrolls nothing)", () => {
        const { grid } = mount(BASE);
        grid.scrollTop = 500;
        const first = grid.querySelector<HTMLElement>("#first")!;
        first.focus();
        press(first, "ArrowUp");
        expect(
            document.activeElement?.closest("[data-grid-row]")?.getAttribute("data-grid-row")
        ).toBe("__header");
        expect(grid.scrollTop).toBe(0);
    });
});
