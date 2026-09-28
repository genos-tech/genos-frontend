/**
 * `useSpotlightPreferences` must resolve a real provider when called from the
 * component that `main.tsx` mounts for `/workspace/*`.
 *
 * The bug this pins shipped and survived a long time. `SpotlightPreferencesProvider`
 * was rendered inside `App`'s *returned JSX*, while `useSpotlight` — and through
 * it `useSpotlightPreferences` — was called in `App`'s own body. React resolves
 * context by position in the mounted tree, so a provider in a component's JSX is
 * a CHILD of that component and invisible to its hooks. The lexical nesting in
 * the file reads as if it should work, which is precisely why nobody caught it.
 *
 * The consequence was silent in three layers:
 *
 *  1. `useSpotlightPreferences` has a deliberate no-provider fallback returning
 *     `DEFAULT_AI_ANSWERS = true` and no-op setters, so consumers outside the App
 *     tree don't crash. Nothing logged, nothing threw.
 *  2. The Settings "AI answers" switch wrote to a provider instance nothing on
 *     the ask path could read, so it appeared to work while changing nothing.
 *  3. Three documented behaviours were therefore unreachable in the running app:
 *     the disabled Ask button, its `errors.enableAiHint` tooltip, and the
 *     `placeholder.aiOff` string — all still rendered correctly by
 *     `SpotlightContent` when the prop is passed directly, which is why unit
 *     tests stayed green.
 *
 * Every other Spotlight test `vi.mock`s this hook to `{ aiAnswers: true }`, so
 * none of them can see this class of defect — mocking the hook mocks away the
 * wiring. These tests deliberately do NOT mock it.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthProvider } from "../context/AuthContext";
import {
    SpotlightPreferencesProvider,
    useSpotlightPreferences,
} from "../hooks/common/useSpotlightPreferences";

const SRC = resolve(__dirname, "..");
const appSource = readFileSync(resolve(SRC, "App.tsx"), "utf8");

describe("Spotlight preferences provider position", () => {
    it("is not rendered inside the component that consumes it", () => {
        // The failure is structural: a provider inside the consuming
        // component's JSX. Assert on where the tag appears relative to the
        // body/JSX boundary rather than on a line number, so the guard
        // survives edits above it.
        //
        // `AppBody` holds the `useSpotlight` call; `App` is the thin wrapper
        // that supplies the context. The provider tag must appear only after
        // `AppBody` has ended.
        const bodyStart = appSource.indexOf("const AppBody = () => {");
        const wrapperStart = appSource.indexOf("export const App = () => (");
        expect(bodyStart).toBeGreaterThan(-1);
        expect(wrapperStart).toBeGreaterThan(bodyStart);

        const insideAppBody = appSource.slice(bodyStart, wrapperStart);
        expect(insideAppBody).not.toContain("<SpotlightPreferencesProvider>");
        expect(appSource.slice(wrapperStart)).toContain("<SpotlightPreferencesProvider>");
    });

    it("wraps the useSpotlight call, not the other way round", () => {
        // The precise inversion that caused the bug: the hook call must NOT
        // sit in a component that is an ancestor of the provider.
        const bodyStart = appSource.indexOf("const AppBody = () => {");
        const wrapperStart = appSource.indexOf("export const App = () => (");
        const insideAppBody = appSource.slice(bodyStart, wrapperStart);
        // The consumer is still where it was...
        expect(insideAppBody).toContain("useSpotlight({");
        // ...and the provider is now strictly above it, so `<AppBody />` is
        // rendered as the provider's child.
        expect(appSource.slice(wrapperStart)).toMatch(
            /<SpotlightPreferencesProvider>\s*<AppBody\s*\/>\s*<\/SpotlightPreferencesProvider>/
        );
    });

    it("still exports App as the route element main.tsx mounts", () => {
        // Renaming the inner component must not change the public entry:
        // main.tsx does `<Route element={<App />} path="/workspace/*" />`.
        const mainSource = readFileSync(resolve(SRC, "main.tsx"), "utf8");
        expect(mainSource).toContain("<App />");
        expect(appSource).toContain("export const App = () => (");
    });
});

describe("useSpotlightPreferences fallback", () => {
    // These two pin the behaviour that made the bug invisible, so the
    // structural guards above can't be "fixed" by removing the fallback.
    it("falls back to AI answers ON with no provider, silently", () => {
        const { result } = renderHook(() => useSpotlightPreferences());
        expect(result.current.aiAnswers).toBe(true);
        // No-op setters: calling them must not throw, and must not change
        // anything — this is what made the Settings switch look functional.
        expect(() => result.current.setAiAnswers(false)).not.toThrow();
        expect(result.current.aiAnswers).toBe(true);
    });

    it("honours a real provider's stored value", () => {
        // The fallback and the provider must be distinguishable, or the
        // structural guards above are testing nothing observable.
        window.localStorage.setItem(
            "genos-spotlight-preferences:v1",
            JSON.stringify({ aiAnswers: false })
        );
        const { result } = renderHook(() => useSpotlightPreferences(), {
            wrapper: ({ children }) => (
                <AuthProvider>
                    <SpotlightPreferencesProvider>{children}</SpotlightPreferencesProvider>
                </AuthProvider>
            ),
        });
        expect(result.current.aiAnswers).toBe(false);
        window.localStorage.removeItem("genos-spotlight-preferences:v1");
    });
});
