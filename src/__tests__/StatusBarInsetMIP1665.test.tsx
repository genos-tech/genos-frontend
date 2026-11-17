/**
 * MIP-1665: on an installed iPhone app the page is drawn under the status bar.
 *
 * `index.html` sets `viewport-fit=cover`, so the page runs edge to edge and the top 47 to 62 px of
 * it is the clock and the Dynamic Island. Nothing reserved that strip, so the header of every
 * page (Back, filters, search, "More options") sat under it and could not be seen or pressed.
 *
 * The strip is reserved once, for the whole shell (`--app-top-inset` on the body, taken off
 * `--app-vh`), and by each fixed surface that starts at the top edge, because a fixed surface is
 * outside the body's padding. jsdom has no `env()` and no layout, so these pin the contract that
 * makes it true (which rule, which variable); the real measurement was taken in a browser with the
 * inset emulated (see the pull request).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cssOf } from "./utils/cssOf";

import { MobileOverlay } from "../components/layout/MobileOverlay";
import { ModalFrame } from "../components/ui/modal/ModalFrame";
import {
    PERMISSION_BANNER_HEIGHT,
    PERMISSION_BANNER_HEIGHT_CSS,
    PermissionBanner,
} from "../services/notifications/PermissionBanner";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) =>
    read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

afterEach(() => {
    cleanup();
    sessionStorage.clear();
    document.documentElement.style.removeProperty("--app-banner-h");
});

describe("the shell reserves the status bar once", () => {
    const css = read("index.css");

    it("defines the strip as the safe-area inset, 0 where there is none", () => {
        expect(css).toMatch(/--app-top-inset:\s*env\(safe-area-inset-top, 0px\);/);
    });

    it("pads the body by it, so every page starts below the status bar", () => {
        const body = css.match(/\n {4}body \{[\s\S]*?\n {4}\}/);
        expect(body, "the body rule").not.toBeNull();
        expect(body![0]).toMatch(/padding-top:\s*var\(--app-top-inset\);/);
    });

    it("takes it off the height every full-height surface fills, with the banner", () => {
        // Else the page would be taller than the screen by the strip, and the document would scroll.
        expect(css).toMatch(
            /--app-vh:\s*calc\(100dvh - var\(--app-top-inset\) - var\(--app-banner-h, 0px\)\)/
        );
    });
});

describe("the notification banner no longer pads for the status bar itself", () => {
    // It used to add the inset to its own height, which was right while nothing else did: a page
    // with no banner (anyone who had answered the prompt) had no padding at all. Now the body pads,
    // and a banner that padded again would be a second strip.
    it("is its own 44px tall, and reserves that much", () => {
        expect(PERMISSION_BANNER_HEIGHT_CSS).toBe(`${PERMISSION_BANNER_HEIGHT}px`);
        render(
            <CssVarsProvider>
                <PermissionBanner
                    permission="default"
                    requestPermission={async () => "granted"}
                    masterEnabled
                />
            </CssVarsProvider>
        );
        expect(document.documentElement.style.getPropertyValue("--app-banner-h")).toBe("44px");
        expect(screen.getByTestId("permission-banner")).toBeTruthy();
    });

    it("has no safe-area padding in its source", () => {
        expect(code("services/notifications/PermissionBanner.tsx")).not.toContain(
            "safe-area-inset-top"
        );
    });
});

describe("a page shown instead of the shell fills what the body's padding leaves", () => {
    // The sign-in pages, the too-small screen, the splash and the landing page do not use
    // `--app-vh`: each was a bare viewport height, which plus the body's padding made the page
    // scroll by the status bar's height.
    it.each([
        [
            "features/admin/components/AuthShell.tsx",
            'minHeight: "calc(100dvh - var(--app-top-inset))"',
        ],
        ["components/layout/TooSmallScreen.tsx", 'height: "calc(100dvh - var(--app-top-inset))"'],
        ["components/ui/misc/InitialLoad.tsx", 'height: "calc(100vh - var(--app-top-inset))"'],
    ])("%s", (rel, expected) => {
        expect(code(rel)).toContain(expected);
    });

    it("the landing page's root", () => {
        expect(read("lp/kit/lp.css")).toMatch(
            /\.lp-root \{[^}]*min-height: calc\(100vh - var\(--app-top-inset, 0px\)\);/
        );
    });
});

describe("a fixed full-screen surface starts below the status bar", () => {
    it("the task / note / chat overlay shell pads its top", () => {
        render(
            <CssVarsProvider>
                <MobileOverlay onClose={() => undefined}>
                    <div />
                </MobileOverlay>
            </CssVarsProvider>
        );
        const shell = screen.getByTestId("mobile-overlay-body").parentElement as HTMLElement;
        expect(cssOf(shell)).toMatch(/padding-top:\s*var\(--app-top-inset\)/);
    });

    it("a dialog that is the whole screen on a phone starts its header below it", () => {
        render(
            <CssVarsProvider>
                <ModalFrame title="Heading" fullScreenOnMobile open onClose={() => undefined}>
                    body
                </ModalFrame>
            </CssVarsProvider>
        );
        const header = screen.getByRole("heading", { name: "Heading" }).parentElement
            ?.parentElement as HTMLElement;
        expect(cssOf(header)).toMatch(/padding-top:\s*calc\(20px \+ var\(--app-top-inset\)\)/);
    });

    it("a centred dialog keeps the same room above as below, status bar included", () => {
        render(
            <CssVarsProvider>
                <ModalFrame title="Heading" open onClose={() => undefined}>
                    body
                </ModalFrame>
            </CssVarsProvider>
        );
        const dialog = screen.getByRole("dialog");
        // Twice: it is centred, so what is taken off the top is taken off the bottom as well.
        expect(cssOf(dialog)).toMatch(
            /max-height:\s*calc\(100dvh - 32px - 2 \* var\(--app-top-inset\)\)/
        );
    });

    it("the same for a dialog that clears the tab bar", () => {
        render(
            <CssVarsProvider>
                <ModalFrame title="Heading" clearBottomBar open onClose={() => undefined}>
                    body
                </ModalFrame>
            </CssVarsProvider>
        );
        expect(cssOf(screen.getByRole("dialog"))).toMatch(
            /max-height:\s*calc\(100dvh - max\(var\(--mobile-bottom-inset, 60px\) \+ 24px, 2 \* var\(--app-top-inset\) \+ 24px\)\)/
        );
    });

    // Mounting these two needs a whole workspace (a task, a chat, a socket), so the rule is
    // pinned in the source, like the other layout pins in this folder.
    it("the task-link preview (full screen on a phone) pads its top and moves its ✕ down", () => {
        const src = code("components/modals/UrlLinkModal.tsx");
        expect(src).toMatch(/paddingTop: "var\(--app-top-inset\)"/);
        expect(src).toContain("calc(${MODAL_CHROME_EDGE}px + var(--app-top-inset))");
        // Both corner buttons use it, not the bare edge.
        expect(src.match(/top: chromeTop,/g)).toHaveLength(2);
        expect(src).not.toMatch(/top: MODAL_CHROME_EDGE,/);
        // The centred card keeps room for it too.
        expect(src).toContain("calc(100dvh - 24px - 2 * var(--app-top-inset))");
    });

    it("the chat page's own overlay shell pads its top and moves its Close down", () => {
        const src = code("features/chat/MobileChatHome.tsx");
        expect(src).toMatch(/paddingTop: "var\(--app-top-inset\)"/);
        expect(src).toContain('top: "calc(8px + var(--app-top-inset))"');
    });
});
