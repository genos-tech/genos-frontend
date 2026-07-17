/**
 * The Stripe return-redirect handling in `BillingReturnSnackbar`.
 *
 * The load-bearing behaviour is the reconcile call: `success` and
 * `portal_return` must fire `refreshBillingTier` (a lost webhook —
 * `stripe listen` down locally, handler crash in prod — otherwise
 * leaves the app on a stale tier), `cancelled` must not (nothing
 * changed), and the handler must wait for the async auth bootstrap
 * instead of dropping the param when the token isn't there yet.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BillingReturnSnackbar } from "../components/layout/BillingReturnSnackbar";
import { refreshBillingTier } from "../services/billingApi";

let authState: { accessToken: string | null } = { accessToken: "tok" };
vi.mock("../context/AuthContext", () => ({
    useAuth: () => authState,
}));

vi.mock("../services/billingApi", () => ({
    refreshBillingTier: vi.fn().mockResolvedValue("max"),
}));

const setUrl = (search: string) => {
    window.history.replaceState(null, "", `/${search}`);
};

const renderSnackbar = () =>
    render(
        <CssVarsProvider>
            <BillingReturnSnackbar />
        </CssVarsProvider>
    );

describe("BillingReturnSnackbar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authState = { accessToken: "tok" };
        setUrl("");
    });

    it("success: toasts, reconciles, and strips the params", async () => {
        setUrl("?billing=success&plan=pro");
        renderSnackbar();
        expect(await screen.findByText(/your subscription is active/i)).toBeTruthy();
        expect(refreshBillingTier).toHaveBeenCalledWith("tok");
        expect(window.location.search).toBe("");
    });

    it("portal_return: reconciles silently and strips the param", async () => {
        setUrl("?billing=portal_return");
        renderSnackbar();
        await waitFor(() => expect(refreshBillingTier).toHaveBeenCalledWith("tok"));
        // No toast — a portal visit may have been invoice browsing.
        expect(screen.queryByText(/your subscription is active/i)).toBeNull();
        expect(screen.queryByText(/checkout cancelled/i)).toBeNull();
        expect(window.location.search).toBe("");
    });

    it("cancelled: toasts but does NOT reconcile", async () => {
        setUrl("?billing=cancelled");
        renderSnackbar();
        expect(await screen.findByText(/checkout cancelled/i)).toBeTruthy();
        expect(refreshBillingTier).not.toHaveBeenCalled();
        expect(window.location.search).toBe("");
    });

    it("no billing param: does nothing and leaves the URL alone", () => {
        setUrl("?tab=settings");
        renderSnackbar();
        expect(refreshBillingTier).not.toHaveBeenCalled();
        expect(screen.queryByText(/your subscription is active/i)).toBeNull();
        expect(window.location.search).toBe("?tab=settings");
    });

    it("waits for the auth bootstrap: param survives until the token arrives", async () => {
        authState = { accessToken: null };
        setUrl("?billing=portal_return");
        const { rerender } = renderSnackbar();
        // Pre-auth: nothing consumed, nothing called.
        expect(refreshBillingTier).not.toHaveBeenCalled();
        expect(window.location.search).toBe("?billing=portal_return");
        // Token lands → the effect re-runs and handles the param.
        authState = { accessToken: "tok" };
        rerender(
            <CssVarsProvider>
                <BillingReturnSnackbar />
            </CssVarsProvider>
        );
        await waitFor(() => expect(refreshBillingTier).toHaveBeenCalledWith("tok"));
        expect(window.location.search).toBe("");
    });

    it("strips other billing-return params but keeps unrelated ones", async () => {
        setUrl("?billing=success&plan=max&tab=settings");
        renderSnackbar();
        await waitFor(() => expect(refreshBillingTier).toHaveBeenCalled());
        expect(window.location.search).toBe("?tab=settings");
    });
});
