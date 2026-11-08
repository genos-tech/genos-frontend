import { useCallback, useEffect, useRef } from "react";

import { hasSendableContent } from "../../components/editors/utils/messageBlocks";
import { readDraft, removeDraft, writeDraft } from "../../utils/editorDraftStorage";

/**
 * Per-context draft cache for BlockNote editors.
 *
 * - **Load**: when `cacheKey` transitions to a new value, read the
 *   stored draft and call `editor.replaceBlocks(editor.document, …)`.
 *   No draft → clear the editor (matches the previous "wipe on
 *   target change" behaviour each call site used to do inline).
 * - **Save**: debounced (~400 ms). A document with nothing in it (no text, chip,
 *   image or file: `hasSendableContent`) removes the key instead of writing an
 *   empty entry. It used to be `length <= 1`, true of every empty editor in
 *   BlockNote 0.49 (a real blank block at the end) but, since 0.57, also of a
 *   single typed line, so a one-line draft was never saved (MIP-1222).
 * - **Clear**: cancels any pending debounced save and synchronously
 *   removes the key. Call this from every send-success path.
 *
 * The `editor` parameter is `any` so the hook can be reused across
 * editors with different custom schemas without forcing the generic
 * machinery — call sites only need `document` + `replaceBlocks`.
 */

const SAVE_DEBOUNCE_MS = 400;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DraftEditor = any;

interface UseEditorDraftResult {
    saveDraft: (doc: unknown[]) => void;
    clearDraft: () => void;
}

export const useEditorDraft = (
    editor: DraftEditor,
    cacheKey: string | null
): UseEditorDraftResult => {
    const cacheKeyRef = useRef<string | null>(cacheKey);
    cacheKeyRef.current = cacheKey;

    const lastLoadedKeyRef = useRef<string | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!editor) return;
        if (lastLoadedKeyRef.current === cacheKey) return;
        lastLoadedKeyRef.current = cacheKey;

        if (!cacheKey) return;

        const draft = readDraft(cacheKey);
        try {
            if (Array.isArray(draft) && draft.length > 0) {
                editor.replaceBlocks(editor.document, draft);
            } else {
                editor.replaceBlocks(editor.document, []);
            }
        } catch {
            // Stored shape no longer matches the current schema —
            // discard the stale draft so the user starts from blank
            // instead of looking at a crashed editor.
            removeDraft(cacheKey);
            try {
                editor.replaceBlocks(editor.document, []);
            } catch {
                // nothing else we can do; let the editor render its
                // own default empty state.
            }
        }
    }, [cacheKey, editor]);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, []);

    const saveDraft = useCallback((doc: unknown[]) => {
        const key = cacheKeyRef.current;
        if (!key) return;

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null;
            // If the user switched contexts during the debounce
            // window, the load effect already swapped `editor`'s
            // content for the new context — writing `doc` now would
            // poison the new key with the old context's content.
            if (cacheKeyRef.current !== key) return;
            if (!Array.isArray(doc) || !hasSendableContent(doc)) {
                removeDraft(key);
            } else {
                writeDraft(key, doc);
            }
        }, SAVE_DEBOUNCE_MS);
    }, []);

    const clearDraft = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        const key = cacheKeyRef.current;
        if (!key) return;
        removeDraft(key);
    }, []);

    return { saveDraft, clearDraft };
};
