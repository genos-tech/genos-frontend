/**
 * Which Yjs documents have a local cache open, and whose cache has
 * failed. State only — the provider that maintains it lives in
 * `yjsPersistence`.
 *
 * The split is load-bearing, not organisational. `yjsPersistence` pulls
 * in `y-indexeddb` and `yjs`, which `vite.config.ts` pins to the lazy
 * `vendor-editor` chunk (~900 kB gzipped of BlockNote/Yjs/Shiki). The
 * readers here are eager: `DatabaseUtils.sweepOrphanYjsDatabases` runs
 * on startup, and the task-create forms gate their submit on a failed
 * cache. Importing the provider for those would make the entry chunk
 * statically depend on the editor stack, putting it in the critical
 * path of every page load including signin — which is exactly what the
 * `bundle-guard` plugin fails the build over.
 *
 * So: anything on an eager path imports THIS module; only the editor
 * imports `yjsPersistence`. Deliberately no re-export between them —
 * one would let an eager caller reach a light function through the
 * heavy module and quietly restore the edge.
 */

// Document name → number of live providers. A count, not a flag: the
// editor rebuilds its provider on an access-token refresh, and during
// the handoff (and whenever two panes show the same document) the old
// and new providers are open at once.
const openDocuments = new Map<string, number>();

// Documents whose local cache threw at least once this session. Never
// cleared on its own — a caller that gates on it decides when the user
// has been told (see `consumeYjsPersistenceFailure`).
const failedDocuments = new Set<string>();

/** Is any editor currently holding this document's IndexedDB open? */
export const isYjsDocumentOpen = (documentName: string): boolean =>
    (openDocuments.get(documentName) ?? 0) > 0;

/**
 * Has this document's local cache failed since it was opened? Read by
 * submit paths that would otherwise persist a body the editor may not
 * have been able to assemble.
 */
export const hasYjsPersistenceFailed = (documentName: string): boolean =>
    failedDocuments.has(documentName);

/**
 * Same as `hasYjsPersistenceFailed`, but clears the flag.
 *
 * Callers that block an action on the failure use this so the block
 * fires ONCE. The guarded observer has already detached by then, so the
 * user's retry runs against an editor that is no longer throwing —
 * leaving the flag set would wedge the form instead of protecting it.
 */
export const consumeYjsPersistenceFailure = (documentName: string): boolean => {
    if (!failedDocuments.has(documentName)) return false;
    failedDocuments.delete(documentName);
    return true;
};

/** Provider bookkeeping — for `yjsPersistence` only. */
export const registerYjsDocument = (documentName: string): void => {
    openDocuments.set(documentName, (openDocuments.get(documentName) ?? 0) + 1);
};

/** Provider bookkeeping — for `yjsPersistence` only. */
export const deregisterYjsDocument = (documentName: string): void => {
    const remaining = (openDocuments.get(documentName) ?? 1) - 1;
    if (remaining > 0) openDocuments.set(documentName, remaining);
    else openDocuments.delete(documentName);
};

/** Provider bookkeeping — for `yjsPersistence` only. */
export const markYjsPersistenceFailed = (documentName: string): void => {
    failedDocuments.add(documentName);
};
