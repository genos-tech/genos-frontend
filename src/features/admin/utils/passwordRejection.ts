import { getMessages } from "../../../i18n";

/**
 * The server refused a new password (signup or reset, MIP-2238): it answers
 * `{ code: "password_rejected", password_errors: [...] }`. Returns the message in the
 * member's language, or null when the body is not such a refusal.
 */
export const passwordRejectionMessage = (data: unknown): string | null => {
    const body = data as { code?: unknown; password_errors?: unknown } | null | undefined;
    if (!body || body.code !== "password_rejected") return null;
    const m = getMessages().admin.auth;
    const codes = Array.isArray(body.password_errors) ? body.password_errors : [];
    // A breached password is the most specific thing to say, then a short one, else "too common".
    if (codes.includes("password_breached")) return m.errors.passwordBreached;
    if (codes.includes("password_too_short")) return m.signUp.passwordTooWeak;
    return m.errors.passwordCommon;
};
