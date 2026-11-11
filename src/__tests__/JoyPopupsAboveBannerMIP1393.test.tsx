/**
 * MIP-1393: a Joy `Select` / `Autocomplete` listbox opened under the page header on a phone sat
 * BELOW the persistent connection banner (MIP-1327 lifted `MenuSurface` only). Joy gives a
 * listbox `var(--unstable_popup-zIndex, <popup token>)`, and a Joy `Modal` root in the document
 * stamps that variable (calc(modal + 1) = 1301) on the listboxes after it, so the theme's popup
 * token alone was not enough: the theme's component overrides take the max of the variable and
 * the menu layer. The pixels were checked in Chromium at 390 with the banner showing (see the PR).
 */
import { Autocomplete, CssVarsProvider, Modal } from "@mui/joy";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    MENU_MIN_Z_INDEX,
    POPUP_Z_INDEX_CSS,
    TOAST_REGION_Z_INDEX,
    TOOLTIP_Z_INDEX,
} from "../components/ui/feedback/toastLayers";
import { buildJoyTheme } from "../theme/purplePalette";
import { joyComponents } from "../theme/tokens/joyComponents";

describe("the popup layers", () => {
    it("menus and listboxes are above the toast region, tooltips above them", () => {
        expect(MENU_MIN_Z_INDEX).toBeGreaterThan(TOAST_REGION_Z_INDEX);
        expect(TOOLTIP_Z_INDEX).toBeGreaterThan(MENU_MIN_Z_INDEX);
    });

    it("the Joy theme carries them", () => {
        const theme = buildJoyTheme("purple") as unknown as { zIndex: Record<string, number> };
        expect(theme.zIndex.popup).toBe(MENU_MIN_Z_INDEX);
        expect(theme.zIndex.tooltip).toBe(TOOLTIP_Z_INDEX);
        // Still below nothing it was above before: the old 13300 is cleared.
        expect(theme.zIndex.tooltip).toBeGreaterThan(13300);
    });

    it("Select, Autocomplete and Menu take the max of a host's stamp and the menu layer", () => {
        expect(POPUP_Z_INDEX_CSS).toBe(
            `max(var(--unstable_popup-zIndex, 0), ${MENU_MIN_Z_INDEX})`
        );
        expect(joyComponents.JoySelect.styleOverrides.listbox.zIndex).toBe(POPUP_Z_INDEX_CSS);
        expect(joyComponents.JoyAutocomplete.styleOverrides.listbox.zIndex).toBe(
            POPUP_Z_INDEX_CSS
        );
        expect(joyComponents.JoyMenu.styleOverrides.root.zIndex).toBe(POPUP_Z_INDEX_CSS);
    });
});

describe("an open Autocomplete listbox", () => {
    it("declares the lift (not Joy's bare var) even with a Joy Modal in the tree", () => {
        render(
            <CssVarsProvider theme={buildJoyTheme("purple")}>
                <Modal open={false} onClose={() => {}}>
                    <div />
                </Modal>
                <Autocomplete options={["alpha", "beta"]} placeholder="pick" />
            </CssVarsProvider>
        );
        fireEvent.mouseDown(screen.getByPlaceholderText("pick"));
        fireEvent.click(screen.getByPlaceholderText("pick"));
        const listbox = document.querySelector('[role="listbox"]');
        expect(listbox).toBeTruthy();
        // jsdom does not resolve var() / max(): it keeps the declared value. The theme's
        // override replaced Joy's own `var(--unstable_popup-zIndex, <popup>)` (it is emitted
        // after the base rule), so the max() is what is declared.
        expect(getComputedStyle(listbox as Element).zIndex).toBe(POPUP_Z_INDEX_CSS);
    });
});
