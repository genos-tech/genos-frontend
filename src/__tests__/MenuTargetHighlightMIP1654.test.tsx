/**
 * MIP-1654: the block a drag-handle menu is open for is highlighted while the menu is open.
 *
 * The menu (Copy link to block, Delete, Colors, Reset type) did not say which block it acts on once
 * the pointer left the block. `MenuTargetHighlight` sits inside the menu's dropdown, which BlockNote
 * mounts only while the menu is open, so mounting it adds a class to the block's element and
 * unmounting it takes the class off. That the dropdown really mounts and unmounts with the menu was
 * checked in a real browser (see the PR); jsdom cannot drive BlockNote's floating menu.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    MENU_TARGET_CLASS,
    MenuTargetHighlight,
} from "../components/editors/sub/MenuTargetHighlight";

// What BlockNote's side-menu state says the menu is for, and the editor's DOM root.
const state = vi.hoisted(() => ({
    blockId: undefined as string | undefined,
    root: null as unknown,
}));
// ONE editor object, as BlockNote hands out: a fresh one per render would re-run the effect for
// the wrong reason and hide a missing dependency.
const editor = vi.hoisted(() => ({
    get domElement() {
        return (state as { root: unknown }).root;
    },
}));
vi.mock("@blocknote/react", () => ({
    useBlockNoteEditor: () => editor,
    useExtensionState: () => state.blockId,
}));

const block = (id: string, text: string, children = "") =>
    `<div data-node-type="blockOuter" data-id="${id}"><div class="bn-block" data-node-type="blockContainer" data-id="${id}"><p>${text}</p>${children}</div></div>`;

let root: HTMLElement;
beforeEach(() => {
    root = document.createElement("div");
    root.innerHTML =
        block("b1", "first") + block("b2", "parent", block("b3", "child")) + block("b4", "last");
    document.body.appendChild(root);
    state.root = root;
    state.blockId = undefined;
});
afterEach(() => {
    cleanup();
    root.remove();
});

const marked = () =>
    [...root.querySelectorAll(`.${MENU_TARGET_CLASS}`)].map((el) => el.getAttribute("data-id"));

describe("while the menu is open", () => {
    it("tints the block the menu is for, and only that block", () => {
        state.blockId = "b1";
        render(<MenuTargetHighlight />);
        expect(marked()).toEqual(["b1"]);
    });

    it("tints a nested child, not its parent", () => {
        state.blockId = "b3";
        render(<MenuTargetHighlight />);
        expect(marked()).toEqual(["b3"]);
    });

    it("takes the tint off again when the menu closes", () => {
        state.blockId = "b1";
        const view = render(<MenuTargetHighlight />);
        expect(marked()).toEqual(["b1"]);
        view.unmount();
        expect(marked()).toEqual([]);
    });

    it("moves the tint when the menu is for another block", () => {
        state.blockId = "b1";
        const view = render(<MenuTargetHighlight />);
        state.blockId = "b4";
        view.rerender(<MenuTargetHighlight />);
        expect(marked()).toEqual(["b4"]);
    });

    it("changes nothing in the document but that one class", () => {
        const before = root.innerHTML;
        state.blockId = "b1";
        const view = render(<MenuTargetHighlight />);
        expect(root.innerHTML).not.toBe(before);
        view.unmount();
        expect(root.innerHTML).toBe(before);
    });

    it("renders nothing of its own", () => {
        state.blockId = "b1";
        const { container } = render(<MenuTargetHighlight />);
        expect(container.innerHTML).toBe("");
    });
});

describe("when there is nothing to tint", () => {
    it("does nothing for a block id that is not in the editor", () => {
        state.blockId = "nope";
        expect(() => render(<MenuTargetHighlight />)).not.toThrow();
        expect(marked()).toEqual([]);
    });

    it("does nothing without a block (the side menu has none)", () => {
        state.blockId = undefined;
        render(<MenuTargetHighlight />);
        expect(marked()).toEqual([]);
    });

    it("does nothing before the editor has a DOM element", () => {
        state.root = null;
        state.blockId = "b1";
        expect(() => render(<MenuTargetHighlight />)).not.toThrow();
        expect(marked()).toEqual([]);
    });
});

describe("it touches only its own editor", () => {
    it("leaves another editor's block with the same id alone", () => {
        // BEFORE this editor in the document, so a lookup in the whole page would find it first.
        const other = document.createElement("div");
        other.innerHTML = block("b1", "elsewhere");
        document.body.insertBefore(other, root);
        state.blockId = "b1";
        render(<MenuTargetHighlight />);
        expect(other.querySelector(`.${MENU_TARGET_CLASS}`)).toBeNull();
        expect(marked()).toEqual(["b1"]);
        other.remove();
    });

    it("does not strip a tint another editor put on its own block when it closes", () => {
        const other = document.createElement("div");
        other.innerHTML = block("x1", "elsewhere");
        other.querySelector(".bn-block")!.classList.add(MENU_TARGET_CLASS);
        document.body.appendChild(other);
        state.blockId = "b1";
        render(<MenuTargetHighlight />).unmount();
        expect(other.querySelector(`.${MENU_TARGET_CLASS}`)).not.toBeNull();
        other.remove();
    });

    it("still clears the tint if the editor redrew the element while the menu was open", () => {
        state.blockId = "b1";
        const view = render(<MenuTargetHighlight />);
        const old = root.querySelector('.bn-block[data-id="b1"]')!;
        const redrawn = old.cloneNode(true) as Element; // a redraw: new element, class carried over
        old.replaceWith(redrawn);
        expect(redrawn.classList.contains(MENU_TARGET_CLASS)).toBe(true);
        view.unmount();
        expect(marked()).toEqual([]);
    });
});

describe("the wiring and the style", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const read = (rel: string) => readFileSync(resolve(here, rel), "utf8").replace(/\s+/g, " ");

    it("the drag-handle menu mounts the highlight INSIDE its dropdown (so it is open-only)", () => {
        const source = read("../components/editors/sub/CustomDragHandleMenu.tsx");
        expect(source).toMatch(/<DragHandleMenu>.*<MenuTargetHighlight \/>.*<\/DragHandleMenu>/);
    });

    it("the class is a steady tint (a state), not an animation (an event)", () => {
        const css = read("../App.css");
        const rule = css.match(/\.bn-block\.bn-menu-target \{([^}]*)\}/)?.[1] ?? "";
        expect(rule).toContain("background-color: var(--g-accent-subtle)");
        expect(rule).toContain("box-shadow:");
        expect(rule).not.toContain("animation");
    });
});
