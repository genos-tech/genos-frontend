/**
 * Lifecycle wrapper around `y-indexeddb`'s `IndexeddbPersistence`.
 *
 * Every collaborative editor (task body, the three note kinds) keeps a
 * local Yjs replica in its own IndexedDB database named after the
 * document (`task-body:<id>`, `my-note:<id>`, …). Two properties of the
 * upstream library make that offline cache able to destroy live edits,
 * and this module exists to take both away:
 *
 * 1. `IndexeddbPersistence` writes from inside a Yjs `update` observer.
 *    Yjs runs observers in registration order and lets an exception
 *    escape the transaction, and this observer is registered BEFORE the
 *    Hocuspocus one. So a single throw from the IndexedDB layer aborts
 *    the whole update: the collab server never receives the edit, and
 *    the editor's own ProseMirror sync unwinds with it. A local cache
 *    must only ever be able to degrade — never to lose data — so
 *    `createYjsPersistence` swaps in a guarded observer that stops
 *    persisting rather than throwing.
 *
 * 2. Nothing tells the app which documents are currently open, so the
 *    orphan sweep in `DatabaseUtils.sweepOrphanYjsDatabases` could
 *    delete the database of a document being edited right then. Deleting
 *    an open IndexedDB fires `versionchange`, `lib0` responds by closing
 *    the connection, and every keystroke after that throws
 *    `InvalidStateError: … The database connection is closing.` — which
 *    is failure mode 1 on a loop. Providers register themselves in
 *    `yjsPersistenceRegistry`, which is the allow-list the sweep reads.
 *
 * The sweep and the create-task form both hit this in one reproducible
 * flow: the sweep's allow-list comes from the cached `taskMeta` rows,
 * and the create form's scaffold task isn't cached until AFTER a
 * successful submit — so a task drafted within the sweep's window had
 * its body database deleted mid-edit and saved empty.
 *
 * `y-indexeddb` and `yjs` belong to the lazy `vendor-editor` chunk, so
 * only code already on the editor's path may import this module. The
 * registry state lives in `yjsPersistenceRegistry` precisely so eager
 * readers (the sweep, the submit guards) can reach it without dragging
 * the editor stack into the entry chunk; see that file.
 */
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

import {
    deregisterYjsDocument,
    markYjsPersistenceFailed,
    registerYjsDocument,
} from "./yjsPersistenceRegistry";

/**
 * Open `documentName`'s local Yjs cache for `doc`, registered as live
 * and unable to break the document it is caching. Pair with
 * `destroyYjsPersistence`.
 */
export function createYjsPersistence(documentName: string, doc: Y.Doc): IndexeddbPersistence {
    const persistence = new IndexeddbPersistence(documentName, doc);
    registerYjsDocument(documentName);

    // Replace the library's `update` observer with one that can't throw
    // into Yjs. On failure we detach for good: every documented cause
    // (connection closing, closed, database deleted) is terminal for
    // this handle, so retrying would just re-throw on every keystroke.
    // The in-memory doc and the Hocuspocus connection carry on; the only
    // thing lost is offline replay of this session.
    const store = persistence._storeUpdate;
    const guarded = (update: Uint8Array, origin: unknown) => {
        try {
            store(update, origin);
        } catch (err) {
            markYjsPersistenceFailed(documentName);
            doc.off("update", guarded);
            console.error(
                `[Yjs] local cache for "${documentName}" failed and was detached; ` +
                    `editing continues against the collab server:`,
                err
            );
        }
    };
    doc.off("update", store);
    doc.on("update", guarded);
    // `destroy()` detaches via this field, so it has to name the
    // observer that is actually registered.
    persistence._storeUpdate = guarded;

    return persistence;
}

/**
 * Close a provider created by `createYjsPersistence` and deregister it.
 *
 * Deregistration is synchronous (so a sweep right after this sees the
 * document as closed) but the connection itself closes on a promise.
 * The returned promise settles when it has and never rejects — callers
 * that need the handle actually gone before touching the database can
 * await it; React cleanups ignore it, and a rejection there would be an
 * unhandled rejection during an unmount the user already considers done.
 */
export function destroyYjsPersistence(
    persistence: IndexeddbPersistence | null | undefined
): Promise<void> {
    if (!persistence) return Promise.resolve();
    const documentName = persistence.name;
    deregisterYjsDocument(documentName);
    const onError = (err: unknown) => {
        console.error(`[Yjs] closing local cache for "${documentName}" failed:`, err);
    };
    try {
        return Promise.resolve(persistence.destroy()).catch(onError);
    } catch (err) {
        onError(err);
        return Promise.resolve();
    }
}
