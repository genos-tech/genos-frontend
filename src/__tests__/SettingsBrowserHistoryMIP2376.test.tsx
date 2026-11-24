/**
 * MIP-2376: Settings and its tabs take part in browser Back / Forward.
 * Back returns to the previous tab, then closes Settings; closing Settings removes its entries.
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_TABS, SettingsModal } from "../components/layout/SettingsModal";
import { en } from "../i18n/locales/en";
import type { SettingsTabKey } from "../manual/settingsMap";
import { modalHistoryDepth, resetModalHistoryForTests } from "../utils/modalHistory";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/integrations/services/connections", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/integrations/services/connections")>()),
    listConnections: () => Promise.resolve({ connections: [] }),
}));
vi.mock("../features/integrations/services/calendar", () => ({
    listCalendars: () => Promise.resolve([]),
}));
vi.mock("../components/layout/settings/CreditBalance", () => ({
    CreditUsageSection: () => <div />,
}));
vi.mock("../components/layout/settings/PlanUsageSection", () => ({
    PlanUsageSection: () => <div />,
}));
vi.mock("../components/layout/MentionGroupsPanel", () => ({ MentionGroupsPanel: () => <div /> }));
vi.mock("../components/layout/DeveloperSettingsSection", () => ({
    DeveloperSettingsSection: () => null,
}));
vi.mock("../components/layout/TeamEmojiPanel", () => ({ TeamEmojiPanel: () => <div /> }));

const labelOf = (key: SettingsTabKey) => SETTINGS_TABS.find((d) => d.key === key)!.label(en);
const selectedTab = () => screen.getByRole("tab", { selected: true }).textContent ?? "";
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 30))));

const Host = ({ initialTab }: { initialTab?: SettingsTabKey }) => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)}>open</button>
            <SettingsModal initialTab={initialTab} open={open} onClose={() => setOpen(false)} />
        </>
    );
};

const renderHost = (initialTab?: SettingsTabKey) =>
    render(
        <CssVarsProvider>
            <Host initialTab={initialTab} />
        </CssVarsProvider>
    );

beforeEach(() => {
    resetModalHistoryForTests();
    window.history.replaceState(null, "", "/workspace/genos");
});
afterEach(() => resetModalHistoryForTests());

describe("Settings and browser history (MIP-2376)", () => {
    it("Back goes to the previous tab, then closes; Forward returns", async () => {
        renderHost();
        fireEvent.click(screen.getByText("open"));
        expect(selectedTab()).toContain(labelOf("general"));
        fireEvent.click(screen.getByRole("tab", { name: labelOf("security") }));
        expect(selectedTab()).toContain(labelOf("security"));
        expect(modalHistoryDepth()).toBe(2);

        await act(async () => window.history.back());
        await settle();
        expect(selectedTab()).toContain(labelOf("general"));

        await act(async () => window.history.forward());
        await settle();
        expect(selectedTab()).toContain(labelOf("security"));

        // Back from the first page closes Settings (its parent owns "open", so Forward cannot
        // reopen it: only the pages between tabs are walked forward).
        await act(async () => window.history.back());
        await settle();
        await act(async () => window.history.back());
        await settle();
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closing pops the entries: Back does not reopen Settings", async () => {
        renderHost();
        fireEvent.click(screen.getByText("open"));
        fireEvent.click(screen.getByRole("tab", { name: labelOf("security") }));
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        await settle();
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(modalHistoryDepth()).toBe(0);
    });

    it("opening on a requested tab is one entry", () => {
        renderHost("security");
        fireEvent.click(screen.getByText("open"));
        expect(selectedTab()).toContain(labelOf("security"));
        expect(modalHistoryDepth()).toBe(1);
    });
});
