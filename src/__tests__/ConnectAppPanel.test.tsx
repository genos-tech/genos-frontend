/**
 * Settings -> Developer -> Connected apps -> "Connect an AI app" (the OAuth way, no API key).
 *
 * One test per state the panel can be in: list still loading, nothing connected (open),
 * apps connected (collapsed, openable), list failed to load (open), the address copied,
 * the clipboard missing or refusing (the text is selected instead), and no API origin
 * (the address row is left out rather than shown relative).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openConnectAppPanel } from "../components/layout/ConnectAppPanel";
import { ConnectedAppsSection } from "../components/layout/ConnectedAppsSection";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listMcpConnections = vi.fn();
vi.mock("../services/mcpConnections", () => ({
    listMcpConnections: (...a: unknown[]) => listMcpConnections(...a),
    updateMcpConnection: vi.fn(),
    revokeMcpConnection: vi.fn(),
}));

const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const c = en.settings.connectedApps.connect;
const ORIGIN = "https://api.example.test";
const ADDRESS = `${ORIGIN}/api/public/v1/mcp`;

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

const toggle = () => screen.getByRole("button", { name: c.title });

beforeEach(() => {
    vi.stubEnv("VITE_DJANGO_URL", ORIGIN);
    listMcpConnections.mockReset();
    listMcpConnections.mockResolvedValue({ connections: [], availableTeams: [] });
});

afterEach(() => {
    vi.unstubAllEnvs();
    window.getSelection()?.removeAllRanges();
});

describe("Connect an AI app panel", () => {
    it("is not drawn until the list has answered (its default would flip)", () => {
        listMcpConnections.mockReturnValue(new Promise(() => {}));
        render(<ConnectedAppsSection />);
        expect(screen.queryByTestId("connect-app-panel")).toBeNull();
        expect(screen.queryByText(c.title)).toBeNull();
    });

    it("is open when nothing is connected, with the address, three app sections and the notes", async () => {
        render(<ConnectedAppsSection />);
        expect(await screen.findByText("No apps connected yet.")).toBeTruthy();
        expect(toggle().getAttribute("aria-expanded")).toBe("true");

        expect(screen.getByTestId("mcp-address").textContent).toBe(ADDRESS);
        expect(screen.getByText(c.claudeTitle)).toBeTruthy();
        expect(screen.getByText(c.claudeCodeTitle)).toBeTruthy();
        expect(screen.getByText(c.chatgptTitle)).toBeTruthy();
        // ChatGPT is "coming": no steps, just the line.
        expect(screen.getByText(c.chatgptBody)).toBeTruthy();
        for (const step of [...c.claudeSteps, ...c.claudeCodeSteps]) {
            expect(screen.getAllByText(step, { exact: false }).length).toBeGreaterThan(0);
        }
        // The plan, how to revoke, the one trap.
        expect(screen.getByText(c.plan)).toBeTruthy();
        expect(screen.getByText(c.revoke)).toBeTruthy();
        expect(screen.getByText(c.trap)).toBeTruthy();
    });

    it("puts the Claude Code command in a block that is the OAuth form, address included", async () => {
        render(<ConnectedAppsSection />);
        const block = await screen.findByTestId("mcp-command");
        expect(block.textContent).toBe(`claude mcp add --transport http genos ${ADDRESS}`);
        expect(block.textContent).not.toMatch(/--header|ApiKey|team_id/);
        expect(block.getAttribute("dir")).toBe("ltr");
        expect(block.getAttribute("translate")).toBe("no");
    });

    it("is collapsed under the list when apps are connected, and opens on click", async () => {
        listMcpConnections.mockResolvedValue({ connections: [CONN], availableTeams: [] });
        render(<ConnectedAppsSection />);
        await screen.findByTestId("connected-app");
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryByTestId("mcp-address")).toBeNull();

        const user = userEvent.setup();
        await user.click(toggle());
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        // The toggle names the region it controls, and the region is labelled by it.
        const region = screen.getByRole("region", { name: c.title });
        expect(toggle().getAttribute("aria-controls")).toBe(region.id);
        expect(within(region).getByTestId("mcp-address").textContent).toBe(ADDRESS);

        await user.click(toggle());
        expect(screen.queryByTestId("mcp-address")).toBeNull();
    });

    it("is open when the list could not be loaded: the how-to does not depend on it", async () => {
        listMcpConnections.mockResolvedValue(null);
        render(<ConnectedAppsSection />);
        await screen.findByText("Couldn't load your connected apps.");
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByTestId("mcp-address")).toBeTruthy();
    });

    it("keeps the person's choice when the list finishes loading afterwards", async () => {
        let resolve: (v: unknown) => void = () => {};
        listMcpConnections.mockReturnValue(new Promise((r) => (resolve = r)));
        render(<ConnectedAppsSection />);
        act(() => resolve({ connections: [CONN], availableTeams: [] }));
        await screen.findByTestId("connected-app");
        expect(toggle().getAttribute("aria-expanded")).toBe("false");
    });

    it("leaves the address (and the command) out when the API origin is unknown", async () => {
        vi.stubEnv("VITE_DJANGO_URL", "");
        vi.stubEnv("VITE_API_BASE_URL", "");
        render(<ConnectedAppsSection />);
        await screen.findByText("No apps connected yet.");
        expect(screen.queryByTestId("mcp-address")).toBeNull();
        expect(screen.queryByTestId("mcp-command")).toBeNull();
        expect(screen.queryByRole("button", { name: c.copyAria })).toBeNull();
        // The steps still read.
        expect(screen.getByText(c.claudeTitle)).toBeTruthy();
    });

    it("derives the address from the legacy /api/v2 base when only that is set", async () => {
        vi.stubEnv("VITE_DJANGO_URL", "");
        vi.stubEnv("VITE_API_BASE_URL", `${ORIGIN}/api/v2/`);
        render(<ConnectedAppsSection />);
        expect((await screen.findByTestId("mcp-address")).textContent).toBe(ADDRESS);
    });
});

describe("copying", () => {
    it("copies the exact address and says Copied", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-address");
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

    it("selects the text and says so when the clipboard refuses", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-address");
        const user = userEvent.setup();
        vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
        await user.click(screen.getByRole("button", { name: c.copyAria }));
        expect(await screen.findByText(c.copyFailed)).toBeTruthy();
        expect(window.getSelection()?.toString()).toBe(ADDRESS);
        expect(screen.queryByText(c.copied, { selector: "button *" })).toBeNull();
    });

    it("selects the text when there is no clipboard API at all", async () => {
        render(<ConnectedAppsSection />);
        await screen.findByTestId("mcp-address");
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
