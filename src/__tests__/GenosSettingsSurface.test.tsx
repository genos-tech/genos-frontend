/**
 * The Genos settings surface: where "What Genos remembers" lives, and the
 * Spotlight -> Genos rename around it.
 *
 * The surface appears twice — the "Genos" tab of the main Settings dialog and
 * the dialog behind the gear on the Genos bar — and both render
 * `GenosSettingsPanel`. The panel is a card that opens a sub-view with a way
 * back, so these tests drive it from both hosts, in English and Japanese.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsModal } from "../components/layout/SettingsModal";
import { SpotlightSettingsModal } from "../features/spotlight/SpotlightSettingsModal";
import { I18nProvider, loadLocale } from "../i18n";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));
vi.mock("../services/api", () => ({
    authApi: () => ({
        get: vi.fn(async (url: string) =>
            url.includes("timezone")
                ? { data: { timezone: "Asia/Tokyo" } }
                : { data: { share_answers_with_team: true } }
        ),
        patch: vi.fn(),
    }),
}));
vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        fetchAgentSessions: vi.fn(async () => []),
        fetchSharedAnswers: vi.fn(async () => ({
            share_answers_with_team: true,
            answers: [],
            has_more: false,
        })),
    };
});
// The model picker is its own concern (and covered by LlmProviderHoldback);
// here it is just "the usual sections" the panel wraps.
vi.mock("../hooks/common/useLlmModelPreference", () => ({
    useLlmModelPreference: () => ({
        loading: true,
        data: null,
        setChoice: vi.fn(),
        setEffort: vi.fn(),
    }),
}));
vi.mock("../features/integrations/services/connections", () => ({
    findGoogleConnection: () => undefined,
    hasCalendarScope: () => false,
    listConnections: () => Promise.resolve([]),
}));
vi.mock("../features/integrations/services/calendar", () => ({
    listCalendars: () => Promise.resolve([]),
}));
vi.mock("../services/notifications/NotificationSettingsPanel", () => ({
    NotificationSettingsPanel: () => <div />,
}));
vi.mock("../components/layout/settings/CreditBalance", () => ({
    CreditUsageSection: () => <div />,
}));
vi.mock("../components/layout/settings/PlanUsageSection", () => ({
    PlanUsageSection: () => <div />,
}));
vi.mock("../components/layout/MentionGroupsPanel", () => ({
    MentionGroupsPanel: () => <div />,
}));
vi.mock("../components/layout/DeveloperSettingsSection", () => ({
    DeveloperSettingsSection: () => null,
}));
vi.mock("../components/layout/TeamEmojiPanel", () => ({
    TeamEmojiPanel: () => <div />,
}));

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("teamId", "team-1");
});
afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
});

const renderGearDialog = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <SpotlightSettingsModal teamId="team-1" open onClose={vi.fn()} />
            </I18nProvider>
        </CssVarsProvider>
    );

const renderMainSettings = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <MemoryRouter>
                    <SettingsModal open onClose={vi.fn()} />
                </MemoryRouter>
            </I18nProvider>
        </CssVarsProvider>
    );

describe("Genos settings dialog (the gear on the Genos bar)", () => {
    it("is titled Genos settings, not Spotlight settings", () => {
        renderGearDialog();
        expect(screen.getByText("Genos settings")).toBeTruthy();
        expect(screen.queryByText(/Spotlight settings/)).toBeNull();
        // The stale copy that named the old daily quota is gone, and the
        // search feature is still called Spotlight where it IS the search.
        expect(screen.getByText("Genos answers")).toBeTruthy();
        expect(screen.queryByText(/daily ask quota/)).toBeNull();
        expect(screen.getByText(/Spotlight search always looks through/)).toBeTruthy();
    });

    it("opens What Genos remembers from a card, and comes back", async () => {
        const user = userEvent.setup();
        renderGearDialog();

        expect(screen.getByText("What Genos remembers")).toBeTruthy();
        // The page itself is not mounted (nor fetching) until asked for.
        expect(screen.queryByText("Your Genos conversations")).toBeNull();

        await user.click(screen.getByRole("button", { name: "Open" }));
        expect(await screen.findByText("Your Genos conversations")).toBeTruthy();
        expect(screen.getByText("Answers shared with your team")).toBeTruthy();
        expect(screen.getByText("Settings Genos uses")).toBeTruthy();
        // The toggles are not on this view.
        expect(screen.queryByText("Genos answers")).toBeNull();
        // This dialog can't open the main Settings, so it names the path.
        expect(
            await screen.findByText("You can change it in Settings › General › Language.")
        ).toBeTruthy();

        await user.click(screen.getByRole("button", { name: "Genos settings" }));
        expect(await screen.findByText("Genos answers")).toBeTruthy();
        expect(screen.queryByText("Your Genos conversations")).toBeNull();
    });

    it("starts at the usual sections again after being closed and reopened", async () => {
        const user = userEvent.setup();
        const view = renderGearDialog();
        await user.click(screen.getByRole("button", { name: "Open" }));
        await screen.findByText("Your Genos conversations");

        view.unmount();
        renderGearDialog();
        expect(screen.getByText("Genos answers")).toBeTruthy();
        expect(screen.queryByText("Your Genos conversations")).toBeNull();
    });
});

describe("Settings -> Genos tab", () => {
    it("labels the tab Genos and shows the same panel", async () => {
        const user = userEvent.setup();
        renderMainSettings();
        const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
        expect(tabs).toContain("Genos");
        expect(tabs).not.toContain("Spotlight");

        await user.click(screen.getByRole("tab", { name: "Genos" }));
        expect(await screen.findByText("Genos answers")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Open" }));
        expect(await screen.findByText("Your Genos conversations")).toBeTruthy();
    });

    it("jumps to General -> Language from the answer-language row", async () => {
        const user = userEvent.setup();
        renderMainSettings();
        await user.click(screen.getByRole("tab", { name: "Genos" }));
        await user.click(await screen.findByRole("button", { name: "Open" }));

        await user.click(await screen.findByRole("button", { name: "Change language" }));

        await waitFor(() =>
            expect(
                screen.getByRole("tab", { name: "General" }).getAttribute("aria-selected")
            ).toBe("true")
        );
        // The language editor is the real one that tab already has.
        expect(screen.getByText("Choose the language used throughout the app.")).toBeTruthy();
    });
});

describe("in Japanese", () => {
    beforeEach(async () => {
        localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
        await loadLocale("ja");
    });

    it("titles the gear dialog Genos設定 and carries the page copy", async () => {
        const user = userEvent.setup();
        renderGearDialog();
        expect(await screen.findByText(ja.spotlight!.settings!.title!)).toBeTruthy();
        expect(ja.spotlight!.settings!.title).toBe("Genos設定");
        expect(screen.queryByText(/スポットライト/)).toBeNull();

        await user.click(screen.getByRole("button", { name: "開く" }));
        const m = ja.settings!.genosMemory!;
        expect(await screen.findByText(m.conversations!.heading!)).toBeTruthy();
        expect(screen.getByText(m.shared!.heading!)).toBeTruthy();
        expect(screen.getByText(m.settingsUsed!.heading!)).toBeTruthy();
        // Not left in English by a missing key.
        expect(screen.queryByText(en.settings.genosMemory.conversations.heading)).toBeNull();
    });

    it("labels the main Settings tab Genos", () => {
        renderMainSettings();
        const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
        expect(tabs).toContain("Genos");
        expect(tabs).not.toContain("スポットライト");
    });

    it("says the permanence in Japanese in the delete confirm", async () => {
        const user = userEvent.setup();
        renderGearDialog();
        await user.click(screen.getByRole("button", { name: "開く" }));
        await user.click(
            await screen.findByRole("button", {
                name: ja.settings!.genosMemory!.conversations!.deleteAll!,
            })
        );
        const dialog = await screen.findByRole("alertdialog");
        expect(
            within(dialog).getByText(ja.settings!.genosMemory!.conversations!.deleteAllBody!)
        ).toBeTruthy();
    });
});
