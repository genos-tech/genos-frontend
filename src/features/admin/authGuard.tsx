import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n";
import { resolveLoggedInLandingPath } from "../../utils/lastWorkspacePath";

export const AuthGuard = () => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, [accessToken]);

    if (loading) return <div>{t.admin.guard.loading}</div>;

    return localStorage.getItem("isSigningIn") === "yes" ? <Outlet /> : <Navigate to="/signin" />;
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
