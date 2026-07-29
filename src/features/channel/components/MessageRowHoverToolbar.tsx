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
 *     so dismissing hover doesn't yank the popover anchor)
 *     OR the row's long-press opened it (touch devices have no hover
 *     signal — `MessageRow` wires `useLongPress` into `visible` and
 *     dismisses on any touch outside the row, mirroring the legacy
 *     MessageBubble behavior).
 *
 * On coarse pointers the buttons render at tap-target size — the
 * hover-sized 2px-padding buttons are precise-pointer furniture.
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

// Static per session: pointer coarseness doesn't change out from under
// a running page, and reading it once keeps BTN_STYLE a plain constant.
const IS_COARSE_POINTER =
    typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;

const BTN_STYLE: React.CSSProperties = {
    fontSize: IS_COARSE_POINTER ? 14 : 11,
    padding: IS_COARSE_POINTER ? "6px 10px" : "2px 6px",
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
                data-testid={`message-row-flag-${messageId}`}
                style={{ ...BTN_STYLE, opacity: isFlagged ? 1 : 0.55 }}
                title={isFlagged ? "Unflag message" : "Flag message"}
                type="button"
                onClick={onFlag}
            >
                ⭐
            </button>
            <button
                data-testid={`message-row-react-${messageId}`}
                style={BTN_STYLE}
                title="Add reaction"
                type="button"
                onClick={onReact}
            >
                🙂+
            </button>
            {onReply && (
                <button
                    data-testid={`message-row-thread-${messageId}`}
                    style={BTN_STYLE}
                    title="Reply in thread"
                    type="button"
                    onClick={onReply}
                >
                    💬{replyCount > 0 ? ` ${replyCount}` : ""}
                </button>
            )}
            <button
                data-testid={`message-row-copy-link-${messageId}`}
                style={BTN_STYLE}
                title="Copy link to message"
                type="button"
                onClick={onCopyLink}
            >
                🔗
            </button>
            {isMine && (
                <>
                    <button
                        data-testid={`message-row-edit-${messageId}`}
                        style={BTN_STYLE}
                        title="Edit"
                        type="button"
                        onClick={onEdit}
                    >
                        ✏️
                    </button>
                    <button
                        data-testid={`message-row-delete-${messageId}`}
                        style={BTN_STYLE}
                        title="Delete"
                        type="button"
                        onClick={onDelete}
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
