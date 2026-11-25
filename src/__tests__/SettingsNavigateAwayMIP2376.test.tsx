/**
 * MIP-2376 (review 2): the Settings links that close Settings and then navigate ("Compare plans",
 * the AI credit upgrade link, the Schedules upgrade prompt) must land on the new page. The router's
 * `navigate` is a synchronous pushState, so by the time the close effect runs, the browser is
 * already past Settings' entries: closing must not `history.go()` back over that navigation.
 */
import { useState, type ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_TABS, SettingsModal } from "../components/layout/SettingsModal";
import { en } from "../i18n/locales/en";
import type { SettingsTabKey } from "../manual/settingsMap";
import {
    closeModalPages,
    modalHistoryDepth,
    pushModalPage,
    resetModalHistoryForTests,
} from "../utils/modalHistory";

const PLANS = "/workspace/plans";
// What `navigate("/workspace/plans")` does in BrowserRouter: one synchronous pushState.
const navigate = () => window.history.pushState({ idx: 99 }, "", PLANS);

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
    PlanUsageSection: ({ onNavigateAway }: { onNavigateAway?: () => void }) => (
        <button
            onClick={() => {
                onNavigateAway?.();
                navigate();
            }}
        >
            Compare plans
        </button>
    ),
}));
vi.mock("../components/layout/settings/AiCreditUsageSection", () => ({
    AiCreditUsageSection: ({ onNavigateAway }: { onNavigateAway?: () => void }) => (
        <button
            onClick={() => {
                onNavigateAway?.();
                navigate();
            }}
        >
            Upgrade credits
        </button>
    ),
}));
vi.mock("../components/layout/schedules/SchedulesSection", () => ({
    SchedulesSection: ({ onNavigateAway }: { onNavigateAway?: () => void }) => (
        <button
            onClick={() => {
                onNavigateAway?.();
                navigate();
            }}
        >
            Upgrade schedules
        </button>
    ),
}));
vi.mock("../components/layout/settings/GenosSettingsPanel", () => ({
    GenosSettingsPanel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/layout/MentionGroupsPanel", () => ({ MentionGroupsPanel: () => <div /> }));
vi.mock("../components/layout/DeveloperSettingsSection", () => ({
    DeveloperSettingsSection: () => null,
}));
vi.mock("../components/layout/TeamEmojiPanel", () => ({ TeamEmojiPanel: () => <div /> }));

const labelOf = (key: SettingsTabKey) => SETTINGS_TABS.find((d) => d.key === key)!.label(en);
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 30))));

const Host = () => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)}>open</button>
            <SettingsModal open={open} onClose={() => setOpen(false)} />
        </>
    );
};

const renderHost = () =>
    render(
        <CssVarsProvider>
            <Host />
        </CssVarsProvider>
    );

beforeEach(() => {
    resetModalHistoryForTests();
    window.history.replaceState(null, "", "/workspace/tasks");
});
afterEach(() => resetModalHistoryForTests());

describe("Settings links that navigate away (MIP-2376)", () => {
    it.each([
        ["Compare plans", "planUsage"],
        ["Upgrade credits", "aiCreditUsage"],
        ["Upgrade schedules", "spotlight"],
    ] as const)("%s lands on /workspace/plans with Settings closed", async (link, tab) => {
        renderHost();
        fireEvent.click(screen.getByText("open"));
        fireEvent.click(screen.getByRole("tab", { name: labelOf(tab) }));
        expect(modalHistoryDepth()).toBeGreaterThanOrEqual(2);

        fireEvent.click(screen.getByText(link));
        await settle();

        expect(window.location.pathname).toBe(PLANS);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(modalHistoryDepth()).toBe(0);

        // Back stays sensible: it walks the dead entries at the old address (Settings is not
        // reopened by them), and ends on the page the user started from.
        for (let i = 0; i < 4 && window.location.pathname === PLANS; i++) {
            await act(async () => window.history.back());
            await settle();
        }
        expect(window.location.pathname).toBe("/workspace/tasks");
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("a route link after that still works (closeModalPages never throws on a stale depth)", async () => {
        pushModalPage("settings", "general");
        pushModalPage("settings", "security");
        navigate();
        closeModalPages("settings");
        expect(window.location.pathname).toBe(PLANS);

        const then = vi.fn();
        expect(() => closeModalPages("url-link-modal", then)).not.toThrow();
        expect(then).toHaveBeenCalledTimes(1);
        expect(window.location.pathname).toBe(PLANS);
    });
});
