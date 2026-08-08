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
import { registerServiceWorkerOnBoot } from "./services/notifications/pushSubscription";
import { startLongTaskObserver } from "./services/perfObserver";

import { App } from "./App";
import { applyDocumentLocale, bootI18n, resolveInitialLocale } from "./i18n";

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
const GenosBlogArticlePage = lazy(() => import("./lp/BlogArticlePage"));
const GenosBlogPage = lazy(() => import("./lp/BlogPage"));
const GenosDemoPage = lazy(() => import("./lp/DemoPage"));
const GenosDevelopersPage = lazy(() => import("./lp/DevelopersPage"));
const GenosFeaturesPage = lazy(() => import("./lp/FeaturesPage"));
const GenosLandingPage = lazy(() => import("./lp/LandingPage"));
const GenosLegalPage = lazy(() => import("./lp/LegalPage"));
const GenosPlansPage = lazy(() => import("./lp/PlansPage"));
const GenosPrivacyPage = lazy(() => import("./lp/PrivacyPage"));

// Initialize PostHog once, before React mounts. No-ops when
// VITE_POSTHOG_KEY / VITE_POSTHOG_HOST are unset, so leaving them blank
// in .env.local is the local-dev kill switch.
analytics.init();

// Register the push service worker at boot. Previously registration only
// happened after the user granted notification permission, which meant a
// visitor who never touched the permission prompt had no service worker —
// and on iOS, no worker means the page can't become a push-capable
// installed PWA at all.
registerServiceWorkerOnBoot();

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

const tree = (
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

            {/* English marketing / engineering blog. Snapshots live under
                src/lp/blog/; sync from genos-docs/marketing via blog:sync.
                Japanese platform drafts are intentionally not published here. */}
            <Route element={publicPage(GenosBlogPage)} path="/blog" />
            <Route element={publicPage(GenosBlogArticlePage)} path="/blog/:slug" />

            {/* 特定商取引法に基づく表記 — the legal disclosure Japanese law
                requires of paid online services, incl. the cancellation /
                refund policy the Stripe portal and checkout link to. Static
                legal text (ja + en summary), so no I18nProvider. */}
            <Route element={publicPage(GenosLegalPage)} path="/legal" />

            {/* プライバシーポリシー — same conventions as /legal (static
                ja + en legal text, no I18nProvider). Linked from the Stripe
                customer portal's privacy link and the landing footer. */}
            <Route element={publicPage(GenosDevelopersPage)} path="/developers" />
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
                    {/* Guest-only routes (redirect to last workspace /
                        Genos home if already logged in; /jointeam only
                        when the user has no team yet) */}
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

const mount = () => createRoot(document.getElementById("root")!).render(tree);

// Gate the mount on the initial locale's catalog.
//
// The six non-English catalogs are lazy-loaded (`i18n/localeLoaders.ts`).
// Two things depend on one being resolved before any app code runs:
// `getMessages()` is synchronous and read by ~30 service modules, and a
// render-first approach would show every non-English user a frame of
// English before flipping.
//
// English needs no fetch, so English users mount synchronously exactly as
// before — no added latency, not even a microtask. `bootI18n` swallows and
// logs its own failures; the `.catch` here is a belt-and-braces guarantee
// that a broken catalog chunk can never leave a white screen. It swallows
// rather than mounting, so `.then(mount)` runs exactly once either way.
const initialLocale = resolveInitialLocale();

// Write <html lang>/<html dir> BEFORE the mount, not just from
// `I18nProvider`'s effect.
//
// `index.html` ships a hard-coded `lang="en"`, and this is a pure
// client-rendered SPA — one `index.html`, no prerender step — so that
// attribute is what every request receives. Until React mounted, a
// Japanese or Arabic user's document claimed to be English: a screen
// reader starting to read immediately used an English voice, and an
// Arabic user got a left-to-right document. For a non-English locale the
// mount is gated on a catalog fetch below, so that window is a network
// round-trip, not a frame.
//
// Placed before the branch so it covers English too — an English user who
// had previously switched away and back still lands on a document whose
// attributes match, rather than inheriting whatever the last locale set.
applyDocumentLocale(initialLocale);

if (initialLocale === "en") {
    mount();
} else {
    void bootI18n(initialLocale)
        .catch(() => {})
        .then(mount);
}
