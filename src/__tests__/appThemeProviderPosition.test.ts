/**
 * `ColorThemeProvider` must sit ABOVE `AppBody`, not inside it (MIP-958).
 *
 * It renders MUI's `CssVarsProvider`, which builds a new theme object every
 * time it renders. Rendered from `AppBody`'s returned JSX it re-rendered on
 * every `AppBody` render (about 13 per task click), and each new theme
 * re-rendered every styled component in the app, memo or not. In `App`, whose
 * children never change, it renders only when the theme changes.
 *
 * Structural, like `SpotlightPreferencesProviderGuard.test.tsx`: the failure is
 * where a tag sits relative to the component whose renders drive it, which no
 * unit render of either component can see.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(__dirname, "..", "App.tsx"), "utf8");
const bodyStart = appSource.indexOf("const AppBody = () => {");
const wrapperStart = appSource.indexOf("export const App = () => (");

describe("ColorThemeProvider position", () => {
    it("finds both components", () => {
        expect(bodyStart).toBeGreaterThan(-1);
        expect(wrapperStart).toBeGreaterThan(bodyStart);
    });

    it("is not rendered by AppBody", () => {
        const insideAppBody = appSource
            .slice(bodyStart, wrapperStart)
            // The commented-out too-small-screen sketch mentions it; ignore comments.
            .split("\n")
            .filter((line) => !line.trim().startsWith("//"))
            .join("\n");
        expect(insideAppBody).not.toContain("<ColorThemeProvider>");
    });

    it("wraps AppBody from App", () => {
        expect(appSource.slice(wrapperStart)).toMatch(
            /<ColorThemeProvider>[\s\S]*<AppBody\s*\/>[\s\S]*<\/ColorThemeProvider>/
        );
    });
});
