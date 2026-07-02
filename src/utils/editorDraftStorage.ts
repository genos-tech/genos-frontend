/**
 * localStorage helpers for the per-context BlockNote draft cache.
 *
 * Keys are namespaced with a versioned prefix so we can invalidate
 * stale drafts later if BlockNote's serialization format changes —
 * just bump the version and old entries are ignored on read and
 * swept on the next logout.
 */

const PREFIX = "genos-editor-draft:v1:";

const buildKey = (cacheKey: string): string => `${PREFIX}${cacheKey}`;

export const readDraft = (cacheKey: string): unknown => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(buildKey(cacheKey));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const writeDraft = (cacheKey: string, doc: unknown): void => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(buildKey(cacheKey), JSON.stringify(doc));
    } catch {
        // quota exceeded / private mode — silently no-op.
    }
};

export const removeDraft = (cacheKey: string): void => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(buildKey(cacheKey));
    } catch {
        // ignore
    }
};

/**
 * Sweep every draft key — called from logout flows so a shared
 * browser doesn't leak one user's in-progress messages to the next.
 */
export const clearAllEditorDrafts = (): void => {
    if (typeof window === "undefined") return;
    try {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(PREFIX)) {
                toRemove.push(key);
            }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {
        // ignore
    }
};
