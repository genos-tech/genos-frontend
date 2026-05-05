import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

export const AuthGuard = () => {
    const { accessToken } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, [accessToken]);

    if (loading) return <div>Loading...</div>;

    return localStorage.getItem("isSigningIn") === "yes" ? <Outlet /> : <Navigate to="/signin" />;
};

export const GuestGuard = () => {
    const { accessToken } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, [accessToken]);

    if (loading) return <div>Loading...</div>;

    return localStorage.getItem("isSigningIn") === "yes" ? (
        <Navigate to="/jointeam" />
    ) : (
        <Outlet />
    );
};
