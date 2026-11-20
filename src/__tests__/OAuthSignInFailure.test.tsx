/**
 * What the OAuth bounce page tells you when a sign-in is refused.
 *
 * The provider flow carries no form the user filled in, so a refusal here
 * arrives with no context at all: they clicked "Continue with Google",
 * were never shown an address, and landed on an error. A message that
 * only says what went wrong leaves them with nowhere to go — the page has
 * to name the method that WILL work, which is what the backend's
 * `primary` param is for.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { OAuthSuccessHandler } from "../features/admin/components/OAuthSuccessHandler";

vi.mock("../context/AuthContext", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../context/AuthContext")>()),
    useAuth: vi.fn(),
}));

const renderAt = (search: string) => {
    window.history.replaceState({}, "", `/oauth/success${search}`);
    render(
        <CssVarsProvider>
            <MemoryRouter initialEntries={["/oauth/success"]}>
                <OAuthSuccessHandler />
            </MemoryRouter>
        </CssVarsProvider>
    );
};

describe("OAuth sign-in failure", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ setAccessToken: vi.fn() });
    });

    it("points a calendar-only account at the password it signs in with", async () => {
        renderAt("?error=not_a_login_account&primary=email");
        expect(
            await screen.findByText(/calendar access.*your email and password instead/i)
        ).toBeInTheDocument();
    });

    it("names the provider when that is the account's sign-in method", async () => {
        renderAt("?error=email_in_use&primary=google");
        expect(
            await screen.findByText(/already exists.*Sign in with Google instead/i)
        ).toBeInTheDocument();
    });

    it("still offers a way forward when the method is unknown", async () => {
        renderAt("?error=not_a_login_account");
        expect(
            await screen.findByText(/the method you originally signed up with/i)
        ).toBeInTheDocument();
    });

    it("sends someone who skipped the consent box to the sign-up page", async () => {
        renderAt("?error=terms_required");
        expect(
            await screen.findByText(/agree to the Terms of Service and the Privacy Policy/i)
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Go to sign up" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Back to sign in" })).toBeNull();
    });

    it("says Google could not confirm the address, and that nothing was created (MIP-1770)", async () => {
        renderAt("?error=email_not_verified");
        expect(
            await screen.findByText(/could not confirm.*no account was created.*sign up/is)
        ).toBeInTheDocument();
        // No other method exists to point at, and the generic text is not shown.
        expect(screen.queryByText(/instead/i)).toBeNull();
        expect(screen.queryByText("OAuth flow failed.")).toBeNull();
        // The way out is the sign-in page, where sign-up is reachable.
        expect(screen.getByRole("button", { name: "Back to sign in" })).toBeInTheDocument();
    });

    it("does not say whether the address is registered", async () => {
        renderAt("?error=email_not_verified&primary=email");
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).not.toMatch(/already|exists|in use|registered/i);
        expect(alert.textContent).not.toMatch(/your email and password instead/i);
    });

    it("still shows the generic message for a code it does not know", async () => {
        renderAt("?error=something_new");
        expect(await screen.findByText("OAuth flow failed.")).toBeInTheDocument();
        expect(screen.queryByText(/could not confirm/i)).toBeNull();
    });
});
