/**
 * `useAttachmentDraft` — composer hook for staging files before send.
 *
 * Mirrors `useMentionDraft` in shape: the caller owns the file-picker
 * UI; this hook holds the pending file list and exposes:
 *   - `addFiles(files)` — append, with a client-side size guard
 *   - `removeAt(i)`     — drop a single pending entry
 *   - `reset()`         — clear everything (call after send + upload)
 *   - `uploadAll(...)`  — POST each pending file to the v3 upload
 *                         endpoint, splice the response into the store
 *
 * Upload + send are intentionally NOT bundled. The send call writes
 * the message via socket; the message id comes back via the ack
 * envelope. Callers do `const msg = await send(...); await uploadAll(channelId, msg.id);`
 * which preserves a clean separation between "message exists" and
 * "attachments exist" — partial failures leave the message intact and
 * the user can retry.
 *
 * Per-file size limit: 25 MiB, mirrored from the server constant in
 * `backend_django/.../message_views.py:MAX_ATTACHMENT_BYTES`. Files
 * above this are rejected client-side so the user gets immediate
 * feedback instead of a slow multipart upload that 413s at the end.
 */

import { useCallback, useState } from "react";

import { channelService } from "../../../services/channel/channelService";

/** Mirror of the server cap. Keep in sync. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface PendingAttachment {
    /** Local-only id. Survives only until upload — the server assigns
     *  the real `MessageAttachment.id`. */
    localId: string;
    file: File;
    /** Set when this file was rejected by the client-side size guard.
     *  The UI renders these in an error state with a remove button. */
    error: string | null;
}

export interface UploadAllReport {
    succeeded: number;
    failed: Array<{ localId: string; error: string }>;
}

export interface UseAttachmentDraftResult {
    pending: PendingAttachment[];
    /** True iff at least one upload is currently in flight. */
    isUploading: boolean;
    addFiles: (files: FileList | File[] | null | undefined) => void;
    removeAt: (localId: string) => void;
    /** Upload every non-errored pending file against `messageId`. The
     *  returned report distinguishes succeeded vs failed so the caller
     *  can keep the failures visible for retry. Successful uploads are
     *  removed from the pending list. */
    uploadAll: (channelId: string, messageId: string) => Promise<UploadAllReport>;
    reset: () => void;
}

function _nextLocalId(): string {
    return `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAttachmentDraft(): UseAttachmentDraftResult {
    const [pending, setPending] = useState<PendingAttachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const addFiles = useCallback((files: FileList | File[] | null | undefined) => {
        if (!files) return;
        const arr: File[] = Array.from(files as ArrayLike<File>);
        if (arr.length === 0) return;
        const next: PendingAttachment[] = arr.map((file) => ({
            localId: _nextLocalId(),
            file,
            error:
                file.size > MAX_ATTACHMENT_BYTES
                    ? `File exceeds ${MAX_ATTACHMENT_BYTES}-byte limit.`
                    : null,
        }));
        setPending((prev) => [...prev, ...next]);
    }, []);

    const removeAt = useCallback((localId: string) => {
        setPending((prev) => prev.filter((p) => p.localId !== localId));
    }, []);

    const reset = useCallback(() => {
        setPending([]);
    }, []);

    const uploadAll = useCallback(
        async (channelId: string, messageId: string): Promise<UploadAllReport> => {
            // Snapshot the pending list at call-time so additions after
            // the upload starts don't accidentally get included.
            const snapshot = pending.filter((p) => p.error === null);
            if (snapshot.length === 0) {
                return { succeeded: 0, failed: [] };
            }
            setIsUploading(true);
            const failed: Array<{ localId: string; error: string }> = [];
            const succeededLocalIds = new Set<string>();
            try {
                await Promise.all(
                    snapshot.map(async (p) => {
                        try {
                            const att = await channelService.uploadAttachment(messageId, p.file);
                            channelService.handleAttachmentAdded(channelId, messageId, att);
                            succeededLocalIds.add(p.localId);
                        } catch (e) {
                            const err = e as { message?: string; code?: string };
                            failed.push({
                                localId: p.localId,
                                error: err?.message ?? String(e),
                            });
                        }
                    })
                );
            } finally {
                setIsUploading(false);
            }
            // Drop the successful uploads; keep failures so the user
            // sees what didn't make it and can retry.
            setPending((prev) => prev.filter((p) => !succeededLocalIds.has(p.localId)));
            return { succeeded: succeededLocalIds.size, failed };
        },
        [pending]
    );

    return { pending, isUploading, addFiles, removeAt, uploadAll, reset };
}
