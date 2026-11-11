/**
 * The overlay's hint is printed from the registry's cycle keys and Settings' words (MIP-1313):
 * Cmd on Mac, Alt elsewhere, in every locale, with no per-platform copy of the sentence.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceSwitcherOverlay } from "../components/layout/ServiceSwitcherOverlay";
import { I18nProvider } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";

let mac = true;
vi.mock("../utils/platform", () => ({ isMac: () => mac }));

const view = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <ServiceSwitcherOverlay
                    previewIndex={1}
                    mruOrder={[2, 0, 1, 3, 4, 5]}
                    onHighlight={() => {}}
                    onSelect={() => {}}
                />
            </I18nProvider>
        </CssVarsProvider>
    );

beforeEach(() => {
    mac = true;
    localStorage.clear();
});
afterEach(cleanup);

describe("ServiceSwitcherOverlay hint", () => {
    it("Mac: hold ⌘, tap Ctrl, release ⌘", () => {
        const { container } = view();
        expect(container.textContent).toContain(
            "Hold ⌘  ·  Tap Ctrl to cycle  ·  Release ⌘ to switch"
        );
    });

    it("Windows and Linux: hold Alt, tap Ctrl, release Alt (the sentence is not copied per platform)", () => {
        mac = false;
        const { container } = view();
        expect(container.textContent).toContain(
            "Hold Alt  ·  Tap Ctrl to cycle  ·  Release Alt to switch"
        );
    });
});
