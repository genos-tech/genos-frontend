import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MobileSpotlightFab } from "../components/layout/MobileSpotlightFab";

let isMobileViewport = true;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));

// jsdom ships neither pointer capture nor a layout engine. Capture is a
// no-op here; the rect stub gives the grab-offset maths something real to
// subtract (a 38px button parked at the bottom-right of a 390x844 phone).
beforeEach(() => {
    isMobileViewport = true;
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.getBoundingClientRect = vi.fn(
        () => ({ bottom: 774, height: 38, left: 336, right: 374, top: 736, width: 38 }) as DOMRect
    );
    window.innerWidth = 390;
    window.innerHeight = 844;
});

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

const fab = () => screen.getByRole("button", { name: "Search" });

// Joy compiles `sx` to an emotion class, so the anchor never reaches
// `element.style`. Resolve it the way the browser would.
const anchorOf = (el: HTMLElement) => {
    const s = getComputedStyle(el);
    return { bottom: s.bottom, left: s.left, right: s.right, top: s.top };
};

const renderFab = (onOpenSpotlight = vi.fn()) => {
    render(
        <CssVarsProvider>
            <MobileSpotlightFab onOpenSpotlight={onOpenSpotlight} />
        </CssVarsProvider>
    );
    return onOpenSpotlight;
};

/** pointerdown → (optional move) → pointerup, as a touch would deliver it. */
const drag = (from: { x: number; y: number }, to?: { x: number; y: number }) => {
    const el = fab();
    fireEvent.pointerDown(el, { clientX: from.x, clientY: from.y, isPrimary: true, pointerId: 1 });
    if (to) {
        fireEvent.pointerMove(el, { clientX: to.x, clientY: to.y, isPrimary: true, pointerId: 1 });
    }
    const end = to ?? from;
    fireEvent.pointerUp(el, { clientX: end.x, clientY: end.y, isPrimary: true, pointerId: 1 });
    // The browser synthesises this after a touch sequence; the component
    // is what decides whether it counts.
    fireEvent.click(el);
};

describe("MobileSpotlightFab", () => {
    it("renders nothing on desktop", () => {
        isMobileViewport = false;
        renderFab();
        expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    });

    it("uses Spotlight's sparkle icon, matching the sidebar entry", () => {
        renderFab();
        expect(fab().querySelector('[data-testid="AutoAwesomeRoundedIcon"]')).not.toBeNull();
        expect(fab().querySelector('[data-testid="SearchRoundedIcon"]')).toBeNull();
    });

    it("opens Spotlight on a tap that never moves", () => {
        const onOpenSpotlight = renderFab();
        drag({ x: 355, y: 755 });
        expect(onOpenSpotlight).toHaveBeenCalledTimes(1);
    });

    it("still opens Spotlight after a sloppy tap inside the tolerance", () => {
        const onOpenSpotlight = renderFab();
        drag({ x: 355, y: 755 }, { x: 358, y: 758 });
        expect(onOpenSpotlight).toHaveBeenCalledTimes(1);
    });

    it("parks the button on the far side of a drag and does NOT open Spotlight", () => {
        const onOpenSpotlight = renderFab();

        // Bottom-right → upper-left.
        drag({ x: 355, y: 755 }, { x: 40, y: 300 });

        expect(onOpenSpotlight).not.toHaveBeenCalled();
        const stored = JSON.parse(localStorage.getItem("mobile:spotlightFabPosition") ?? "null");
        expect(stored.side).toBe("left");
        // Grab offset was 355-336 = 19 across, 755-736 = 19 down, so the
        // button's top-left lands at (21, 281).
        expect(stored.top).toBe(281);
        expect(anchorOf(fab())).toMatchObject({ left: "16px" });
        expect(anchorOf(fab())).toMatchObject({ top: "281px" });
    });

    it("opens Spotlight again on the tap AFTER a drag", () => {
        const onOpenSpotlight = renderFab();
        drag({ x: 355, y: 755 }, { x: 40, y: 300 });
        expect(onOpenSpotlight).not.toHaveBeenCalled();

        drag({ x: 30, y: 290 });
        expect(onOpenSpotlight).toHaveBeenCalledTimes(1);
    });

    it("restores a parked position on the next mount", () => {
        localStorage.setItem(
            "mobile:spotlightFabPosition",
            JSON.stringify({ side: "left", top: 240 })
        );
        renderFab();
        expect(anchorOf(fab())).toMatchObject({ left: "16px" });
        expect(anchorOf(fab())).toMatchObject({ top: "240px" });
    });

    it("pulls a restored position back on-screen when the viewport is shorter", () => {
        localStorage.setItem(
            "mobile:spotlightFabPosition",
            JSON.stringify({ side: "right", top: 800 })
        );
        window.innerHeight = 400;
        renderFab();
        // 400 - 60 (inset fallback) - 38 - 16 = 286.
        expect(anchorOf(fab())).toMatchObject({ top: "286px" });
    });
});
