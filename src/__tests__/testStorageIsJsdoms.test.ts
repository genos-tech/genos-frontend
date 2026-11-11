/**
 * MIP-1407. Node 25+ has its own `localStorage` / `sessionStorage` globals, and vitest's jsdom
 * environment used to leave them in place. They work, but they are not jsdom's `Storage`, so a
 * spy on `Storage.prototype.setItem` watched an object nothing writes to: three draft-debounce
 * tests failed on Node 26, and every "storage throws" test passed without testing anything.
 * `setup.ts` puts jsdom's back. These tests pin the property that broke, on whatever Node runs.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
});

describe.each([
    ["localStorage", () => localStorage],
    ["sessionStorage", () => sessionStorage],
])("%s in the test environment", (_name, get) => {
    it("is a Storage, with the methods of Storage.prototype", () => {
        expect(get()).toBeInstanceOf(Storage);
        expect(get().setItem).toBe(Storage.prototype.setItem);
        expect(get().getItem).toBe(Storage.prototype.getItem);
    });

    it("is the window's, so code and tests see the same store", () => {
        expect(get()).toBe(window[_name as "localStorage" | "sessionStorage"]);
    });
});

describe("a spy on Storage.prototype sees the writes (what the draft tests count)", () => {
    it("counts a setItem and passes it through", () => {
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        localStorage.setItem("k", "v");
        expect(setItem).toHaveBeenCalledTimes(1);
        expect(setItem).toHaveBeenCalledWith("k", "v");
        expect(localStorage.getItem("k")).toBe("v");
    });

    it("can make storage throw (what the failure-path tests rely on)", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("full", "QuotaExceededError");
        });
        expect(() => localStorage.setItem("k", "v")).toThrow(/full/);
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(() => localStorage.getItem("k")).toThrow(/denied/);
    });
});
