/**
 * MIP-1316: the Spotlight result row asks for roles, not for the mode.
 *
 * `SpotlightResultItem` was the last Spotlight file that read `purplePalette` and branched on
 * `isDark`, painted its icon tiles with eight gradients and carried 12 literal colors, seven
 * `--gp-brand` references and two weight-700 literals. jsdom cannot compute a color, so the
 * source is pinned (the same approach as `SpotlightLeftoversTokens`) and the row is rendered to
 * read the roles it resolves to.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    CHAT_PALETTE,
    MILESTONE_PALETTE,
    TASK_PALETTE,
} from "../components/editors/mentionPalettes";
import { SpotlightResultItem } from "../features/spotlight/SpotlightResultItem";
import type { SpotlightResult } from "../features/spotlight/types";
import { hexToRgb } from "../theme/tokens/color";

// jsdom serializes a hex color as rgb().
const rgb = (hex: string): string => `rgb(${hexToRgb(hex).join(", ")})`;

const FILE = "features/spotlight/SpotlightResultItem.tsx";
const code = readFileSync(join(__dirname, "..", FILE), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the result row source", () => {
    it("has no mode branching, no gradient, no literal color, no brand var and no heavy weight", () => {
        expect(code).not.toMatch(/\bisDark\b/);
        expect(code).not.toMatch(/useColorScheme|purplePalette/);
        expect(code).not.toMatch(/-gradient/);
        expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(code).not.toMatch(/rgba?\(\s*\d/);
        expect(code).not.toMatch(/--gp-brand/);
        expect(code).not.toMatch(/fontWeight:\s*(700|800|900|"bold")/);
    });

    it("takes the entity identity colors from the shared mention palettes", () => {
        expect(code).toMatch(/from "\.\.\/\.\.\/components\/editors\/mentionPalettes"/);
    });
});

const row = (over: Partial<SpotlightResult> = {}): SpotlightResult =>
    ({
        entity_type: "task",
        entity_id: "task:1",
        title: "Ship the search filter",
        snippet: null,
        score: 1,
        keyword_rank: 1,
        vector_rank: null,
        matched_chunk_types: ["task_title_body"],
        matched_terms: [],
        updated_at: null,
        chat_type: null,
        chat_id: null,
        thread_id: null,
        message_id: null,
        task_id: "1",
        ...over,
    }) as SpotlightResult;

const renderRow = (over: Partial<SpotlightResult>, isHighlighted = false) =>
    render(
        <CssVarsProvider>
            <SpotlightResultItem
                isHighlighted={isHighlighted}
                query=""
                result={row(over)}
                onSelect={() => {}}
            />
        </CssVarsProvider>
    );

describe("the result row", () => {
    it("is clear at rest and wears the accent wash when it is the selected one", () => {
        const { unmount } = renderRow({});
        const rest = screen.getByRole("button");
        expect(getComputedStyle(rest).background).not.toBe("var(--g-accent-subtle)");
        unmount();
        renderRow({}, true);
        expect(getComputedStyle(screen.getByRole("button")).background).toBe(
            "var(--g-accent-subtle)"
        );
    });

    it("follows the density row height as a floor", () => {
        renderRow({});
        const style = getComputedStyle(screen.getByRole("button"));
        expect(style.minHeight).toBe("var(--g-row)");
    });

    it.each([
        ["task", rgb(TASK_PALETTE.text)],
        ["milestone", rgb(MILESTONE_PALETTE.text)],
        ["chat", rgb(CHAT_PALETTE.text)],
        // The violet kinds resolve to the brand var in their palette: they take the accent role.
        ["note", "var(--g-accent)"],
        ["note_folder", "var(--g-accent)"],
        // A past answer is a Genos moment.
        ["spotlight_answer", "var(--g-brand-gradient)"],
    ] as const)("the %s icon tile is its identity hue as one flat fill", (entity_type, fill) => {
        renderRow({ entity_type });
        const tile = screen.getByRole("button").firstElementChild as HTMLElement;
        expect(getComputedStyle(tile).background).toBe(fill);
    });
});
