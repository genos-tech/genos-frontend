/**
 * Typed error for plan-limit rejections.
 *
 * The tier system answers HTTP 429 (monthly creation caps, AI quotas)
 * and 413 (per-file upload size) with a `limit_reached: true` JSON
 * body. Axios call sites already surface these via the interceptor's
 * `limitReached` toast (`services/api.ts`); RAW-FETCH call sites (the
 * task create services) throw this typed error instead so their
 * catch-sites can render the limit message inside their own error UI
 * (create-form error pane, quick-add inline error) rather than the
 * generic "failed" copy.
 */

export interface LimitReachedBody {
    error?: string;
    limit_reached?: boolean;
    used?: number;
    limit?: number;
    category?: string;
}

export class LimitReachedError extends Error {
    readonly category?: string;
    readonly used?: number;
    readonly limit?: number;

    constructor(message: string, opts?: Pick<LimitReachedBody, "category" | "used" | "limit">) {
        super(message);
        this.name = "LimitReachedError";
        this.category = opts?.category;
        this.used = opts?.used;
        this.limit = opts?.limit;
    }
}

/**
 * Inspect a failed fetch Response; return a `LimitReachedError` when it
 * is a plan-limit rejection, else null. Reads the body via `clone()` so
 * the caller can still consume the original response. The error message
 * is the SERVER's `error` string (already user-facing "Upgrade your
 * plan…" copy) — callers may replace it with a localized template using
 * the carried `used`/`limit`.
 */
export const parseLimitReached = async (resp: Response): Promise<LimitReachedError | null> => {
    if (resp.status !== 429 && resp.status !== 413) return null;
    try {
        const body = (await resp.clone().json()) as LimitReachedBody | null;
        if (body?.limit_reached) {
            return new LimitReachedError(body.error ?? "", {
                category: body.category,
                used: body.used,
                limit: body.limit,
            });
        }
    } catch {
        /* non-JSON body (proxy error page) — not a limit rejection */
    }
    return null;
};
