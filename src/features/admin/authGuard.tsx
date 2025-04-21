import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";

const AuthGuard = () => {
    const { accessToken } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, [accessToken]);

    if (loading) return <div>Loading...</div>;

    return (accessToken || localStorage.getItem("isSigningIn") === "yes") ? <Outlet /> : <Navigate to="/SignIn" />;
};

export default AuthGuard;
