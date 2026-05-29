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

import { useState } from "react";

import { ChannelServiceError } from "../../../services/channel/channelService";
import { useChannelThread } from "../hooks/useChannelThread";

interface ThreadPanelV3Props {
    channelId: string;
    rootMessageId: string;
    onClose: () => void;
}

export function ThreadPanelV3({ channelId, rootMessageId, onClose }: ThreadPanelV3Props) {
    const { root, replies, replyInThread, isLoading } = useChannelThread(channelId, rootMessageId);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function send() {
        const text = draft.trim();
        if (!text) return;
        setBusy(true);
        setError(null);
        try {
            await replyInThread([{ type: "paragraph", content: [{ type: "text", text }] }], {
                bodyText: text,
            });
            setDraft("");
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
                            {root.deletedAt ? "(deleted)" : root.bodyText}
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
                                    {r.deletedAt ? "(deleted)" : r.bodyText}
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
                }}
            >
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply…"
                    disabled={busy || !root}
                    style={{ flex: 1, padding: "4px 8px" }}
                    data-testid="thread-panel-v3-input"
                />
                <button
                    type="submit"
                    disabled={busy || !draft.trim() || !root}
                    data-testid="thread-panel-v3-send"
                >
                    Reply
                </button>
            </form>
        </div>
    );
}
