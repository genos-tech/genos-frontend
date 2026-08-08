/**
 * Loading protected `/media/` with the session's OWN credential.
 *
 * ## Why this exists
 *
 * `genos-api` gates the attachment trees per file (`views/common/
 * media_views.py`). An `<img>` tag cannot send an `Authorization` header,
 * so those loads authenticate with the HttpOnly `refresh` cookie instead —
 * which works, right up until the browser and the app disagree about who
 * the cookie belongs to:
 *
 *   - The cookie is browser-global, while the access token lives in memory
 *     per tab. A session that gets its cookie rewritten out from under it
 *     (a second sign-in elsewhere in the same browser, rotation racing a
 *     signup) loads images AS THE OTHER USER, who is not in this chat —
 *     the API correctly answers 404 and the picture renders as its
 *     filename.
 *   - Production sets that cookie `SameSite=None` (the app and API are
 *     different sites), so browsers that block third-party cookies — Safari
 *     and Brave by default, Chrome's heuristics hardest on a domain with no
 *     first-party history, i.e. a brand-new account's — send nothing at
 *     all and every attachment 401s.
 *
 * Both were reported as "the recipient saw only the image name". So when a
 * token is available, fetch protected media with it and hand BlockNote an
 * object URL: the picture then depends on the identity the app is actually
 * signed in as, not on whatever the browser is willing to attach.
 *
 * ## What it does NOT touch
 *
 * Avatars and custom emoji, which the API serves publicly on purpose (they
 * render dozens of times per viewport, and web push fetches icons from a
 * context that has no cookies). Sending those through a fetch would trade
 * the browser's image cache for blobs to no benefit — so the public
 * prefixes here mirror `PUBLIC_MEDIA_PREFIXES` in `media_views.py`.
 *
 * ## Failure is always backwards-compatible
 *
 * No token, a non-media URL, a failed fetch, a browser without
 * `createObjectURL` — every one of those returns the original URL, which
 * is exactly today's behavior (the browser tries the cookie). This can
 * make a broken image work; it cannot make a working one break.
 */

/** Mirrors `PUBLIC_MEDIA_PREFIXES` in genos-api `media_views.py`. */
const PUBLIC_MEDIA_PREFIXES = [
    "user_profiles/",
    "team_profiles/",
    "project_profiles/",
    "gm_profiles/",
    "channel_profiles/",
    "team_emoji/",
];

/**
 * The origin our own protected media lives on. A `/media/` PATH is not
 * enough to prove a URL is ours: third-party CDNs shovel user content under
 * `/media/` too — a Giphy insert is `https://media4.giphy.com/media/<id>/
 * giphy.gif`. Fetching one of those with our `Authorization` header both
 * offers the session token to a site that has no business seeing it AND
 * trips the page CSP `connect-src` (giphy isn't listed), which throws a
 * console error on every GIF render. So gate on the host as well as the path.
 *
 * Derived from `VITE_MEDIA_ROOT_DJANGO` (…/media) with the Django root as a
 * fallback — both point at the same API origin the upload path bakes into
 * message bodies. `null` when neither is set (a misconfigured build): we then
 * fall back to the path-only test rather than refuse to authenticate media we
 * can't prove is foreign. Read per call (the value is a Vite build-time
 * constant, so this is effectively free) so it stays stubbable in tests.
 */
const getOwnMediaOrigin = (): string | null => {
    const root =
        (import.meta.env.VITE_MEDIA_ROOT_DJANGO as string | undefined) ||
        (import.meta.env.VITE_DJANGO_URL as string | undefined);
    if (!root) return null;
    try {
        return new URL(root).origin;
    } catch {
        return null;
    }
};

/**
 * Blobs are held so a re-render doesn't re-download, and bounded by BYTES
 * rather than count because one screenshot can outweigh fifty icons.
 *
 * Eviction revokes, which in principle can pull the rug from an `<img>`
 * still pointing at it. Accepted: BlockNote re-runs `resolveFileUrl` when
 * a block remounts, so the practical cost is a re-fetch, and the budget is
 * far above what a single conversation's visible images add up to.
 */
const CACHE_BUDGET_BYTES = 48 * 1024 * 1024;

interface CacheEntry {
    url: Promise<string>;
    /** Resolved value, once known — only revoked if it is a blob we made. */
    objectUrl?: string;
    bytes: number;
}

const cache = new Map<string, CacheEntry>();
let cachedBytes = 0;

let accessToken: string | null = null;

/**
 * Push the current access token in from the React tree (see
 * `useChannelServiceBootstrap`, which does the same for `channelService`).
 *
 * A CHANGED token means a different session — a sign-in, a sign-out, an
 * account switch — so every blob cached under the old one is dropped.
 * Serving the previous user's attachments out of an in-memory cache after
 * a switch would reintroduce, on the client, exactly the cross-user leak
 * the per-file ACL closed on the server.
 */
export const setMediaAccessToken = (token: string | null): void => {
    if (token === accessToken) return;
    accessToken = token;
    clearMediaCache();
};

export const clearMediaCache = (): void => {
    for (const entry of cache.values()) {
        if (entry.objectUrl?.startsWith("blob:")) URL.revokeObjectURL(entry.objectUrl);
    }
    cache.clear();
    cachedBytes = 0;
};

/**
 * True for the media trees the API requires a session for. Judged on the
 * path alone: any `/media/` URL baked into a message body is ours, and one
 * that isn't simply fails the fetch and falls back.
 */
export const isProtectedMediaUrl = (url: string): boolean => {
    if (typeof url !== "string" || url.startsWith("blob:") || url.startsWith("data:"))
        return false;
    let parsed: URL;
    try {
        parsed = new URL(url, "http://placeholder.invalid");
    } catch {
        return false;
    }
    // Only OUR media origin is protected. A third-party CDN URL that also
    // sits under `/media/` (Giphy, `media4.giphy.com/media/<id>/giphy.gif`)
    // is public and must never be fetched with our token — doing so leaks
    // the credential and trips CSP `connect-src`. When our origin is unknown
    // (no env, e.g. tests) fall through to the path-only test — an absolute
    // URL that resolved against the placeholder base has no real host to
    // compare anyway.
    const ownMediaOrigin = getOwnMediaOrigin();
    if (
        ownMediaOrigin &&
        parsed.origin !== "http://placeholder.invalid" &&
        parsed.origin !== ownMediaOrigin
    ) {
        return false;
    }
    const path = parsed.pathname;
    const marker = "/media/";
    const at = path.indexOf(marker);
    if (at === -1) return false;
    const rest = path.slice(at + marker.length);
    if (!rest) return false;
    return !PUBLIC_MEDIA_PREFIXES.some((prefix) => rest.startsWith(prefix));
};

const evictToBudget = (): void => {
    // Map iterates in insertion order, so this drops least-recently-added.
    for (const [key, entry] of cache) {
        if (cachedBytes <= CACHE_BUDGET_BYTES) return;
        if (entry.objectUrl?.startsWith("blob:")) URL.revokeObjectURL(entry.objectUrl);
        cache.delete(key);
        cachedBytes -= entry.bytes;
    }
};

/**
 * The URL to actually render for `url` — an object URL when we can fetch
 * it as the signed-in user, otherwise `url` unchanged.
 */
export const resolveProtectedMediaUrl = async (url: string): Promise<string> => {
    const token = accessToken;
    if (!token || !isProtectedMediaUrl(url)) return url;
    if (typeof fetch !== "function" || typeof URL?.createObjectURL !== "function") return url;

    const hit = cache.get(url);
    if (hit) return hit.url;

    const entry: CacheEntry = { url: Promise.resolve(url), bytes: 0 };
    entry.url = (async () => {
        try {
            // `credentials: "include"` stays as a belt-and-braces second
            // credential: harmless when the header works, and the reason a
            // stale token still renders anything at all.
            const res = await fetch(url, {
                credentials: "include",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return url;
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            entry.objectUrl = objectUrl;
            entry.bytes = blob.size;
            cachedBytes += blob.size;
            evictToBudget();
            return objectUrl;
        } catch {
            // Offline, CORS, anything: render what we were given.
            return url;
        }
    })();
    cache.set(url, entry);
    return entry.url;
};

/** Authorization header for the current session, or `{}`. Used by the
 *  download path, which fetches the same protected trees. */
export const mediaAuthHeaders = (): Record<string, string> =>
    accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
