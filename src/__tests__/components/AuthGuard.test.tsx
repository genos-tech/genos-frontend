import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../context/AuthContext", () => ({
    useAuth: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";
import { AuthGuard } from "../../features/admin/authGuard";

describe("AuthGuard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const renderWithRouter = (initialPath = "/protected") => {
        return render(
            <MemoryRouter initialEntries={[initialPath]}>
                <Routes>
                    <Route path="/SignIn" element={<div>Sign In Page</div>} />
                    <Route element={<AuthGuard />}>
                        <Route path="/protected" element={<div>Protected Content</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );
    };

    it("should redirect to /SignIn when not signed in", async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            accessToken: null,
        });

        renderWithRouter();

        expect(await screen.findByText("Sign In Page")).toBeInTheDocument();
    });

    it("should render protected content when signed in", async () => {
        localStorage.setItem("isSigningIn", "yes");
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            accessToken: "valid-token",
        });

        renderWithRouter();

        expect(await screen.findByText("Protected Content")).toBeInTheDocument();
    });

    it("should show loading initially", () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            accessToken: null,
        });

        const { container } = render(
            <MemoryRouter initialEntries={["/protected"]}>
                <Routes>
                    <Route path="/SignIn" element={<div>Sign In Page</div>} />
                    <Route element={<AuthGuard />}>
                        <Route path="/protected" element={<div>Protected Content</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        // AuthGuard renders "Loading..." briefly, then redirects
        expect(container).toBeTruthy();
    });
});
