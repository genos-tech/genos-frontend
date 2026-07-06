import { useEffect, useMemo, useRef } from "react";

import { AttachmentFileProps } from "../../../types/tasks";
import { buildAvatarSrc } from "../../../utils/avatarSrc";

export type AttachmentPreview = {
    url: string;
    kind: "image" | "file";
    /** True when we created the URL via `URL.createObjectURL` and must
     *  revoke it on cleanup. False for server-supplied paths (already
     *  usable as-is). */
    ownsUrl: boolean;
};

const base64ToBlob = (b64: string, mime?: string): Blob => {
    const byteChars = atob(b64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        bytes[i] = byteChars.charCodeAt(i);
    }
    return new Blob([bytes], mime ? { type: mime } : undefined);
};

const resolvePreview = (item: AttachmentFileProps): AttachmentPreview | null => {
    const mime = item.type ?? (item.file instanceof File ? item.file.type : undefined);
    const kind: AttachmentPreview["kind"] = mime?.startsWith("image/") ? "image" : "file";

    if (item.file_base64) {
        const blob = base64ToBlob(item.file_base64, mime);
        return { url: URL.createObjectURL(blob), kind, ownsUrl: true };
    }
    if (item.file instanceof File) {
        return { url: URL.createObjectURL(item.file), kind, ownsUrl: true };
    }
    const filePath = item.file as unknown;
    // Meta shape (`getTask?attachments=meta`): no base64 — `file` is
    // the bare storage path and `file_url` marks the mode. Compose the
    // absolute Django media URL the same way avatars do (`file_url`
    // itself starts with `/media/`, and VITE_MEDIA_ROOT_DJANGO already
    // ends in `/media`, so build from the bare path to avoid doubling
    // the prefix). The browser lazy-loads the bytes on first render
    // instead of receiving them inside the getTask JSON.
    if (item.file_url && typeof filePath === "string" && filePath.length > 0) {
        const absolute = buildAvatarSrc(filePath);
        if (absolute) return { url: absolute, kind, ownsUrl: false };
    }
    // `useSendUpdatedTask` reassigns `file` to a server-side path
    // string after a successful upload (see useSendUpdatedTask.ts:107),
    // so this branch handles the post-save shape that the
    // `AttachmentFileProps` type doesn't currently reflect.
    if (typeof filePath === "string" && filePath.length > 0) {
        return { url: filePath, kind, ownsUrl: false };
    }
    return null;
};

/**
 * Builds (and caches) preview URLs for an attachment list keyed by
 * `attachment_id`. Decodes `file_base64` to a Blob ONCE per id, falls
 * back to `URL.createObjectURL(file)` for in-flight `File` inputs, and
 * uses server-supplied string paths directly. Created object URLs are
 * revoked when the corresponding id leaves the list (or on unmount) so
 * the panel stays leak-free across rapid add/remove cycles.
 */
export const useAttachmentPreviews = (
    attachments: AttachmentFileProps[] | undefined
): Map<number, AttachmentPreview> => {
    const cacheRef = useRef<Map<number, AttachmentPreview>>(new Map());

    // Pure build: derive the next map from the cache + incoming list.
    // No URL revocation here — `useMemo` is supposed to be side-effect
    // free, and React's strict mode re-runs it. Cleanup lives in the
    // effect below.
    const map = useMemo(() => {
        const cache = cacheRef.current;
        const next = new Map<number, AttachmentPreview>();
        const list = attachments ?? [];

        for (const item of list) {
            const id = item.attachment_id;
            const existing = cache.get(id);
            if (existing) {
                next.set(id, existing);
                continue;
            }
            const preview = resolvePreview(item);
            if (preview) next.set(id, preview);
        }

        return next;
    }, [attachments]);

    // Reconcile the cache + revoke URLs for ids that disappeared. This
    // runs after the render commits, so we never revoke a URL that's
    // still being rendered (which would break the current frame's
    // <img>/anchor).
    useEffect(() => {
        const previous = cacheRef.current;
        for (const [id, preview] of previous) {
            if (!map.has(id) && preview.ownsUrl) {
                URL.revokeObjectURL(preview.url);
            }
        }
        cacheRef.current = map;
    }, [map]);

    useEffect(() => {
        return () => {
            for (const preview of cacheRef.current.values()) {
                if (preview.ownsUrl) URL.revokeObjectURL(preview.url);
            }
            cacheRef.current = new Map();
        };
    }, []);

    return map;
};
