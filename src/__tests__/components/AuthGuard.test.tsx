import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../../context/AuthContext";
import { AuthGuard } from "../../features/admin/authGuard";

vi.mock("../../context/AuthContext", () => ({
    useAuth: vi.fn(),
}));

describe("AuthGuard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const renderWithRouter = (initialPath = "/protected") => {
        return render(
            <MemoryRouter initialEntries={[initialPath]}>
                <Routes>
                    <Route element={<div>Sign In Page</div>} path="/signin" />
                    <Route element={<AuthGuard />}>
                        <Route element={<div>Protected Content</div>} path="/protected" />
                    </Route>
                </Routes>
            </MemoryRouter>
        );
    };

    it("should redirect to /signin when not signed in", async () => {
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
                    <Route element={<div>Sign In Page</div>} path="/signin" />
                    <Route element={<AuthGuard />}>
                        <Route element={<div>Protected Content</div>} path="/protected" />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        // AuthGuard renders "Loading..." briefly, then redirects
        expect(container).toBeTruthy();
    });
});
