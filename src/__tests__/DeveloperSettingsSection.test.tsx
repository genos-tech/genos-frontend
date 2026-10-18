import { CssVarsProvider } from "@mui/joy/styles";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeveloperSettingsSection } from "../components/layout/DeveloperSettingsSection";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const listApiKeys = vi.fn();
const createApiKey = vi.fn();
const revokeApiKey = vi.fn();
const listTeamApiKeys = vi.fn();
const revokeTeamApiKey = vi.fn();
const listWebhooks = vi.fn();
const createWebhook = vi.fn();
const deleteWebhook = vi.fn();

vi.mock("../services/developerApi", async () => {
    const actual = await vi.importActual<typeof import("../services/developerApi")>(
        "../services/developerApi"
    );
    return {
        ...actual,
        listApiKeys: (...a: unknown[]) => listApiKeys(...a),
        createApiKey: (...a: unknown[]) => createApiKey(...a),
        revokeApiKey: (...a: unknown[]) => revokeApiKey(...a),
        listTeamApiKeys: (...a: unknown[]) => listTeamApiKeys(...a),
        revokeTeamApiKey: (...a: unknown[]) => revokeTeamApiKey(...a),
        listWebhooks: (...a: unknown[]) => listWebhooks(...a),
        createWebhook: (...a: unknown[]) => createWebhook(...a),
        deleteWebhook: (...a: unknown[]) => deleteWebhook(...a),
    };
});

// `AppTooltip` calls `useColorScheme`, which throws outside a
// CssVarsProvider. The real app always has one above Settings.
const render = (ui: React.ReactElement) => rtlRender(<CssVarsProvider>{ui}</CssVarsProvider>);

const KEY = {
    id: "k1",
    name: "CI bot",
    prefix: "gnos_abcdef",
    scope: "read" as const,
    teamId: null,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: "2026-08-02T00:00:00Z",
};

const TEAM_KEY = {
    ...KEY,
    id: "tk1",
    name: "Deploy bot",
    prefix: "gnos_teamkey",
    teamId: "t1",
    expiresAt: "2027-01-15T00:00:00Z",
    userId: "u2",
    userName: "Editor Ed",
    userEmail: "ed@example.com",
};

describe("DeveloperSettingsSection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listApiKeys.mockResolvedValue([]);
        listWebhooks.mockResolvedValue([]);
        // Not the owner — the server's 404, which is the common case.
        listTeamApiKeys.mockResolvedValue(null);
    });

    it("lists existing keys by prefix, never by value", async () => {
        listApiKeys.mockResolvedValue([KEY]);
        render(<DeveloperSettingsSection teamId="t1" />);
        await waitFor(() => expect(screen.getByText("CI bot")).toBeInTheDocument());
        // The full key does not exist client-side at all after creation.
        expect(screen.getByText(/gnos_abcdef/)).toBeInTheDocument();
    });

    /**
     * The load-bearing behaviour of this panel. Both secrets are shown
     * exactly once and cannot be recovered, so the UI must present the
     * plaintext and say so — and must not keep showing it afterwards,
     * which would teach people it can be retrieved.
     */
    it("shows a new API key once, with a warning, and hides it on dismiss", async () => {
        const user = userEvent.setup();
        createApiKey.mockResolvedValue({
            status: "created",
            key: "gnos_THE_ONLY_TIME",
            created: KEY,
        });
        render(<DeveloperSettingsSection teamId="t1" />);

        await user.type(screen.getByPlaceholderText(/What is this key for/i), "CI bot");
        await user.click(screen.getByRole("button", { name: /Create key/i }));

        const shown = await screen.findByDisplayValue("gnos_THE_ONLY_TIME");
        expect(shown).toBeInTheDocument();
        expect(screen.getByText(/only time it will be shown/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /I've saved it/i }));
        expect(screen.queryByDisplayValue("gnos_THE_ONLY_TIME")).not.toBeInTheDocument();
    });

    it("shows a new webhook secret once", async () => {
        const user = userEvent.setup();
        createWebhook.mockResolvedValue({
            status: "created",
            secret: "whsec_ONE_SHOT",
            created: {
                id: "w1",
                url: "https://x.example/h",
                description: "",
                events: ["task.created"],
                isActive: true,
                consecutiveFailures: 0,
                disabledAt: null,
                createdAt: "2026-08-02T00:00:00Z",
            },
        });
        render(<DeveloperSettingsSection teamId="t1" />);

        await user.type(
            screen.getByPlaceholderText(/your-app.example.com/i),
            "https://x.example/h"
        );
        await user.click(screen.getByRole("button", { name: /Add webhook/i }));

        expect(await screen.findByDisplayValue("whsec_ONE_SHOT")).toBeInTheDocument();
    });

    /**
     * The server's URL rules are specific ("must resolve to a public
     * address"), and the person reading the message is the one who typed
     * the URL. Replacing it with a generic failure is the difference
     * between them fixing their tunnel and filing a bug against us.
     */
    it("surfaces the server's URL rejection verbatim", async () => {
        const user = userEvent.setup();
        createWebhook.mockResolvedValue({
            status: "invalid",
            message:
                "Webhook URL must resolve to a public address (private, loopback and link-local ranges are refused).",
        });
        render(<DeveloperSettingsSection teamId="t1" />);

        await user.type(
            screen.getByPlaceholderText(/your-app.example.com/i),
            "https://localhost/h"
        );
        await user.click(screen.getByRole("button", { name: /Add webhook/i }));

        expect(await screen.findByText(/must resolve to a public address/i)).toBeInTheDocument();
    });

    it("explains a disabled endpoint rather than just hiding it", async () => {
        listWebhooks.mockResolvedValue([
            {
                id: "w1",
                url: "https://dead.example/h",
                description: "",
                events: ["task.created"],
                isActive: false,
                consecutiveFailures: 10,
                disabledAt: "2026-08-02T00:00:00Z",
                createdAt: "2026-08-02T00:00:00Z",
            },
        ]);
        render(<DeveloperSettingsSection teamId="t1" />);
        expect(await screen.findByText(/Disabled after repeated failures/i)).toBeInTheDocument();
    });

    it("does not try to load webhooks without a team", async () => {
        render(<DeveloperSettingsSection teamId={null} />);
        await waitFor(() => expect(listApiKeys).toHaveBeenCalled());
        expect(listWebhooks).not.toHaveBeenCalled();
        expect(listTeamApiKeys).not.toHaveBeenCalled();
    });

    /**
     * Every key expires now. The form must send a lifetime — 90 days
     * unless the person picks another — and offer no "never".
     */
    it("creates a key with the 90-day default lifetime", async () => {
        const user = userEvent.setup();
        createApiKey.mockResolvedValue({ status: "created", key: "gnos_X", created: KEY });
        render(<DeveloperSettingsSection teamId="t1" />);

        await user.type(screen.getByPlaceholderText(/What is this key for/i), "CI bot");
        await user.click(screen.getByRole("button", { name: /Create key/i }));

        await waitFor(() =>
            expect(createApiKey).toHaveBeenCalledWith("tok", {
                name: "CI bot",
                scope: "read",
                expiresInDays: 90,
            })
        );
    });

    it("creates a key with the lifetime the person picks", async () => {
        const user = userEvent.setup();
        createApiKey.mockResolvedValue({ status: "created", key: "gnos_X", created: KEY });
        render(<DeveloperSettingsSection teamId="t1" />);

        await user.click(screen.getByRole("combobox", { name: /Expires after/i }));
        const options = screen.getAllByRole("option").map((o) => o.textContent);
        expect(options).toEqual(["30 days", "90 days", "180 days", "365 days"]);
        await user.click(screen.getByRole("option", { name: "365 days" }));

        await user.type(screen.getByPlaceholderText(/What is this key for/i), "CI bot");
        await user.click(screen.getByRole("button", { name: /Create key/i }));

        await waitFor(() =>
            expect(createApiKey).toHaveBeenCalledWith(
                "tok",
                expect.objectContaining({ expiresInDays: 365 })
            )
        );
    });

    it("says when each key expires, and flags one that never does", async () => {
        listApiKeys.mockResolvedValue([
            { ...KEY, id: "k1", name: "Old key", expiresAt: null },
            { ...KEY, id: "k2", name: "New key", expiresAt: "2027-01-15T00:00:00Z" },
        ]);
        render(<DeveloperSettingsSection teamId="t1" />);

        expect(await screen.findByText(/Never expires/i)).toBeInTheDocument();
        const date = new Date("2027-01-15T00:00:00Z").toLocaleDateString("en");
        expect(screen.getByText(`Expires ${date}`)).toBeInTheDocument();
    });

    /**
     * The owner's view of every team key, including ones an editor made —
     * the list above shows the caller's own keys only.
     */
    it("shows the owner every team key, with who made it, and revokes one", async () => {
        const user = userEvent.setup();
        listTeamApiKeys.mockResolvedValueOnce([TEAM_KEY]).mockResolvedValue([]);
        revokeTeamApiKey.mockResolvedValue(true);
        render(<DeveloperSettingsSection teamId="t1" />);

        expect(await screen.findByText("Team API keys")).toBeInTheDocument();
        expect(listTeamApiKeys).toHaveBeenCalledWith("tok", "t1");
        expect(screen.getByText("Deploy bot")).toBeInTheDocument();
        expect(screen.getByText("Made by Editor Ed")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Revoke Deploy bot" }));

        await waitFor(() => expect(revokeTeamApiKey).toHaveBeenCalledWith("tok", "t1", "tk1"));
        expect(revokeApiKey).not.toHaveBeenCalled();
        expect(await screen.findByText(/No team keys right now/i)).toBeInTheDocument();
    });

    /**
     * A non-owner gets a 404 (`null`), and the section is ABSENT, not
     * empty — "no team keys" would be a false statement about the team.
     */
    it("hides the team-keys section from anyone but the owner", async () => {
        render(<DeveloperSettingsSection teamId="t1" />);
        await waitFor(() => expect(listTeamApiKeys).toHaveBeenCalled());
        expect(await screen.findByText(/No API keys yet/i)).toBeInTheDocument();
        expect(screen.queryByText("Team API keys")).not.toBeInTheDocument();
        expect(screen.queryByText(/No team keys right now/i)).not.toBeInTheDocument();
    });
});
