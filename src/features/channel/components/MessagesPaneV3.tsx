/**
 * `MessagesPaneV3` — v3 chat pane with the four core interactions:
 * send, mark-read, react, edit, delete.
 *
 * Each interaction routes through `channelService` mutation methods,
 * which emit on the `/v3` socket and await the ack. The visible
 * update comes through the broadcast loop (`message.created/updated/
 * deleted`, `reaction.added/removed`, `read.advanced`) which the
 * service writes back to its in-memory store — so the pane updates
 * live without imperative state.
 *
 * Intentionally NOT styled like the production MainChatPane. This is
 * the proof-of-life surface that the eventual production pane will
 * inherit from once we've validated the UX end-to-end.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { EmojiGlyph } from "../../../components/ui/emoji/EmojiGlyph";
import { useLongPress } from "../../../hooks/common/useLongPress";
import { useTranslation } from "../../../i18n";
import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import type { Message } from "../../../types/channel";
import { useChannel } from "../hooks/useChannel";
import { MessageAttachments } from "./MessageAttachments";
import { MessageBody } from "./MessageBody";
import { MessageComposerV3 } from "./MessageComposerV3";
import { MessageRowHoverToolbar, useCopyMessageLink } from "./MessageRowHoverToolbar";

interface MessagesPaneV3Props {
    channelId: string;
    /** Optional: called when the user clicks the "Reply in thread"
     *  button on a message. The shell wires this to navigate to
     *  /workspace/v3/:channelId/t/:rootMessageId so the thread panel
     *  opens beside the main pane. When omitted, the thread button
     *  is hidden (still useful for embedded contexts that don't have
     *  room for a side panel). */
    onOpenThread?: (rootMessageId: string) => void;
    /** Optional: renders a back button in the header. The shell passes
     *  it only in the mobile single-pane stack, where the channel list
     *  isn't visible beside the pane. */
    onBack?: () => void;
}

/** Common emojis for the quick-react row. Kept short so it doesn't
 *  overwhelm the proof-of-life UI. */
const QUICK_EMOJI = ["👍", "❤️", "🎉", "🤔", "😄"];

export function MessagesPaneV3({ channelId, onOpenThread, onBack }: MessagesPaneV3Props) {
    const { t } = useTranslation();
    const { channel, messages, readCursor, isLoading } = useChannel(channelId);
    // Separate subscription for the flag index so each row knows
    // whether it's flagged without a prop dance from useChannel.
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );
    const currentUserId = typeof window === "undefined" ? null : localStorage.getItem("userId");
    const [error, setError] = useState<string | null>(null);

    // Mark-read on view: whenever the latest message in this channel
    // differs from the last-read cursor, advance the cursor so my
    // unread badge decrements. The server enforces forward-only so a
    // race with another tab can't rewind us.
    //
    // Gate on tab visibility: a message arriving while this tab is
    // backgrounded (user is elsewhere) must NOT silently mark the channel
    // read — they never saw it. (A stricter scrolled-to-bottom gate is a
    // follow-up; it needs an at-bottom signal from the message list.)
    useEffect(() => {
        if (!channel || messages.length === 0) return;
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        const latest = messages[messages.length - 1];
        if (!latest || latest.id === readCursor?.lastReadMessageId) return;
        void channelService.markRead(channelId, latest.id).catch(() => {
            /* transient errors are fine — next render re-tries */
        });
    }, [channelId, channel, messages, readCursor]);

    if (isLoading) {
        return <div style={{ padding: 16 }}>Loading channel {channelId}…</div>;
    }
    if (!channel) {
        return <div style={{ padding: 16 }}>Channel {channelId} not in store.</div>;
    }

    return (
        <div
            data-testid="messages-pane-v3"
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            <header
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                {onBack && (
                    <AppTooltip title={t.chat.channel.pane.backToChannels}>
                        <button
                            data-testid="messages-pane-v3-back"
                            type="button"
                            style={{
                                fontSize: 14,
                                padding: "4px 10px",
                                border: "1px solid #ddd",
                                borderRadius: 4,
                                background: "#fff",
                                cursor: "pointer",
                            }}
                            onClick={onBack}
                        >
                            ←
                        </button>
                    </AppTooltip>
                )}
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {channel.title || channel.id} <span style={{ opacity: 0.6 }}>(v3)</span>
                </span>
            </header>

            <ul
                data-testid="messages-pane-v3-list"
                style={{
                    flex: 1,
                    overflowY: "auto",
                    margin: 0,
                    padding: "8px 12px",
                    listStyle: "none",
                }}
            >
                {messages.map((m) => (
                    <MessageRow
                        key={m.id}
                        channelId={channelId}
                        channelKind={channel.kind}
                        isFlagged={snapshot.flagByMessageId.has(m.id)}
                        message={m}
                        onError={setError}
                        onOpenThread={onOpenThread}
                    />
                ))}
                {messages.length === 0 && <li style={{ opacity: 0.5 }}>No messages yet.</li>}
            </ul>

            {error && (
                <div
                    role="alert"
                    style={{
                        color: "crimson",
                        padding: "4px 12px",
                        fontSize: 12,
                    }}
                    onClick={() => setError(null)}
                >
                    {error} (click to dismiss)
                </div>
            )}

            <MessageComposerV3
                channelId={channelId}
                currentUserId={currentUserId}
                testIdPrefix="messages-pane-v3"
                onError={setError}
            />
        </div>
    );
}

interface MessageRowProps {
    message: Message;
    channelId: string;
    channelKind: number;
    /** True iff the current viewer has flagged this message. The row
     *  reads it from the parent's `flagByMessageId` lookup. */
    isFlagged: boolean;
    onError: (msg: string) => void;
    /** Forwarded from the pane. When set, each row renders a thread
     *  entry-point button + a reply-count chip when `replyCount > 0`. */
    onOpenThread?: (rootMessageId: string) => void;
}

/** Per-message row. Owns the edit-mode toggle, the inline editor, and
 *  the per-row interaction buttons. Pulled out so a re-render of one
 *  row's edit state doesn't re-render the whole list. */
function MessageRow({
    message,
    channelId,
    channelKind,
    isFlagged,
    onError,
    onOpenThread,
}: MessageRowProps) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [editDraft, setEditDraft] = useState(message.bodyText);
    const [showEmoji, setShowEmoji] = useState(false);
    const [hovered, setHovered] = useState(false);
    // Touch path for the toolbar: touch devices have no hover signal, so
    // a 500ms long-press on the row opens it instead (the same pattern
    // as the legacy MessageBubble). Dismissed by touching anywhere
    // outside the row.
    const [touchOpen, setTouchOpen] = useState(false);
    const rowRef = useRef<HTMLLIElement>(null);
    const longPress = useLongPress(() => setTouchOpen(true));

    useEffect(() => {
        if (!touchOpen) return;
        const dismiss = (e: TouchEvent) => {
            if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
                setTouchOpen(false);
            }
        };
        document.addEventListener("touchstart", dismiss);
        return () => document.removeEventListener("touchstart", dismiss);
    }, [touchOpen]);

    const reportError = useCallback(
        (e: unknown) => {
            const err = e as ChannelServiceError;
            onError(`${err.code ?? "INTERNAL"}: ${err.message ?? String(err)}`);
        },
        [onError]
    );

    const copyLink = useCopyMessageLink(channelId, message.id, undefined, onError);

    const handleSaveEdit = useCallback(async () => {
        const text = editDraft.trim();
        if (!text) return;
        try {
            await channelService.edit(
                message.id,
                [{ type: "paragraph", content: [{ type: "text", text }] }],
                text
            );
            setEditing(false);
        } catch (e) {
            reportError(e);
        }
    }, [editDraft, message.id, reportError]);

    const handleCancelEdit = useCallback(() => {
        setEditDraft(message.bodyText);
        setEditing(false);
    }, [message.bodyText]);

    const handleDelete = useCallback(async () => {
        if (!window.confirm("Delete this message?")) return;
        try {
            await channelService.deleteMessage(message.id, channelId, channelKind);
        } catch (e) {
            reportError(e);
        }
    }, [channelId, channelKind, message.id, reportError]);

    const handleToggleFlag = useCallback(async () => {
        try {
            if (isFlagged) await channelService.unflagMessage(message.id);
            else await channelService.flagMessage(message.id);
        } catch (e) {
            reportError(e);
        }
    }, [isFlagged, message.id, reportError]);

    const handleToggleReaction = useCallback(
        async (emoji: string) => {
            // Use the current viewer's reaction state to decide whether
            // this click is "add" or "remove". The viewer's userId is
            // wherever the legacy `userId` localStorage entry lives —
            // every existing surface reads it that way.
            const me = localStorage.getItem("userId");
            const mine = message.reactions.find((r) => r.user.userId === me && r.emoji === emoji);
            try {
                if (mine) {
                    await channelService.unreact(message.id, channelId, channelKind, emoji);
                } else {
                    await channelService.react(message.id, channelId, channelKind, emoji);
                }
                setShowEmoji(false);
            } catch (e) {
                reportError(e);
            }
        },
        [channelId, channelKind, message.id, message.reactions, reportError]
    );

    const isMine = (() => {
        const me = localStorage.getItem("userId");
        return me && message.sender?.userId === me;
    })();

    return (
        <li
            ref={rowRef}
            data-testid={`message-row-${message.id}`}
            id={`message-${message.id}`}
            style={{
                padding: "6px 0",
                opacity: message.deletedAt ? 0.4 : 1,
                fontStyle: message.deletedAt ? "italic" : "normal",
            }}
            onFocus={() => setHovered(true)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onTouchCancel={longPress.onTouchCancel}
            onTouchEnd={longPress.onTouchEnd}
            onTouchMove={longPress.onTouchMove}
            onTouchStart={longPress.onTouchStart}
            onBlur={(e) => {
                // Keep the toolbar visible if focus moves to a child
                // (e.g. clicking the react button to open the emoji
                // popover). Only collapse when focus leaves the row.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setHovered(false);
                }
            }}
            onClickCapture={(e) => {
                // A long-press that opened the toolbar also produces a
                // synthetic click on whatever child is under the finger
                // (a link, a reaction chip). Swallow that one click so
                // opening the toolbar never doubles as an action.
                if (longPress.consumedTap()) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
        >
            {/* flexWrap: at coarse-pointer tap-target size the toolbar can
                be wider than a phone row — wrapping drops it onto its own
                line instead of overflowing the pane horizontally. */}
            <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong>{message.sender?.userName ?? "system"}:</strong>{" "}
                {editing ? (
                    <span style={{ display: "flex", gap: 4, flex: 1 }}>
                        <input
                            data-testid={`message-row-edit-input-${message.id}`}
                            style={{ flex: 1, padding: "2px 6px" }}
                            type="text"
                            value={editDraft}
                            autoFocus
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSaveEdit();
                                if (e.key === "Escape") handleCancelEdit();
                            }}
                        />
                        <button
                            data-testid={`message-row-edit-save-${message.id}`}
                            type="button"
                            onClick={() => void handleSaveEdit()}
                        >
                            Save
                        </button>
                        <button type="button" onClick={handleCancelEdit}>
                            Cancel
                        </button>
                    </span>
                ) : (
                    <>
                        {message.deletedAt ? (
                            "(deleted)"
                        ) : (
                            <MessageBody
                                body={message.body}
                                bodyText={message.bodyText}
                                currentUserId={
                                    typeof window === "undefined"
                                        ? null
                                        : localStorage.getItem("userId")
                                }
                            />
                        )}
                        {!message.deletedAt && mentionsMe(message) && (
                            <AppTooltip title={t.chat.channel.pane.mentionsYouBadge}>
                                <span
                                    data-testid={`message-row-mention-me-${message.id}`}
                                    style={{
                                        marginLeft: 6,
                                        padding: "0 4px",
                                        background: "rgba(239, 68, 68, 0.18)",
                                        color: "#b91c1c",
                                        borderRadius: 3,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    @you
                                </span>
                            </AppTooltip>
                        )}
                        {message.editedAt && !message.deletedAt && (
                            <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 12 }}>
                                (edited)
                            </span>
                        )}
                    </>
                )}
                {!editing && !message.deletedAt && isFlagged && (
                    <AppTooltip title={t.chat.channel.pane.flaggedIndicator}>
                        <span
                            data-testid={`message-row-flagged-indicator-${message.id}`}
                            style={{ marginLeft: 6, fontSize: 12 }}
                        >
                            ⭐
                        </span>
                    </AppTooltip>
                )}
                {!editing && !message.deletedAt && (
                    <MessageRowHoverToolbar
                        messageId={message.id}
                        // The popover stays open after the reaction is
                        // toggled (handleToggleReaction closes it), so
                        // keep the toolbar visible while it's open even
                        // if hover has moved away — otherwise the user
                        // can't see what they're clicking on.
                        isFlagged={isFlagged}
                        isMine={!!isMine}
                        replyCount={message.replyCount}
                        visible={hovered || showEmoji || touchOpen}
                        onCopyLink={copyLink}
                        onDelete={() => void handleDelete()}
                        onFlag={() => void handleToggleFlag()}
                        onReact={() => setShowEmoji((v) => !v)}
                        onEdit={() => {
                            setEditDraft(message.bodyText);
                            setEditing(true);
                        }}
                        onReply={
                            onOpenThread && !message.isThreadReply
                                ? () => onOpenThread(message.id)
                                : undefined
                        }
                    />
                )}
            </div>
            {showEmoji && !editing && !message.deletedAt && (
                <div
                    data-testid={`message-row-emoji-picker-${message.id}`}
                    style={{
                        marginTop: 4,
                        display: "flex",
                        gap: 4,
                        padding: "4px 6px",
                        background: "#f4f4f4",
                        borderRadius: 4,
                        width: "fit-content",
                    }}
                >
                    {QUICK_EMOJI.map((e) => (
                        <button
                            key={e}
                            data-testid={`message-row-emoji-${message.id}-${e}`}
                            type="button"
                            style={{
                                fontSize: 14,
                                padding: "2px 6px",
                                background: "transparent",
                                border: "1px solid transparent",
                                cursor: "pointer",
                            }}
                            onClick={() => void handleToggleReaction(e)}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}
            {!message.deletedAt && message.attachments.length > 0 && (
                <MessageAttachments attachments={message.attachments} messageId={message.id} />
            )}
            {message.reactions.length > 0 && !message.deletedAt && (
                <ReactionChips
                    messageId={message.id}
                    reactions={message.reactions}
                    onToggle={handleToggleReaction}
                />
            )}
        </li>
    );
}

/** True iff any mention in this message points at the current viewer.
 *  Used to decorate rows with a small `@you` tag so a long timeline
 *  surfaces "this one's for you" at a glance. */
function mentionsMe(message: Message): boolean {
    if (typeof window === "undefined") return false;
    const me = localStorage.getItem("userId");
    if (!me) return false;
    return message.mentions.some((m) => m.mentionedUserId === me);
}

interface ReactionChipsProps {
    messageId: string;
    reactions: Message["reactions"];
    onToggle: (emoji: string) => void;
}

/** Groups reactions by emoji, renders one chip per emoji with the
 *  per-emoji count + a tooltip listing the reactors. */
function ReactionChips({ messageId, reactions, onToggle }: ReactionChipsProps) {
    const me = localStorage.getItem("userId");
    const byEmoji = new Map<string, { count: number; mine: boolean; names: string[] }>();
    for (const r of reactions) {
        const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false, names: [] };
        cur.count += 1;
        cur.names.push(r.user.userName);
        if (r.user.userId === me) cur.mine = true;
        byEmoji.set(r.emoji, cur);
    }
    return (
        <div
            data-testid={`message-row-reactions-${messageId}`}
            style={{ display: "flex", gap: 4, marginTop: 4 }}
        >
            {Array.from(byEmoji.entries()).map(([emoji, info]) => (
                <AppTooltip key={emoji} title={info.names.join(", ")}>
                    <button
                        data-testid={`message-row-reaction-chip-${messageId}-${emoji}`}
                        type="button"
                        style={{
                            fontSize: 12,
                            padding: "0 6px",
                            borderRadius: 10,
                            border: info.mine ? "1px solid #44a" : "1px solid #ccc",
                            background: info.mine ? "#eaf" : "#f4f4f4",
                            cursor: "pointer",
                        }}
                        onClick={() => onToggle(emoji)}
                    >
                        <EmojiGlyph emoji={emoji} size={14} /> {info.count}
                    </button>
                </AppTooltip>
            ))}
        </div>
    );
}
