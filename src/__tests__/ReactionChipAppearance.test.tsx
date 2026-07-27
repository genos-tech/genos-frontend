/**
 * The posted-reaction chip's appearance contract.
 *
 * Two things this pins down, both of which were real defects:
 *
 *  1. **It follows the color theme.** The chat bubble painted "I reacted"
 *     with Joy's `color="success"` — a green that ignored the brand ramp
 *     entirely and stayed green on every theme. The highlight now comes
 *     from `--gp-brand-*`, so it moves with the user's selected theme.
 *
 *  2. **Chat and task comments agree.** They rendered separate Joy chips
 *     that had drifted (`success` solid vs `neutral` solid), so the same
 *     reaction looked different depending on where you saw it. Both now
 *     render the same component.
 *
 * Styling itself isn't asserted colour-by-colour — jsdom doesn't resolve
 * `var()`, and pinning exact rgba strings would just re-encode the
 * implementation. What's asserted is the part that carries meaning: which
 * chips claim the pressed state, and that the highlight is expressed in
 * brand variables rather than a hardcoded palette.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReactionChip } from "../components/ui/emoji/ReactionChip";

const renderChip = (props: Partial<Parameters<typeof ReactionChip>[0]> = {}) =>
    render(
        <CssVarsProvider>
            <ReactionChip
                count={3}
                emoji="👍"
                mine={false}
                onClick={vi.fn()}
                {...(props as Record<string, unknown>)}
            />
        </CssVarsProvider>
    );

describe("ReactionChip", () => {
    it("is a toggle button that reports whether the reaction is mine", () => {
        const theirs = renderChip({ mine: false });
        const a = theirs.container.querySelector("button")!;
        expect(a.tagName).toBe("BUTTON");
        // A reaction chip toggles YOUR reaction on and off — `aria-pressed`
        // is what makes the highlighted styling mean something to a screen
        // reader instead of being colour-only.
        expect(a.getAttribute("aria-pressed")).toBe("false");

        const mine = renderChip({ mine: true });
        expect(mine.container.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");
    });

    it("renders the emoji and its count", () => {
        const { container } = renderChip({ count: 12, emoji: "🎉" });
        expect(container.querySelector("button")!.textContent).toBe("🎉12");
    });

    it("does not submit the form it may sit inside", () => {
        // Task comments render inside editors/forms; a chip defaulting to
        // type="submit" would post the form on every reaction toggle.
        const { container } = renderChip();
        expect(container.querySelector("button")!.getAttribute("type")).toBe("button");
    });

    it("draws the mine-highlight from brand variables, not a fixed palette", () => {
        const { container } = renderChip({ mine: true });
        const style = container.querySelector("button")!.getAttribute("style") ?? "";
        const css = document.head.innerHTML + style;
        // The point of the change: theme-driven, not Joy's green `success`.
        expect(css).toContain("--gp-brand-700-rgb");
    });

    it("keeps both states the same height so the row doesn't reflow on toggle", () => {
        const mine = renderChip({ mine: true }).container.querySelector("button")!;
        const theirs = renderChip({ mine: false }).container.querySelector("button")!;
        const h = (el: Element) => getComputedStyle(el).height;
        expect(h(mine)).toBe(h(theirs));
    });

    it("fires onClick when pressed", () => {
        const onClick = vi.fn();
        const { container } = renderChip({ onClick });
        container.querySelector("button")!.click();
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
