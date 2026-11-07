/**
 * MIP-1130: the answer's typography block reads roles, not values, so a Genos
 * answer, a thread Ask and a note Ask follow the theme and mode in CSS (the
 * same tokens as a chat message or a comment), with no `isDark` argument.
 */
import { describe, expect, it } from "vitest";

import { markdownAnswerSx } from "../features/agentQA/markdownAnswerSx";

const css = JSON.stringify(markdownAnswerSx());

describe("markdownAnswerSx", () => {
    it("contains no literal color and no legacy brand variable", () => {
        expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(css).not.toMatch(/rgba?\(\s*\d/);
        expect(css).not.toMatch(/--gp-/);
    });

    it("takes its colors from the token roles", () => {
        for (const role of ["--g-text)", "--g-accent-text)", "--g-hover)", "--g-border-strong)"]) {
            expect(css, role).toContain(`var(${role}`.replace(")", ""));
        }
    });

    it("uses only the three weights", () => {
        expect(css).not.toMatch(/"fontWeight":(700|800|900)/);
    });
});
