/**
 * MIP-1120: Tailwind's theme comes from the design tokens, and the global CSS
 * carries no dead template rules or hashed Emotion selectors.
 *
 * jsdom ignores Tailwind, so what a class really computes to is checked in a
 * browser (the "Tailwind" section of /workspace/design reads both sides of
 * every role; see the PR). What jsdom CAN check is the wiring in the source:
 * each `@theme` line points at a variable the token stylesheet defines, no
 * role is silently left out, and the sample page only uses classes the theme
 * defines (a typo'd class is a silent no-op in Tailwind).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildTokenStylesheet } from "../theme/tokens/tokenStyles";

// Not `new URL(…, import.meta.url)`: Vite rewrites that form as an asset import.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

const indexCss = read("index.css");
const appCss = read("App.css");

/** `--tailwind-name` -> `--g-name` for every line of the `@theme inline` block. */
const themeBlock = (() => {
    const m = indexCss.match(/@theme inline \{([\s\S]*?)\n\}/);
    if (!m) throw new Error("no `@theme inline` block in index.css");
    return m[1];
})();
const theme = new Map(
    [...themeBlock.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((x) => [x[1], x[2].trim()])
);

/** Every `--g-*` the token stylesheet defines. */
const defined = new Set(
    [...buildTokenStylesheet().matchAll(/^\s*(--g-[a-z0-9-]+):/gm)].map((x) => x[1])
);

const EXPECTED: Record<string, string> = {
    "--color-bg": "--g-bg",
    "--color-bg-subtle": "--g-bg-subtle",
    "--color-surface": "--g-surface",
    "--color-surface-raised": "--g-surface-raised",
    "--color-hover": "--g-hover",
    "--color-active": "--g-active",
    "--color-scrim": "--g-scrim",
    "--color-focus": "--g-focus",
    "--color-primary": "--g-text",
    "--color-secondary": "--g-text-secondary",
    "--color-tertiary": "--g-text-tertiary",
    "--color-disabled": "--g-text-disabled",
    "--color-subtle": "--g-border-subtle",
    "--color-default": "--g-border",
    "--color-strong": "--g-border-strong",
    "--color-accent": "--g-accent",
    "--color-accent-hover": "--g-accent-hover",
    "--color-accent-fg": "--g-accent-fg",
    "--color-accent-text": "--g-accent-text",
    "--color-accent-subtle": "--g-accent-subtle",
    "--color-accent-border": "--g-accent-border",
    "--radius-xs": "--g-radius-xs",
    "--radius-sm": "--g-radius-sm",
    "--radius-md": "--g-radius-md",
    "--radius-lg": "--g-radius-lg",
    "--shadow-sm": "--g-shadow-sm",
    "--shadow-md": "--g-shadow-md",
    "--font-sans": "--g-font-body",
    "--font-mono": "--g-font-mono",
};
for (const status of ["danger", "success", "warning", "info"]) {
    EXPECTED[`--color-${status}`] = `--g-${status}-solid`;
    for (const part of ["fg", "text", "subtle", "border"]) {
        EXPECTED[`--color-${status}-${part}`] =
            `--g-${status}-${part === "fg" ? "solid-fg" : part}`;
    }
}

describe("@theme inline maps the design tokens into Tailwind", () => {
    it.each(Object.entries(EXPECTED))("%s is var(%s)", (name, token) => {
        expect(theme.get(name)).toBe(`var(${token})`);
    });

    it("has no line beyond the expected ones (a new line needs a row above)", () => {
        expect([...theme.keys()].sort()).toEqual(Object.keys(EXPECTED).sort());
    });

    it("every referenced --g variable is one the token stylesheet defines", () => {
        for (const [name, value] of theme) {
            const ref = value.match(/^var\((--g-[a-z0-9-]+)\)$/)?.[1];
            expect(ref, `${name}: ${value} is not a bare var(--g-…)`).toBeTruthy();
            expect(defined.has(ref!), `${name} -> ${ref} is not defined by tokenStyles`).toBe(
                true
            );
        }
    });

    it("leaves no color role unmapped except the deliberate ones", () => {
        const mapped = new Set(Object.values(EXPECTED));
        // Gradients are `background-image`, not a color utility; ink-rgb is a
        // channel triplet; shadow-lg is excluded on purpose (next test).
        const deliberate = new Set([
            "--g-brand-gradient",
            "--g-brand-gradient-hover",
            "--g-ink-rgb",
            "--g-shadow-lg",
        ]);
        const roleNames = [...defined].filter(
            (v) => !/^--g-(type|space|control|row|motion|ease|font|radius)/.test(v)
        );
        const missing = roleNames.filter((v) => !mapped.has(v) && !deliberate.has(v));
        expect(missing).toEqual([]);
    });

    it("does not map shadow-lg: an opaque var() would strip the tint from `shadow-lg shadow-violet-900/10`", () => {
        expect(theme.has("--shadow-lg")).toBe(false);
    });
});

describe("the sample page only uses classes the theme defines", () => {
    const sample = read("features/designSystem/TailwindSample.tsx");
    const roles = [...sample.matchAll(/role: "([a-z0-9-]+)"/g)].map((m) => m[1]);

    it("lists the roles", () => {
        expect(roles.length).toBeGreaterThan(20);
    });

    it.each(roles)("%s resolves to a theme variable", (role) => {
        const pick = (prefix: string) => role.slice(prefix.length);
        const name = role.startsWith("bg-")
            ? `--color-${pick("bg-")}`
            : role.startsWith("text-")
              ? `--color-${pick("text-")}`
              : role.startsWith("border-")
                ? `--color-${pick("border-")}`
                : role.startsWith("rounded-")
                  ? `--radius-${pick("rounded-")}`
                  : role.startsWith("shadow-")
                    ? `--shadow-${pick("shadow-")}`
                    : `--${role}`;
        // `text-accent-text` is the role "accent-text": the class prefix is
        // `text-`, the color is `accent-text`.
        expect(theme.has(name), `${role} -> ${name}`).toBe(true);
    });
});

describe("global CSS carries no dead rules", () => {
    it("App.css has no hashed Emotion selectors (they break on any MUI upgrade, and never matched in production, where Emotion drops the label)", () => {
        expect(appCss.match(/\.css-[a-z0-9]{5,}[-\s{.:,>]/g)).toBeNull();
    });

    it("the Vite template leftovers are gone", () => {
        for (const dead of [
            /\.logo\b/,
            /\.card\b/,
            /\.read-the-docs\b/,
            /logo-spin/,
            /--logo-/,
            /--card-padding/,
            /646cffaa/,
            /61dafbaa/,
        ]) {
            expect(appCss, String(dead)).not.toMatch(dead);
            expect(indexCss, String(dead)).not.toMatch(dead);
        }
    });

    it("the dead DataGrid block and --datagrid-* variables are gone (MIP-1154)", () => {
        // No DataGrid / TablePagination renders in the app and `task-datagrid-*` is never
        // applied, so none of these selectors or variables can match anything.
        for (const dead of [/DataGrid/i, /datagrid/i, /MuiTablePagination/, /task-datagrid/]) {
            expect(appCss, String(dead)).not.toMatch(dead);
        }
    });
});
