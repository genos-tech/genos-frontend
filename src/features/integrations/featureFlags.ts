/**
 * Master kill-switch for the OAuth + Integrations surface.
 *
 * When `false` (the default while we keep the feature in main but
 * hide it from end users), all of the following disappear:
 *
 *   - "Continue with Google" / "Continue with GitHub" buttons on
 *     SignInForm and SignUpForm (and the "or" divider above the
 *     email/password form, which only makes sense alongside the
 *     OAuth buttons).
 *   - The "Integrations" entry in the sidebar nav.
 *   - The `/workspace/integrations` route.
 *   - The `/oauth/success` bounce route.
 *
 * Backend OAuth endpoints stay live regardless — they're not user-
 * facing on their own. Only the frontend surfaces are gated.
 *
 * Flip to `true` to re-enable everything for ongoing development.
 * That's the only change required.
 */
export const OAUTH_INTEGRATIONS_ENABLED = false;
