import { Outlet } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

// Layout for everything that needs access to AuthContext (the sign-in /
// sign-up flows, the authenticated workspace, join-team, the 404 page).
// Public marketing pages such as /home are intentionally rendered OUTSIDE
// this layout so AuthProvider never mounts on them — that means no token
// refresh, no forced sign-out redirect, and no useAuth dependency.
export const AuthLayout = () => (
    <AuthProvider>
        <Outlet />
    </AuthProvider>
);
