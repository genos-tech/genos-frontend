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

import { useCallback, useEffect, useMemo, useState } from "react";

import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import type { Message } from "../../../types/channel";
import { useChannel } from "../hooks/useChannel";
import { candidatesFromMessages, useMentionDraft } from "../hooks/useMentionDraft";
import { MessageBody } from "./MessageBody";

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
    const currentUserId = typeof window === "undefined" ? null : localStorage.getItem("userId");
    const candidates = useMemo(
        () => candidatesFromMessages(messages, currentUserId),
        [messages, currentUserId]
    );
    const mention = useMentionDraft(candidates);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Mark-read on view: whenever the latest message in this channel
    // differs from the last-read cursor, advance the cursor so my
    // unread badge decrements. The server enforces forward-only so a
    // race with another tab can't rewind us.
    useEffect(() => {
        if (!channel || messages.length === 0) return;
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

    async function send() {
        const text = mention.draft.trim();
        if (!text) return;
        setBusy(true);
        setError(null);
        try {
            const body = mention.buildBody();
            await channelService.send(channelId, body, { bodyText: text });
            mention.reset();
        } catch (e) {
            const err = e as ChannelServiceError;
            setError(`${err.code}: ${err.message}`);
        } finally {
            setBusy(false);
        }
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

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                }}
                style={{
                    display: "flex",
                    gap: 8,
                    padding: "8px 12px",
                    borderTop: "1px solid #ddd",
                    position: "relative",
                }}
            >
                {mention.pickerOpen && (
                    <MentionPicker
                        testIdPrefix="messages-pane-v3"
                        suggestions={mention.suggestions}
                        onSelect={mention.selectCandidate}
                    />
                )}
                <input
                    type="text"
                    value={mention.draft}
                    onChange={(e) => {
                        mention.setDraft(e.target.value);
                        mention.setCaret(e.target.selectionStart ?? e.target.value.length);
                    }}
                    onKeyUp={(e) =>
                        mention.setCaret(
                            e.currentTarget.selectionStart ?? e.currentTarget.value.length
                        )
                    }
                    onClick={(e) =>
                        mention.setCaret(
                            e.currentTarget.selectionStart ?? e.currentTarget.value.length
                        )
                    }
                    placeholder="Message…  (type @ to mention)"
                    disabled={busy}
                    style={{ flex: 1, padding: "4px 8px" }}
                    data-testid="messages-pane-v3-input"
                />
                <button
                    type="submit"
                    disabled={busy || !mention.draft.trim()}
                    data-testid="messages-pane-v3-send"
                >
                    Send
                </button>
            </form>
        </div>
    );
}

interface MessageRowProps {
    message: Message;
    channelId: string;
    channelKind: number;
    onError: (msg: string) => void;
    /** Forwarded from the pane. When set, each row renders a thread
     *  entry-point button + a reply-count chip when `replyCount > 0`. */
    onOpenThread?: (rootMessageId: string) => void;
}

/** Per-message row. Owns the edit-mode toggle, the inline editor, and
 *  the per-row interaction buttons. Pulled out so a re-render of one
 *  row's edit state doesn't re-render the whole list. */
function MessageRow({ message, channelId, channelKind, onError, onOpenThread }: MessageRowProps) {
    const [editing, setEditing] = useState(false);
    const [editDraft, setEditDraft] = useState(message.bodyText);
    const [showEmoji, setShowEmoji] = useState(false);

    const reportError = useCallback(
        (e: unknown) => {
            const err = e as ChannelServiceError;
            onError(`${err.code ?? "INTERNAL"}: ${err.message ?? String(err)}`);
        },
        [onError]
    );

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
            data-testid={`message-row-${message.id}`}
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
                {!editing && !message.deletedAt && (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                        <button
                            type="button"
                            onClick={() => setShowEmoji((v) => !v)}
                            data-testid={`message-row-react-${message.id}`}
                            style={{ fontSize: 11 }}
                            title="Add reaction"
                        >
                            🙂+
                        </button>
                        {onOpenThread && !message.isThreadReply && (
                            <button
                                type="button"
                                onClick={() => onOpenThread(message.id)}
                                data-testid={`message-row-thread-${message.id}`}
                                style={{ fontSize: 11 }}
                                title="Reply in thread"
                            >
                                💬{message.replyCount > 0 ? ` ${message.replyCount}` : ""}
                            </button>
                        )}
                        {isMine && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditDraft(message.bodyText);
                                        setEditing(true);
                                    }}
                                    style={{ fontSize: 11 }}
                                    data-testid={`message-row-edit-${message.id}`}
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleDelete()}
                                    style={{ fontSize: 11 }}
                                    data-testid={`message-row-delete-${message.id}`}
                                >
                                    Delete
                                </button>
                            </>
                        )}
                    </span>
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

interface MentionPickerProps {
    testIdPrefix: string;
    suggestions: { userId: string; userName: string }[];
    onSelect: (c: { userId: string; userName: string }) => void;
}

/** Floating dropdown rendered above the composer when an `@` trigger
 *  is active. Clicking a row inserts the mention chip via the hook. */
function MentionPicker({ testIdPrefix, suggestions, onSelect }: MentionPickerProps) {
    return (
        <div
            data-testid={`${testIdPrefix}-mention-picker`}
            style={{
                position: "absolute",
                bottom: "100%",
                left: 12,
                marginBottom: 4,
                background: "#fff",
                border: "1px solid #ccc",
                borderRadius: 4,
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                fontSize: 13,
                minWidth: 160,
                zIndex: 10,
            }}
        >
            {suggestions.map((s) => (
                <button
                    key={s.userId}
                    type="button"
                    onMouseDown={(e) => {
                        // onMouseDown (not onClick) so we fire before
                        // the input loses focus and the picker unmounts
                        // mid-click. Without this, the trigger char
                        // changes before selectCandidate runs.
                        e.preventDefault();
                        onSelect(s);
                    }}
                    data-testid={`${testIdPrefix}-mention-option-${s.userId}`}
                    style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "4px 8px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    @{s.userName}
                </button>
            ))}
        </div>
    );
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
