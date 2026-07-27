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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppTooltip } from "../components/ui/AppTooltip";
import { MoreReactionsChip, ReactionChip } from "../components/ui/emoji/ReactionChip";

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

/**
 * Every chip is wrapped in `AppTooltip` (the "X and Y reacted" hover), and
 * Joy's Tooltip works by CLONING its child to inject a ref, hover/focus
 * listeners and a11y attributes. That interaction produced two regressions
 * in a row, neither of which threw and neither of which the tests above
 * could see — so it gets its own coverage, exercised through a real
 * `AppTooltip` rather than by asserting the props in isolation.
 *
 *  1. The chip didn't forward a ref or spread the injected props, so the
 *     tooltip never appeared anywhere in the app.
 *  2. Fixing that by spreading naively clobbered `component="button"` —
 *     Joy injects `component: undefined`, so the chip silently degraded to
 *     a <div>: no button role, no keyboard activation.
 */
describe("chips inside AppTooltip", () => {
    const renderTipped = () =>
        render(
            <CssVarsProvider>
                <AppTooltip title="Alice and Bob reacted">
                    <ReactionChip count={2} emoji="👍" mine onClick={vi.fn()} />
                </AppTooltip>
            </CssVarsProvider>
        );

    it("shows the senders tooltip on hover", async () => {
        renderTipped();
        fireEvent.mouseOver(screen.getByRole("button"));
        await waitFor(() => expect(screen.getByText("Alice and Bob reacted")).toBeInTheDocument());
    });

    it("is still a real <button> once Tooltip has cloned it", () => {
        const { container } = renderTipped();
        // Joy injects `component: undefined`; if that wins, this is a div.
        const el = container.querySelector("[aria-pressed]")!;
        expect(el.tagName).toBe("BUTTON");
        expect(el.getAttribute("type")).toBe("button");
        expect(el.getAttribute("aria-pressed")).toBe("true");
    });

    it("still toggles when clicked through the tooltip wrapper", () => {
        const onClick = vi.fn();
        render(
            <CssVarsProvider>
                <AppTooltip title="Alice reacted">
                    <ReactionChip count={1} emoji="👍" mine onClick={onClick} />
                </AppTooltip>
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button"));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("shows the overflow tooltip on the +N more chip too", async () => {
        render(
            <CssVarsProvider>
                <AppTooltip title="🎉 4 🚀 2">
                    <MoreReactionsChip text="+2 more" />
                </AppTooltip>
            </CssVarsProvider>
        );

        fireEvent.mouseOver(screen.getByText("+2 more"));
        await waitFor(() => expect(screen.getByText("🎉 4 🚀 2")).toBeInTheDocument());
    });
});
