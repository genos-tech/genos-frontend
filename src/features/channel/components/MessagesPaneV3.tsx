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

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

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
}

/** Common emojis for the quick-react row. Kept short so it doesn't
 *  overwhelm the proof-of-life UI. */
const QUICK_EMOJI = ["👍", "❤️", "🎉", "🤔", "😄"];

export function MessagesPaneV3({ channelId, onOpenThread }: MessagesPaneV3Props) {
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
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                fontFamily: "system-ui, sans-serif",
            }}
            data-testid="messages-pane-v3"
        >
            <header
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 600,
                }}
            >
                {channel.title || channel.id} <span style={{ opacity: 0.6 }}>(v3)</span>
            </header>

            <ul
                style={{
                    flex: 1,
                    overflowY: "auto",
                    margin: 0,
                    padding: "8px 12px",
                    listStyle: "none",
                }}
                data-testid="messages-pane-v3-list"
            >
                {messages.map((m) => (
                    <MessageRow
                        key={m.id}
                        message={m}
                        channelId={channelId}
                        channelKind={channel.kind}
                        isFlagged={snapshot.flagByMessageId.has(m.id)}
                        onError={setError}
                        onOpenThread={onOpenThread}
                    />
                ))}
                {messages.length === 0 && <li style={{ opacity: 0.5 }}>No messages yet.</li>}
            </ul>

            {error && (
                <div
                    style={{
                        color: "crimson",
                        padding: "4px 12px",
                        fontSize: 12,
                    }}
                    role="alert"
                    onClick={() => setError(null)}
                >
                    {error} (click to dismiss)
                </div>
            )}

            <MessageComposerV3
                channelId={channelId}
                currentUserId={currentUserId}
                onError={setError}
                testIdPrefix="messages-pane-v3"
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
    const [editing, setEditing] = useState(false);
    const [editDraft, setEditDraft] = useState(message.bodyText);
    const [showEmoji, setShowEmoji] = useState(false);
    const [hovered, setHovered] = useState(false);

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
            id={`message-${message.id}`}
            data-testid={`message-row-${message.id}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={(e) => {
                // Keep the toolbar visible if focus moves to a child
                // (e.g. clicking the react button to open the emoji
                // popover). Only collapse when focus leaves the row.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setHovered(false);
                }
            }}
            style={{
                padding: "6px 0",
                opacity: message.deletedAt ? 0.4 : 1,
                fontStyle: message.deletedAt ? "italic" : "normal",
            }}
        >
            <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <strong>{message.sender?.userName ?? "system"}:</strong>{" "}
                {editing ? (
                    <span style={{ display: "flex", gap: 4, flex: 1 }}>
                        <input
                            type="text"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSaveEdit();
                                if (e.key === "Escape") handleCancelEdit();
                            }}
                            autoFocus
                            style={{ flex: 1, padding: "2px 6px" }}
                            data-testid={`message-row-edit-input-${message.id}`}
                        />
                        <button
                            type="button"
                            onClick={() => void handleSaveEdit()}
                            data-testid={`message-row-edit-save-${message.id}`}
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
                                title="This message mentions you"
                            >
                                @you
                            </span>
                        )}
                        {message.editedAt && !message.deletedAt && (
                            <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 12 }}>
                                (edited)
                            </span>
                        )}
                    </>
                )}
                {!editing && !message.deletedAt && isFlagged && (
                    <span
                        data-testid={`message-row-flagged-indicator-${message.id}`}
                        style={{ marginLeft: 6, fontSize: 12 }}
                        title="You flagged this message"
                    >
                        ⭐
                    </span>
                )}
                {!editing && !message.deletedAt && (
                    <MessageRowHoverToolbar
                        messageId={message.id}
                        // The popover stays open after the reaction is
                        // toggled (handleToggleReaction closes it), so
                        // keep the toolbar visible while it's open even
                        // if hover has moved away — otherwise the user
                        // can't see what they're clicking on.
                        visible={hovered || showEmoji}
                        onFlag={() => void handleToggleFlag()}
                        isFlagged={isFlagged}
                        onReact={() => setShowEmoji((v) => !v)}
                        onReply={
                            onOpenThread && !message.isThreadReply
                                ? () => onOpenThread(message.id)
                                : undefined
                        }
                        replyCount={message.replyCount}
                        onCopyLink={copyLink}
                        isMine={!!isMine}
                        onEdit={() => {
                            setEditDraft(message.bodyText);
                            setEditing(true);
                        }}
                        onDelete={() => void handleDelete()}
                    />
                )}
            </div>
            {showEmoji && !editing && !message.deletedAt && (
                <div
                    style={{
                        marginTop: 4,
                        display: "flex",
                        gap: 4,
                        padding: "4px 6px",
                        background: "#f4f4f4",
                        borderRadius: 4,
                        width: "fit-content",
                    }}
                    data-testid={`message-row-emoji-picker-${message.id}`}
                >
                    {QUICK_EMOJI.map((e) => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => void handleToggleReaction(e)}
                            style={{
                                fontSize: 14,
                                padding: "2px 6px",
                                background: "transparent",
                                border: "1px solid transparent",
                                cursor: "pointer",
                            }}
                            data-testid={`message-row-emoji-${message.id}-${e}`}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}
            {!message.deletedAt && message.attachments.length > 0 && (
                <MessageAttachments messageId={message.id} attachments={message.attachments} />
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
            style={{ display: "flex", gap: 4, marginTop: 4 }}
            data-testid={`message-row-reactions-${messageId}`}
        >
            {Array.from(byEmoji.entries()).map(([emoji, info]) => (
                <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggle(emoji)}
                    title={info.names.join(", ")}
                    data-testid={`message-row-reaction-chip-${messageId}-${emoji}`}
                    style={{
                        fontSize: 12,
                        padding: "0 6px",
                        borderRadius: 10,
                        border: info.mine ? "1px solid #44a" : "1px solid #ccc",
                        background: info.mine ? "#eaf" : "#f4f4f4",
                        cursor: "pointer",
                    }}
                >
                    {emoji} {info.count}
                </button>
            ))}
        </div>
    );
}
