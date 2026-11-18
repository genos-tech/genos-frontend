import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MobileSpotlightFab } from "../components/layout/MobileSpotlightFab";
import { FAB_CLEARANCE, FAB_CLEARANCE_VAR } from "../components/layout/spotlightFabPosition";

let isMobileViewport = true;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));

// jsdom ships neither pointer capture nor a layout engine. Capture is a
// no-op here; the rect stub gives the grab-offset maths something real to
// subtract (a 38px button parked at the bottom-right of a 390x844 phone).
// The height of the status bar the app is drawn under (`--app-top-inset`, MIP-1665). The button
// measures it with a probe box, which is the one element here whose height is that variable.
let statusBarHeight = 0;
// The height of the bottom inset the button measures (`--mobile-bottom-inset`): the tab bar's 60 px.
let bottomInsetHeight = 60;

beforeEach(() => {
    isMobileViewport = true;
    statusBarHeight = 0;
    bottomInsetHeight = 60;
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
        if ((this as HTMLElement).style?.height.includes("--app-top-inset")) {
            return { bottom: statusBarHeight, height: statusBarHeight, top: 0 } as DOMRect;
        }
        // The bottom inset probe (`--mobile-bottom-inset`, MIP-1680): the tab bar's 60 px unless a
        // test sets another (a home indicator, the keyboard).
        if ((this as HTMLElement).style?.height.includes("--mobile-bottom-inset")) {
            return { bottom: bottomInsetHeight, height: bottomInsetHeight, top: 0 } as DOMRect;
        }
        return { bottom: 774, height: 38, left: 336, right: 374, top: 736, width: 38 } as DOMRect;
    });
    window.innerWidth = 390;
    window.innerHeight = 844;
});

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

const fab = () => screen.getByRole("button", { name: "Open Genos" });

// Joy compiles `sx` to an emotion class, so the anchor never reaches
// `element.style`. Resolve it the way the browser would.
const anchorOf = (el: HTMLElement) => {
    const s = getComputedStyle(el);
    return { bottom: s.bottom, left: s.left, right: s.right, top: s.top };
};

const renderFab = (onPress = vi.fn()) => {
    render(
        <CssVarsProvider>
            <MobileSpotlightFab onPress={onPress} />
        </CssVarsProvider>
    );
    return onPress;
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
    // MIP-1404: lists that scroll under the button read this variable to leave
    // room after their last row, so it must exist only while the button does.
    it("publishes the list clearance while shown and removes it with the button", () => {
        const root = document.documentElement;
        const { unmount } = render(
            <CssVarsProvider>
                <MobileSpotlightFab onPress={vi.fn()} />
            </CssVarsProvider>
        );
        expect(root.style.getPropertyValue(FAB_CLEARANCE_VAR)).toBe(`${FAB_CLEARANCE}px`);
        unmount();
        expect(root.style.getPropertyValue(FAB_CLEARANCE_VAR)).toBe("");
    });

    it("publishes no clearance on desktop, where the button is not shown", () => {
        isMobileViewport = false;
        renderFab();
        expect(document.documentElement.style.getPropertyValue(FAB_CLEARANCE_VAR)).toBe("");
    });

    it("renders nothing on desktop", () => {
        isMobileViewport = false;
        renderFab();
        expect(screen.queryByRole("button", { name: "Open Genos" })).toBeNull();
    });

    it("uses Spotlight's sparkle icon, matching the sidebar entry", () => {
        renderFab();
        expect(fab().querySelector('[data-testid="AutoAwesomeRoundedIcon"]')).not.toBeNull();
        expect(fab().querySelector('[data-testid="SearchRoundedIcon"]')).toBeNull();
    });

    it("opens Spotlight on a tap that never moves", () => {
        const onPress = renderFab();
        drag({ x: 355, y: 755 });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("still opens Spotlight after a sloppy tap inside the tolerance", () => {
        const onPress = renderFab();
        drag({ x: 355, y: 755 }, { x: 358, y: 758 });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("parks the button on the far side of a drag and does NOT open Spotlight", () => {
        const onPress = renderFab();

        // Bottom-right → upper-left.
        drag({ x: 355, y: 755 }, { x: 40, y: 300 });

        expect(onPress).not.toHaveBeenCalled();
        const stored = JSON.parse(localStorage.getItem("mobile:spotlightFabPosition") ?? "null");
        expect(stored.side).toBe("left");
        // Grab offset was 355-336 = 19 across, 755-736 = 19 down, so the
        // button's top-left lands at (21, 281).
        expect(stored.top).toBe(281);
        expect(anchorOf(fab())).toMatchObject({ left: "16px" });
        expect(anchorOf(fab())).toMatchObject({ top: "281px" });
    });

    it("opens Spotlight again on the tap AFTER a drag", () => {
        const onPress = renderFab();
        drag({ x: 355, y: 755 }, { x: 40, y: 300 });
        expect(onPress).not.toHaveBeenCalled();

        drag({ x: 30, y: 290 });
        expect(onPress).toHaveBeenCalledTimes(1);
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

    // MIP-1665: an installed iPhone app is drawn under its status bar; the button cannot be seen
    // or touched there.
    it("is not dropped under the status bar", () => {
        statusBarHeight = 62;
        renderFab();
        // Pointer at y=20, grab offset 19: the button's top would be 1.
        drag({ x: 355, y: 755 }, { x: 40, y: 20 });
        const stored = JSON.parse(localStorage.getItem("mobile:spotlightFabPosition") ?? "null");
        expect(stored.top).toBe(62 + 16);
        expect(anchorOf(fab())).toMatchObject({ top: "78px" });
    });

    it("is pulled out from under the status bar when a parked position is restored", () => {
        statusBarHeight = 62;
        localStorage.setItem(
            "mobile:spotlightFabPosition",
            JSON.stringify({ side: "left", top: 10 })
        );
        renderFab();
        expect(anchorOf(fab())).toMatchObject({ top: "78px" });
    });

    // MIP-1680: `--mobile-bottom-inset` is read as a LENGTH (a box of that height is measured), not
    // as text: its text (`max(calc(60px + 34px), 0px)`) is not a number, so the bottom limit used to
    // be the 60 px fallback whatever the phone had under the button.
    it("is not dropped onto the home indicator: the tab bar's 60 px plus the 34 px strip", () => {
        bottomInsetHeight = 94;
        renderFab();
        drag({ x: 355, y: 755 }, { x: 355, y: 830 });
        const stored = JSON.parse(localStorage.getItem("mobile:spotlightFabPosition") ?? "null");
        // 844 - 94 - 44 (the button) - 16 (the gap) = 690; with the 60 px fallback it was 724.
        expect(stored.top).toBe(690);
        expect(anchorOf(fab())).toMatchObject({ top: "690px" });
    });

    it("keeps clear of the keyboard when it is up", () => {
        bottomInsetHeight = 336;
        localStorage.setItem(
            "mobile:spotlightFabPosition",
            JSON.stringify({ side: "right", top: 700 })
        );
        renderFab();
        // 844 - 336 - 44 - 16 = 448
        expect(anchorOf(fab())).toMatchObject({ top: "448px" });
    });

    it("uses the 60 px of the tab bar when nothing says otherwise", () => {
        renderFab();
        drag({ x: 355, y: 755 }, { x: 355, y: 830 });
        const stored = JSON.parse(localStorage.getItem("mobile:spotlightFabPosition") ?? "null");
        expect(stored.top).toBe(724);
    });

    it("measures the variable itself, with 60 px for when it is unset", () => {
        const probes: string[] = [];
        const original = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
            probes.push((this as HTMLElement).style?.height ?? "");
            return original.call(this);
        });
        renderFab();
        drag({ x: 355, y: 755 }, { x: 355, y: 830 });
        expect(probes).toContain("var(--mobile-bottom-inset, 60px)");
    });

    it("pulls a restored position back on-screen when the viewport is shorter", () => {
        localStorage.setItem(
            "mobile:spotlightFabPosition",
            JSON.stringify({ side: "right", top: 800 })
        );
        window.innerHeight = 400;
        renderFab();
        // 400 - 60 (inset fallback) - 44 - 16 = 280.
        expect(anchorOf(fab())).toMatchObject({ top: "280px" });
    });
});
