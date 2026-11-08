/**
 * MIP-1134 (part of MIP-1106): the app shell's chrome.
 *
 *  - The notification banner is a row in the layout, not a card over the page's
 *    toolbar, and it reserves exactly its own height (`--app-banner-h`, which
 *    `--app-vh` subtracts) so the document never scrolls.
 *  - The mobile tab bar is real buttons on the rail's tokens, flat.
 *  - The service switcher overlay is an opaque raised card on tokens.
 *  - No sidebar or page carries a decorative tagline footer.
 *
 * jsdom cannot measure layout: the "banner does not push the page off screen"
 * half is checked in a real browser (`design/evidence/MIP-1134.md`); here the
 * contract that makes it true is pinned (the variable, who reads it).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { BottomTabBar } from "../components/layout/BottomTabBar";
import { ServiceSwitcherOverlay } from "../components/layout/ServiceSwitcherOverlay";
import {
    PERMISSION_BANNER_HEIGHT,
    PermissionBanner,
} from "../services/notifications/PermissionBanner";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => true }));

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) =>
    read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

const BANNER_VAR = "--app-banner-h";

const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (name === "__tests__") continue;
            walk(full, out);
        } else if (/\.(ts|tsx)$/.test(name)) out.push(full);
    }
    return out;
};

afterEach(() => {
    cleanup();
    sessionStorage.clear();
    document.documentElement.style.removeProperty(BANNER_VAR);
});

const mountBanner = (over: Partial<Parameters<typeof PermissionBanner>[0]> = {}) =>
    render(
        <CssVarsProvider>
            <PermissionBanner
                masterEnabled
                permission="default"
                requestPermission={async () => "granted"}
                {...over}
            />
        </CssVarsProvider>
    );

const bannerVar = () => document.documentElement.style.getPropertyValue(BANNER_VAR);

describe("the notification banner is in the layout", () => {
    it("is not fixed or floating, and has no layer, gradient or shadow of its own", () => {
        mountBanner();
        const css = cssOf(screen.getByTestId("permission-banner")).toLowerCase();
        expect(css).not.toMatch(/position:\s*(fixed|absolute)/);
        expect(css).not.toContain("z-index");
        expect(css).not.toContain("gradient");
        expect(css).not.toContain("box-shadow");
        expect(css).toContain(`height: ${PERMISSION_BANNER_HEIGHT}px`);
    });

    it("reserves its own height while it shows and gives it back when dismissed", () => {
        mountBanner();
        expect(bannerVar()).toBe(`${PERMISSION_BANNER_HEIGHT}px`);
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByTestId("permission-banner")).toBeNull();
        expect(bannerVar()).toBe("");
    });

    it("reserves nothing when it does not render, and releases on unmount", () => {
        const hidden = mountBanner({ permission: "granted" });
        expect(screen.queryByTestId("permission-banner")).toBeNull();
        expect(bannerVar()).toBe("");
        hidden.unmount();

        const shown = mountBanner();
        expect(bannerVar()).not.toBe("");
        shown.unmount();
        expect(bannerVar()).toBe("");
    });

    it("Enable asks for permission and then hides the banner", async () => {
        const requestPermission = vi.fn(async () => "granted" as const);
        mountBanner({ requestPermission });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Enable" }));
        });
        expect(requestPermission).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("permission-banner")).toBeNull();
        expect(bannerVar()).toBe("");
    });

    it("is one line, and the explanation is dropped on a phone", () => {
        mountBanner();
        const line = screen.getByText(/Enable desktop notifications/).closest("p, div")!;
        expect(cssOf(line as HTMLElement)).toMatch(/white-space:\s*nowrap/);
        const body = screen.getByText(/Get notified about new messages/);
        expect(cssOf(body)).toMatch(/display:\s*none/);
    });

    it("the shell height is the viewport less the banner, and the full-height surfaces use it", () => {
        const css = read("index.css");
        expect(css).toMatch(/--app-vh:\s*calc\(100dvh - var\(--app-banner-h, 0px\)\)/);
        // Every full-height surface of the shell uses it: a bare `100dvh` / `100vh` in a surface
        // that sits next to the banner makes the document taller than the viewport while the
        // banner shows. Fixed overlays (modals, Spotlight, the lightbox) are the viewport's
        // own and are listed here on purpose; a new file with a bare viewport height fails
        // this test until it is either converted or added with a reason.
        const OVERLAYS = new Set([
            "components/ui/modal/ModalFrame.tsx",
            "components/ui/menu/menuStyles.ts",
            "features/tasks/components/modals/ModalManageTags.tsx",
            "features/notes/common/components/ModalNoteHistory.tsx",
            "components/messageBody/ImageZoomModal.tsx",
            "features/tasks/components/table/filterBarParts.tsx",
            "features/spotlight/SpotlightOverlay.tsx",
            // Rendered instead of the shell, or before it exists: there is no banner then.
            "features/admin/components/AuthShell.tsx",
            "components/layout/TooSmallScreen.tsx",
            "components/ui/misc/InitialLoad.tsx",
            // The hook that explains why those units are unreliable (a comment-free scan still sees the word in code).
            "hooks/common/useKeyboardInset.ts",
        ]);
        const offenders = walk(SRC)
            .map((f) => f.slice(SRC.length + 1))
            .filter((rel) => !OVERLAYS.has(rel))
            .filter((rel) => /\b100d?vh\b/.test(code(rel)));
        expect(offenders).toEqual([]);
        for (const rel of [
            "App.tsx",
            "components/layout/sidebar.tsx",
            "components/ui/styles/commonStyle.ts",
            "features/genos/GenosHome.tsx",
            "features/notes/NoteHome.tsx",
        ]) {
            expect(code(rel), rel).toContain("var(--app-vh)");
        }
    });
});

describe("the mobile tab bar", () => {
    const mount = (path = "/workspace/tasks") => {
        window.history.replaceState({}, "", path);
        return render(
            <CssVarsProvider>
                <BrowserRouter>
                    <BottomTabBar
                        useCM={{ unReadChatAndActivityCounts: 3 } as never}
                        useIM={{ unReadInboxItemCount: 0 } as never}
                        onOpenAccount={() => {}}
                    />
                </BrowserRouter>
            </CssVarsProvider>
        );
    };
    const tab = (label: string) => screen.getByText(label).closest("button") as HTMLElement;

    it("every tab is a real button, and only the current one is aria-current=page", () => {
        mount("/workspace/tasks");
        expect(screen.getAllByRole("button")).toHaveLength(5);
        expect(tab("Tasks")).toHaveAttribute("aria-current", "page");
        expect(tab("Tasks")).toHaveAttribute("data-selected", "true");
        for (const other of ["Inbox", "Chats", "Notes", "Account"]) {
            expect(tab(other), other).not.toHaveAttribute("aria-current");
        }
    });

    it("the Account tab is never current, whatever the route", () => {
        mount("/workspace/chat");
        expect(tab("Account")).not.toHaveAttribute("aria-current");
        expect(tab("Chats")).toHaveAttribute("aria-current", "page");
    });

    it("a mouse over a tab changes its colour only: no full-cell tint, current or not", () => {
        mount();
        const css = [cssOf(tab("Tasks")), cssOf(tab("Chats"))].join("\n");
        // The tone's own hover tint comes first and the tab's override later, at the same
        // specificity: the LAST hover background of each kind (plain, selected) is what paints.
        const rules = [
            ...css.matchAll(/([^{}]*:hover[^{]*)\{[^}]*?background(?:-color)?:\s*([^;}]+)/g),
        ].map((m) => ({ selected: /data-selected/.test(m[1]), bg: m[2].trim() }));
        const last = (selected: boolean) => rules.filter((r) => r.selected === selected).at(-1);
        expect(last(false)?.bg).toBe("transparent");
        expect(last(true)?.bg).toBe("transparent");
    });

    it("is flat: the shared tone and focus ring, no gradient, no blur, no isDark", () => {
        mount();
        const bar = tab("Tasks").parentElement as HTMLElement;
        const css = [cssOf(bar), cssOf(tab("Tasks")), cssOf(tab("Chats"))]
            .join("\n")
            .toLowerCase();
        expect(css).not.toContain("gradient");
        expect(css).not.toContain("backdrop-filter");
        expect(css).toContain("var(--g-accent-text)");
        expect(css).toContain("focus-visible");
        const src = code("components/layout/BottomTabBar.tsx");
        expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|gradient|isDark|useColorScheme/);
    });
});

describe("the service switcher overlay", () => {
    it("is an opaque raised card on tokens: no gradient, blur or literal colour", () => {
        render(
            <CssVarsProvider>
                <ServiceSwitcherOverlay mruOrder={[0, 1, 2, 3, 4, 5]} previewIndex={1} />
            </CssVarsProvider>
        );
        const tiles = document.querySelectorAll("[data-service-tile]");
        const sheet = tiles[0].parentElement!.parentElement as HTMLElement;
        const css = [cssOf(sheet), cssOf(tiles[0]), cssOf(tiles[1])].join("\n").toLowerCase();
        expect(css).toContain("var(--g-surface-raised)");
        expect(css).toContain("var(--g-shadow-lg)");
        expect(css).toContain("var(--g-accent-subtle)");
        expect(css).not.toContain("gradient");
        expect(css).not.toContain("backdrop-filter");
        const src = code("components/layout/ServiceSwitcherOverlay.tsx");
        expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|gradient|isDark|useColorScheme/);
    });
});

describe("no decorative taglines", () => {
    it("the sidebar and inbox footer strings are gone from every locale and every caller", () => {
        const offenders = walk(SRC)
            .filter((f) => !f.endsWith("ShellChromeMIP1134.test.tsx"))
            .filter((f) => /footerTagline|t\.inbox\.footer\b/.test(readFileSync(f, "utf8")));
        expect(offenders).toEqual([]);
    });
});
