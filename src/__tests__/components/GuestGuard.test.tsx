import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../../context/AuthContext";
import { GuestGuard } from "../../features/admin/authGuard";
import { saveLastWorkspacePath } from "../../utils/lastWorkspacePath";

vi.mock("../../context/AuthContext", () => ({
    useAuth: vi.fn(),
}));

describe("GuestGuard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            accessToken: null,
        });
    });

    const renderGuest = (initialPath = "/") =>
        render(
            <MemoryRouter initialEntries={[initialPath]}>
                <Routes>
                    <Route element={<GuestGuard />}>
                        <Route element={<div>Sign In Page</div>} path="/" />
                        <Route element={<div>Sign In Page</div>} path="/signin" />
                    </Route>
                    <Route element={<div>Join Team</div>} path="/jointeam" />
                    <Route element={<div>Genos Home</div>} path="/workspace/genos" />
                    <Route element={<div>Notes Page</div>} path="/workspace/notes/my/1" />
                </Routes>
            </MemoryRouter>
        );

    it("shows the guest route when signed out", async () => {
        renderGuest();
        expect(await screen.findByText("Sign In Page")).toBeInTheDocument();
    });

    it("redirects signed-in users without a team to /jointeam", async () => {
        localStorage.setItem("isSigningIn", "yes");
        renderGuest();
        expect(await screen.findByText("Join Team")).toBeInTheDocument();
    });

    it("redirects signed-in users with a team to Genos home by default", async () => {
        localStorage.setItem("isSigningIn", "yes");
        localStorage.setItem("teamId", "t1");
        renderGuest();
        expect(await screen.findByText("Genos Home")).toBeInTheDocument();
    });

    it("redirects signed-in users to their last workspace page", async () => {
        localStorage.setItem("isSigningIn", "yes");
        localStorage.setItem("teamId", "t1");
        saveLastWorkspacePath("/workspace/notes/my/1");
        renderGuest();
        expect(await screen.findByText("Notes Page")).toBeInTheDocument();
    });
});
