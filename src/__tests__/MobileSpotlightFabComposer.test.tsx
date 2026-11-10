// MIP-1403: the floating "Open Genos" button must never sit on a composer's
// Send button. jsdom has no layout, so every box here is stubbed; the real
// 9-point elementFromPoint check is in genos-docs design/evidence/MIP-1403.md.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MobileSpotlightFab } from "../components/layout/MobileSpotlightFab";
import { FAB_AVOID_ATTR, fabLift } from "../components/layout/spotlightFabPosition";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => true }));

const box = (left: number, top: number, right: number, bottom: number) => ({
    left,
    top,
    right,
    bottom,
});

// A 390x844 phone: the FAB's default corner sits at x 336..374 (38px), 16px above the
// 60px tab bar, y 730..768; a one-line composer fills y 736..780 edge to edge.
const FAB_BASE = box(336, 730, 374, 768);
const COMPOSER = box(16, 700, 374, 780);

describe("fabLift", () => {
    it("does not move the button when no composer is around", () => {
        expect(fabLift(FAB_BASE, [])).toEqual({ lift: 0, hidden: false });
    });

    it("rises so its bottom edge sits one gap above the composer top", () => {
        const { lift, hidden } = fabLift(FAB_BASE, [COMPOSER]);
        expect(hidden).toBe(false);
        // base.bottom 768 - (composer.top 700 - 12 gap) = 80
        expect(lift).toBe(80);
        expect(FAB_BASE.bottom - lift).toBe(COMPOSER.top - 12);
    });

    it("stays put for a composer that is not under it", () => {
        // a composer in the left half only
        expect(fabLift(FAB_BASE, [box(0, 700, 200, 780)]).lift).toBe(0);
        // a composer wholly above the button, with room to spare
        expect(fabLift(FAB_BASE, [box(16, 400, 374, 600)]).lift).toBe(0);
    });

    it("rises for a composer closer than the gap, so it never touches", () => {
        // composer top 6px below the button's bottom edge: inside the 12px gap
        expect(fabLift(FAB_BASE, [box(16, 774, 374, 800)]).lift).toBeGreaterThan(0);
    });

    it("keeps rising past a second composer it lands on", () => {
        const { lift } = fabLift(FAB_BASE, [COMPOSER, box(16, 600, 374, 690)]);
        expect(FAB_BASE.bottom - lift).toBe(600 - 12);
    });

    it("steps aside when there is no room above the composer", () => {
        expect(fabLift(FAB_BASE, [box(16, 40, 374, 780)])).toEqual({ lift: 0, hidden: true });
    });
});

describe("MobileSpotlightFab above a composer", () => {
    let composerBox = COMPOSER;

    beforeEach(() => {
        composerBox = COMPOSER;
        window.innerWidth = 390;
        window.innerHeight = 844;
        // The twin (aria-hidden) is the button's unlifted spot; the composer is
        // whatever carries the attribute; anything else is empty.
        Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
            const b = this.hasAttribute(FAB_AVOID_ATTR)
                ? composerBox
                : this.getAttribute("aria-hidden") === "true"
                  ? FAB_BASE
                  : box(0, 0, 0, 0);
            return {
                ...b,
                x: b.left,
                y: b.top,
                width: b.right - b.left,
                height: b.bottom - b.top,
            } as DOMRect;
        });
    });

    afterEach(() => {
        document.body.innerHTML = "";
        localStorage.clear();
        vi.restoreAllMocks();
    });

    // By label, not role: a hidden button is out of the accessibility tree.
    const fab = () => screen.getByLabelText("Open Genos");
    const renderFab = () =>
        render(
            <CssVarsProvider>
                <MobileSpotlightFab onPress={vi.fn()} />
            </CssVarsProvider>
        );
    const addComposer = () => {
        const el = document.createElement("div");
        el.setAttribute(FAB_AVOID_ATTR, "composer");
        document.body.appendChild(el);
        return el;
    };

    it("rises above a composer that appears, and drops back when it goes", async () => {
        renderFab();
        expect(getComputedStyle(fab()).translate).toBe("0 0px");
        let composer!: HTMLElement;
        act(() => {
            composer = addComposer();
        });
        await waitFor(() => expect(getComputedStyle(fab()).translate).toBe("0 -80px"));
        act(() => composer.remove());
        await waitFor(() => expect(getComputedStyle(fab()).translate).toBe("0 0px"));
    });

    it("ignores a composer with no box (a kept-alive screen that is display: none)", async () => {
        composerBox = box(0, 0, 0, 0);
        renderFab();
        act(() => {
            addComposer();
        });
        await new Promise((r) => setTimeout(r, 60));
        expect(getComputedStyle(fab()).translate).toBe("0 0px");
    });

    it("hides, not sits on Send, when there is no room above the composer", async () => {
        composerBox = box(16, 40, 374, 780);
        renderFab();
        act(() => {
            addComposer();
        });
        await waitFor(() => expect(getComputedStyle(fab()).visibility).toBe("hidden"));
    });
});

describe("composers carry the marker", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = (rel: string) => readFileSync(join(here, "..", rel), "utf8");

    it("the attribute name the components write is the one the button reads", () => {
        expect(FAB_AVOID_ATTR).toBe("data-fab-avoid");
    });

    it.each([
        "components/editors/bnChatEditor.tsx",
        "components/editors/bnThreadEditor.tsx",
        "components/editors/bnTaskCommentEditor.tsx",
        "features/channel/components/MessageComposerV3.tsx",
    ])("%s marks its composer box", (file) => {
        expect(src(file)).toContain('data-fab-avoid="composer"');
    });
});
