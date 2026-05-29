/**
 * `ThreadPanelV3` — side panel that renders one thread.
 *
 * Consumed by `V3ChatShell` when the route includes a `:rootMessageId`.
 * Reads the root + replies via `useChannelThread` (which subscribes to
 * the same `channelService` store as the main pane), exposes a
 * composer that sends replies with `parentId === rootMessageId`.
 *
 * Intentionally not styled to match the production thread surface yet —
 * proof-of-life only.
 */

import { useMemo, useRef, useState, useSyncExternalStore } from "react";

import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import { useAttachmentDraft } from "../hooks/useAttachmentDraft";
import { useChannelThread } from "../hooks/useChannelThread";
import { candidatesFromMessages, useMentionDraft } from "../hooks/useMentionDraft";
import { MessageAttachments } from "./MessageAttachments";
import { MessageBody } from "./MessageBody";
import { PendingAttachmentStrip } from "./PendingAttachmentStrip";

interface ThreadPanelV3Props {
    channelId: string;
    rootMessageId: string;
    onClose: () => void;
}

export function ThreadPanelV3({ channelId, rootMessageId, onClose }: ThreadPanelV3Props) {
    const { root, replies, replyInThread, isLoading } = useChannelThread(channelId, rootMessageId);
    const currentUserId = typeof window === "undefined" ? null : localStorage.getItem("userId");
    // Picker candidates come from the people we've already seen in this
    // thread — root + replies. That keeps the mention scope tight to
    // the thread participants, not the whole channel.
    const candidates = useMemo(
        () => candidatesFromMessages(root ? [root, ...replies] : replies, currentUserId),
        [root, replies, currentUserId]
    );
    const mention = useMentionDraft(candidates);
    const attachments = useAttachmentDraft();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function toggleFlag(messageId: string, isFlagged: boolean) {
        try {
            if (isFlagged) await channelService.unflagMessage(messageId);
            else await channelService.flagMessage(messageId);
        } catch (e) {
            const err = e as ChannelServiceError;
            setError(`${err.code ?? "INTERNAL"}: ${err.message ?? String(err)}`);
        }
    }

    async function send() {
        const text = mention.draft.trim();
        const hasAttachments = attachments.pending.some((p) => p.error === null);
        if (!text && !hasAttachments) return;
        setBusy(true);
        setError(null);
        try {
            const reply = await replyInThread(mention.buildBody(), { bodyText: text });
            if (reply && hasAttachments) {
                const report = await attachments.uploadAll(channelId, reply.id);
                if (report.failed.length > 0) {
                    setError(
                        `Uploaded ${report.succeeded}, ${report.failed.length} failed: ` +
                            report.failed.map((f) => f.error).join("; ")
                    );
                }
            }
            mention.reset();
            if (!hasAttachments || attachments.pending.length === 0) {
                attachments.reset();
            }
        } catch (e) {
            const err = e as ChannelServiceError;
            setError(`${err.code ?? "INTERNAL"}: ${err.message ?? String(err)}`);
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
            data-testid="thread-panel-v3"
        >
            <header
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #ddd",
                    background: "#fafafa",
                    fontWeight: 600,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <span>Thread</span>
                <button
                    type="button"
                    onClick={onClose}
                    style={{ fontSize: 12 }}
                    data-testid="thread-panel-v3-close"
                >
                    Close
                </button>
            </header>

            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "8px 12px",
                }}
                data-testid="thread-panel-v3-body"
            >
                {isLoading && <div style={{ opacity: 0.5 }}>Loading thread…</div>}
                {!isLoading && root && (
                    <>
                        <div
                            style={{
                                paddingBottom: 8,
                                borderBottom: "1px solid #eee",
                                marginBottom: 8,
                            }}
                            data-testid="thread-panel-v3-root"
                        >
                            <strong>{root.sender?.userName ?? "system"}:</strong>{" "}
                            {root.deletedAt ? (
                                "(deleted)"
                            ) : (
                                <MessageBody
                                    body={root.body}
                                    bodyText={root.bodyText}
                                    currentUserId={currentUserId}
                                />
                            )}
                            {!root.deletedAt && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        void toggleFlag(
                                            root.id,
                                            snapshot.flagByMessageId.has(root.id)
                                        )
                                    }
                                    data-testid={`thread-panel-v3-flag-${root.id}`}
                                    style={{
                                        marginLeft: 6,
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: 12,
                                        opacity: snapshot.flagByMessageId.has(root.id) ? 1 : 0.45,
                                    }}
                                    title={
                                        snapshot.flagByMessageId.has(root.id) ? "Unflag" : "Flag"
                                    }
                                >
                                    ⭐
                                </button>
                            )}
                            {!root.deletedAt && root.attachments.length > 0 && (
                                <MessageAttachments
                                    messageId={root.id}
                                    attachments={root.attachments}
                                />
                            )}
                        </div>
                        <ul
                            style={{ listStyle: "none", margin: 0, padding: 0 }}
                            data-testid="thread-panel-v3-replies"
                        >
                            {replies.map((r) => (
                                <li
                                    key={r.id}
                                    style={{
                                        padding: "4px 0",
                                        opacity: r.deletedAt ? 0.4 : 1,
                                    }}
                                    data-testid={`thread-panel-v3-reply-${r.id}`}
                                >
                                    <strong>{r.sender?.userName ?? "system"}:</strong>{" "}
                                    {r.deletedAt ? (
                                        "(deleted)"
                                    ) : (
                                        <MessageBody
                                            body={r.body}
                                            bodyText={r.bodyText}
                                            currentUserId={currentUserId}
                                        />
                                    )}
                                    {r.editedAt && !r.deletedAt && (
                                        <span
                                            style={{
                                                marginLeft: 8,
                                                opacity: 0.5,
                                                fontSize: 12,
                                            }}
                                        >
                                            (edited)
                                        </span>
                                    )}
                                    {!r.deletedAt && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void toggleFlag(
                                                    r.id,
                                                    snapshot.flagByMessageId.has(r.id)
                                                )
                                            }
                                            data-testid={`thread-panel-v3-flag-${r.id}`}
                                            style={{
                                                marginLeft: 6,
                                                background: "transparent",
                                                border: "none",
                                                cursor: "pointer",
                                                fontSize: 12,
                                                opacity: snapshot.flagByMessageId.has(r.id)
                                                    ? 1
                                                    : 0.45,
                                            }}
                                            title={
                                                snapshot.flagByMessageId.has(r.id)
                                                    ? "Unflag"
                                                    : "Flag"
                                            }
                                        >
                                            ⭐
                                        </button>
                                    )}
                                    {!r.deletedAt && r.attachments.length > 0 && (
                                        <MessageAttachments
                                            messageId={r.id}
                                            attachments={r.attachments}
                                        />
                                    )}
                                </li>
                            ))}
                            {replies.length === 0 && (
                                <li style={{ opacity: 0.5 }}>No replies yet.</li>
                            )}
                        </ul>
                    </>
                )}
                {!isLoading && !root && (
                    <div style={{ opacity: 0.5 }}>Thread root not loaded.</div>
                )}
            </div>

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

            <PendingAttachmentStrip
                pending={attachments.pending}
                onRemove={attachments.removeAt}
                testIdPrefix="thread-panel-v3"
            />
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
                    <div
                        data-testid="thread-panel-v3-mention-picker"
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
                        {mention.suggestions.map((s) => (
                            <button
                                key={s.userId}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    mention.selectCandidate(s);
                                }}
                                data-testid={`thread-panel-v3-mention-option-${s.userId}`}
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
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                        attachments.addFiles(e.target.files);
                        e.target.value = "";
                    }}
                    style={{ display: "none" }}
                    data-testid="thread-panel-v3-file-input"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || !root}
                    style={{ fontSize: 14 }}
                    title="Attach file(s)"
                    data-testid="thread-panel-v3-attach"
                >
                    📎
                </button>
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
                    placeholder="Reply…  (type @ to mention)"
                    disabled={busy || !root}
                    style={{ flex: 1, padding: "4px 8px" }}
                    data-testid="thread-panel-v3-input"
                />
                <button
                    type="submit"
                    disabled={
                        busy ||
                        !root ||
                        attachments.isUploading ||
                        (!mention.draft.trim() &&
                            !attachments.pending.some((p) => p.error === null))
                    }
                    data-testid="thread-panel-v3-send"
                >
                    {attachments.isUploading ? "Uploading…" : "Reply"}
                </button>
            </form>
        </div>
    );
}
