/**
 * MIP-1041: links in the dark message and comment bubbles must be readable.
 *
 * A link with no colour of its own takes the browser's default for the
 * element's `color-scheme`, and the full BlockNote renderer (and every task
 * comment) computes to `light` even in dark mode: a dark blue link, and a dark
 * purple visited one, on a near-black bubble (about 2:1; 4.5:1 is the AA floor).
 * jsdom cannot compute a stylesheet's cascade, so this reads the rules out of
 * App.css and checks their colours against the backgrounds they sit on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../App.css"), "utf8");

const colorOf = (selector: string): string | null => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    const color = match?.[1].match(/(?:^|[;\s])color:\s*(#[0-9a-fA-F]{6})\b/);
    return color ? color[1] : null;
};

const luminance = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

// Each dark palette, and the backgrounds its links can sit on. The comment has
// no bubble of its own: it sits on the page, from pure black up to the grey
// task pane.
const PALETTES = [
    { name: "received bubble", root: ".bn-message-bubble-box-dark", on: ["#1f2937", "#0b0d0e"] },
    { name: "sent bubble", root: ".bn-message-bubble-box-dark-me", on: ["#312e81", "#0b0d0e"] },
    {
        name: "task comment",
        root: ".task-comment-preview-dark",
        on: ["#000000", "#0b0d0e", "#1f1f1f"],
    },
];

describe("links in the dark bubbles", () => {
    for (const { name, root, on } of PALETTES) {
        for (const [state, suffix] of [
            ["link", " a"],
            ["visited link", " a:visited"],
            ["hovered link", " a:hover"],
        ] as const) {
            it(`${name}: the ${state} has a colour of its own`, () => {
                expect(colorOf(`${root}${suffix}`), `${root}${suffix}`).not.toBeNull();
            });

            it(`${name}: the ${state} reads at 4.5:1 or better on every background it sits on`, () => {
                const color = colorOf(`${root}${suffix}`)!;
                for (const background of on) {
                    expect(
                        contrast(color, background),
                        `${color} on ${background}`
                    ).toBeGreaterThanOrEqual(4.5);
                }
            });
        }
    }

    it("the browser's default light-scheme link blue would not have passed (the test can fail)", () => {
        expect(contrast("#0000ee", "#0b0d0e")).toBeLessThan(4.5);
        expect(contrast("#551a8b", "#0b0d0e")).toBeLessThan(4.5);
    });

    it("leaves the light bubbles on the default link colour", () => {
        expect(colorOf(".bn-message-bubble-box-light a")).toBeNull();
        expect(colorOf(".task-comment-preview-light a")).toBeNull();
    });
});
