/**
 * `useShortcut` (MIP-1275): one listener per use, matched by the registry,
 * with the editable-target policy applied before the handler runs.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShortcut } from "../shortcuts";

let mac = true;
vi.mock("../utils/platform", () => ({ isMac: () => mac }));

const press = (init: KeyboardEventInit, target: EventTarget = document) => {
    const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
};

beforeEach(() => {
    mac = true;
});
afterEach(() => {
    document.body.innerHTML = "";
});

describe("useShortcut", () => {
    it("runs the handler for the chord and not for a near miss", () => {
        const handler = vi.fn();
        renderHook(() => useShortcut("global.spotlight", handler));
        press({ key: "k", metaKey: true });
        press({ key: "K", metaKey: true });
        expect(handler).toHaveBeenCalledTimes(2);
        press({ key: "k", ctrlKey: true }); // Ctrl+K is not the Mac chord
        press({ key: "k" });
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it("follows the platform: Ctrl+K on Windows and Linux", () => {
        mac = false;
        const handler = vi.fn();
        renderHook(() => useShortcut("global.spotlight", handler));
        press({ key: "k", metaKey: true });
        expect(handler).not.toHaveBeenCalled();
        press({ key: "k", ctrlKey: true });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("hands the event to the handler, which owns preventDefault", () => {
        renderHook(() => useShortcut("global.spotlight", (e) => e.preventDefault()));
        expect(press({ key: "k", metaKey: true }).defaultPrevented).toBe(true);
        const quiet = renderHook(() => useShortcut("chat.switchTab", () => {}));
        expect(press({ key: "ArrowLeft", metaKey: true, shiftKey: true }).defaultPrevented).toBe(
            false
        );
        quiet.unmount();
    });

    it("an editable-skip shortcut stays out of text fields (chat arrows keep text selection)", () => {
        const handler = vi.fn();
        const tab = vi.fn();
        renderHook(() => {
            useShortcut("chat.moveSelection", handler);
            useShortcut("chat.switchTab", tab);
        });
        const chord = { key: "ArrowDown", metaKey: true, shiftKey: true };
        const tabChord = { key: "ArrowLeft", metaKey: true, shiftKey: true };

        const input = document.body.appendChild(document.createElement("input"));
        press(chord, input);
        const editor = document.body.appendChild(document.createElement("div"));
        editor.setAttribute("contenteditable", "true");
        const inner = editor.appendChild(document.createElement("p"));
        press(chord, inner);
        press(tabChord, input);
        press(tabChord, inner);
        expect(handler).not.toHaveBeenCalled();
        expect(tab).not.toHaveBeenCalled();

        const button = document.body.appendChild(document.createElement("button"));
        press(chord, button);
        press(tabChord, button);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(tab).toHaveBeenCalledTimes(1);
    });

    it("an editable-allow shortcut fires inside a text field (Cmd+K from the composer)", () => {
        const handler = vi.fn();
        renderHook(() => useShortcut("global.spotlight", handler));
        const input = document.body.appendChild(document.createElement("input"));
        press({ key: "k", metaKey: true }, input);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("always calls the latest handler without re-binding", () => {
        const add = vi.spyOn(document, "addEventListener");
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ fn }) => useShortcut("global.spotlight", fn), {
            initialProps: { fn: first },
        });
        const bound = add.mock.calls.filter(([type]) => type === "keydown").length;
        rerender({ fn: second });
        press({ key: "k", metaKey: true });
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        expect(add.mock.calls.filter(([type]) => type === "keydown").length).toBe(bound);
        add.mockRestore();
    });

    it("listens on window when asked, and stops when disabled or unmounted", () => {
        const handler = vi.fn();
        const { rerender, unmount } = renderHook(
            ({ enabled }) =>
                useShortcut("taskCreate.submit", handler, { target: "window", enabled }),
            { initialProps: { enabled: true } }
        );
        press({ key: "Enter", metaKey: true }, window);
        expect(handler).toHaveBeenCalledTimes(1);
        rerender({ enabled: false });
        press({ key: "Enter", metaKey: true }, window);
        expect(handler).toHaveBeenCalledTimes(1);
        rerender({ enabled: true });
        press({ key: "Enter", metaKey: true }, window);
        expect(handler).toHaveBeenCalledTimes(2);
        unmount();
        press({ key: "Enter", metaKey: true }, window);
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it("a shortcut that claims its keys reaches the handler before the editor and ends the event (Cmd+K, MIP-1310)", () => {
        const handler = vi.fn();
        renderHook(() => useShortcut("global.spotlight", handler));
        const editor = document.body.appendChild(document.createElement("div"));
        editor.setAttribute("contenteditable", "true");
        // BlockNote's CreateLinkButton listens on the editor element, in the bubble phase.
        const editorOwn = vi.fn((e: Event) => e.preventDefault());
        editor.addEventListener("keydown", editorOwn);
        const e = press({ key: "k", metaKey: true }, editor);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(editorOwn).not.toHaveBeenCalled();
        expect(e.defaultPrevented).toBe(false); // the handler decides preventDefault, not the editor
    });

    it("a shortcut that does not claim leaves the editor's own listener running", () => {
        const handler = vi.fn();
        renderHook(() => useShortcut("global.tasksNew", handler));
        const editor = document.body.appendChild(document.createElement("div"));
        const editorOwn = vi.fn();
        editor.addEventListener("keydown", editorOwn);
        mac = true;
        press({ key: "t", ctrlKey: true, metaKey: true }, editor);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(editorOwn).toHaveBeenCalledTimes(1);
    });
});
