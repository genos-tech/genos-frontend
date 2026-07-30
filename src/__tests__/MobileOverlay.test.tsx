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

    it("reserves the bottom strip so the pane clears the tab bar and keyboard", () => {
        renderOverlay();
        const overlay = screen.getByTestId("mobile-overlay-body").parentElement as HTMLElement;
        expect(getComputedStyle(overlay).paddingBottom).toBe("var(--mobile-bottom-inset, 60px)");
    });
});
