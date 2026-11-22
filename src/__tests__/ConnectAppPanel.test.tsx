/**
 * Settings -> Developer -> Connected apps -> "Connect your AI" (MIP-2020; the OAuth way, no API key).
 *
 * One test per state the panel can be in: list still loading, nothing connected (open),
 * apps connected (collapsed, openable), list failed to load (open), one tab per app,
 * the connection check (not connected, connected without and with activity), the Free
 * plan notice, the preference with its per-app "where to paste", the address copied,
 * the clipboard missing or refusing (the text is selected instead), and no API origin
 * (the address rows are left out rather than shown relative).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    latestActivity,
    OPEN_PLAN_EVENT,
    openConnectAppPanel,
} from "../components/layout/connectAppPanelHelpers";
import { ConnectedAppsSection } from "../components/layout/ConnectedAppsSection";
import { en } from "../i18n/locales/en";
import { PLUGIN_COMMANDS, PLUGIN_REPO_URL, PLUGIN_ZIP_URL } from "../utils/mcpConnect";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listMcpConnections = vi.fn();
vi.mock("../services/mcpConnections", () => ({
    listMcpConnections: (...a: unknown[]) => listMcpConnections(...a),
    updateMcpConnection: vi.fn(),
    revokeMcpConnection: vi.fn(),
}));

const fetchAgentFeatures = vi.fn();
vi.mock("../services/agentApi", () => ({
    fetchAgentFeatures: (...a: unknown[]) => fetchAgentFeatures(...a),
}));

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const c = en.settings.connectedApps.connect;
const ai = en.settings.connectedApps.connectAi;
const ORIGIN = "https://api.example.test";
const ADDRESS = `${ORIGIN}/api/public/v1/mcp/core`;

const CONN = {
    id: "c1",
    client: { name: "Claude", kind: "registered" as const, host: "", url: "" },
    scope: "write" as const,
    allowDestructive: false,
    defaultTeamId: "t1",
    teamIds: ["t1"],
    teams: [{ id: "t1", name: "Alpha" }],
    lastUsedAt: null,
    createdAt: "2026-11-06T00:00:00Z",
};

const toggle = () => screen.getByRole("button", { name: new RegExp(`^${ai.title}`) });
const openTab = async (name: string) => {
    await userEvent.setup().click(screen.getByRole("tab", { name }));
};

beforeEach(() => {
    vi.stubEnv("VITE_DJANGO_URL", ORIGIN);
    listMcpConnections.mockReset();
    listMcpConnections.mockResolvedValue({ connections: [], availableTeams: [] });
    fetchAgentFeatures.mockReset();
    fetchAgentFeatures.mockResolvedValue({ tier: "core" });
});

afterEach(() => {
    vi.unstubAllEnvs();
    window.getSelection()?.removeAllRanges();
});

describe("Connect your AI panel", () => {
    it("is not drawn until the list has answered (its default would flip)", () => {
        listMcpConnections.mockReturnValue(new Promise(() => {}));
        render(<ConnectedAppsSection />);
        expect(screen.queryByTestId("connect-app-panel")).toBeNull();
        expect(screen.queryByText(ai.title)).toBeNull();
    });

    it("is open when nothing is connected: three app tabs, the first one's steps, the preference and the notes", async () => {
        render(<ConnectedAppsSection />);
        expect(await screen.findByText("No apps connected yet.")).toBeTruthy();
        expect(toggle().getAttribute("aria-expanded")).toBe("true");

        const tabs = screen.getAllByRole("tab");
        expect(tabs.map((t) => t.textContent)).toEqual([
            ai.tabClaudeCode,
            ai.tabClaudeDesktop,
            ai.tabChatgpt,
        ]);
        expect(screen.getByRole("tablist", { name: ai.tabsAria })).toBeTruthy();
        // Claude Code first: one install, then sign in. Two steps, not ten minutes.
        expect(screen.getAllByRole("listitem")).toHaveLength(ai.claudeCodeSteps.length);
        for (const step of ai.claudeCodeSteps) {
            expect(screen.getByText(step, { exact: false })).toBeTruthy();
        }
        // The "paste the whole address" warning is about an address: not on this tab.
        expect(screen.queryByText(c.trap)).toBeNull();
        expect(screen.getByText(c.revoke)).toBeTruthy();
    });

    it("says nothing about being connected when the list could not be loaded", async () => {
        listMcpConnections.mockResolvedValue(null);
        render(<ConnectedAppsSection />);
        await screen.findByText("Couldn't load your connected apps.");
        expect(screen.queryByTestId("connect-status")).toBeNull();
        expect(screen.queryByText(ai.statusNone)).toBeNull();
    });

    it("Claude Code: both plugin commands in one copy box, and the one-command connection on its own", async () => {
        render(<ConnectedAppsSection />);
        const plugin = await screen.findByTestId("mcp-plugin-command");
        expect(plugin.textContent).toBe(PLUGIN_COMMANDS);
        expect(PLUGIN_COMMANDS.split("\n")).toEqual([
            "/plugin marketplace add genos-tech/genos-claude-plugin",
            "/plugin install genos@genos",
        ]);
        const block = screen.getByTestId("mcp-command");
        expect(block.textContent).toBe(`claude mcp add --transport http genos ${ADDRESS}`);
        expect(block.textContent).not.toMatch(/--header|ApiKey|team_id/);
        expect(block.getAttribute("dir")).toBe("ltr");
        expect(block.getAttribute("translate")).toBe("no");
        expect(screen.getByRole("link", { name: c.pluginRepoLink }).getAttribute("href")).toBe(
            PLUGIN_REPO_URL
        );
    });

    it("claude.ai and Desktop: two steps, the address, and the zip link", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        await openTab(ai.tabClaudeDesktop);
        expect(screen.getByTestId("mcp-address").textContent).toBe(ADDRESS);
        expect(screen.getAllByRole("listitem")).toHaveLength(ai.claudeDesktopSteps.length);
        // The address trap sits where the address is pasted.
        expect(screen.getByText(c.trap)).toBeTruthy();
        // Another app's own menu names stay as it shows them.
        expect(ai.claudeDesktopSteps[0]).toMatch(/Customize.*Connectors.*Add custom connector/);
        const zip = screen.getByRole("link", { name: c.pluginZipLink });
        expect(zip.getAttribute("href")).toBe(PLUGIN_ZIP_URL);
        expect(zip.getAttribute("target")).toBe("_blank");
        expect(zip.getAttribute("rel")).toContain("noopener");
    });

    it("ChatGPT: the steps, the address, and the honest 'not tested end to end' note", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        await openTab(ai.tabChatgpt);
        expect(screen.getAllByRole("listitem")).toHaveLength(ai.chatgptSteps.length);
        expect(screen.getByTestId("mcp-address").textContent).toBe(ADDRESS);
        expect(screen.getByText(ai.chatgptNote)).toBeTruthy();
    });

    it("is collapsed under the list when apps are connected, and opens on click", async () => {
        listMcpConnections.mockResolvedValue({ connections: [CONN], availableTeams: [] });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryByTestId("mcp-command")).toBeNull();
        // The header still says it is connected while it is closed.
        expect(within(toggle()).getByText(ai.statusConnected)).toBeTruthy();

        const user = userEvent.setup();
        await user.click(toggle());
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        // The toggle names the region it controls, and the region is labelled by it.
        const region = screen.getByRole("region", { name: ai.title });
        expect(toggle().getAttribute("aria-controls")).toBe(region.id);
        expect(within(region).getByTestId("mcp-command")).toBeTruthy();

        await user.click(toggle());
        expect(screen.queryByTestId("mcp-command")).toBeNull();
    });

    it("is open when the list could not be loaded: the how-to does not depend on it", async () => {
        listMcpConnections.mockResolvedValue(null);
        render(<ConnectedAppsSection />);
        await screen.findByText("Couldn't load your connected apps.");
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByTestId("mcp-command")).toBeTruthy();
    });

    it("keeps the person's choice when the list finishes loading afterwards", async () => {
        let resolve: (v: unknown) => void = () => {};
        listMcpConnections.mockReturnValue(new Promise((r) => (resolve = r)));
        render(<ConnectedAppsSection />);
        act(() => resolve({ connections: [CONN], availableTeams: [] }));
        await screen.findByTestId("connected-app");
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
    });

    it("leaves the address rows out when the API origin is unknown, and the steps still read", async () => {
        vi.stubEnv("VITE_DJANGO_URL", "");
        vi.stubEnv("VITE_API_BASE_URL", "");
        render(<ConnectedAppsSection />);
        await screen.findByText("No apps connected yet.");
        expect(screen.queryByTestId("mcp-command")).toBeNull();
        await openTab(ai.tabClaudeDesktop);
        expect(screen.queryByTestId("mcp-address")).toBeNull();
        expect(screen.getByText(ai.claudeDesktopSteps[1], { exact: false })).toBeTruthy();
    });

    it("derives the address from the legacy /api/v2 base when only that is set", async () => {
        vi.stubEnv("VITE_DJANGO_URL", "");
        vi.stubEnv("VITE_API_BASE_URL", `${ORIGIN}/api/v2/`);
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-command");
        await openTab(ai.tabClaudeDesktop);
        expect(screen.getByTestId("mcp-address").textContent).toBe(ADDRESS);
    });
});

describe("the connection check", () => {
    it("is a neutral line, not a warning, when nothing is connected", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        const status = screen.getByTestId("connect-status");
        expect(status.textContent).toBe(ai.statusNone);
        expect(within(status).queryByRole("alert")).toBeNull();
    });

    it("says Connected, and that no agent activity has been seen yet, for a connection never used", async () => {
        listMcpConnections.mockResolvedValue({ connections: [CONN], availableTeams: [] });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        await userEvent.setup().click(toggle());
        const status = screen.getByTestId("connect-status");
        expect(status.textContent).toContain(ai.statusConnected);
        expect(status.textContent).toContain(ai.statusNoActivity);
    });

    it("says when an agent was last seen: the most recent use over all connections", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-22T12:00:00Z"));
        try {
            listMcpConnections.mockResolvedValue({
                connections: [
                    { ...CONN, id: "a", lastUsedAt: "2026-11-19T12:00:00Z" },
                    { ...CONN, id: "b", lastUsedAt: "2026-11-22T09:00:00Z" },
                    { ...CONN, id: "c", lastUsedAt: null },
                ],
                availableTeams: [],
            });
            render(<ConnectedAppsSection />);
            await screen.findAllByTestId("connected-app");
            await userEvent.setup({ advanceTimers: () => {} }).click(toggle());
            const status = screen.getByTestId("connect-status");
            expect(status.textContent).toContain(ai.statusConnected);
            expect(status.textContent).toContain("Agent activity seen 3 hours ago");
        } finally {
            vi.useRealTimers();
        }
    });

    it("latestActivity picks the newest parsable time and ignores the rest", () => {
        expect(latestActivity([])).toBeNull();
        expect(latestActivity([{ lastUsedAt: null }])).toBeNull();
        expect(latestActivity([{ lastUsedAt: "not a time" }])).toBeNull();
        expect(
            latestActivity([
                { lastUsedAt: "2026-11-01T00:00:00Z" },
                { lastUsedAt: "2026-11-20T00:00:00Z" },
                { lastUsedAt: null },
            ])
        ).toBe("2026-11-20T00:00:00Z");
    });
});

describe("the Free plan notice", () => {
    it("says the connector needs Core and links to Plan & Usage, which the Settings modal listens for", async () => {
        fetchAgentFeatures.mockResolvedValue({ tier: "free" });
        render(<ConnectedAppsSection />);
        const notice = await screen.findByTestId("connect-free-plan");
        expect(notice.textContent).toContain(ai.freePlan);
        const onPlan = vi.fn();
        window.addEventListener(OPEN_PLAN_EVENT, onPlan);
        try {
            await userEvent
                .setup()
                .click(within(notice).getByRole("button", { name: en.settings.tabs.planUsage }));
            expect(onPlan).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener(OPEN_PLAN_EVENT, onPlan);
        }
    });

    it("is absent on a paid plan, and when the plan could not be read", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        await waitFor(() => expect(fetchAgentFeatures).toHaveBeenCalled());
        expect(screen.queryByTestId("connect-free-plan")).toBeNull();
    });

    it("is absent when the plan could not be read (the notice is an extra, never a blocker)", async () => {
        fetchAgentFeatures.mockResolvedValue(null);
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        await waitFor(() => expect(fetchAgentFeatures).toHaveBeenCalled());
        expect(screen.queryByTestId("connect-free-plan")).toBeNull();
    });
});

describe("the one-line preference", () => {
    it("is copyable, and says where to paste it for the app on the open tab", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        expect(screen.getByTestId("mcp-preference").textContent).toBe(ai.prefText);
        const where = () => screen.getByTestId("mcp-preference-where").textContent;
        expect(where()).toBe(ai.prefWhereClaudeCode);
        await openTab(ai.tabClaudeDesktop);
        expect(where()).toBe(ai.prefWhereClaudeDesktop);
        expect(where()).toContain("Settings → Profile");
        await openTab(ai.tabChatgpt);
        expect(where()).toBe(ai.prefWhereChatgpt);
        expect(where()).toMatch(/custom instructions/i);

        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText");
        await user.click(screen.getByRole("button", { name: ai.prefCopyAria }));
        expect(writeText).toHaveBeenCalledWith(ai.prefText);
    });

    it("selects the sentence and says so when the clipboard refuses", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-preference");
        const user = userEvent.setup();
        vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
        await user.click(screen.getByRole("button", { name: ai.prefCopyAria }));
        expect(await screen.findByText(c.copyFailed)).toBeTruthy();
        expect(window.getSelection()?.toString()).toBe(ai.prefText);
    });
});

describe("copying", () => {
    it("copies the exact address and says Copied", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        await openTab(ai.tabClaudeDesktop);
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText");
        await user.click(screen.getByRole("button", { name: c.copyAria }));
        expect(writeText).toHaveBeenCalledWith(ADDRESS);
        await waitFor(() =>
            expect(screen.getByRole("button", { name: c.copyAria }).textContent).toContain(
                c.copied
            )
        );
        // Announced as well, not only a changed label.
        expect(screen.getAllByRole("status").some((el) => el.textContent === c.copied)).toBe(true);
    });

    it("copies the command from its own button", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-command");
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText");
        await user.click(screen.getByRole("button", { name: c.copyCommandAria }));
        expect(writeText).toHaveBeenCalledWith(`claude mcp add --transport http genos ${ADDRESS}`);
    });

    it("copies both plugin commands from one button", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText");
        await user.click(screen.getByRole("button", { name: ai.claudeCodeCommandAria }));
        expect(writeText).toHaveBeenCalledWith(PLUGIN_COMMANDS);
    });

    it("selects the text and says so when the clipboard refuses", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        await openTab(ai.tabClaudeDesktop);
        const user = userEvent.setup();
        vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
        await user.click(screen.getByRole("button", { name: c.copyAria }));
        expect(await screen.findByText(c.copyFailed)).toBeTruthy();
        expect(window.getSelection()?.toString()).toBe(ADDRESS);
        expect(screen.queryByText(c.copied, { selector: "button *" })).toBeNull();
    });

    it("selects the text when there is no clipboard API at all", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-plugin-command");
        await openTab(ai.tabClaudeDesktop);
        const user = userEvent.setup();
        Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
        await user.click(screen.getByRole("button", { name: c.copyAria }));
        expect(await screen.findByText(c.copyFailed)).toBeTruthy();
        expect(window.getSelection()?.toString()).toBe(ADDRESS);
    });
});

describe("pointing at the panel from elsewhere", () => {
    it("opens it when it is collapsed", async () => {
        listMcpConnections.mockResolvedValue({ connections: [CONN], availableTeams: [] });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
        act(() => openConnectAppPanel());
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
    });

    it("does nothing, and does not throw, when the panel is not on screen", () => {
        expect(() => openConnectAppPanel()).not.toThrow();
    });
});
