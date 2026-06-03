import "./index.css";

import { createRoot } from "react-dom/client";
import { Outlet, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { PageNotFound } from "./components/layout/pageNotFound";
import { AuthGuard, GuestGuard } from "./features/admin/authGuard";
import { AcceptInviteHandler } from "./features/admin/components/AcceptInviteHandler";
import { AuthShell } from "./features/admin/components/AuthShell";
import { JoinTeam } from "./features/admin/components/joinTeamFrom";
import { OAuthSuccessHandler } from "./features/admin/components/OAuthSuccessHandler";
import { ResetPasswordForm } from "./features/admin/components/ResetPasswordForm";
import { SignInForm } from "./features/admin/components/SignInForm";
import { SignUpForm } from "./features/admin/components/SignUpForm";
import { VerifyEmailHandler } from "./features/admin/components/VerifyEmailHandler";
import { OAUTH_INTEGRATIONS_ENABLED } from "./features/integrations/featureFlags";
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
                {/* AuthShell owns the visual chrome (theme + i18n providers,
                    gradient background, AdminHeader, footer) shared by every
                    admin-auth route. Mounted once so switching between
                    /signin, /signup, /jointeam, etc. only swaps the inner
                    column — no provider re-init, no header flash.

                    `/workspace/*` is intentionally NOT under AuthShell:
                    App.tsx still owns its own CssVarsProvider / I18nProvider.
                    Lifting those is a separate, bigger refactor. */}
                <Route element={<AuthShell />}>
                    {/* Guest-only routes (redirect to /jointeam if already logged in) */}
                    <Route element={<GuestGuard />}>
                        <Route element={<SignInForm />} path="/" />
                        <Route element={<SignUpForm />} path="/signup" />
                        <Route element={<SignInForm />} path="/signin" />
                        <Route element={<ResetPasswordForm />} path="/reset-password" />
                    </Route>

                    {/* OAuth bounce — not auth-guarded. Reached by both
                        signed-out users (login intent: the page reads
                        the JWT from the URL hash and finishes sign-in)
                        and signed-in users (failure paths only — connect
                        successes go straight to the next route). */}
                    {OAUTH_INTEGRATIONS_ENABLED && (
                        <Route element={<OAuthSuccessHandler />} path="/oauth/success" />
                    )}

                    {/* Email verification — outside guards because the user
                        is not signed in yet. After verifying they're sent
                        to /signin to authenticate. */}
                    <Route element={<VerifyEmailHandler />} path="/verify-email" />

                    {/* Invite acceptance — outside BOTH guards because the
                        visitor may be logged in OR not. The signup/signin
                        branch happens inside the handler based on the
                        preview response, never a blind redirect (GuestGuard
                        would bounce a logged-in visitor). */}
                    <Route element={<AcceptInviteHandler />} path="/accept-invite" />

                    {/* JoinTeam is auth-guarded but shares the same chrome
                        as the sign-in cluster, so it lives under AuthShell. */}
                    <Route element={<AuthGuard />}>
                        <Route element={<JoinTeam />} path="/jointeam" />
                    </Route>
                </Route>

                {/* Workspace is outside AuthShell — App.tsx renders its own
                    providers and full-screen layout. */}
                <Route element={<AuthGuard />}>
                    <Route element={<App />} path="/workspace/*" />
                </Route>

                {/* Catch-all 404. Lives inside the auth layout because
                    PageNotFound uses useNavigate, but it doesn't read auth
                    state itself. */}
                <Route element={<PageNotFound />} path="*" />
            </Route>
        </Routes>
    </Router>
);
