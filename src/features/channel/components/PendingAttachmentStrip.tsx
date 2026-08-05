/**
 * `PendingAttachmentStrip` — chips for files staged in the composer
 * before the user hits send.
 *
 * One chip per pending file. Each chip shows the filename + size,
 * plus a × button to drop the file from the pending list. Files that
 * tripped the client-side size guard render in an error state so the
 * user sees what won't be uploaded.
 */

import type { CSSProperties } from "react";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation } from "../../../i18n";
import type { PendingAttachment } from "../hooks/useAttachmentDraft";
import { formatSize } from "./MessageAttachments";

interface PendingAttachmentStripProps {
    pending: readonly PendingAttachment[];
    onRemove: (localId: string) => void;
    /** Test-id prefix so two strips on the same screen (main pane +
     *  thread reply form) don't clash. */
    testIdPrefix: string;
}

const STRIP_STYLE: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    padding: "6px 12px",
    borderTop: "1px solid #eee",
    background: "#fafafa",
};

const CHIP_BASE: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
    maxWidth: 260,
};

const CHIP_OK: CSSProperties = {
    ...CHIP_BASE,
    background: "#f4f4f4",
    border: "1px solid #ddd",
    color: "#222",
};

const CHIP_ERR: CSSProperties = {
    ...CHIP_BASE,
    background: "rgba(239, 68, 68, 0.10)",
    border: "1px solid rgba(239, 68, 68, 0.5)",
    color: "#b91c1c",
};

export function PendingAttachmentStrip({
    pending,
    onRemove,
    testIdPrefix,
}: PendingAttachmentStripProps) {
    const { t } = useTranslation();
    if (pending.length === 0) return null;
    return (
        <div data-testid={`${testIdPrefix}-pending-strip`} style={STRIP_STYLE}>
            {pending.map((p) => (
                <AppTooltip
                    key={p.localId}
                    title={p.error ?? `${p.file.name} — ${formatSize(p.file.size)}`}
                >
                    <div
                        data-testid={`${testIdPrefix}-pending-${p.localId}`}
                        style={p.error ? CHIP_ERR : CHIP_OK}
                    >
                        <span aria-hidden="true">{p.error ? "⚠️" : "📎"}</span>
                        <span
                            style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {p.file.name}
                        </span>
                        <span style={{ opacity: 0.6, flexShrink: 0 }}>
                            {formatSize(p.file.size)}
                        </span>
                        <AppTooltip title={t.chat.channel.attachments.remove}>
                            <button
                                data-testid={`${testIdPrefix}-pending-remove-${p.localId}`}
                                type="button"
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "inherit",
                                    padding: 0,
                                    fontSize: 14,
                                    lineHeight: 1,
                                }}
                                onClick={() => onRemove(p.localId)}
                            >
                                ×
                            </button>
                        </AppTooltip>
                    </div>
                </AppTooltip>
            ))}
        </div>
    );
}
