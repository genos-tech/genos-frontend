/**
 * Where the signup consent checkbox sends people to read what they agree to.
 *
 * The Terms of Service have no page of their own yet: the text is waiting for
 * counsel. Until it ships, the "Terms of Service" link opens the legal notice
 * (`/legal`), the only terms-like page we publish. When a `/terms` route
 * exists, this constant is the only thing that changes.
 */
export const TERMS_PATH = "/legal";

/** The Privacy Policy page. */
export const PRIVACY_PATH = "/privacy";
