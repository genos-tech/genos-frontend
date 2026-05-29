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

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Box, Button, IconButton, Input, Sheet, Stack, Typography } from "@mui/joy";

import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import { purplePalette } from "../../../theme/purplePalette";
import type { Message } from "../../../types/channel";
import { useAttachmentDraft } from "../hooks/useAttachmentDraft";
import { useChannel } from "../hooks/useChannel";
import { candidatesFromMessages, useMentionDraft } from "../hooks/useMentionDraft";
import { MessageAttachments } from "./MessageAttachments";
import { MessageBody } from "./MessageBody";
import { PendingAttachmentStrip } from "./PendingAttachmentStrip";

/** Pinned to dark palette — see ChannelListV3.tsx for the rationale. */
const p = purplePalette.dark;

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
    const candidates = useMemo(
        () => candidatesFromMessages(messages, currentUserId),
        [messages, currentUserId]
    );
    const mention = useMentionDraft(candidates);
    const attachments = useAttachmentDraft();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
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
        return (
            <Sheet
                sx={{
                    p: 2,
                    flex: 1,
                    color: p.textMuted,
                    background: p.surface,
                }}
            >
                Loading channel {channelId}…
            </Sheet>
        );
    }
    if (!channel) {
        return (
            <Sheet
                sx={{
                    p: 2,
                    flex: 1,
                    color: p.textMuted,
                    background: p.surface,
                }}
            >
                Channel {channelId} not in store.
            </Sheet>
        );
    }

    async function send() {
        const text = mention.draft.trim();
        const hasAttachments = attachments.pending.some((p) => p.error === null);
        // Allow sending if there's text OR at least one valid attachment.
        // An empty text + valid file → the message exists as an "attachment-
        // only" post, matching how the production composer behaves.
        if (!text && !hasAttachments) return;
        setBusy(true);
        setError(null);
        try {
            const body = mention.buildBody();
            const msg = await channelService.send(channelId, body, { bodyText: text });
            // The send ack returns the created message; we need its id to
            // attach files. If the server didn't echo the message (older
            // server / ack shape mismatch), skip the uploads and let the
            // user retry once the message round-trips back via the
            // broadcast.
            if (msg && hasAttachments) {
                const report = await attachments.uploadAll(channelId, msg.id);
                if (report.failed.length > 0) {
                    setError(
                        `Uploaded ${report.succeeded}, ${report.failed.length} failed: ` +
                            report.failed.map((f) => f.error).join("; ")
                    );
                }
            }
            mention.reset();
            // Clear the pending strip only if every upload landed —
            // failures stay visible so the user can retry without
            // re-picking the files.
            if (!hasAttachments || attachments.pending.length === 0) {
                attachments.reset();
            }
        } catch (e) {
            const err = e as ChannelServiceError;
            setError(`${err.code}: ${err.message}`);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Sheet
            data-testid="messages-pane-v3"
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: p.bg,
                color: p.text,
            }}
        >
            <Box
                component="header"
                sx={{
                    px: 1.5,
                    py: 1,
                    borderBottom: `1px solid ${p.divider}`,
                    background: p.surfaceElevated,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 1,
                }}
            >
                <Typography level="title-md" sx={{ color: p.text, fontWeight: 700 }}>
                    {channel.title || channel.id}
                </Typography>
                <Typography level="body-xs" sx={{ color: p.textSubtle }}>
                    (v3)
                </Typography>
            </Box>

            <Box
                component="ul"
                data-testid="messages-pane-v3-list"
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    margin: 0,
                    px: 1.5,
                    py: 1,
                    listStyle: "none",
                }}
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
                {messages.length === 0 && (
                    <Box component="li" sx={{ color: p.textSubtle }}>
                        No messages yet.
                    </Box>
                )}
            </Box>

            {error && (
                <Box
                    role="alert"
                    onClick={() => setError(null)}
                    sx={{
                        color: p.dangerTint,
                        background: p.dangerTintBg,
                        border: `1px solid ${p.dangerTintBorder}`,
                        borderRadius: 6,
                        mx: 1.5,
                        my: 0.5,
                        px: 1,
                        py: 0.5,
                        fontSize: 12,
                        cursor: "pointer",
                    }}
                >
                    {error} (click to dismiss)
                </Box>
            )}

            <PendingAttachmentStrip
                pending={attachments.pending}
                onRemove={attachments.removeAt}
                testIdPrefix="messages-pane-v3"
            />
            <Box
                component="form"
                onSubmit={(e: React.FormEvent) => {
                    e.preventDefault();
                    void send();
                }}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderTop: `1px solid ${p.divider}`,
                    background: p.surface,
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
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                        attachments.addFiles(e.target.files);
                        // Reset the input so the same file can be re-picked
                        // after a remove + re-pick.
                        e.target.value = "";
                    }}
                    style={{ display: "none" }}
                    data-testid="messages-pane-v3-file-input"
                />
                <IconButton
                    size="sm"
                    variant="plain"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    title="Attach file(s)"
                    data-testid="messages-pane-v3-attach"
                    sx={{
                        fontSize: 16,
                        color: p.textMuted,
                        "&:hover": { background: p.hoverBg, color: p.text },
                    }}
                >
                    📎
                </IconButton>
                <Input
                    slotProps={{
                        input: {
                            "data-testid": "messages-pane-v3-input",
                            value: mention.draft,
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                                mention.setDraft(e.target.value);
                                mention.setCaret(e.target.selectionStart ?? e.target.value.length);
                            },
                            onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) =>
                                mention.setCaret(
                                    e.currentTarget.selectionStart ?? e.currentTarget.value.length
                                ),
                            onClick: (e: React.MouseEvent<HTMLInputElement>) =>
                                mention.setCaret(
                                    e.currentTarget.selectionStart ?? e.currentTarget.value.length
                                ),
                        },
                    }}
                    placeholder="Message…  (type @ to mention)"
                    disabled={busy}
                    sx={{
                        flex: 1,
                        background: p.inputBg,
                        borderColor: p.inputBorder,
                        color: p.text,
                        "&:focus-within": {
                            borderColor: p.inputFocusBorder,
                            boxShadow: p.inputFocusShadow,
                        },
                    }}
                />
                <Button
                    type="submit"
                    size="sm"
                    disabled={
                        busy ||
                        attachments.isUploading ||
                        (!mention.draft.trim() &&
                            !attachments.pending.some((p) => p.error === null))
                    }
                    data-testid="messages-pane-v3-send"
                    sx={{
                        background: p.primaryButtonBg,
                        color: "#fff",
                        boxShadow: p.primaryButtonShadow,
                        "&:hover": { background: p.primaryButtonHover },
                        "&:disabled": { opacity: 0.5 },
                    }}
                >
                    {attachments.isUploading ? "Uploading…" : "Send"}
                </Button>
            </Box>
        </Sheet>
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

    const rowActionBtn = {
        background: "transparent",
        border: `1px solid transparent`,
        color: p.textMuted,
        fontSize: 11,
        cursor: "pointer",
        padding: "2px 6px",
        borderRadius: 4,
        "&:hover": { background: p.hoverBg, color: p.text },
    } as const;

    return (
        <Box
            component="li"
            data-testid={`message-row-${message.id}`}
            sx={{
                py: 0.75,
                opacity: message.deletedAt ? 0.4 : 1,
                fontStyle: message.deletedAt ? "italic" : "normal",
                borderRadius: 6,
                px: 0.5,
                "&:hover": { background: p.hoverBg },
                transition: "background 120ms ease",
            }}
        >
            <Box sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                <Typography
                    component="strong"
                    level="title-sm"
                    sx={{ color: p.accentSoft, fontWeight: 700 }}
                >
                    {message.sender?.userName ?? "system"}:
                </Typography>
                {editing ? (
                    <Box sx={{ display: "flex", gap: 0.5, flex: 1 }}>
                        <Input
                            slotProps={{
                                input: {
                                    "data-testid": `message-row-edit-input-${message.id}`,
                                    value: editDraft,
                                    autoFocus: true,
                                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                                        setEditDraft(e.target.value),
                                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === "Enter") void handleSaveEdit();
                                        if (e.key === "Escape") handleCancelEdit();
                                    },
                                },
                            }}
                            size="sm"
                            sx={{
                                flex: 1,
                                background: p.inputBg,
                                borderColor: p.inputBorder,
                                color: p.text,
                            }}
                        />
                        <Button
                            size="sm"
                            variant="soft"
                            onClick={() => void handleSaveEdit()}
                            data-testid={`message-row-edit-save-${message.id}`}
                            sx={{
                                background: p.buttonBg,
                                color: p.text,
                                "&:hover": { background: p.buttonBgHover },
                            }}
                        >
                            Save
                        </Button>
                        <Button
                            size="sm"
                            variant="plain"
                            onClick={handleCancelEdit}
                            sx={{ color: p.textMuted }}
                        >
                            Cancel
                        </Button>
                    </Box>
                ) : (
                    <Box component="span" sx={{ color: p.text, lineHeight: 1.4 }}>
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
                            <Box
                                component="span"
                                data-testid={`message-row-mention-me-${message.id}`}
                                title="This message mentions you"
                                sx={{
                                    ml: 0.75,
                                    px: 0.5,
                                    background: p.dangerTintBg,
                                    color: p.dangerTint,
                                    border: `1px solid ${p.dangerTintBorder}`,
                                    borderRadius: 3,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                }}
                            >
                                @you
                            </Box>
                        )}
                        {message.editedAt && !message.deletedAt && (
                            <Typography
                                component="span"
                                level="body-xs"
                                sx={{ ml: 1, color: p.textSubtle }}
                            >
                                (edited)
                            </Typography>
                        )}
                    </Box>
                )}
                {!editing && !message.deletedAt && isFlagged && (
                    <Box
                        component="span"
                        data-testid={`message-row-flagged-indicator-${message.id}`}
                        title="You flagged this message"
                        sx={{ ml: 0.75, fontSize: 12 }}
                    >
                        ⭐
                    </Box>
                )}
                {!editing && !message.deletedAt && (
                    <Stack
                        direction="row"
                        spacing={0.25}
                        sx={{ ml: "auto", alignItems: "center" }}
                    >
                        <Box
                            component="button"
                            type="button"
                            onClick={() => void handleToggleFlag()}
                            data-testid={`message-row-flag-${message.id}`}
                            title={isFlagged ? "Unflag message" : "Flag message"}
                            sx={{
                                ...rowActionBtn,
                                opacity: isFlagged ? 1 : 0.45,
                            }}
                        >
                            ⭐
                        </Box>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setShowEmoji((v) => !v)}
                            data-testid={`message-row-react-${message.id}`}
                            title="Add reaction"
                            sx={rowActionBtn}
                        >
                            🙂+
                        </Box>
                        {onOpenThread && !message.isThreadReply && (
                            <Box
                                component="button"
                                type="button"
                                onClick={() => onOpenThread(message.id)}
                                data-testid={`message-row-thread-${message.id}`}
                                title="Reply in thread"
                                sx={rowActionBtn}
                            >
                                💬{message.replyCount > 0 ? ` ${message.replyCount}` : ""}
                            </Box>
                        )}
                        {isMine && (
                            <>
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={() => {
                                        setEditDraft(message.bodyText);
                                        setEditing(true);
                                    }}
                                    data-testid={`message-row-edit-${message.id}`}
                                    sx={rowActionBtn}
                                >
                                    Edit
                                </Box>
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={() => void handleDelete()}
                                    data-testid={`message-row-delete-${message.id}`}
                                    sx={rowActionBtn}
                                >
                                    Delete
                                </Box>
                            </>
                        )}
                    </Stack>
                )}
            </Box>
            {showEmoji && !editing && !message.deletedAt && (
                <Box
                    data-testid={`message-row-emoji-picker-${message.id}`}
                    sx={{
                        mt: 0.5,
                        display: "flex",
                        gap: 0.5,
                        px: 0.75,
                        py: 0.5,
                        background: p.chipBg,
                        border: `1px solid ${p.chipBorder}`,
                        borderRadius: 6,
                        width: "fit-content",
                    }}
                >
                    {QUICK_EMOJI.map((e) => (
                        <Box
                            key={e}
                            component="button"
                            type="button"
                            onClick={() => void handleToggleReaction(e)}
                            data-testid={`message-row-emoji-${message.id}-${e}`}
                            sx={{
                                fontSize: 16,
                                px: 0.75,
                                py: 0.25,
                                background: "transparent",
                                border: "1px solid transparent",
                                cursor: "pointer",
                                borderRadius: 4,
                                "&:hover": { background: p.hoverBg },
                            }}
                        >
                            {e}
                        </Box>
                    ))}
                </Box>
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
        </Box>
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
        <Sheet
            variant="outlined"
            data-testid={`${testIdPrefix}-mention-picker`}
            sx={{
                position: "absolute",
                bottom: "100%",
                left: 12,
                mb: 0.5,
                background: p.surfaceSolid,
                borderColor: p.border,
                color: p.text,
                borderRadius: 6,
                boxShadow: p.shadow,
                fontSize: 13,
                minWidth: 180,
                zIndex: 10,
                overflow: "hidden",
            }}
        >
            {suggestions.map((s) => (
                <Box
                    key={s.userId}
                    component="button"
                    type="button"
                    onMouseDown={(e: React.MouseEvent) => {
                        // onMouseDown (not onClick) so we fire before
                        // the input loses focus and the picker unmounts
                        // mid-click. Without this, the trigger char
                        // changes before selectCandidate runs.
                        e.preventDefault();
                        onSelect(s);
                    }}
                    data-testid={`${testIdPrefix}-mention-option-${s.userId}`}
                    sx={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        px: 1,
                        py: 0.75,
                        background: "transparent",
                        border: "none",
                        color: p.text,
                        cursor: "pointer",
                        "&:hover": { background: p.hoverBg },
                    }}
                >
                    @{s.userName}
                </Box>
            ))}
        </Sheet>
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
        <Box
            data-testid={`message-row-reactions-${messageId}`}
            sx={{ display: "flex", gap: 0.5, mt: 0.5 }}
        >
            {Array.from(byEmoji.entries()).map(([emoji, info]) => (
                <Box
                    key={emoji}
                    component="button"
                    type="button"
                    onClick={() => onToggle(emoji)}
                    title={info.names.join(", ")}
                    data-testid={`message-row-reaction-chip-${messageId}-${emoji}`}
                    sx={{
                        fontSize: 12,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 12,
                        border: `1px solid ${info.mine ? p.accentSoft : p.border}`,
                        background: info.mine ? p.activeBg : p.chipBg,
                        color: p.text,
                        cursor: "pointer",
                        "&:hover": {
                            background: info.mine ? p.activeBg : p.hoverBg,
                            borderColor: p.accentSoft,
                        },
                    }}
                >
                    {emoji} {info.count}
                </Box>
            ))}
        </Box>
    );
}
