/**
 * `MessageAttachments` — display strip for `Message.attachments`.
 *
 * Renders one chip per attachment with the filename + size + a
 * download link (the `fileUrl` field is generated server-side by DRF's
 * FileField). Image-mime attachments additionally render an inline
 * preview thumbnail above the chip so users see the picture without
 * clicking through.
 *
 * Read-only on the v3 surfaces for now: there is no v3 upload endpoint
 * yet (legacy uploads still go to `/api/v2/chat/attachment/`). This
 * surface displays whatever the backend serializer returns, so once a
 * v3 upload route + attachment backfill ship, the same component picks
 * them up without changes.
 */

import type { CSSProperties } from "react";

import { purplePalette } from "../../../theme/purplePalette";
import type { MessageAttachment } from "../../../types/channel";

/** Pinned to dark palette — see ChannelListV3.tsx for the rationale. */
const p = purplePalette.dark;

interface MessageAttachmentsProps {
    messageId: string;
    attachments: readonly MessageAttachment[];
}

const STRIP_STYLE: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
};

const CHIP_STYLE: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    background: p.chipBg,
    border: `1px solid ${p.chipBorder}`,
    borderRadius: 6,
    fontSize: 12,
    color: p.text,
    textDecoration: "none",
    maxWidth: 280,
};

const PREVIEW_STYLE: CSSProperties = {
    display: "block",
    maxWidth: 240,
    maxHeight: 180,
    borderRadius: 6,
    border: `1px solid ${p.border}`,
    marginBottom: 4,
};

export function MessageAttachments({ messageId, attachments }: MessageAttachmentsProps) {
    if (!attachments || attachments.length === 0) return null;
    return (
        <div data-testid={`message-attachments-${messageId}`} style={STRIP_STYLE}>
            {attachments.map((a) => (
                <AttachmentChip key={a.id} messageId={messageId} attachment={a} />
            ))}
        </div>
    );
}

interface AttachmentChipProps {
    messageId: string;
    attachment: MessageAttachment;
}

function AttachmentChip({ messageId, attachment }: AttachmentChipProps) {
    const isImage = (attachment.mime || "").startsWith("image/");
    const filename = extractFilename(attachment.fileUrl);
    const sizeLabel = formatSize(attachment.sizeBytes);
    return (
        <div data-testid={`message-attachment-${messageId}-${attachment.id}`}>
            {isImage && (
                <img
                    src={attachment.fileUrl}
                    alt={filename}
                    style={PREVIEW_STYLE}
                    data-testid={`message-attachment-preview-${attachment.id}`}
                    loading="lazy"
                />
            )}
            <a
                href={attachment.fileUrl}
                target="_blank"
                rel="noreferrer"
                download={filename}
                style={CHIP_STYLE}
                data-testid={`message-attachment-link-${attachment.id}`}
                title={`${filename} — ${sizeLabel}`}
            >
                <span aria-hidden="true">{isImage ? "🖼️" : "📎"}</span>
                <span
                    style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {filename}
                </span>
                <span style={{ opacity: 0.6, flexShrink: 0 }}>{sizeLabel}</span>
            </a>
        </div>
    );
}

/** Pull the filename off a URL or path. Strips query string, fragment,
 *  and any leading directories. */
function extractFilename(fileUrl: string): string {
    if (!fileUrl) return "attachment";
    try {
        const u = new URL(fileUrl, "http://placeholder.invalid");
        const last = u.pathname.split("/").filter(Boolean).pop();
        if (last) return decodeURIComponent(last);
    } catch {
        /* fall through */
    }
    const stripped = fileUrl.split(/[?#]/)[0];
    const last = stripped.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "attachment";
}

/** Format bytes as a human-readable size. Mirrors the production
 *  formatter (KB/MB/GB with one decimal, dropped for whole numbers). */
export function formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i += 1;
    }
    if (i === 0) return `${n} ${units[i]}`;
    const rounded = Math.round(n * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${units[i]}`;
}
