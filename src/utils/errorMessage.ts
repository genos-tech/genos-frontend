/**
 * A displayable message from an API error body. DRF answers a plain string,
 * `{ detail }`, `{ message }`, `{ error }`, `{ non_field_errors: [..] }`, a
 * list of strings, or field errors (`{ project_id: ["..."] }`); a proxy or a
 * 500 may answer an HTML page or nothing. React throws on an object child,
 * so the result is always a string: the first usable message found, else
 * `fallback`.
 */
const HTML_PAGE = /^\s*<(!doctype|html|head|body)\b/i;

const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" && !HTML_PAGE.test(value) ? value : null;

const firstText = (value: unknown): string | null =>
    Array.isArray(value) ? (value.map(text).find((m) => m !== null) ?? null) : text(value);

export const errorMessageFrom = (data: unknown, fallback: string): string => {
    if (data != null && typeof data === "object" && !Array.isArray(data)) {
        const body = data as Record<string, unknown>;
        for (const key of ["detail", "message", "error", "non_field_errors"]) {
            const found = firstText(body[key]);
            if (found) return found;
        }
        // Field errors: the first readable one.
        for (const value of Object.values(body)) {
            const found = firstText(value);
            if (found) return found;
        }
        return fallback;
    }
    return firstText(data) ?? fallback;
};
