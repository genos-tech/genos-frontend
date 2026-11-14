/**
 * The API-keys block points people who came for a key to the "Connect an AI app" panel:
 * Claude and ChatGPT connect with a sign-in, not a key. The pointer sits in a sibling
 * component, so it reaches the panel through `openConnectAppPanel`.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeveloperSettingsSection } from "../components/layout/DeveloperSettingsSection";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../services/developerApi", async () => {
    const actual = await vi.importActual<typeof import("../services/developerApi")>(
        "../services/developerApi"
    );
    return {
        ...actual,
        listApiKeys: vi.fn().mockResolvedValue([]),
        listWebhooks: vi.fn().mockResolvedValue([]),
        listTeamApiKeys: vi.fn().mockResolvedValue(null),
        listTeamSecurityEvents: vi.fn().mockResolvedValue(null),
    };
});

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const k = en.settings.developer.keys;

describe("API keys: pointer to connecting an app", () => {
    beforeEach(() => vi.clearAllMocks());

    it("says no key is needed to connect Claude or ChatGPT, and links to the panel", async () => {
        render(<DeveloperSettingsSection teamId="t1" />);
        expect(await screen.findByText(k.connectPointer, { exact: false })).toBeTruthy();
        expect(k.connectPointer + " " + k.connectPointerLink).toBe(
            "No key needed to connect Claude or ChatGPT: connect an app instead."
        );
        expect(screen.getByRole("button", { name: k.connectPointerLink })).toBeTruthy();
    });

    it("pressing it with no panel on screen does nothing and does not throw", async () => {
        render(<DeveloperSettingsSection teamId="t1" />);
        const link = await screen.findByRole("button", { name: k.connectPointerLink });
        await userEvent.setup().click(link);
        expect(link).toBeTruthy();
    });
});
