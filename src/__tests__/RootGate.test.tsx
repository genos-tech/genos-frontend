/**
 * The address `/` (MIP-1747): the home page for a signed-out visitor, the app for
 * someone still signed in. The marketing page must not need the auth stack, so the
 * gate reads storage directly.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RootGate } from "../features/admin/RootGate";

vi.mock("../utils/lastWorkspacePath", () => ({
    resolveLoggedInLandingPath: () => "/workspace/genos",
}));

const renderAt = () =>
    render(
        <MemoryRouter initialEntries={["/"]}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <RootGate>
                            <div>the home page</div>
                        </RootGate>
                    }
                />
                <Route element={<div>the app</div>} path="/workspace/genos" />
            </Routes>
        </MemoryRouter>
    );

describe("RootGate", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("shows the home page to a signed-out visitor", () => {
        renderAt();
        expect(screen.getByText("the home page")).toBeTruthy();
        expect(screen.queryByText("the app")).toBeNull();
    });

    it("sends someone who is still signed in to the app, never flashing the home page", () => {
        window.localStorage.setItem("isSigningIn", "yes");
        renderAt();
        expect(screen.getByText("the app")).toBeTruthy();
        expect(screen.queryByText("the home page")).toBeNull();
    });

    it("treats any other value of the flag as signed out", () => {
        window.localStorage.setItem("isSigningIn", "no");
        renderAt();
        expect(screen.getByText("the home page")).toBeTruthy();
    });
});
