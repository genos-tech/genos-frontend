/**
 * Build-time switch for the public Terms of Service page (`/terms`).
 *
 * `VITE_SHOW_TERMS_PAGE=true` turns it on; anything else (including unset, the
 * default) leaves the whole feature out:
 *
 *  - no `/terms` route is registered, so the URL falls through to the 404 page;
 *  - the page chunk (the draft text) is not emitted into `dist/` at all
 *    (see `termsRoute.tsx`);
 *  - no link to it appears anywhere (the landing footer asks this function).
 *
 * Why it exists: counsel's official text arrives in mid-December 2026 and
 * nothing legal may be published before then. The page and its plumbing are
 * built ahead of time; an accidental merge must still publish nothing.
 *
 * Read at call time (not cached in a module constant) so tests can switch it
 * with `vi.stubEnv`. In a production build Vite replaces the expression with a
 * literal, so nothing is lost.
 */
export const isTermsPageEnabled = (): boolean => import.meta.env.VITE_SHOW_TERMS_PAGE === "true";
