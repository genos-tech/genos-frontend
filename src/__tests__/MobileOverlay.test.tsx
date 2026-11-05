import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileOverlay } from "../components/layout/MobileOverlay";

const renderOverlay = (onClose = vi.fn()) => {
    render(
        <CssVarsProvider>
            <MobileOverlay onClose={onClose}>
                <div data-testid="pane">pane</div>
            </MobileOverlay>
        </CssVarsProvider>
    );
    return onClose;
};

/**
 * These assert the two structural properties that give the pane the full
 * screen height. jsdom has no layout engine, so nothing here measures
 * pixels — but both properties are media-query-independent, so they hold
 * in jsdom exactly as they do in a browser.
 */
describe("MobileOverlay", () => {
    it("closes when the header button is tapped", () => {
        const onClose = renderOverlay();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps Close in flow so content can never render over or under it", () => {
        renderOverlay();
        // The old shell positioned this absolutely over the content, which
        // is why the body needed a 40px spacer to stay clear of it.
        expect(getComputedStyle(screen.getByRole("button", { name: "Close" })).position).not.toBe(
            "absolute"
        );
    });

    it("hands the pane a bare flex column — no padding, no scroller of its own", () => {
        renderOverlay();
        const body = screen.getByTestId("mobile-overlay-body");
        const style = getComputedStyle(body);
        // A scroller here would stack with the pane's own (the task
        // preview's Sheet owns `overflowY: auto`), which is what left the
        // preview a short card in a tall empty overlay.
        expect(style.overflow).not.toBe("auto");
        expect(style.display).toBe("flex");
        expect(style.flexDirection).toBe("column");
        // No `pt: 5` (40px) spacer: the header row reserves that space
        // now, so the pane starts at the very top of its slot.
        expect(style.paddingTop === "" || style.paddingTop === "0").toBe(true);
        expect(body).toContainElement(screen.getByTestId("pane"));
    });

    it("runs to the bottom edge: it leaves the home indicator and keyboard free, not a tab-bar band", () => {
        renderOverlay();
        const overlay = screen.getByTestId("mobile-overlay-body").parentElement as HTMLElement;
        const padding = getComputedStyle(overlay).paddingBottom;
        // The overlay is z-index 1300 and the tab bar 1200, so it paints over
        // the bar: reserving the bar's height (`--mobile-bottom-inset`) left a
        // 60px band of empty gradient under every pane.
        expect(padding).not.toContain("--mobile-bottom-inset");
        expect(padding).not.toContain("60px");
        // What it does reserve: the home indicator, and the keyboard when it is
        // up (iOS doesn't resize the layout viewport).
        expect(padding).toBe("max(env(safe-area-inset-bottom, 0px), var(--keyboard-inset, 0px))");
    });

    it("keeps the Close row to a single compact strip", () => {
        renderOverlay();
        const strip = screen.getByRole("button", { name: "Close" }).parentElement as HTMLElement;
        // 2px of padding top and bottom (theme spacing 0.25), around the 32px button.
        expect(getComputedStyle(strip).paddingTop).toBe("2px");
        expect(getComputedStyle(strip).paddingBottom).toBe("2px");
    });
});
