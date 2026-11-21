/**
 * Where the signup consent checkbox sends people to read what they agree to.
 *
 * The Terms of Service are the interim v1 page at `/terms` (MIP-1843). That
 * route exists only when the build has `VITE_SHOW_TERMS_PAGE=true`; until then
 * the link leads to the 404 page. Switch the flag on in the same release that
 * ships this constant.
 */
export const TERMS_PATH = "/terms";

/** The Privacy Policy page. */
export const PRIVACY_PATH = "/privacy";
