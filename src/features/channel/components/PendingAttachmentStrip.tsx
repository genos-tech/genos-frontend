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

import { purplePalette } from "../../../theme/purplePalette";
import type { PendingAttachment } from "../hooks/useAttachmentDraft";
import { formatSize } from "./MessageAttachments";

/** Pinned to dark palette — see ChannelListV3.tsx for the rationale. */
const p = purplePalette.dark;

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
    padding: "8px 12px",
    borderTop: `1px solid ${p.divider}`,
    background: p.surfaceElevated,
};

const CHIP_BASE: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    maxWidth: 260,
};

const CHIP_OK: CSSProperties = {
    ...CHIP_BASE,
    background: p.chipBg,
    border: `1px solid ${p.chipBorder}`,
    color: p.text,
};

const CHIP_ERR: CSSProperties = {
    ...CHIP_BASE,
    background: p.dangerTintBg,
    border: `1px solid ${p.dangerTintBorder}`,
    color: p.dangerTint,
};

export function PendingAttachmentStrip({
    pending,
    onRemove,
    testIdPrefix,
}: PendingAttachmentStripProps) {
    if (pending.length === 0) return null;
    return (
        <div data-testid={`${testIdPrefix}-pending-strip`} style={STRIP_STYLE}>
            {pending.map((p) => (
                <div
                    key={p.localId}
                    data-testid={`${testIdPrefix}-pending-${p.localId}`}
                    style={p.error ? CHIP_ERR : CHIP_OK}
                    title={p.error ?? `${p.file.name} — ${formatSize(p.file.size)}`}
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
                    <span style={{ opacity: 0.6, flexShrink: 0 }}>{formatSize(p.file.size)}</span>
                    <button
                        type="button"
                        onClick={() => onRemove(p.localId)}
                        data-testid={`${testIdPrefix}-pending-remove-${p.localId}`}
                        style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "inherit",
                            padding: 0,
                            fontSize: 14,
                            lineHeight: 1,
                        }}
                        title="Remove"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
