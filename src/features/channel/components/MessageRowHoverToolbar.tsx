/**
 * Per-row hover toolbar for `MessagesPaneV3`.
 *
 * Lifts the action buttons (react / thread-reply / flag / copy-link /
 * edit / delete) out of the always-on inline strip and into a hover-
 * gated panel. The legacy `MainChatPane` shows actions only on bubble
 * hover so they don't crowd the message list; this brings v3 to UX
 * parity without changing the underlying interactions.
 *
 * Visibility contract:
 *   - Hidden by default.
 *   - Shown when `isHovered` (caller's onMouseEnter/Leave on the row)
 *     OR `forceShow` (caller passes true when the emoji popover is open
 *     so dismissing hover doesn't yank the popover anchor).
 *
 * Touch-mode TODO: long-press handling. Touch devices have no hover
 * signal so the toolbar would never appear. The legacy code mirrors
 * the toolbar visibility off a separate `mobileToolbarOpen` set by
 * an on-bubble tap. That's a follow-on slice; for now this surface
 * targets the desktop hover UX and touch users can still react via
 * any existing reaction chips on the bubble.
 *
 * Owner-gating: `isMine` controls whether the edit/delete buttons
 * render. The channelService also enforces ownership on the server,
 * so this is purely UX hygiene (don't show actions that would 403).
 */

import { useCallback } from "react";

export interface MessageRowHoverToolbarProps {
    messageId: string;
    /** Visible when true (caller computes from hover + popover state). */
    visible: boolean;
    /** Toggle viewer flag on this message. */
    onFlag: () => void;
    isFlagged: boolean;
    /** Open the emoji popover (caller owns the popover; this just opens it). */
    onReact: () => void;
    /** Thread reply. Hidden when undefined (used by the thread panel and
     *  for thread-reply messages that can't open further nested threads). */
    onReply?: () => void;
    replyCount: number;
    /** Copy a deep link to this message to the clipboard. */
    onCopyLink: () => void;
    /** Edit + delete are gated on `isMine` — only the sender (and the
     *  channel owner on the server) can edit/delete. */
    isMine: boolean;
    onEdit: () => void;
    onDelete: () => void;
}

const BTN_STYLE: React.CSSProperties = {
    fontSize: 11,
    padding: "2px 6px",
    border: "1px solid #ddd",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
};

export function MessageRowHoverToolbar({
    messageId,
    visible,
    onFlag,
    isFlagged,
    onReact,
    onReply,
    replyCount,
    onCopyLink,
    isMine,
    onEdit,
    onDelete,
}: MessageRowHoverToolbarProps) {
    return (
        <span
            data-testid={`message-row-toolbar-${messageId}`}
            data-toolbar-visible={visible ? "true" : "false"}
            style={{
                marginLeft: "auto",
                display: "flex",
                gap: 4,
                // `opacity + pointer-events` rather than display:none so
                // the hover state stays steady — toggling display would
                // re-layout the row and cause a flicker as the toolbar
                // appears / disappears.
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? "auto" : "none",
                transition: "opacity 0.12s ease-out",
            }}
        >
            <button
                type="button"
                onClick={onFlag}
                data-testid={`message-row-flag-${messageId}`}
                style={{ ...BTN_STYLE, opacity: isFlagged ? 1 : 0.55 }}
                title={isFlagged ? "Unflag message" : "Flag message"}
            >
                ⭐
            </button>
            <button
                type="button"
                onClick={onReact}
                data-testid={`message-row-react-${messageId}`}
                style={BTN_STYLE}
                title="Add reaction"
            >
                🙂+
            </button>
            {onReply && (
                <button
                    type="button"
                    onClick={onReply}
                    data-testid={`message-row-thread-${messageId}`}
                    style={BTN_STYLE}
                    title="Reply in thread"
                >
                    💬{replyCount > 0 ? ` ${replyCount}` : ""}
                </button>
            )}
            <button
                type="button"
                onClick={onCopyLink}
                data-testid={`message-row-copy-link-${messageId}`}
                style={BTN_STYLE}
                title="Copy link to message"
            >
                🔗
            </button>
            {isMine && (
                <>
                    <button
                        type="button"
                        onClick={onEdit}
                        data-testid={`message-row-edit-${messageId}`}
                        style={BTN_STYLE}
                        title="Edit"
                    >
                        ✏️
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        data-testid={`message-row-delete-${messageId}`}
                        style={BTN_STYLE}
                        title="Delete"
                    >
                        🗑️
                    </button>
                </>
            )}
        </span>
    );
}

/** Build the v3 deep-link URL for a single message. The route doesn't
 *  carry a `/m/<messageId>` segment yet, so we use a hash anchor —
 *  the row writes an `id="message-<id>"` attribute so the browser
 *  scrolls to it on page open with the hash present. Keep in sync
 *  with the row's `id` attribute writer. */
export function messageDeepLinkUrl(channelId: string, messageId: string): string {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/workspace/v3/${channelId}#message-${messageId}`;
}

/** Hook returning a stable copy-to-clipboard handler. Falls back to a
 *  no-op when the clipboard API is unavailable (older browsers / file:
 *  protocol). Errors are swallowed and surfaced via the caller's
 *  `onError` so a denied permission doesn't break the click. */
export function useCopyMessageLink(
    channelId: string,
    messageId: string,
    onCopied?: () => void,
    onError?: (message: string) => void
): () => void {
    return useCallback(() => {
        const url = messageDeepLinkUrl(channelId, messageId);
        const clip = navigator?.clipboard;
        if (!clip || typeof clip.writeText !== "function") {
            onError?.("Clipboard API unavailable.");
            return;
        }
        clip.writeText(url).then(
            () => onCopied?.(),
            (e) => onError?.(`Copy failed: ${e?.message ?? String(e)}`)
        );
    }, [channelId, messageId, onCopied, onError]);
}
