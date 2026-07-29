/**
 * `--keyboard-inset` is the only thing that knows the on-screen keyboard
 * exists.
 *
 * On iOS the keyboard does not resize the layout viewport — `innerHeight`,
 * `100vh` and `100dvh` are all unchanged while it's up. So a composer at
 * the bottom of a full-height shell sits behind it, and no amount of CSS
 * can work that out alone. These pin the arithmetic that replaces the
 * signal the platform doesn't give us.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useKeyboardInset } from "../hooks/common/useKeyboardInset";

type Listener = () => void;

class FakeVisualViewport {
    height: number;
    offsetTop = 0;
    private listeners = new Map<string, Set<Listener>>();

    constructor(height: number) {
        this.height = height;
    }
    addEventListener(type: string, fn: Listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(fn);
    }
    removeEventListener(type: string, fn: Listener) {
        this.listeners.get(type)?.delete(fn);
    }
    emit(type: string) {
        this.listeners.get(type)?.forEach((fn) => fn());
    }
    /** Simulate the keyboard covering `px` of the screen. */
    coverBy(px: number) {
        this.height = window.innerHeight - px;
        this.emit("resize");
    }
}

const readInset = () => document.documentElement.style.getPropertyValue("--keyboard-inset");

let vv: FakeVisualViewport;

beforeEach(() => {
    window.innerHeight = 800;
    vv = new FakeVisualViewport(800);
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
});

afterEach(() => {
    document.documentElement.style.removeProperty("--keyboard-inset");
});

describe("useKeyboardInset", () => {
    it("reports 0 when no keyboard is up", () => {
        renderHook(() => useKeyboardInset());
        expect(readInset()).toBe("0px");
    });

    it("reports the covered height when the keyboard opens", () => {
        renderHook(() => useKeyboardInset());
        vv.coverBy(320);
        expect(readInset()).toBe("320px");
    });

    it("returns to 0 when the keyboard closes", () => {
        renderHook(() => useKeyboardInset());
        vv.coverBy(320);
        vv.coverBy(0);
        expect(readInset()).toBe("0px");
    });

    it("accounts for a shifted visual viewport", () => {
        // iOS scrolls the visual viewport under the layout viewport while
        // the keyboard animates. Ignoring offsetTop reads that shift as
        // extra keyboard and over-shrinks the layout.
        renderHook(() => useKeyboardInset());
        vv.height = 500;
        vv.offsetTop = 100;
        vv.emit("scroll");
        // 800 - (500 + 100) = 200 covered, not 300.
        expect(readInset()).toBe("200px");
    });

    it("treats sub-pixel rounding as no keyboard", () => {
        renderHook(() => useKeyboardInset());
        vv.height = 799.5;
        vv.emit("resize");
        expect(readInset()).toBe("0px");
    });

    it("cleans the variable up on unmount", () => {
        const { unmount } = renderHook(() => useKeyboardInset());
        vv.coverBy(320);
        unmount();
        expect(readInset()).toBe("");
    });

    it("does nothing when visualViewport is unavailable", () => {
        Object.defineProperty(window, "visualViewport", {
            value: undefined,
            configurable: true,
        });
        expect(() => renderHook(() => useKeyboardInset())).not.toThrow();
        expect(readInset()).toBe("");
    });
});
