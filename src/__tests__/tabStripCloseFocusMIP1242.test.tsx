/**
 * MIP-1242: a tab's "Close <title>" button is hidden (clipped) so the tablist owns only tabs, but a
 * touch screen reader (iOS VoiceOver has no Delete key) reaches it by swiping, and it used to be an
 * EMPTY button parked at a pixel: the cursor landed on nothing visible. It now has its text, and when
 * it takes focus it is unclipped and drawn as a labelled button. jsdom has no layout: this reads the
 * DOM and the CSS the component emits; the pixels were measured in Chromium (see the PR).
 */
import { CssVarsProvider } from "@mui/joy";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TabStrip } from "../components/ui/feedback/TabStrip";

afterEach(cleanup);

const allCss = () =>
    Array.from(document.querySelectorAll("style"))
        .map((s) => s.textContent ?? "")
        .join("\n");

/** The declarations of every rule whose selector carries one of the element's Emotion classes. */
const rulesOf = (el: Element, pseudo = "") => {
    const css = allCss();
    const out: string[] = [];
    for (const cls of Array.from(el.classList).filter((c) => c.startsWith("css-"))) {
        const re = new RegExp(`\\.${cls}${pseudo.replace(":", "\\:")}\\{([^}]*)\\}`, "g");
        for (const m of css.matchAll(re)) out.push(m[1]);
    }
    return out.join(";");
};

describe("a tab's hidden Close button is visible when a screen reader lands on it", () => {
    const mount = (onClose = vi.fn()) => {
        render(
            <CssVarsProvider>
                <TabStrip
                    ariaLabel="Open notes"
                    closeLabel="Close tab"
                    value="a"
                    tabs={[
                        { id: "a", label: "Plan", title: "Plan", closable: true },
                        { id: "b", label: "Retro", title: "Retro", closable: true },
                    ]}
                    onChange={() => {}}
                    onClose={onClose}
                />
            </CssVarsProvider>
        );
        return onClose;
    };

    it("has its name as visible text, not an empty button", () => {
        mount();
        const button = screen.getByRole("button", { name: "Close tab: Retro" });
        expect(button.textContent).toBe("Close tab: Retro");
    });

    it("is clipped at rest and unclipped, in place, on :focus", () => {
        mount();
        const button = screen.getByRole("button", { name: "Close tab: Plan" });
        const rest = rulesOf(button);
        expect(rest).toMatch(/clip:rect\(0 0 0 0\)/);
        expect(rest).toMatch(/width:1px/);
        const focused = rulesOf(button, ":focus");
        expect(focused).toMatch(/clip:auto/);
        expect(focused).toMatch(/width:auto/);
        expect(focused).toMatch(/height:100%/);
        // Pointer events stay off at rest, so the pixel never steals a click from a tab.
        expect(rest).toMatch(/pointer-events:none/);
        expect(focused).toMatch(/pointer-events:auto/);
    });

    it("still closes the tab and stays out of the tablist", () => {
        const onClose = mount();
        const tablist = screen.getByRole("tablist");
        const button = screen.getByRole("button", { name: "Close tab: Plan" });
        expect(tablist.contains(button)).toBe(false);
        fireEvent.click(button);
        expect(onClose).toHaveBeenCalledWith("a");
    });
});
