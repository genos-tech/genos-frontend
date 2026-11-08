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
import { THEME_IDS } from "../theme/themePalettes";
import { composite, contrast } from "../theme/tokens/color";
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

describe("the token palettes keep the contrast of the hex they replaced", () => {
    const fills = (id: (typeof THEME_IDS)[number], mode: "light" | "dark") => {
        const r = buildRoles(id, mode);
        const tints = [r.accentSubtle, r.success.subtle];
        return [r.bg, r.surface].flatMap((base) => [
            base,
            composite(r.hover.hex, r.hover.a, base),
            ...tints.map((t) => composite(t.hex, t.a, base)),
        ]);
    };
    const worst = (
        mode: "light" | "dark",
        fg: (r: ReturnType<typeof buildRoles>) => string,
        chip?: (r: ReturnType<typeof buildRoles>) => { hex: string; a: number }
    ) =>
        Math.min(
            ...THEME_IDS.flatMap((id) => {
                const r = buildRoles(id, mode);
                return fills(id, mode).map((f) => {
                    const c = chip ? composite(chip(r).hex, chip(r).a, f) : f;
                    return contrast(fg(r), c);
                });
            })
        );

    it("sent dark bubble and dark comment: body text on --g-text (was #e0e7ff)", () => {
        const old = worst("dark", () => "#e0e7ff");
        expect(worst("dark", (r) => r.text)).toBeGreaterThanOrEqual(old);
        expect(rule(".bn-message-bubble-box-dark-me .bn-editor")).toMatch(
            /color:\s*var\(--g-text\)/
        );
        expect(rule(".task-comment-preview-dark .bn-editor")).toMatch(/color:\s*var\(--g-text\)/);
    });

    it("sent dark bubble and dark comment: code on --g-warning-text over --g-active (was #fbbf24 on white .15)", () => {
        const old = worst(
            "dark",
            () => "#fbbf24",
            () => ({ hex: "#ffffff", a: 0.15 })
        );
        expect(
            worst(
                "dark",
                (r) => r.warning.text,
                (r) => r.active
            )
        ).toBeGreaterThanOrEqual(old);
        for (const root of [".bn-message-bubble-box-dark-me", ".task-comment-preview-dark"]) {
            const body = rule(`${root} code`);
            expect(body).toMatch(/color:\s*var\(--g-warning-text\)/);
            expect(body).toMatch(/background-color:\s*var\(--g-active\)/);
        }
    });

    it("received dark bubble quote rule: accent text (was #818cf8)", () => {
        const old = worst("dark", () => "#818cf8");
        expect(worst("dark", (r) => r.accentText)).toBeGreaterThanOrEqual(old);
        expect(rule('.bn-message-bubble-box-dark [data-content-type="quote"] blockquote')).toMatch(
            /border-left-color:\s*var\(--g-accent-text\)/
        );
    });

    it("sent light bubble: text on --g-text (was #1e1b4b), code in the accent wash (was brand-700 on indigo .15)", () => {
        expect(worst("light", (r) => r.text)).toBeGreaterThanOrEqual(
            worst("light", () => "#1e1b4b")
        );
        const body = rule(".bn-message-bubble-box-light-me .bn-editor");
        expect(body).toMatch(/color:\s*var\(--g-text\)/);
        // The brand ramp's 700 stop is the old text; per theme it is the ramp,
        // so the floor is the amber theme's 3.5:1 measured at the time.
        const codeFloor = 3.5;
        expect(
            worst(
                "light",
                (r) => r.accentText,
                (r) => r.accentSubtle
            )
        ).toBeGreaterThanOrEqual(codeFloor);
        const code = rule(".bn-message-bubble-box-light-me code");
        expect(code).toMatch(/color:\s*var\(--g-accent-text\)/);
        expect(code).toMatch(/background-color:\s*var\(--g-accent-subtle\)/);
    });

    it("light quote rules: the border is accent text (was the brand-700 stop, 4.18:1 at worst)", () => {
        expect(worst("light", (r) => r.accentText)).toBeGreaterThanOrEqual(4.18);
        for (const root of [
            ".bn-message-bubble-box-light",
            ".bn-message-bubble-box-light-me",
            ".task-comment-preview-light",
        ]) {
            expect(rule(`${root} [data-content-type="quote"] blockquote`)).toMatch(
                /border-left-color:\s*var\(--g-accent-text\)/
            );
        }
    });
});
