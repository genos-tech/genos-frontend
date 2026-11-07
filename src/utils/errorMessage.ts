/**
 * A displayable message from an API error body. DRF answers a plain string,
 * `{ detail }`, `{ message }` or `{ error }`; a proxy or a 500 may answer an
 * HTML page or nothing. React throws on an object child, so anything that is
 * not a usable string becomes `fallback`.
 */
export const errorMessageFrom = (data: unknown, fallback: string): string => {
    const pick = (value: unknown): string | null =>
        typeof value === "string" && value.trim() !== "" && !value.trimStart().startsWith("<")
            ? value
            : null;
    if (data != null && typeof data === "object") {
        const body = data as Record<string, unknown>;
        return pick(body.detail) ?? pick(body.message) ?? pick(body.error) ?? fallback;
    }
    return pick(data) ?? fallback;
};
