/**
 * MIP-1865: the boot screen says "Your session may have expired" on a normal first load.
 *
 * The prompt appears after 5 s on the boot screen. The screen only mounts with a valid access
 * token, so a slow load is not an expired session: the copy must say the server is still being
 * reached, and must not blame the session. A session that really expires is signed out by
 * AuthContext, which redirects to /signin.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InitialLoad } from "../components/ui/misc/InitialLoad";
import { I18nProvider } from "../i18n";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "token", setAccessToken: () => {} }),
}));
vi.mock("../services/loadInitialData", () => ({ loadInitialData: () => {} }));

const myself = { userId: "u1", userName: "new-user" } as never;

const renderSlowBoot = () =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <MemoryRouter>
                    <InitialLoad
                        firstRefreshDone={false}
                        myself={myself}
                        setCurrentMainChat={() => {}}
                        setIsLoading={() => {}}
                    />
                </MemoryRouter>
            </I18nProvider>
        </CssVarsProvider>
    );

describe("InitialLoad slow-boot prompt (MIP-1865)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not show the prompt before 5 s", () => {
        renderSlowBoot();
        expect(screen.queryByText(/taking longer/i)).toBeNull();
    });

    it("after 5 s says the server is still being reached, and never that the session expired", () => {
        renderSlowBoot();
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(screen.getByText(/taking longer than expected/i)).toBeTruthy();
        expect(screen.getByText(/still connecting to the server/i)).toBeTruthy();
        expect(screen.queryByText(/expired/i)).toBeNull();
        expect(screen.queryByText(/sign in again/i)).toBeNull();
    });

    it("offers a reload instead of sign-in while online", () => {
        renderSlowBoot();
        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    });
});
