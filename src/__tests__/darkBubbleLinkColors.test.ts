/**
 * MIP-1041: links in the dark message and comment bubbles must be readable.
 *
 * A link with no colour of its own takes the browser's default for the
 * element's `color-scheme`, and the full BlockNote renderer (and every task
 * comment) computes to `light` even in dark mode: a dark blue link, and a dark
 * purple visited one, on a near-black bubble (about 2:1; 4.5:1 is the AA floor).
 * jsdom cannot compute a stylesheet's cascade, so this reads the rules out of
 * App.css and checks their colours against the backgrounds they sit on: since
 * MIP-1130 those are the shared Bubble's token fills, in every color theme
 * (MIP-1166), not the three fixed backgrounds the palettes were tuned for.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { THEME_IDS } from "../theme/themePalettes";
import { composite, contrast } from "../theme/tokens/color";
import { buildRoles } from "../theme/tokens/roles";

const css = readFileSync(join(__dirname, "../App.css"), "utf8");

// A color declared as a hex or as one of the token variables the palettes use
// (`var(--g-text)`, ...). Returned as written; `resolve` turns it into a hex for
// one color theme.
const colorOf = (selector: string): string | null => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    const color = match?.[1].match(
        /(?:^|[;\s])color:\s*(#[0-9a-fA-F]{6}|var\(--g-[a-z-]+\))(?=\s*(?:;|!important|$))/
    );
    return color ? color[1] : null;
};

type Roles = ReturnType<typeof buildRoles>;
const TOKEN_COLORS: Record<string, (r: Roles) => string> = {
    "--g-text": (r) => r.text,
    "--g-warning-text": (r) => r.warning.text,
    "--g-accent-text": (r) => r.accentText,
};
/** `#rrggbb` as is; `var(--g-x)` as that role in the theme's dark mode. */
const resolve = (value: string, id: (typeof THEME_IDS)[number]): string => {
    const token = value.match(/^var\((--g-[a-z-]+)\)$/)?.[1];
    if (!token) return value;
    const role = TOKEN_COLORS[token];
    if (!role) throw new Error(`the test does not know ${token}`);
    return role(buildRoles(id, "dark"));
};

// The dark message and comment palettes in App.css carry fixed link colors and, in
// part, fixed text colors (the rest are token variables: the file name, the sent
// bubbles' text and code), but since MIP-1130 they no longer sit on the fixed
// backgrounds they were tuned for (#1f2937, #312e81, #0b0d0e): every bubble
// is the shared `Bubble`, whose fills are theme tokens. So the backgrounds below
// are the real ones, per color theme: the page and the surface, each with the
// hover fill, the sent tint (accent), the open-thread tint (accent) and the
// deep-link tint (success) composited over it.
const darkFills = (id: (typeof THEME_IDS)[number]): Record<string, string> => {
    const r = buildRoles(id, "dark");
    const tints = { accent: r.accentSubtle, success: r.success.subtle };
    const base = { bg: r.bg, surface: r.surface };
    return Object.fromEntries(
        Object.entries(base).flatMap(([bn, b]) => [
            [bn, b],
            [`${bn}+hover`, composite(r.hover.hex, r.hover.a, b)],
            ...Object.entries(tints).map(([tn, t]) => [`${bn}+${tn}`, composite(t.hex, t.a, b)]),
        ])
    );
};

// Each dark palette in App.css. They all sit on the same fills now, whichever
// bubble look (compact row, received or sent balloon, task comment) hosts them.
const PALETTES = [
    { name: "message bubble", root: ".bn-message-bubble-box-dark" },
    { name: "sent message bubble", root: ".bn-message-bubble-box-dark-me" },
    { name: "task comment", root: ".task-comment-preview-dark" },
];

const DARK_THEMES = THEME_IDS.map((id) => [id, darkFills(id)] as const);

const worst = (color: string, fills: Record<string, string>) =>
    Object.entries(fills)
        .map(([n, bg]) => ({ n, ratio: contrast(color, bg) }))
        .sort((x, y) => x.ratio - y.ratio)[0];

describe("links in the dark bubbles", () => {
    for (const { name, root } of PALETTES) {
        for (const [state, suffix] of [
            ["link", " a"],
            ["visited link", " a:visited"],
            ["hovered link", " a:hover"],
        ] as const) {
            it(`${name}: the ${state} has a colour of its own`, () => {
                expect(colorOf(`${root}${suffix}`), `${root}${suffix}`).not.toBeNull();
            });

            it.each(DARK_THEMES)(
                `${name}: the ${state} reads at 4.5:1 or better on every fill a bubble has in the %s theme`,
                (id, fills) => {
                    const color = resolve(colorOf(`${root}${suffix}`)!, id);
                    const w = worst(color, fills);
                    expect(w.ratio, `${color} on ${w.n}`).toBeGreaterThanOrEqual(4.5);
                }
            );
        }
    }

    it("the browser's default light-scheme link blue would not have passed (the test can fail)", () => {
        for (const [, fills] of DARK_THEMES) {
            expect(worst("#0000ee", fills).ratio).toBeLessThan(4.5);
            expect(worst("#551a8b", fills).ratio).toBeLessThan(4.5);
        }
    });

    it("leaves the light bubbles on the default link colour", () => {
        expect(colorOf(".bn-message-bubble-box-light a")).toBeNull();
        expect(colorOf(".task-comment-preview-light a")).toBeNull();
    });
});

describe("text and code in the dark bubbles", () => {
    for (const { name, root } of PALETTES) {
        it.each(DARK_THEMES)(`${name}: body text reads at 4.5:1 in the %s theme`, (id, fills) => {
            const declared = colorOf(`${root} .bn-editor`);
            expect(declared, `${root} .bn-editor`).not.toBeNull();
            const color = resolve(declared!, id);
            const w = worst(color, fills);
            expect(w.ratio, `${color} on ${w.n}`).toBeGreaterThanOrEqual(4.5);
        });

        it.each(DARK_THEMES)(
            `${name}: inline code reads at 4.5:1 in the %s theme`,
            (id, fills) => {
                // The code chip is a translucent fill over the bubble: reading the rule
                // gives its color; its own background is white or black at an alpha, or
                // the `--g-active` wash (the ink at its active alpha).
                const rule = css.match(
                    new RegExp(`(?:^|\\n)${root.replace(/[\\.]/g, "\\$&")} code\\s*\\{([^}]*)\\}`)
                );
                const declared = rule?.[1].match(
                    /(?:^|[;\s])color:\s*(#[0-9a-fA-F]{6}|var\(--g-[a-z-]+\))\s*;/
                )?.[1];
                const bgm = rule?.[1].match(
                    /background-color:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/
                );
                const bgToken = rule?.[1].match(/background-color:\s*var\((--g-[a-z-]+)\)/)?.[1];
                expect(declared, `${root} code color`).toBeTruthy();
                expect(bgm || bgToken, `${root} code background`).toBeTruthy();
                const fg = resolve(declared!, id);
                let hex: string;
                let a: number;
                if (bgm) {
                    hex =
                        "#" +
                        [bgm[1], bgm[2], bgm[3]]
                            .map((v) => Number(v).toString(16).padStart(2, "0"))
                            .join("");
                    a = Number(bgm[4]);
                } else {
                    expect(bgToken, `${root} code background token`).toBe("--g-active");
                    ({ hex, a } = buildRoles(id, "dark").active);
                }
                const bad = Object.entries(fills)
                    .map(([n, f]) => ({ n, ratio: contrast(fg, composite(hex, a, f)) }))
                    .filter((x) => x.ratio < 4.5);
                expect(bad).toEqual([]);
            }
        );
    }
});
