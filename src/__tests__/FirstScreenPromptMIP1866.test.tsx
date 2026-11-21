/**
 * MIP-1866: the first screen of a new account shows no prompt above its content, and never two.
 *
 * The prompts wait until the person has seen the app: a second visit, or a first action in this
 * visit. Then at most one shows: the install banner where it can be offered, else the
 * notifications bar.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FirstScreenPrompt } from "../components/layout/FirstScreenPrompt";
import { I18nProvider } from "../i18n";
import { en } from "../i18n/locales/en";

const install = vi.hoisted(() => ({ canPrompt: true, isMobile: true }));

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => install.isMobile }));
vi.mock("../hooks/common/useInstallPrompt", () => ({
    useInstallPrompt: () => ({ canPrompt: install.canPrompt, promptInstall: async () => false }),
    isIOSDevice: () => false,
    isStandaloneDisplay: () => false,
}));

const installTitle = en.services.pwaInstall.title;
const notifTitle = en.services.notifications.banner.title;

const renderPrompt = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <FirstScreenPrompt
                    permission="default"
                    requestPermission={async () => "denied"}
                    masterEnabled
                />
            </I18nProvider>
        </CssVarsProvider>
    );

const queryInstall = () => screen.queryByText(installTitle);
const queryNotif = () => document.querySelector('[data-testid="permission-banner"]');

describe("FirstScreenPrompt (MIP-1866)", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        install.canPrompt = true;
        install.isMobile = true;
    });

    it("shows nothing on the first visit of a new account", () => {
        renderPrompt();
        expect(queryInstall()).toBeNull();
        expect(queryNotif()).toBeNull();
    });

    it("shows the install prompt after the first action of the first visit", () => {
        renderPrompt();
        act(() => {
            fireEvent.pointerDown(document.body);
        });
        expect(queryInstall()).not.toBeNull();
        expect(queryNotif()).toBeNull();
    });

    it("shows one prompt on a second visit, never both", () => {
        localStorage.setItem("genos:visitCount", "1");
        renderPrompt();
        expect(queryInstall()).not.toBeNull();
        expect(queryNotif()).toBeNull();
    });

    it("falls back to the notifications bar when the device cannot install", () => {
        install.canPrompt = false;
        install.isMobile = false;
        localStorage.setItem("genos:visitCount", "1");
        renderPrompt();
        expect(queryInstall()).toBeNull();
        expect(queryNotif()).not.toBeNull();
        expect(document.body.textContent).toContain(notifTitle);
    });

    it("keeps the decision for the rest of the session, so a remount does not show it again on the first visit", () => {
        const first = renderPrompt();
        act(() => {
            fireEvent.pointerDown(document.body);
        });
        expect(queryInstall()).not.toBeNull();
        first.unmount();
        renderPrompt();
        expect(queryInstall()).not.toBeNull();
    });
});
