import "@testing-library/jest-dom/vitest";

// jsdom doesn't ship `window.matchMedia`. Mantine (used by BlockNote's
// `@blocknote/mantine` view) reads it at first render to detect the
// system color scheme — without this stub, every test that mounts a
// BlockNote-using component throws `window.matchMedia is not a function`.
// The stub returns "not matching" for every query, which is the correct
// default (light mode, no `prefers-reduced-motion`, etc.).
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    });
}
