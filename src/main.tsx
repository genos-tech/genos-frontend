import "@fontsource-variable/noto-sans-jp/index.css";
import "./index.css";

import { ComponentType, lazy, Suspense } from "react";
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

// The public marketing pages are code-split away from the app entry.
// They are the only consumers of framer-motion, and nobody who opens
// /signin or /workspace ever renders one — statically importing them put
// `src/lp` plus the whole framer-motion / motion-dom tree into the entry
// chunk that every app session downloads.
//
// The trade runs the other way for marketing visitors, who now wait one
// extra round-trip for the page chunk after the entry evaluates. That is
// an acceptable price here because app sessions vastly outnumber
// marketing hits — but the real fix for /home is a separate Vite entry
// so it stops downloading the app shell at all. See the PR for that.
const GenosDemoPage = lazy(() => import("./lp/DemoPage"));
const GenosFeaturesPage = lazy(() => import("./lp/FeaturesPage"));
const GenosLandingPage = lazy(() => import("./lp/LandingPage"));
const GenosLegalPage = lazy(() => import("./lp/LegalPage"));
const GenosPlansPage = lazy(() => import("./lp/PlansPage"));
const GenosPrivacyPage = lazy(() => import("./lp/PrivacyPage"));

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

// Suspense boundary for the lazy marketing pages. Deliberately wrapped
// per-route rather than around the whole <Routes>: an outer boundary
// would also catch suspensions from App.tsx's own lazy route homes and
// blank the workspace instead of letting their local fallbacks render.
//
// `fallback={null}` on purpose — these pages mount their own theme and
// i18n providers, so any spinner rendered here would be unthemed and
// flash the wrong colors before the real page swaps in.
const publicPage = (Page: ComponentType) => (
    <Suspense fallback={null}>
        <Page />
    </Suspense>
);

createRoot(document.getElementById("root")!).render(
    <Router>
        <Routes>
            {/* Public company / marketing page. Fully isolated from the auth
                stack: no AuthProvider, no guards, no redirects. */}
            <Route element={publicPage(GenosLandingPage)} path="/home" />

            {/* Public product guide (features, how-to, shortcuts). Linked from
                the landing page and, like /home, fully isolated from the auth
                stack: it renders its own I18nProvider internally. */}
            <Route element={publicPage(GenosFeaturesPage)} path="/features-guide" />

            {/* Public demo walkthrough (how to sign in as a demo user, what
                the sample workspace contains, and copy-paste Spotlight
                prompts). Same isolation as /features-guide: renders its own
                I18nProvider internally, no auth stack. */}
            <Route element={publicPage(GenosDemoPage)} path="/demo-guide" />

            {/* Public pricing / plans comparison. Reachable from the landing
                page without signing in: renders its own I18nProvider and reads
                the public billing/plans endpoint (no auth stack, no guards). */}
            <Route element={publicPage(GenosPlansPage)} path="/plans" />

            {/* 特定商取引法に基づく表記 — the legal disclosure Japanese law
                requires of paid online services, incl. the cancellation /
                refund policy the Stripe portal and checkout link to. Static
                legal text (ja + en summary), so no I18nProvider. */}
            <Route element={publicPage(GenosLegalPage)} path="/legal" />

            {/* プライバシーポリシー — same conventions as /legal (static
                ja + en legal text, no I18nProvider). Linked from the Stripe
                customer portal's privacy link and the landing footer. */}
            <Route element={publicPage(GenosPrivacyPage)} path="/privacy" />

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
