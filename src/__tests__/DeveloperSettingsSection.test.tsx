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

describe("DeveloperSettingsSection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listApiKeys.mockResolvedValue([]);
        listWebhooks.mockResolvedValue([]);
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
    });
});
