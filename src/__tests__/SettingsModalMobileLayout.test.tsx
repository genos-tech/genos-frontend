import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsModal } from "../components/layout/SettingsModal";

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));

// The modal is a leaf of a large tree: auth, integrations, notifications
// and the credit/plan sections all reach for the network or a context on
// mount. Stub the boundaries — the layout under test is the tab rail, not
// what the panels fetch.
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "t" }),
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
vi.mock("../components/layout/TeamEmojiPanel", () => ({
    TeamEmojiPanel: () => <div />,
}));

beforeEach(() => {
    isMobileViewport = false;
    localStorage.clear();
});

const renderModal = () =>
    render(
        <CssVarsProvider>
            <SettingsModal open onClose={vi.fn()} />
        </CssVarsProvider>
    );

describe("SettingsModal tab rail", () => {
    it("is a vertical sidebar on desktop", () => {
        renderModal();
        expect(screen.getByRole("tablist")).toHaveClass("MuiTabList-vertical");
    });

    it("is a horizontal strip on mobile", () => {
        // The vertical rail is `minWidth: 184` + `flexShrink: 0`, which
        // left ~120px of a 92vw dialog for the panel — narrower than the
        // 140px `minWidth` of the Selects every settings row is built
        // from, so the rows overflowed and were clipped. Flipping the
        // orientation gives the panel the dialog's full width.
        isMobileViewport = true;
        renderModal();
        // Joy omits `aria-orientation` when horizontal (it is the ARIA
        // default for a tablist), so assert on the ownerState class it
        // always emits.
        expect(screen.getByRole("tablist")).toHaveClass("MuiTabList-horizontal");
    });

    it("keeps every tab reachable in the mobile strip", () => {
        isMobileViewport = true;
        renderModal();
        // Nothing may be dropped on the way to a narrow layout — the
        // strip scrolls instead.
        expect(screen.getAllByRole("tab").length).toBeGreaterThanOrEqual(9);
    });
});
