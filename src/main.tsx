import "./index.css";

import { createRoot } from "react-dom/client";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { PageNotFound } from "./components/layout/pageNotFound";
import { AuthGuard, GuestGuard } from "./features/admin/authGuard";
import { JoinTeam } from "./features/admin/components/joinTeamFrom";
import { SignInForm } from "./features/admin/components/SignInForm";
import { SignUpForm } from "./features/admin/components/SignUpForm";

import { App } from "./App";
import GenosLandingPage from "./LandingPage";

createRoot(document.getElementById("root")!).render(
    <AuthProvider>
        <Router>
            <Routes>
                {/* Guest-only Routes (redirect to /home if already logged in) */}
                <Route element={<GuestGuard />}>
                    <Route element={<SignInForm />} path="/" />
                    <Route element={<SignUpForm />} path="/signup" />
                    <Route element={<SignInForm />} path="/signin" />
                    <Route element={<GenosLandingPage />} path="/home" />
                </Route>

                <Route element={<PageNotFound />} path="*" />

                {/* Protected Routes */}
                <Route element={<AuthGuard />}>
                    <Route element={<App />} path="/home/*" />
                    <Route element={<JoinTeam />} path="/jointeam" />
                </Route>
            </Routes>
        </Router>
    </AuthProvider>
);
