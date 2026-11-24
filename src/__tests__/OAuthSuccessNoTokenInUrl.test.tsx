/**
 * MIP-2219: the bounce page must never sign the browser in with a token that came from the URL.
 *
 * A link anyone can craft (`/oauth/success#access=<attacker JWT>`) used to sign the victim's tab
 * in as the attacker. The session now comes only from the refresh cookie the API sets on the OAuth
 * callback, so a forged link in a browser that never finished an OAuth round trip goes nowhere.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/authState";
import { OAuthSuccessHandler } from "../features/admin/components/OAuthSuccessHandler";
import { authApi } from "../services/api";
import { refreshSession } from "../services/refreshSession";

vi.mock("../context/authState", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../context/authState")>()),
    useAuth: vi.fn(),
}));
vi.mock("../services/refreshSession", () => ({ refreshSession: vi.fn() }));
vi.mock("../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/api")>()),
    authApi: vi.fn(),
}));

const ATTACKER = "attacker.jwt.value";

const LandedAt = ({ name }: { name: string }) => {
    const { pathname } = useLocation();
    return <div data-testid="landed">{`${name}:${pathname}`}</div>;
};

const renderAt = (hash: string) => {
    window.history.replaceState({}, "", `/oauth/success${hash}`);
    return render(
        <CssVarsProvider>
            <MemoryRouter initialEntries={["/oauth/success"]}>
                <Routes>
                    <Route element={<OAuthSuccessHandler />} path="/oauth/success" />
                    <Route element={<LandedAt name="signin" />} path="/signin" />
                    <Route element={<LandedAt name="app" />} path="/jointeam" />
                    <Route element={<LandedAt name="app" />} path="/workspace" />
                </Routes>
            </MemoryRouter>
        </CssVarsProvider>
    );
};

const ME = {
    id: "u1",
    username: "me",
    email: "me@example.com",
    profile_image_file_name: null,
    is_offline_forced: false,
    custom_status: null,
    role: null,
    base_country: null,
    phone_number: null,
    current_location: null,
    about_me: null,
    ts_created_at: "2020-01-01T00:00:00Z",
};

describe("OAuth bounce page ignores a token in the URL", () => {
    const setAccessToken = vi.fn();
    const get = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ setAccessToken });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
        get.mockResolvedValue({ data: ME });
    });

    it("does not sign in with a forged access token when this browser has no session cookie", async () => {
        (refreshSession as ReturnType<typeof vi.fn>).mockResolvedValue({
            kind: "unauthenticated",
        });
        const { findByTestId } = renderAt(`#access=${ATTACKER}&next=/jointeam`);
        expect((await findByTestId("landed")).textContent).toBe("signin:/signin");
        expect(setAccessToken).not.toHaveBeenCalled();
        expect(authApi).not.toHaveBeenCalledWith(ATTACKER);
        expect(get).not.toHaveBeenCalled();
    });

    it("signs in with the token the refresh cookie yields, not the one in the URL", async () => {
        (refreshSession as ReturnType<typeof vi.fn>).mockResolvedValue({
            kind: "ok",
            access: "cookie.jwt.value",
        });
        const { findByTestId } = renderAt(`#access=${ATTACKER}&next=/workspace`);
        expect((await findByTestId("landed")).textContent).toBe("app:/workspace");
        expect(authApi).toHaveBeenCalledWith("cookie.jwt.value");
        expect(authApi).not.toHaveBeenCalledWith(ATTACKER);
        expect(setAccessToken).toHaveBeenCalledWith("cookie.jwt.value");
        expect(window.location.hash).toBe("");
    });

    it("works with the fragment the API sends now (next only)", async () => {
        (refreshSession as ReturnType<typeof vi.fn>).mockResolvedValue({
            kind: "ok",
            access: "cookie.jwt.value",
        });
        const { findByTestId } = renderAt("#next=/workspace");
        expect((await findByTestId("landed")).textContent).toBe("app:/workspace");
    });

    it("sends a visitor with no fragment to sign-in without asking the API", async () => {
        const { findByTestId } = renderAt("");
        expect((await findByTestId("landed")).textContent).toBe("signin:/signin");
        expect(refreshSession).not.toHaveBeenCalled();
    });

    it("does not follow a next that leaves the app", async () => {
        (refreshSession as ReturnType<typeof vi.fn>).mockResolvedValue({
            kind: "ok",
            access: "cookie.jwt.value",
        });
        const { findByTestId } = renderAt("#next=//evil.example/x");
        await waitFor(async () =>
            expect((await findByTestId("landed")).textContent).toBe("app:/jointeam")
        );
    });
});
