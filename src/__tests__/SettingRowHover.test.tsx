/**
 * MIP-1458: in Settings -> Notifications every row lights up as a whole on hover and on
 * keyboard focus, so a label far from its toggle can be matched with it at a glance.
 *
 * Pinned here: the plate's recipe (a background colour from the `hover` role, on a real
 * pointer only, faded over the `fast` motion step, instant under reduced motion, a stronger
 * press, none on a disabled row), that the panel's rows really carry it, and that every
 * toggle has an accessible name (they had none). jsdom cannot resolve `var()` colours or
 * run `:hover`: the look and the computed transition were checked in Chromium (see the
 * evidence page).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssWithMediaOf } from "./utils/cssOf";

import { SettingRow } from "../components/ui/settings/SettingRow";
import {
    SETTING_ROW_CLASS,
    SETTING_ROW_FILLED_ACTIVE,
    SETTING_ROW_FILLED_HOVER,
    settingRowSx,
} from "../components/ui/settings/settingRowStyles";
import { NotificationsProvider } from "../services/notifications/NotificationsContext";
import { NotificationSettingsPanel } from "../services/notifications/NotificationSettingsPanel";
import { DEFAULT_NOTIFICATION_PREFERENCE } from "../services/notifications/types";

vi.mock("../hooks/common/useDigestPreference", () => ({
    useDigestPreference: () => ({
        digestEnabled: true,
        setDigestEnabled: () => undefined,
        emailDigestEnabled: null,
        setEmailDigestEnabled: () => undefined,
    }),
}));

afterEach(cleanup);

const noop = () => undefined;
const renderPanel = (over: Record<string, unknown> = {}) => {
    const ctx = {
        preferences: {
            ...DEFAULT_NOTIFICATION_PREFERENCE,
            mutedChats: [{ chatType: 2, chatId: "c1", chatName: "Design review" }],
            ...over,
        },
        permission: "granted",
        requestPermission: noop,
        setMasterEnabled: noop,
        setEmailEnabled: noop,
        setEmailCategoryEnabled: noop,
        setGroupEnabled: noop,
        setSubCategoryEnabled: noop,
        unmute: noop,
        unmuteTarget: noop,
        isPausedNow: false,
        snoozeUntil: null,
        snoozeSchedule: null,
        pauseFor: noop,
        pauseUntilTomorrow: noop,
        pauseUntilNextWeek: noop,
        pauseUntil: noop,
        resume: noop,
        setSchedule: noop,
    };
    return render(
        <CssVarsProvider>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <NotificationsProvider value={ctx as any}>
                <NotificationSettingsPanel />
            </NotificationsProvider>
        </CssVarsProvider>
    );
};

const cssOfRow = (props: { disabled?: boolean; filled?: boolean } = {}) => {
    render(
        <CssVarsProvider>
            <SettingRow data-testid="row" {...props} />
        </CssVarsProvider>
    );
    return cssWithMediaOf(screen.getByTestId("row")).replace(/\s+/g, " ");
};

describe("the setting row plate", () => {
    it("is the hover role, on a real pointer only, as a background colour", () => {
        const css = cssOfRow();
        expect(css).toMatch(
            /@media \(hover: hover\) and \(pointer: fine\) \{[^}]*:hover \{[^}]*background-color: var\(--g-hover\)/
        );
        // Not under a bare `:hover` rule outside the media query: that would stick on a phone.
        expect(
            css.replace(/@media \(hover: hover\) and \(pointer: fine\) \{[^}]*\}[^}]*\}/, "")
        ).not.toMatch(/:hover/);
    });

    it("fades the colour over the fast step on the shared curve, and nothing else", () => {
        const css = cssOfRow();
        expect(css).toMatch(/transition: background-color var\(--g-motion-fast\) var\(--g-ease\)/);
        expect(css).not.toMatch(/transform|scale|translate|box-shadow|transition: all/);
    });

    it("is instant under reduced motion", () => {
        expect(cssOfRow()).toMatch(
            /@media \(prefers-reduced-motion: reduce\) \{[^}]*transition: none/
        );
    });

    it("follows keyboard focus on the control inside, in its own rule", () => {
        const css = cssOfRow();
        expect(css).toMatch(/:has\(:focus-visible\) \{[^}]*background-color: var\(--g-hover\)/);
        // `:has()` must not share a selector list with `:hover`: an engine without it would
        // drop the hover rule too.
        expect(css).not.toMatch(/:hover, [^{]*:has|:has\([^)]*\), [^{]*:hover/);
    });

    it("presses one step stronger, for a touch screen", () => {
        expect(cssOfRow()).toMatch(/:active \{[^}]*background-color: var\(--g-active\)/);
    });

    it("gives a disabled row no plate at all", () => {
        const css = cssOfRow({ disabled: true });
        expect(css).not.toMatch(/:hover|:active|:has\(/);
        expect(css).toMatch(/transition: background-color/);
    });

    it("mixes the plate over a row that has its own fill instead of replacing it", () => {
        const css = cssOfRow({ filled: true });
        expect(css).toContain(`background-color: ${SETTING_ROW_FILLED_HOVER}`);
        expect(css).toContain(`background-color: ${SETTING_ROW_FILLED_ACTIVE}`);
        expect(css).not.toMatch(/background-color: var\(--g-hover\)/);
        // A fill is opaque, or the transition would run to a translucent colour.
        expect(SETTING_ROW_FILLED_HOVER).toMatch(
            /^color-mix\(in srgb, var\(--joy-palette-background-level1\)/
        );
    });

    it("keeps no literal colour in the recipe", () => {
        const src = JSON.stringify(settingRowSx({}));
        expect(src).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(|!important/i);
    });
});

describe("the Notifications panel", () => {
    it("puts every toggle inside a row that carries the plate", () => {
        const { container } = renderPanel();
        const toggles = container.querySelectorAll('input[type="checkbox"]');
        expect(toggles.length).toBeGreaterThan(20);
        toggles.forEach((input) => {
            expect(input.closest(`.${SETTING_ROW_CLASS}`)).not.toBeNull();
        });
    });

    it("includes the row's description, so hovering it lights the toggle too", () => {
        renderPanel();
        for (const text of [
            /Show desktop notifications when the tab/,
            /Automatically pause every day/,
        ]) {
            expect(screen.getByText(text).closest(`.${SETTING_ROW_CLASS}`)).not.toBeNull();
        }
    });

    it("lights the muted rows too, mixed over their fill", () => {
        const { container } = renderPanel();
        const row = screen.getByText("Design review").closest(`.${SETTING_ROW_CLASS}`);
        expect(row).not.toBeNull();
        expect(cssWithMediaOf(row as Element)).toContain(SETTING_ROW_FILLED_HOVER);
        expect(container.querySelectorAll(`.${SETTING_ROW_CLASS}`).length).toBeGreaterThan(25);
    });

    it("gives a row with a disabled toggle no plate", () => {
        const { container } = renderPanel({
            masterEnabled: false,
        });
        const off = [...container.querySelectorAll('input[type="checkbox"]')].find(
            (el) => (el as HTMLInputElement).disabled
        );
        const row = off?.closest(`.${SETTING_ROW_CLASS}`) as Element;
        expect(row).toBeDefined();
        expect(cssWithMediaOf(row)).not.toMatch(/:hover|:active/);
    });

    it("names every toggle, so it can be told apart from the one next to it", () => {
        const { container } = renderPanel();
        const unnamed = [...container.querySelectorAll('input[type="checkbox"]')].filter(
            (el) => !el.getAttribute("aria-label")
        );
        expect(unnamed).toEqual([]);
        expect(screen.getByRole("switch", { name: "Web notifications" })).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: "On a schedule" })).toBeInTheDocument();
        expect(
            screen.getByRole("switch", { name: "Mentions: In a chat message" })
        ).toBeInTheDocument();
    });
});
