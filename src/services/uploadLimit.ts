/**
 * The current user's per-file upload ceiling, resolved once and shared.
 *
 * `upload_max_mb` lives on `/agent/features/` and nowhere cheaper: the
 * JWT claims carry only username/email/avatar, `AuthContext` holds just
 * the token, and `/billing/subscription/` is null for free users and
 * blind to a team-granted tier. So this is the endpoint — but it is
 * emphatically NOT one to fetch per consumer.
 *
 * Uploads are guarded from deep inside the tree: thirteen BlockNote
 * editors, the v3 composer, four avatar modals, the task-attachment
 * uploader. Several mount at once, many stay mounted (the keep-alive
 * Homes), and a naive fetch inside `useFileSizeGuard` would be an N+1
 * on every editor instance. `createRequestCache` collapses that to one
 * request: concurrent callers share the in-flight promise, later ones
 * read the cached payload.
 *
 * The TTL is long because the value is a plan attribute, not live data.
 * The one moment it changes — an upgrade — is signalled explicitly, so
 * `BILLING_REFRESHED` invalidates rather than the clock. Without that a
 * user who upgrades in an already-open tab keeps their old ceiling
 * until the TTL lapses.
 */

import { fetchAgentFeatures } from "./agentApi";
import { createRequestCache } from "./requestCache";

/** 10 minutes. Long enough that a session of editing costs one request;
 *  short enough that a tier change arriving by some path we don't know
 *  about still lands without a reload. */
const TTL_MS = 10 * 60 * 1000;

/** `null` = no tier ceiling resolved. Deliberately preserved rather than
 *  collapsed to a number here, so the caller decides what "unknown"
 *  means — see `ABSOLUTE_MAX_UPLOAD_BYTES`. */
const cache = createRequestCache<number | null>({ ttlMs: TTL_MS });

const KEY = "upload-limit";

export const resolveUploadLimitBytes = (accessToken: string | null): Promise<number | null> => {
    if (!accessToken) return Promise.resolve(null);
    return cache.get(KEY, async () => {
        const features = await fetchAgentFeatures(accessToken);
        const mb = features?.upload_max_mb;
        // `fetchAgentFeatures` returns null on any failure, and
        // `upload_max_mb` is itself nullable (the server's own accessor
        // fails open). Both land here as null — "we don't know" — which
        // is the honest answer and the permissive one.
        if (mb == null) return null;
        return mb * 1024 * 1024;
    });
};

/** Drop the cached ceiling — call after anything that can change the
 *  user's tier. */
export const invalidateUploadLimit = (): void => cache.invalidate(KEY);
