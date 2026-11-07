/**
 * MIP-1164: the 68px global rail selects like every sidebar next to it.
 *
 * It used to paint its own gradient, border and icon plate for the selected
 * service, with literal colours and `isDark` branches. Now each button is a
 * `RailButton`: the shared hover/selected tone (`navToneSx`, the accent's quiet
 * tint, `aria-current`), the rail's own icon-over-label geometry, and nothing
 * that is a literal colour or a gradient.
 *
 * jsdom cannot measure layout, so the "labels do not wrap" half of the
 * acceptance is a budget check on the strings (calibrated against widths measured in
 * Chromium, see `labelWidth`) plus `white-space: nowrap` on the label; the real
 * numbers, per locale, are in the evidence page.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { Sidebar } from "../components/layout/sidebar";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../hooks/common/useSidebarVisibility", async () => ({
    ...(await vi.importActual<object>("../hooks/common/useSidebarVisibility")),
    useSidebarVisibility: () => ({ isVisible: () => true, loading: false, setVisible: () => {} }),
}));
vi.mock("../features/admin/components/teamDropdown", () => ({ TeamDropdown: () => null }));
vi.mock("../components/layout/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("../features/admin/components/modals/ModalUserProfile", () => ({
    UserProfile: () => null,
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));
vi.mock("../hooks/common/useSignOut", () => ({ useSignOut: () => async () => {} }));

afterEach(cleanup);

const mountRail = (start: string) => {
    window.history.replaceState({}, "", start);
    render(
        <CssVarsProvider>
            <BrowserRouter>
                <Sidebar
                    myself={{} as never}
                    setMyself={() => {}}
                    socket={null}
                    useCM={{ unReadChatAndActivityCounts: 0 } as never}
                    useIM={{ unReadInboxItemCount: 0 } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                    onOpenGenos={() => {}}
                    onOpenHistory={() => {}}
                    onOpenTodo={() => {}}
                />
            </BrowserRouter>
        </CssVarsProvider>
    );
};

const button = (label: string) =>
    screen.getByText(label).closest('[role="button"]') as HTMLElement;
const tile = (label: string) => button(label).closest("li") as HTMLElement;

describe("rail buttons", () => {
    it("the selected service is the accent's quiet tint and aria-current=page; the others are neither", () => {
        mountRail("/workspace/tasks");
        expect(button("Tasks")).toHaveAttribute("aria-current", "page");
        expect(tile("Tasks")).toHaveAttribute("data-selected", "true");
        // The shared style, from the tokens: the same rule every NavItem row carries.
        const css = cssOf(tile("Tasks"));
        expect(css).toContain("var(--g-accent-subtle)");
        expect(css).toContain("var(--g-accent-text)");
        expect(css).toMatch(/data-selected="true"/);
        for (const other of ["Chats", "Inbox", "Notes", "Genos", "Settings"]) {
            expect(button(other), other).not.toHaveAttribute("aria-current");
            expect(tile(other), other).not.toHaveAttribute("data-selected");
        }
    });

    it("no gradient in what the rail renders, and no literal colour or isDark branch in its source", () => {
        mountRail("/workspace/tasks");
        for (const label of ["Tasks", "Chats", "Sign out"]) {
            const css = [cssOf(tile(label)), cssOf(button(label)), cssOf(screen.getByText(label))];
            expect(css.join("\n").toLowerCase(), label).not.toContain("gradient");
        }
        // Joy's own rules carry hex fallbacks, so the literal check reads the source.
        const source = readFileSync(
            join(dirname(fileURLToPath(import.meta.url)), "../components/layout/sidebar.tsx"),
            "utf8"
        );
        const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(code).not.toMatch(/rgba?\(\s*\d/);
        expect(code).not.toMatch(/gradient/i);
        expect(code).not.toContain("isDark");
        expect(code).not.toContain("useColorScheme");
    });

    it("the icon follows the tile's state (Joy's neutral button would pin it to its own grey)", () => {
        mountRail("/workspace/tasks");
        expect(cssOf(button("Tasks"))).toMatch(/--Icon-color:\s*currentColor/);
        // ...and so does the label on hover: `inherit` as a custom property would hand Joy's
        // fallback back its own hover colour, and Sign out would keep a neutral label.
        expect(cssOf(button("Sign out"))).toMatch(/--variant-plainHoverColor:\s*currentColor/);
    });

    it("a label never wraps: one line, and the button keeps its narrow side padding", () => {
        mountRail("/workspace/tasks");
        for (const label of ["Inbox", "Settings", "Sign out"]) {
            expect(cssOf(screen.getByText(label)), label).toMatch(/white-space:\s*nowrap/);
        }
        // RAIL_BUTTON_PX = 0.5 (4px): Geist's "Sign out" no longer fit at 10px (MIP-1118).
        expect(cssOf(button("Sign out"))).toMatch(/padding:\s*\d+px 4px/);
    });

    it("selected is medium over a regular rest weight: the cue that is not a colour", () => {
        mountRail("/workspace/tasks");
        expect(cssOf(tile("Chats"))).toMatch(/font-weight:\s*400/);
        expect(cssOf(tile("Tasks"))).toMatch(/data-selected="true"[^{]*\{[^}]*font-weight:\s*500/);
        expect(cssOf(screen.getByText("Tasks"))).toMatch(/font-weight:\s*inherit/);
    });

    it("Sign out turns danger on hover, from the danger tokens", () => {
        mountRail("/workspace/tasks");
        const css = cssOf(tile("Sign out"));
        expect(css).toContain("var(--g-danger-subtle)");
        expect(css).toContain("var(--g-danger-text)");
        expect(cssOf(tile("Settings"))).not.toContain("--g-danger");
    });

    it("every button is keyboard reachable and rings from the focus token", () => {
        mountRail("/workspace/tasks");
        for (const label of [
            "Genos",
            "Inbox",
            "Tasks",
            "To-Do",
            "History",
            "Settings",
            "Sign out",
        ]) {
            expect(button(label), label).toHaveAttribute("tabindex", "0");
        }
        expect(cssOf(button("Tasks"))).toContain("var(--g-focus)");
    });
});

/**
 * Widest a rail label can be (px) at the label size (0.65rem = 10.4px, weight
 * 500): the rail is 68px, a tile 63, minus 4px of padding a side, minus the
 * scrollbar-less 2px rounding = 53, measured as the button's content width.
 */
const RAIL_LABEL_BUDGET_PX = 53;

/**
 * Estimated width of a label in px. Per-script averages fitted to widths
 * measured in Chromium with Geist / Noto: Latin 5.7 per character (measured
 * 5.1-5.7), a space 3, kana and CJK one em (10.4), Arabic 5.4, Devanagari 7 per
 * base letter (combining marks add nothing). Conservative on purpose.
 */
const labelWidth = (text: string): number => {
    let w = 0;
    for (const ch of text) {
        const c = ch.codePointAt(0)!;
        if (/\p{M}/u.test(ch)) continue;
        if (ch === " ") w += 3;
        else if (c >= 0x3000 && c <= 0x9fff) w += 10.4;
        else if (c >= 0x0600 && c <= 0x06ff) w += 5.4;
        else if (c >= 0x0900 && c <= 0x097f) w += 7;
        else w += 5.7;
    }
    return w;
};

type Catalog = {
    sidebar?: {
        nav?: Record<string, string>;
        actions?: Record<string, string>;
    };
};
const LOCALES = { en, ja, zh, es, fr, hi, ar } as const;
const RAIL_KEYS = [
    ["nav", "search"],
    ["nav", "inbox"],
    ["nav", "chats"],
    ["nav", "tasks"],
    ["nav", "notes"],
    ["actions", "todo"],
    ["actions", "history"],
    ["actions", "settings"],
    ["actions", "signOut"],
] as const;

describe("rail labels fit the 68px rail on one line, in all seven locales", () => {
    it("the estimator agrees with what Chromium measured", () => {
        // Measured natural widths (px): "Sign out" 40.6, "Réception" 49.3, "ログアウト" 52,
        // "करने के लिए" 47.2, "الملاحظات" 41.1. The estimate is never below the measurement.
        expect(labelWidth("Sign out")).toBeGreaterThanOrEqual(40.6);
        expect(labelWidth("Réception")).toBeGreaterThanOrEqual(49.3);
        expect(labelWidth("ログアウト")).toBeGreaterThanOrEqual(52);
        expect(labelWidth("करने के लिए")).toBeGreaterThanOrEqual(47.2);
        expect(labelWidth("الملاحظات")).toBeGreaterThanOrEqual(41.1);
        // ...and the ones that overflowed before MIP-1164's copy changes do exceed the budget.
        for (const wide of ["Conversations", "Se déconnecter", "サインアウト", "desconectar"]) {
            expect(labelWidth(wide), wide).toBeGreaterThan(RAIL_LABEL_BUDGET_PX);
        }
    });

    for (const [name, catalog] of Object.entries(LOCALES)) {
        it(`${name}: every label is within the budget`, () => {
            const sidebar = (catalog as Catalog).sidebar;
            for (const [group, key] of RAIL_KEYS) {
                // A locale may leave a key out and show English (DeepPartial): test what shows.
                const text =
                    sidebar?.[group]?.[key] ?? (en as Catalog).sidebar?.[group]?.[key] ?? "";
                expect(text, `${name}.${group}.${key}`).toBeTruthy();
                expect(
                    labelWidth(text),
                    `${name}.${group}.${key} = "${text}" (~${labelWidth(text)}px)`
                ).toBeLessThanOrEqual(RAIL_LABEL_BUDGET_PX);
            }
        });
    }
});
