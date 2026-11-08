/**
 * MIP-1301: "Disconnect" on a Google or GitHub account deleted the stored tokens in
 * one click, and coming back is a full OAuth round trip. It asks first, and Cancel
 * sends nothing. The primary account (the one you sign in with) stays disabled.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionsSection } from "../features/integrations/components/ConnectionsSection";

const listConnections = vi.fn();
const disconnectAccount = vi.fn();

vi.mock("../features/integrations/services/connections", async () => {
    const actual = await vi.importActual<
        typeof import("../features/integrations/services/connections")
    >("../features/integrations/services/connections");
    return {
        ...actual,
        listConnections: (...a: unknown[]) => listConnections(...a),
        disconnectAccount: (...a: unknown[]) => disconnectAccount(...a),
    };
});
vi.mock("../features/integrations/services/oauth", () => ({
    redirectToOAuthConnect: vi.fn(),
}));

const account = (over: object) => ({
    id: "a1",
    provider: "google",
    provider_email: "work@example.com",
    scopes: [],
    is_primary: false,
    ...over,
});

const setup = () =>
    render(
        <CssVarsProvider>
            <ConnectionsSection accessToken="tok" />
        </CssVarsProvider>
    );

beforeEach(() => {
    vi.clearAllMocks();
    listConnections.mockResolvedValue({
        primary_auth_provider: "email",
        connections: [
            account({ id: "g1" }),
            account({ id: "h1", provider: "github", provider_email: "ken@example.com" }),
        ],
    });
    disconnectAccount.mockResolvedValue(true);
});
afterEach(cleanup);

describe("disconnecting an account", () => {
    it("Google: asks with the account named, and Cancel disconnects nothing", async () => {
        setup();
        fireEvent.click((await screen.findAllByRole("button", { name: "Disconnect" }))[0]);
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Disconnect Google?")).toBeTruthy();
        expect(within(dialog).getByText("work@example.com")).toBeTruthy();
        expect(dialog.textContent).toMatch(/calendar/i);
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(disconnectAccount).not.toHaveBeenCalled();
    });

    it("GitHub: its own copy, and Disconnect removes that account only", async () => {
        setup();
        const buttons = await screen.findAllByRole("button", { name: "Disconnect" });
        fireEvent.click(buttons[1]);
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText("Disconnect GitHub?")).toBeTruthy();
        expect(within(dialog).getByText("ken@example.com")).toBeTruthy();
        expect(dialog.textContent).toMatch(/pull request/i);
        fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
        await waitFor(() => expect(disconnectAccount).toHaveBeenCalledTimes(1));
        expect(disconnectAccount.mock.calls[0][1]).toBe("h1");
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    });

    it("the account you sign in with cannot be disconnected, so nothing opens", async () => {
        listConnections.mockResolvedValue({
            primary_auth_provider: "google",
            connections: [account({ id: "g1", is_primary: true })],
        });
        setup();
        const button = await screen.findByRole("button", { name: "Disconnect" });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });
});
