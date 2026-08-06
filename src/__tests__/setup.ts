import "@testing-library/jest-dom/vitest";

// Node 25+ exposes a stub `localStorage` global that throws / is
// undefined unless `--localstorage-file` is passed. jsdom normally
// provides its own, but Vitest's worker can leave the Node stub in
// place — polyfill a minimal in-memory store so auth/guard tests that
// call `localStorage.clear()` keep working.
if (
    typeof globalThis !== "undefined" &&
    (typeof globalThis.localStorage === "undefined" ||
        typeof globalThis.localStorage?.clear !== "function")
) {
    const store = new Map<string, string>();
    const memoryStorage: Storage = {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key) => (store.has(key) ? store.get(key)! : null),
        key: (index) => [...store.keys()][index] ?? null,
        removeItem: (key) => {
            store.delete(key);
        },
        setItem: (key, value) => {
            store.set(key, String(value));
        },
    };
    Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: memoryStorage,
    });
}

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

// Same class of gap: jsdom doesn't ship `IntersectionObserver`, and
// framer-motion reaches for it the moment a component uses
// `whileInView`. Every scroll-reveal on the marketing pages does, so
// without this a test that merely RENDERS one throws before it can
// assert anything.
//
// The stub never fires a callback, so `whileInView` elements stay at
// their initial style. That is fine for assertions about content — the
// element is in the DOM either way — but a test about the animated
// state itself would need to drive the callback rather than trust this.
if (typeof globalThis !== "undefined" && typeof globalThis.IntersectionObserver === "undefined") {
    class StubIntersectionObserver implements IntersectionObserver {
        readonly root = null;
        readonly rootMargin = "";
        readonly thresholds: ReadonlyArray<number> = [];
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
            return [];
        }
    }
    globalThis.IntersectionObserver =
        StubIntersectionObserver as unknown as typeof IntersectionObserver;
}
