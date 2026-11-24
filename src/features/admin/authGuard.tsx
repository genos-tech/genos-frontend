import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../context/authState";
import { useTranslation } from "../../i18n";
import { resolveLoggedInLandingPath } from "../../utils/lastWorkspacePath";
import { rememberReturn } from "../../utils/pendingReturn";
import {
    readSettingsParam,
    resolveSettingsTab,
    SETTINGS_PARAM,
} from "../../utils/settingsDeepLink";

export const AuthGuard = () => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const { pathname, search } = useLocation();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, [accessToken]);

    if (loading) return <div>{t.admin.guard.loading}</div>;

    if (localStorage.getItem("isSigningIn") === "yes") return <Outlet />;
    // A signed-out visit to a Settings link keeps its tab through sign-in (MIP-2323).
    const settings = readSettingsParam(search);
    if (pathname.startsWith("/workspace") && settings !== null) {
        rememberReturn(`/workspace?${SETTINGS_PARAM}=${resolveSettingsTab(settings)}`);
    }
    return <Navigate to="/signin" />;
};

export const GuestGuard = () => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, [accessToken]);

    if (loading) return <div>{t.admin.guard.loading}</div>;

    // Still signed in → restore last workspace page (or Genos home).
    // No team yet → /jointeam so they can pick/create one. Signed out
    // or expired session → show the guest route (signin/signup).
    return localStorage.getItem("isSigningIn") === "yes" ? (
        <Navigate to={resolveLoggedInLandingPath()} replace />
    ) : (
        <Outlet />
    );
};
