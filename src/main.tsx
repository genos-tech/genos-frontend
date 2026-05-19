import "./index.css";

import { createRoot } from "react-dom/client";
import { Outlet, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { PageNotFound } from "./components/layout/pageNotFound";
import { AuthGuard, GuestGuard } from "./features/admin/authGuard";
import { JoinTeam } from "./features/admin/components/joinTeamFrom";
import { SignInForm } from "./features/admin/components/SignInForm";
import { SignUpForm } from "./features/admin/components/SignUpForm";
import { analytics } from "./services/analytics";
import { startLongTaskObserver } from "./services/perfObserver";

import { App } from "./App";
import GenosLandingPage from "./lp/LandingPage";

// Initialize PostHog once, before React mounts. No-ops when
// VITE_POSTHOG_KEY / VITE_POSTHOG_HOST are unset, so leaving them blank
// in .env.local is the local-dev kill switch.
analytics.init();

// Dev-only: log main-thread tasks >50ms to the console. The observer is
// stripped from production builds by Vite's dead-code elimination on
// `import.meta.env.DEV`. See `services/perfObserver.ts` for the audit
// procedure (Phase 6.1 deliverable).
if (import.meta.env.DEV) {
    startLongTaskObserver();
}

// Layout for everything that needs access to AuthContext (the sign-in /
// sign-up flows, the authenticated workspace, join-team, the 404 page).
// Public marketing pages such as /home are intentionally rendered OUTSIDE
// this layout so AuthProvider never mounts on them — that means no token
// refresh, no forced sign-out redirect, and no useAuth dependency.
const AuthLayout = () => (
    <AuthProvider>
        <Outlet />
    </AuthProvider>
);

createRoot(document.getElementById("root")!).render(
    <Router>
        <Routes>
            {/* Public company / marketing page. Fully isolated from the auth
                stack: no AuthProvider, no guards, no redirects. */}
            <Route element={<GenosLandingPage />} path="/home" />

            {/* All routes that need authentication context. */}
            <Route element={<AuthLayout />}>
                {/* Guest-only routes (redirect to /jointeam if already logged in) */}
                <Route element={<GuestGuard />}>
                    <Route element={<SignInForm />} path="/" />
                    <Route element={<SignUpForm />} path="/signup" />
                    <Route element={<SignInForm />} path="/signin" />
                </Route>

                {/* Protected routes */}
                <Route element={<AuthGuard />}>
                    <Route element={<App />} path="/workspace/*" />
                    <Route element={<JoinTeam />} path="/jointeam" />
                </Route>

                {/* Catch-all 404. Lives inside the auth layout because
                    PageNotFound uses useNavigate, but it doesn't read auth
                    state itself. */}
                <Route element={<PageNotFound />} path="*" />
            </Route>
        </Routes>
    </Router>
);
