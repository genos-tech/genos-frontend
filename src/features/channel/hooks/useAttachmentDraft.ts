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
 * Per-file size limit: the user's TIER limit (`upload_max_mb`). Files
 * above it are rejected client-side so the user gets immediate feedback
 * instead of a slow multipart upload that 413s at the end.
 *
 * This used to be a flat 25 MiB mirroring the chat endpoint's historical
 * fallback — which had the opposite failure to the rest of the app: 25
 * MiB sits ABOVE free's 5 MB tier limit, so a free user's 20 MB file was
 * accepted here, uploaded in full, and only then rejected by the server.
 * The fallback it mirrored is now unreachable anyway: `check_upload_size`
 * only falls back when the tier supplies no cap, and every tier does.
 */

import { useCallback, useEffect, useState } from "react";

import { useOptionalAccessToken } from "../../../context/AuthContext";
import { fmt, useTranslation } from "../../../i18n";
import { channelService } from "../../../services/channel/channelService";
import { resolveUploadLimitBytes } from "../../../services/uploadLimit";
import { ABSOLUTE_MAX_UPLOAD_BYTES, formatLimitLabel } from "../../../utils/uploadLimits";

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
    /** The per-file ceiling currently applied, in bytes. `null` until
     *  the tier resolves — during which staging stays permissive and
     *  anything oversize is re-flagged once it lands. */
    limitBytes: number | null;
}

function _nextLocalId(): string {
    return `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAttachmentDraft(): UseAttachmentDraftResult {
    const { t } = useTranslation();
    const accessToken = useOptionalAccessToken();
    const [pending, setPending] = useState<PendingAttachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    // Unknown tier ⇒ permissive, same rule as `useFileSizeGuard`: the
    // server is the enforcement, this is only the fast feedback.
    const [tierLimitBytes, setTierLimitBytes] = useState<number | null>(null);
    const limitBytes = tierLimitBytes ?? ABSOLUTE_MAX_UPLOAD_BYTES;

    useEffect(() => {
        let alive = true;
        void resolveUploadLimitBytes(accessToken).then((bytes) => {
            if (alive) setTierLimitBytes(bytes);
        });
        return () => {
            alive = false;
        };
    }, [accessToken]);

    // Re-check what's already staged whenever the limit moves. Two cases,
    // and the first is not hypothetical: the limit resolves a tick after
    // mount, so a file picked immediately is staged against the
    // permissive default and would otherwise sit in the strip looking
    // fine until the server rejected it. The second is an upgrade
    // mid-session, where a previously-flagged file should clear.
    useEffect(() => {
        setPending((prev) => {
            let changed = false;
            const next = prev.map((p) => {
                const error =
                    p.file.size > limitBytes
                        ? fmt(t.chat.channel.attachments.sizeExceeded, {
                              limit: formatLimitLabel(limitBytes),
                          })
                        : null;
                if (error === p.error) return p;
                changed = true;
                return { ...p, error };
            });
            return changed ? next : prev;
        });
    }, [limitBytes, t.chat.channel.attachments.sizeExceeded]);

    const addFiles = useCallback(
        (files: FileList | File[] | null | undefined) => {
            if (!files) return;
            const arr: File[] = Array.from(files as ArrayLike<File>);
            if (arr.length === 0) return;
            const next: PendingAttachment[] = arr.map((file) => ({
                localId: _nextLocalId(),
                file,
                // Reads as a plan limit ("File exceeds the 5 MB limit for
                // your plan."), not as raw bytes — this string is shown
                // verbatim in the composer's pending strip.
                error:
                    file.size > limitBytes
                        ? fmt(t.chat.channel.attachments.sizeExceeded, {
                              limit: formatLimitLabel(limitBytes),
                          })
                        : null,
            }));
            setPending((prev) => [...prev, ...next]);
        },
        [limitBytes, t.chat.channel.attachments.sizeExceeded]
    );

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

    return {
        pending,
        isUploading,
        addFiles,
        removeAt,
        uploadAll,
        reset,
        limitBytes: tierLimitBytes,
    };
}
