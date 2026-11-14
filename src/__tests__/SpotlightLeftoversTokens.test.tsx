/**
 * MIP-1176: the Spotlight content, its mention composer and the dark bubble
 * palettes ask for roles, not for the mode.
 *
 *  - no `isDark`, `useColorScheme` or `purplePalette` is left in the Spotlight
 *    files and the mention menu/marker, so the Ask modals (which never passed
 *    `isDark`) and Spotlight cannot differ again;
 *  - the mention dropdown paints its rows from the accent / hover roles;
 *  - the App.css rules that moved to tokens keep the contrast they had on every
 *    fill a bubble has in every color theme (measured, MIP-1176): the check below
 *    is the old worst case as a floor.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MentionSuggestionDropdown } from "../features/agentQA/mentions/MentionSuggestionDropdown";
import type { AgentMentionCandidate } from "../features/agentQA/mentions/types";
import { THEME_IDS, THEME_PRIMITIVES } from "../theme/themePalettes";
import { composite, contrast, hexToOklch, oklchToHex } from "../theme/tokens/color";
import { buildRoles } from "../theme/tokens/roles";

const src = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

const NO_MODE_BRANCHING = [
    "features/spotlight/SpotlightContent.tsx",
    "features/spotlight/SpotlightOverlay.tsx",
    "features/spotlight/SpotlightProjectFilter.tsx",
    "features/agentQA/mentions/MentionSuggestionDropdown.tsx",
    "features/agentQA/mentions/MentionHighlightOverlay.tsx",
    "components/editors/mentionMenuRow.tsx",
];

describe("no mode branching in the Spotlight and mention files", () => {
    it.each(NO_MODE_BRANCHING)("%s asks for roles", (file) => {
        const text = src(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
        expect(text).not.toMatch(/\bisDark\b/);
        expect(text).not.toMatch(/useColorScheme/);
        expect(text).not.toMatch(/purplePalette/);
        expect(text).not.toMatch(/rgba?\(\s*\d/);
    });
});

const USER: AgentMentionCandidate = {
    ref: { kind: "user", userId: "u1", label: "Ken Kamiya" },
    trigger: "@",
    key: "user:u1",
};
const OTHER: AgentMentionCandidate = {
    ref: { kind: "user", userId: "u2", label: "Mei" },
    trigger: "@",
    key: "user:u2",
};

describe("the mention dropdown", () => {
    const renderMenu = () => {
        const anchor = document.createElement("div");
        document.body.appendChild(anchor);
        return render(
            <CssVarsProvider>
                <MentionSuggestionDropdown
                    anchorRef={{ current: anchor }}
                    ariaLabel="Mentions"
                    highlightIndex={0}
                    placement="below"
                    suggestions={[USER, OTHER]}
                    onSelect={() => {}}
                />
            </CssVarsProvider>
        );
    };

    it("paints the keyboard-selected row with the accent wash and the rest clear", () => {
        renderMenu();
        const selected = screen.getByTestId("agent-mention-option-user:u1");
        const other = screen.getByTestId("agent-mention-option-user:u2");
        expect(getComputedStyle(selected).backgroundColor).toBe("var(--g-accent-subtle)");
        expect(getComputedStyle(other).backgroundColor).not.toBe("var(--g-accent-subtle)");
    });

    it("sits on the raised surface with the large shadow role", () => {
        renderMenu();
        const menu = screen.getByTestId("agent-mention-dropdown");
        const style = getComputedStyle(menu);
        expect(style.background).toBe("var(--g-surface-raised)");
        expect(style.boxShadow).toBe("var(--g-shadow-lg)");
    });
});

// ---- App.css rules that moved to tokens ------------------------------------
const css = src("App.css");
const rule = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    expect(m, `${selector} is in App.css`).not.toBeNull();
    return m![1];
};

describe("the file block in a dark bubble", () => {
    it("is not forced to a fixed blue (it was 2:1 and 1.5:1 on the dark bubble)", () => {
        // The base rule (accent text, text on hover) must be the one that applies.
        expect(css).not.toMatch(
            /\.bn-message-bubble-box-dark[^{]*\.bn-file-name-with-icon[^{]*\{/
        );
        expect(rule(".bn-file-name-with-icon")).toMatch(/var\(--g-accent-text\)/);
    });

    it("sizes in secondary text", () => {
        expect(
            rule(
                ".bn-message-bubble-box-dark .bn-file-size,\n.bn-message-bubble-box-dark-me .bn-file-size"
            )
        ).toMatch(/var\(--g-text-secondary\)/);
    });
});

describe("the token palettes keep the contrast of the hex they replaced, on every fill", () => {
    type Roles = ReturnType<typeof buildRoles>;
    type Wash = { hex: string; a: number };
    // The fills a bubble can have (page and surface, each plain and with the
    // hover, accent and success washes), per color theme: ONE entry per
    // theme x fill, so a rule that is worse on any single fill fails, not only
    // the worst case (the worst case can move to another theme and hide it).
    const fillsOf = (r: Roles): [string, string][] => {
        const tints: [string, Wash][] = [
            ["accent", r.accentSubtle],
            ["success", r.success.subtle],
        ];
        return (
            [
                ["bg", r.bg],
                ["surface", r.surface],
            ] as [string, string][]
        ).flatMap(([name, base]) => [
            [name, base] as [string, string],
            [`${name}+hover`, composite(r.hover.hex, r.hover.a, base)] as [string, string],
            ...tints.map(
                ([tn, t]) => [`${name}+${tn}`, composite(t.hex, t.a, base)] as [string, string]
            ),
        ]);
    };
    /** Every (theme, fill) where the token reads lower than the old hex. */
    const regressions = (
        mode: "light" | "dark",
        oldFg: string | ((id: (typeof THEME_IDS)[number]) => string),
        newFg: (r: Roles) => string,
        chips?: { old: Wash; new: (r: Roles) => Wash }
    ) =>
        THEME_IDS.flatMap((id) => {
            const r = buildRoles(id, mode);
            return fillsOf(r).flatMap(([fill, f]) => {
                const before = contrast(
                    typeof oldFg === "function" ? oldFg(id) : oldFg,
                    chips ? composite(chips.old.hex, chips.old.a, f) : f
                );
                const nw = chips ? chips.new(r) : null;
                const after = contrast(newFg(r), nw ? composite(nw.hex, nw.a, f) : f);
                return after < before - 1e-9
                    ? [`${id}/${fill}: ${before.toFixed(2)} -> ${after.toFixed(2)}`]
                    : [];
            });
        });

    it("sent dark bubble and dark comment: body text on --g-text (was #e0e7ff)", () => {
        expect(regressions("dark", "#e0e7ff", (r) => r.text)).toEqual([]);
        expect(rule(".bn-message-bubble-box-dark-me .bn-editor")).toMatch(
            /color:\s*var\(--g-text\)/
        );
        expect(rule(".task-comment-preview-dark .bn-editor")).toMatch(/color:\s*var\(--g-text\)/);
    });

    it("sent dark bubble and dark comment: code on --g-warning-text over --g-active (was #fbbf24 on white .15)", () => {
        expect(
            regressions("dark", "#fbbf24", (r) => r.warning.text, {
                old: { hex: "#ffffff", a: 0.15 },
                new: (r) => r.active,
            })
        ).toEqual([]);
        for (const root of [".bn-message-bubble-box-dark-me", ".task-comment-preview-dark"]) {
            const body = rule(`${root} code`);
            expect(body).toMatch(/color:\s*var\(--g-warning-text\)/);
            expect(body).toMatch(/background-color:\s*var\(--g-active\)/);
        }
    });

    it("the file block: the name is accent text (was #1b60ae), its hover text (was #0800ff), the size secondary (was #af9c9e)", () => {
        expect(regressions("dark", "#1b60ae", (r) => r.accentText)).toEqual([]);
        expect(regressions("dark", "#0800ff", (r) => r.text)).toEqual([]);
        expect(regressions("dark", "#af9c9e", (r) => r.textSecondary)).toEqual([]);
    });

    it("sent light bubble: text on --g-text (was #1e1b4b)", () => {
        expect(regressions("light", "#1e1b4b", (r) => r.text)).toEqual([]);
        expect(rule(".bn-message-bubble-box-light-me .bn-editor")).toMatch(
            /color:\s*var\(--g-text\)/
        );
    });

    it("the test can fail: a lower token is caught per fill", () => {
        // The received dark bubble's links are #a5b4fc (6.3:1); --g-accent-text is lower on
        // some fill, which is why they stayed hex.
        expect(regressions("dark", "#a5b4fc", (r) => r.accentText).length).toBeGreaterThan(0);
        // And the light quote bars / sent code, whose brand-700 stop beats the token in the slate theme.
        expect(
            regressions("light", THEME_PRIMITIVES.slate.ramp[700], (r) => r.accentText).length
        ).toBeGreaterThan(0);
    });

    // ---- MIP-1317: the link roles -------------------------------------------------
    const BUBBLES = [
        ".bn-message-bubble-box-dark",
        ".bn-message-bubble-box-dark-me",
        ".task-comment-preview-dark",
    ];

    it("dark links: --g-link / -visited / -hover are not lower than the hex on any fill", () => {
        // Received bubble (#a5b4fc / #c4b5fd / #c7d2fe) and the sent bubble and comment
        // (#c7d2fe / #ddd6fe / #e0e7ff): the roles clear the stricter of the two.
        for (const [oldHex, role] of [
            ["#a5b4fc", (r: Roles) => r.link],
            ["#c7d2fe", (r: Roles) => r.link],
            ["#c4b5fd", (r: Roles) => r.linkVisited],
            ["#ddd6fe", (r: Roles) => r.linkVisited],
            ["#c7d2fe", (r: Roles) => r.linkHover],
            ["#e0e7ff", (r: Roles) => r.linkHover],
        ] as const) {
            expect(regressions("dark", oldHex, role), oldHex).toEqual([]);
        }
        for (const root of BUBBLES) {
            expect(rule(`${root} a`)).toMatch(/color:\s*var\(--g-link\)/);
            expect(rule(`${root} a:visited`)).toMatch(/color:\s*var\(--g-link-visited\)/);
            expect(rule(`${root} a:hover`)).toMatch(/color:\s*var\(--g-link-hover\)/);
        }
    });

    it("dark quotes: the bar is --g-link and the text --g-text-quote (were #a5b4fc / #818cf8 and #cbd5e1 / #c7d2fe)", () => {
        for (const oldHex of ["#a5b4fc", "#818cf8"]) {
            expect(
                regressions("dark", oldHex, (r) => r.link),
                oldHex
            ).toEqual([]);
        }
        for (const oldHex of ["#cbd5e1", "#c7d2fe"]) {
            expect(
                regressions("dark", oldHex, (r) => r.textQuote),
                oldHex
            ).toEqual([]);
        }
        for (const root of [...BUBBLES, ".inbox-preview-dark"]) {
            const body = rule(`${root} [data-content-type="quote"] blockquote`);
            expect(body).toMatch(/border-left-color:\s*var\(--g-link\)/);
            expect(body).toMatch(/(?:^|[;\s])color:\s*var\(--g-text-quote\)/);
        }
    });

    it("light quotes and the sent code: --g-link is not lower than the brand 700 stop on any fill", () => {
        expect(
            regressions(
                "light",
                (id) => THEME_PRIMITIVES[id].ramp[700],
                (r) => r.link
            )
        ).toEqual([]);
        for (const oldHex of ["#4b5563", "#4338ca"]) {
            expect(
                regressions("light", oldHex, (r) => r.textQuote),
                oldHex
            ).toEqual([]);
        }
        for (const root of [
            ".bn-message-bubble-box-light",
            ".bn-message-bubble-box-light-me",
            ".task-comment-preview-light",
            ".inbox-preview-light",
        ]) {
            const body = rule(`${root} [data-content-type="quote"] blockquote`);
            expect(body).toMatch(/border-left-color:\s*var\(--g-link\)/);
            expect(body).toMatch(/(?:^|[;\s])color:\s*var\(--g-text-quote\)/);
        }
        expect(rule(".bn-message-bubble-box-light-me code")).toMatch(
            /color:\s*var\(--g-text-code-sent\)/
        );
    });

    it("no bubble link or quote rule keeps a hex or brand variable", () => {
        for (const root of [...BUBBLES, ".inbox-preview-dark"]) {
            const quote = rule(`${root} [data-content-type="quote"] blockquote`);
            expect(quote).not.toMatch(/#[0-9a-f]{3,6}|--gp-/i);
        }
        for (const root of BUBBLES) {
            for (const suffix of [" a", " a:visited", " a:hover"]) {
                expect(rule(`${root}${suffix}`)).not.toMatch(/#[0-9a-f]{3,6}/i);
            }
        }
    });

    // ---- MIP-1388: the bubble code chips and the received dark body ----------------
    it("sent light bubble: code on --g-active (was the brand 700 stop on indigo .15, a lavender chip on every theme)", () => {
        expect(
            regressions(
                "light",
                (id) => THEME_PRIMITIVES[id].ramp[700],
                (r) => r.codeInkSent,
                { old: { hex: "#6366f1", a: 0.15 }, new: (r) => r.active }
            )
        ).toEqual([]);
        const body = rule(".bn-message-bubble-box-light-me code");
        expect(body).toMatch(/background-color:\s*var\(--g-active\)/);
        expect(body).toMatch(/color:\s*var\(--g-text-code-sent\)/);
        expect(body).not.toMatch(/rgba?\(|#[0-9a-f]{3,6}/i);
    });

    // ---- MIP-1454: light code ink holds 4.5:1 on its chip, on every fill ----------------
    /** Every (theme, fill) where `ink` over the `active` chip reads under `floor`. */
    const belowFloor = (mode: "light" | "dark", ink: (r: Roles) => string, floor: number) =>
        THEME_IDS.flatMap((id) => {
            const r = buildRoles(id, mode);
            return fillsOf(r).flatMap(([fill, f]) => {
                const ratio = contrast(ink(r), composite(r.active.hex, r.active.a, f));
                return ratio < floor ? [`${id}/${fill}: ${ratio.toFixed(2)}`] : [];
            });
        });

    it("light sent code (--g-text-code-sent) and light received code (--g-text-code) are 4.5:1 on every fill of every theme", () => {
        expect(belowFloor("light", (r) => r.codeInkSent, 4.5)).toEqual([]);
        expect(belowFloor("light", (r) => r.codeInk, 4.5)).toEqual([]);
        // The reason the sent role exists: the link role over the chip's wash is under 4.5.
        expect(belowFloor("light", (r) => r.link, 4.5).length).toBeGreaterThan(0);
    });

    it("light received code keeps the pink it had (was #be185d on black .08), darker only where a fill needs it", () => {
        expect(
            regressions("light", "#be185d", (r) => r.codeInk, {
                old: { hex: "#000000", a: 0.08 },
                new: (r) => r.active,
            })
        ).toEqual([]);
        expect(buildRoles("purple", "light").codeInk).toMatch(/^#(be185d|9d174d|831843)$/);
    });

    it("the light code rules in App.css ask for the roles, not for a hex", () => {
        for (const root of [".bn-message-bubble-box-light", ".task-comment-preview-light"]) {
            const body = rule(`${root} code`);
            expect(body).toMatch(/color:\s*var\(--g-text-code\)/);
            expect(body).toMatch(/background-color:\s*var\(--g-active\)/);
            expect(body).not.toMatch(/rgba?\(|#[0-9a-f]{3,6}/i);
        }
        expect(css).not.toMatch(/be185d/i);
    });

    it("received dark bubble: body text on --g-text (was #f3f4f6; the role was up to 0.65:1 lower until its dark lightness moved to 0.97)", () => {
        expect(regressions("dark", "#f3f4f6", (r) => r.text)).toEqual([]);
        expect(rule(".bn-message-bubble-box-dark .bn-editor")).toMatch(/color:\s*var\(--g-text\)/);
        // The bump is the only reason this passes: at the old lightness it fails.
        expect(
            THEME_IDS.some((id) => {
                const r = buildRoles(id, "dark");
                const old = oklchToHex(0.955, 0.006, hexToOklch(THEME_PRIMITIVES[id].ramp[600]).h);
                return fillsOf(r).some(([, f]) => contrast(old, f) < contrast("#f3f4f6", f));
            })
        ).toBe(true);
    });

    it("received dark bubble: code on --g-text-code over --g-active (was #fb923c on black .3)", () => {
        expect(
            regressions("dark", "#fb923c", (r) => r.codeInk, {
                old: { hex: "#000000", a: 0.3 },
                new: (r) => r.active,
            })
        ).toEqual([]);
        const body = rule(".bn-message-bubble-box-dark code");
        expect(body).toMatch(/color:\s*var\(--g-text-code\)/);
        expect(body).toMatch(/background-color:\s*var\(--g-active\)/);
        expect(body).not.toMatch(/rgba?\(|#[0-9a-f]{3,6}/i);
        // The warning ink the sent bubble uses would NOT have held it: that is why the role exists.
        expect(
            regressions("dark", "#fb923c", (r) => r.warning.text, {
                old: { hex: "#000000", a: 0.3 },
                new: (r) => r.active,
            }).length
        ).toBeGreaterThan(0);
    });

    it("inbox preview code: both modes use the code roles, no hex or rgba (MIP-1490)", () => {
        const css = src("App.css");
        const vars = css.slice(
            css.indexOf("--code-light-bg"),
            css.indexOf("}", css.indexOf("--code-light-bg"))
        );
        expect(vars).toMatch(/--code-dark-color:\s*var\(--g-text-code\)/);
        expect(vars).toMatch(/--code-dark-bg:\s*var\(--g-active\)/);
        expect(vars).not.toMatch(/#[0-9a-f]{3,6}|rgba?\(/i);
        expect(rule(".inbox-preview-dark code")).toMatch(/color:\s*var\(--code-dark-color\)/);
        expect(rule(".inbox-preview-light code")).toMatch(/color:\s*var\(--code-light-color\)/);
    });

    it("the roles are what the contrast rows promise on a spread of themes", () => {
        // Floors, not exact colors: link 9.5 (dark) / AA (light), quote text 9.5 / 7.
        for (const id of THEME_IDS) {
            for (const [mode, link, quote] of [
                ["dark", 9.5, 9.5],
                ["light", 4.5, 7],
            ] as const) {
                const r = buildRoles(id, mode);
                // A hover and a visited link are a different color from the link itself.
                expect(r.linkHover, `${id}/${mode} hover`).not.toBe(r.link);
                expect(r.linkVisited, `${id}/${mode} visited`).not.toBe(r.link);
                const fills = fillsOf(r).map(([, f]) => f);
                for (const f of fills) {
                    expect(contrast(r.link, f), `${id}/${mode} link`).toBeGreaterThanOrEqual(link);
                    expect(contrast(r.textQuote, f), `${id}/${mode} quote`).toBeGreaterThanOrEqual(
                        quote
                    );
                }
            }
        }
    });
});
