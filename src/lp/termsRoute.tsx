import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";

/**
 * The `/terms` route, or nothing when `VITE_SHOW_TERMS_PAGE` is off.
 *
 * The flag is compared INLINE (not through `isTermsPageEnabled()`) on purpose:
 * Vite turns `import.meta.env.VITE_SHOW_TERMS_PAGE` into a literal at build
 * time, the comparison folds to a constant, and the dynamic `import()` below
 * is dropped together with its chunk. With the flag off the draft text is not
 * in `dist/` at all, so an accidental merge publishes nothing, not even an
 * unlinked file. Keep the comparison and the import in the same branch.
 *
 * Mounted from main.tsx among the public pages, outside `AuthLayout`, like
 * `/privacy` and `/legal`. Off, the URL matches the catch-all and renders the
 * 404 page.
 */
export function termsRoutes() {
    if (import.meta.env.VITE_SHOW_TERMS_PAGE !== "true") return null;
    const TermsPage = lazy(() => import("./TermsPage"));
    return (
        <Route
            path="/terms"
            element={
                <Suspense fallback={null}>
                    <TermsPage />
                </Suspense>
            }
        />
    );
}
