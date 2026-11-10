import { afterEach, describe, expect, it, vi } from "vitest";

import { columnMove, monthMove, RovingNav, type RovingConfig } from "../hooks/common/roving";

// MIP-1402: the DOM half of the roving tab stops, on plain elements. The real board and the
// real calendar are in RovingBoardMIP1402.test.tsx / RovingCalendarMIP1402.test.tsx.

const flush = () => new Promise<void>((r) => setTimeout(r, 40));

type Spec = Record<string, Array<string | { id: string; sort?: number; inner?: boolean }>>;

const build = (spec: Spec, opts: { dir?: string } = {}) => {
    const container = document.createElement("div");
    if (opts.dir) container.style.direction = opts.dir;
    for (const [group, items] of Object.entries(spec)) {
        for (const entry of items) {
            const { id, sort, inner } = typeof entry === "string" ? { id: entry } : entry;
            const el = document.createElement("div");
            el.setAttribute("data-roving-group", group);
            el.setAttribute("data-roving-item", id);
            if (sort !== undefined) el.setAttribute("data-roving-sort", String(sort));
            el.setAttribute("tabindex", "0");
            el.textContent = id;
            if (inner !== false) {
                const button = document.createElement("button");
                button.textContent = `${id}-btn`;
                button.setAttribute("data-inner", id);
                el.appendChild(button);
            }
            container.appendChild(el);
        }
    }
    document.body.appendChild(container);
    return container;
};

const item = (c: HTMLElement, id: string) =>
    c.querySelector<HTMLElement>(`[data-roving-item="${id}"]`)!;
const inner = (c: HTMLElement, id: string) =>
    c.querySelector<HTMLElement>(`[data-inner="${id}"]`)!;
const stops = (c: HTMLElement) =>
    Array.from(c.querySelectorAll<HTMLElement>("[data-roving-item]"))
        .filter((el) => el.getAttribute("tabindex") === "0")
        .map((el) => el.getAttribute("data-roving-item"));
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
        ...init,
    });
    el.dispatchEvent(event);
    return event;
};

const nav = (config: Partial<RovingConfig> = {}) => {
    const full: RovingConfig = { move: columnMove, groupOrder: "dom", ...config };
    return new RovingNav(() => full);
};

let cleanups: Array<() => void> = [];
afterEach(() => {
    cleanups.forEach((c) => c());
    cleanups = [];
    document.body.innerHTML = "";
});
const attach = (n: RovingNav, c: HTMLElement) => {
    cleanups.push(n.attach(c));
};

describe("one tab stop per group", () => {
    it("the first item of every group is its stop, the rest are out of the Tab order", () => {
        const c = build({ open: ["a", "b", "c"], wip: ["d", "e"] });
        attach(nav(), c);
        expect(stops(c)).toEqual(["a", "d"]);
        expect(item(c, "b").getAttribute("tabindex")).toBe("-1");
    });

    it("the controls inside an item are out of the Tab order, or stay for the active item with keepInner", () => {
        const c = build({ open: ["a", "b"] });
        attach(nav(), c);
        expect(inner(c, "a").getAttribute("tabindex")).toBe("-1");
        expect(inner(c, "b").getAttribute("tabindex")).toBe("-1");

        const k = build({ open: ["a", "b"] });
        attach(nav({ keepInner: true }), k);
        expect(inner(k, "a").hasAttribute("tabindex")).toBe(false); // the button's own (none)
        expect(inner(k, "b").getAttribute("tabindex")).toBe("-1");
    });

    it("keeps a control's own tabindex when its item becomes active again", async () => {
        const c = build({ open: ["a", "b"] });
        inner(c, "a").setAttribute("tabindex", "0");
        attach(nav({ keepInner: true }), c);
        item(c, "b").focus();
        await flush();
        expect(inner(c, "a").getAttribute("tabindex")).toBe("-1");
        item(c, "a").focus();
        await flush();
        expect(inner(c, "a").getAttribute("tabindex")).toBe("0");
        expect(inner(c, "a").hasAttribute("data-roving-tabindex")).toBe(false);
    });

    it("when the active day goes with a month change, the group's default is the stop, not the same grid index", async () => {
        const c = build({ month: ["2026-11-29", "2026-11-30", "2026-12-01"] });
        item(c, "2026-11-30").setAttribute("data-roving-default", "");
        attach(nav({ move: monthMove }), c);
        item(c, "2026-12-01").focus();
        expect(stops(c)).toEqual(["2026-12-01"]);
        // the next month's grid replaces the cells; its default is the 1st
        c.innerHTML = "";
        for (const id of ["2027-01-01", "2027-01-02", "2027-01-03"]) {
            const el = document.createElement("div");
            el.setAttribute("data-roving-group", "month");
            el.setAttribute("data-roving-item", id);
            el.setAttribute("tabindex", "0");
            if (id === "2027-01-01") el.setAttribute("data-roving-default", "");
            c.appendChild(el);
        }
        await flush();
        expect(stops(c)).toEqual(["2027-01-01"]);
    });

    it("an item that is focused (a click, a Tab) becomes its group's stop", () => {
        const c = build({ open: ["a", "b", "c"], wip: ["d"] });
        attach(nav(), c);
        item(c, "c").focus();
        expect(stops(c)).toEqual(["c", "d"]);
    });

    it("the item marked as default is where a group starts", () => {
        const c = build({ month: ["d1", "d2", "d3"] });
        item(c, "d2").setAttribute("data-roving-default", "");
        attach(nav({ move: monthMove }), c);
        expect(stops(c)).toEqual(["d2"]);
    });
});

describe("the arrow keys", () => {
    it("Up / Down move inside the column and the focus and the stop follow", () => {
        const c = build({ open: ["a", "b", "c"], wip: ["d"] });
        attach(nav(), c);
        item(c, "a").focus();
        const down = key(item(c, "a"), "ArrowDown");
        expect(down.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(item(c, "b"));
        expect(stops(c)).toEqual(["b", "d"]);
        key(item(c, "b"), "ArrowDown");
        key(item(c, "c"), "ArrowDown"); // the end: stays, the key is still swallowed
        expect(document.activeElement).toBe(item(c, "c"));
    });

    it("Left / Right change column; the column left keeps its card as its stop", () => {
        const c = build({ open: ["a", "b", "c"], wip: ["d", "e"] });
        attach(nav(), c);
        item(c, "b").focus();
        key(item(c, "b"), "ArrowRight");
        expect(document.activeElement).toBe(item(c, "e"));
        expect(stops(c)).toEqual(["b", "e"]);
        key(item(c, "e"), "ArrowLeft");
        expect(document.activeElement).toBe(item(c, "b"));
    });

    it("RTL mirrors Left / Right", () => {
        const c = build({ open: ["a"], wip: ["b"] }, { dir: "rtl" });
        attach(nav(), c);
        item(c, "a").focus();
        key(item(c, "a"), "ArrowLeft");
        expect(document.activeElement).toBe(item(c, "b"));
    });

    it("works from a control inside the item (the card's own button)", () => {
        const c = build({ open: ["a", "b"] });
        attach(nav({ keepInner: true }), c);
        inner(c, "a").focus();
        key(inner(c, "a"), "ArrowDown");
        expect(document.activeElement).toBe(item(c, "b"));
    });

    it("leaves keys it does not own: modifiers, Tab, the page keys", () => {
        const c = build({ open: ["a", "b"] });
        attach(nav(), c);
        item(c, "a").focus();
        for (const [k, init] of [
            ["ArrowDown", { shiftKey: true }],
            ["ArrowDown", { altKey: true }],
            ["Tab", {}],
            ["PageDown", {}],
            ["a", {}],
        ] as const) {
            expect(key(item(c, "a"), k, init).defaultPrevented, `${k}`).toBe(false);
        }
        expect(document.activeElement).toBe(item(c, "a"));
    });

    it("is silent while the host says it is paused, and for a key somebody handled", () => {
        const c = build({ open: ["a", "b"] });
        let paused = true;
        attach(nav({ paused: () => paused }), c);
        item(c, "a").focus();
        expect(key(item(c, "a"), "ArrowDown").defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(item(c, "a"));
        paused = false;
        const handled = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
        });
        handled.preventDefault();
        item(c, "a").dispatchEvent(handled);
        expect(document.activeElement).toBe(item(c, "a"));
    });

    it("does not touch the keys of a text field inside the surface", () => {
        const c = build({ open: ["a", "b"] });
        const input = document.createElement("input");
        item(c, "a").appendChild(input);
        attach(nav(), c);
        input.focus();
        expect(key(input, "ArrowDown").defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(input);
        expect(input.hasAttribute("data-roving-tabindex")).toBe(false);
    });
});

describe("items come and go", () => {
    it("the stop moves to the nearest item when its own unmounts", async () => {
        const c = build({ open: ["a", "b", "c"] });
        attach(nav(), c);
        item(c, "b").focus();
        item(c, "b").remove();
        await flush();
        expect(stops(c)).toEqual(["c"]);
    });

    it("a control that re-mounts inside an item is fixed up without reading the whole surface", async () => {
        const c = build({ open: ["a", "b"] });
        attach(nav({ keepInner: true }), c);
        const spy = vi.spyOn(c, "querySelectorAll");
        const fresh = document.createElement("button");
        fresh.setAttribute("tabindex", "0");
        item(c, "b").replaceChildren(fresh);
        await flush();
        expect(fresh.getAttribute("tabindex")).toBe("-1");
        // the surface-wide item query is not run for a change inside one item
        expect(spy.mock.calls.filter(([q]) => String(q) === "[data-roving-item]")).toHaveLength(0);
    });

    it("a drag's placeholders and text changes do not make it read the surface", async () => {
        const c = build({ open: ["a", "b"] });
        attach(nav(), c);
        const spy = vi.spyOn(c, "querySelectorAll");
        const placeholder = document.createElement("div");
        c.appendChild(placeholder);
        placeholder.remove();
        await flush();
        expect(spy).not.toHaveBeenCalled();
    });

    it("a new item is taken out of the Tab order", async () => {
        const c = build({ open: ["a"] });
        attach(nav(), c);
        const extra = document.createElement("div");
        extra.setAttribute("data-roving-group", "open");
        extra.setAttribute("data-roving-item", "z");
        extra.setAttribute("tabindex", "0");
        c.appendChild(extra);
        await flush();
        expect(stops(c)).toEqual(["a"]);
    });

    it("an emptied group has no stop, and gets one back when it fills", async () => {
        const c = build({ open: ["a"], wip: ["d"] });
        attach(nav(), c);
        item(c, "d").remove();
        await flush();
        expect(stops(c)).toEqual(["a"]);
        const back = document.createElement("div");
        back.setAttribute("data-roving-group", "wip");
        back.setAttribute("data-roving-item", "n");
        back.setAttribute("tabindex", "0");
        c.appendChild(back);
        await flush();
        expect(stops(c)).toEqual(["a", "n"]);
    });

    it("a card dropped into another column by the keyboard keeps the focus", async () => {
        const c = build({ open: ["a", "b"], wip: ["d"] });
        attach(nav(), c);
        item(c, "b").focus();
        key(item(c, "b"), " "); // a key on the surface: the drop is a keyboard move
        // The drag library re-mounts the card in the other column and the focus falls to <body>.
        item(c, "b").remove();
        const moved = document.createElement("div");
        moved.setAttribute("data-roving-group", "wip");
        moved.setAttribute("data-roving-item", "b");
        moved.setAttribute("tabindex", "0");
        c.appendChild(moved);
        await flush();
        expect(document.activeElement).toBe(moved);
        expect(stops(c)).toEqual(["a", "b"]);
    });

    it("does not pull the focus back after a mouse click elsewhere", async () => {
        const c = build({ open: ["a", "b"] });
        const nowMs = vi.spyOn(Date, "now");
        nowMs.mockReturnValue(1_000);
        attach(nav(), c);
        item(c, "b").focus();
        key(item(c, "b"), "ArrowUp");
        nowMs.mockReturnValue(60_000); // a minute later: not the keyboard's doing
        item(c, "a").remove();
        await flush();
        expect(document.activeElement).toBe(document.body);
        nowMs.mockRestore();
    });
});

describe("Enter and ordering", () => {
    it("Enter on the item itself calls activate; on a control inside it does not", () => {
        const c = build({ open: ["a"] });
        const activate = vi.fn();
        attach(nav({ activate }), c);
        item(c, "a").focus();
        expect(key(item(c, "a"), "Enter").defaultPrevented).toBe(true);
        expect(activate).toHaveBeenCalledWith({ group: "open", item: "a" }, expect.anything());
        key(inner(c, "a"), "Enter");
        expect(activate).toHaveBeenCalledTimes(1);
        key(item(c, "a"), "Enter", { repeat: true });
        key(item(c, "a"), "Enter", { ctrlKey: true });
        expect(activate).toHaveBeenCalledTimes(1);
    });

    it("sorts groups by id and items by data-roving-sort, the DOM order breaking ties", () => {
        const c = build({
            "2026-11-12": [
                { id: "late", sort: 9 },
                { id: "all-day", sort: -1 },
                { id: "early", sort: 5 },
            ],
            "2026-11-11": ["x"],
        });
        attach(nav({ groupOrder: "sorted" }), c);
        item(c, "x").focus();
        key(item(c, "x"), "ArrowRight");
        // the new group starts with its all-day item at the same index 0
        expect(document.activeElement).toBe(item(c, "all-day"));
        key(item(c, "all-day"), "ArrowDown");
        expect(document.activeElement).toBe(item(c, "early"));
        key(item(c, "early"), "ArrowDown");
        expect(document.activeElement).toBe(item(c, "late"));
    });
});

describe("a move to a day that is not there yet", () => {
    it("asks the host to show it and focuses it when it arrives", async () => {
        const c = build({ month: ["2026-11-29", "2026-11-30"] });
        const onOutside = vi.fn();
        attach(nav({ move: monthMove, onOutside }), c);
        item(c, "2026-11-30").focus();
        const press = key(item(c, "2026-11-30"), "ArrowRight");
        expect(press.defaultPrevented).toBe(true);
        expect(onOutside).toHaveBeenCalledWith({ group: "month", item: "2026-12-01" });
        // The host re-renders the grid for December.
        const dec = document.createElement("div");
        dec.setAttribute("data-roving-group", "month");
        dec.setAttribute("data-roving-item", "2026-12-01");
        dec.setAttribute("tabindex", "0");
        c.appendChild(dec);
        await flush();
        expect(document.activeElement).toBe(dec);
        expect(stops(c)).toEqual(["2026-12-01"]);
    });

    it("focuses the day at once when the host had it on screen already", async () => {
        const c = build({ month: ["2026-11-05", "2026-12-05"] });
        attach(nav({ move: monthMove, onOutside: vi.fn() }), c);
        item(c, "2026-11-05").focus();
        key(item(c, "2026-11-05"), "PageDown"); // Dec 5 IS in the model: no mutation will come
        await flush();
        expect(document.activeElement).toBe(item(c, "2026-12-05"));
    });

    it("swallows the key when the host cannot show the day", () => {
        const c = build({ month: ["2026-11-30"] });
        attach(nav({ move: monthMove }), c);
        item(c, "2026-11-30").focus();
        expect(key(item(c, "2026-11-30"), "ArrowRight").defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(item(c, "2026-11-30"));
    });
});
