/**
 * Where "Genos Assist Schedules" can be found (MIP-1200).
 *
 * They used to sit at the bottom of Settings > Developer, where nobody looked.
 * Now: they are a section of Settings > Genos (and Developer no longer carries
 * them), and the Genos page opens the SAME `SchedulesSection` from an
 * icon-only button (MIP-1218: top right on desktop, next to the history button
 * on a phone; no row in the session sidebar). `SchedulesSection` is stubbed so these tests pin WHERE it is
 * mounted and that both hosts mount one component, not what it fetches
 * (`SchedulesSection.test.tsx` covers that).
 *
 * jsdom has no layout engine: the placement on the page (top-right corner, phone
 * width, no shift of the conversation) was checked in a browser, see the PR.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsModal } from "../components/layout/SettingsModal";
import { GenosHome } from "../features/genos/GenosHome";
import { GenosSessionSidebar } from "../features/genos/GenosSessionSidebar";
import { en } from "../i18n/locales/en";

// Big dialogs rendered through Joy: slow when the whole suite shares the machine.
vi.setConfig({ testTimeout: 30000 });

const sectionProps = vi.fn();
vi.mock("../components/layout/schedules/SchedulesSection", () => ({
    SchedulesSection: (props: { teamId: string; showHeading?: boolean }) => {
        sectionProps(props);
        return <div data-testid="schedules-section">{props.teamId}</div>;
    },
}));

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));
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
vi.mock("../components/layout/DeveloperSettingsSection", () => ({
    DeveloperSettingsSection: () => <div data-testid="developer-section" />,
}));
vi.mock("../components/layout/TeamEmojiPanel", () => ({
    TeamEmojiPanel: () => <div />,
}));
// The Genos page: its conversation column and session feed are other
// features; the entry under test lives in the button the page owns.
vi.mock("../features/spotlight/SpotlightContent", () => ({
    SpotlightContent: () => <div data-testid="spotlight-content" />,
    hasAskContent: () => false,
}));
vi.mock("../features/genos/useGenosSessions", () => ({
    useGenosSessions: () => ({
        sessions: [],
        isLoading: false,
        loadFailed: false,
        reload: vi.fn(),
        search: "",
        setSearch: vi.fn(),
        pinError: null,
        togglePin: vi.fn(),
    }),
}));
vi.mock("../hooks/common/useIsDemoUser", () => ({ useIsDemoUser: () => false }));

beforeEach(() => {
    isMobileViewport = false;
    sectionProps.mockClear();
    localStorage.clear();
    localStorage.setItem("teamId", "team-7");
});

const renderSettings = () =>
    render(
        <CssVarsProvider>
            <MemoryRouter>
                <SettingsModal open onClose={vi.fn()} />
            </MemoryRouter>
        </CssVarsProvider>
    );

const spotlight = {
    turns: [],
    ask: { sessionId: null },
    historyMode: "closed",
    resumeIsLoading: false,
    resumeError: null,
    resumeSession: vi.fn(),
    onNewConversation: vi.fn(),
    registerPageInputFocus: vi.fn(),
} as never;

const renderGenos = () =>
    render(
        <CssVarsProvider>
            <GenosHome
                accessToken="tok"
                spotlight={spotlight}
                teamId="team-7"
                onOpenSettings={vi.fn()}
                onPreview={vi.fn()}
                onSelect={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("Settings > Genos > Genos Assist Schedules", () => {
    it("shows the schedules in the Genos tab, under the other Genos settings", async () => {
        renderSettings();
        await userEvent.click(screen.getByRole("tab", { name: en.settings.tabs.spotlight }));
        const panel = screen.getByRole("tabpanel");
        expect(within(panel).getByTestId("schedules-section")).toHaveTextContent("team-7");
        // The section keeps its own heading here (only the Genos page's dialog drops it).
        expect(sectionProps).toHaveBeenLastCalledWith(
            expect.not.objectContaining({ showHeading: false })
        );
    });

    it("has no tab of its own for them", () => {
        renderSettings();
        expect(screen.queryByRole("tab", { name: /schedules/i })).toBeNull();
    });

    it("no longer carries the schedules in the Developer tab", async () => {
        renderSettings();
        await userEvent.click(screen.getByRole("tab", { name: en.settings.tabs.developer }));
        const panel = screen.getByRole("tabpanel");
        expect(within(panel).getByTestId("developer-section")).toBeInTheDocument();
        expect(within(panel).queryByTestId("schedules-section")).toBeNull();
    });

    it("is called Genos Assist Schedules", () => {
        expect(en.settings.schedules.title).toBe("Genos Assist Schedules");
        expect(en.settings.schedules.shortTitle).toBe("Assist schedules");
    });
});

describe("Genos page schedules entry (MIP-1218)", () => {
    const NAME = en.settings.schedules.shortTitle;

    it("is the short name everywhere it shows: Assist schedules", () => {
        expect(NAME).toBe("Assist schedules");
    });

    it("desktop: one icon-only button with the tooltip text and no visible label", async () => {
        renderGenos();
        const entry = screen.getByRole("button", { name: NAME });
        expect(screen.getAllByRole("button", { name: NAME })).toHaveLength(1);
        // Icon only: the words are the accessible name and the tooltip, never on the page.
        expect(entry).toHaveTextContent("");
        expect(entry.querySelector("svg")).toBeTruthy();
        expect(screen.queryByText(NAME)).toBeNull();
        await userEvent.hover(entry);
        expect(await screen.findByRole("tooltip")).toHaveTextContent(NAME);
    });

    it("the session sidebar carries no schedules row any more", () => {
        render(
            <CssVarsProvider>
                <GenosSessionSidebar
                    activeSessionId={null}
                    isLoading={false}
                    loadFailed={false}
                    pinError={null}
                    resumeError={null}
                    search=""
                    sessions={[]}
                    onNewChat={vi.fn()}
                    onRetry={vi.fn()}
                    onSearchChange={vi.fn()}
                    onSelectSession={vi.fn()}
                    onTogglePin={vi.fn()}
                />
            </CssVarsProvider>
        );
        expect(screen.queryByText(/assist schedules/i)).toBeNull();
        expect(screen.queryByTestId("genos-schedules-entry")).toBeNull();
        expect(screen.queryByRole("button", { name: /schedules/i })).toBeNull();
    });

    it("desktop: opens the shared schedules component in a dialog, with the Genos page's team", async () => {
        renderGenos();
        expect(screen.queryByTestId("schedules-section")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: NAME }));
        const dialog = await screen.findByRole("dialog");
        const title = document.getElementById(dialog.getAttribute("aria-labelledby")!)!;
        // The dialog keeps the full name.
        expect(title.textContent).toBe("Genos Assist Schedules");
        expect(within(dialog).getByTestId("schedules-section")).toHaveTextContent("team-7");
        // The dialog is already titled: the section must not repeat the heading.
        expect(sectionProps).toHaveBeenLastCalledWith(
            expect.objectContaining({ showHeading: false })
        );
    });

    it("does not open an empty dialog while the team is unknown", async () => {
        render(
            <CssVarsProvider>
                <GenosHome
                    accessToken="tok"
                    spotlight={spotlight}
                    teamId={null}
                    onOpenSettings={vi.fn()}
                    onPreview={vi.fn()}
                    onSelect={vi.fn()}
                />
            </CssVarsProvider>
        );
        await userEvent.click(screen.getByRole("button", { name: NAME }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByRole("status")).toHaveTextContent(
            en.settings.schedules.loading
        );
        expect(within(dialog).queryByTestId("schedules-section")).toBeNull();
    });

    it("phone: the entry sits right next to the history button, visible without opening the drawer", async () => {
        isMobileViewport = true;
        renderGenos();
        const history = screen.getByRole("button", { name: en.genos.sidebar.openLabel });
        const entry = screen.getByRole("button", { name: NAME });
        expect(screen.getAllByRole("button", { name: NAME })).toHaveLength(1);
        // Adjacent siblings in one row: history first, the entry beside it.
        expect(entry.parentElement).toBe(history.parentElement);
        expect(history.nextElementSibling).toBe(entry);
        expect(entry).toHaveTextContent("");
        await userEvent.click(entry);
        expect(await screen.findByTestId("schedules-section")).toBeInTheDocument();
    });

    it("phone: the history drawer has no second schedules entry", async () => {
        isMobileViewport = true;
        renderGenos();
        await userEvent.click(screen.getByRole("button", { name: en.genos.sidebar.openLabel }));
        expect(screen.getAllByRole("button", { name: NAME })).toHaveLength(1);
    });
});
