/**
 * `MessagesPaneV3` — minimal v3 chat pane.
 *
 * Proof-of-life surface for the unified v3 architecture: renders one
 * channel's messages live from `useChannel`, exposes send / edit /
 * delete / react via `channelService` mutations.
 *
 * Intentionally NOT styled like the production MainChatPane. The goal
 * is to verify end-to-end:
 *   - the in-memory store updates on socket events
 *   - useSyncExternalStore re-renders correctly
 *   - mutation methods emit + ack + roundtrip back via broadcast
 *
 * Once this is stable the production chat surfaces get migrated to
 * use the same hook + service, and this component is deleted.
 */

import { useState } from "react";

import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import { useChannel } from "../hooks/useChannel";

interface MessagesPaneV3Props {
    channelId: string;
}

export function MessagesPaneV3({ channelId }: MessagesPaneV3Props) {
    const { channel, messages, isLoading } = useChannel(channelId);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (isLoading) {
        return <div style={{ padding: 16 }}>Loading channel {channelId}…</div>;
    }
    if (!channel) {
        return <div style={{ padding: 16 }}>Channel {channelId} not in store.</div>;
    }

    async function send() {
        const text = draft.trim();
        if (!text) return;
        setBusy(true);
        setError(null);
        try {
            await channelService.send(
                channelId,
                [{ type: "paragraph", content: [{ type: "text", text }] }],
                { bodyText: text }
            );
            setDraft("");
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
                    <li
                        key={m.id}
                        style={{
                            padding: "4px 0",
                            opacity: m.deletedAt ? 0.4 : 1,
                            fontStyle: m.deletedAt ? "italic" : "normal",
                        }}
                    >
                        <strong>{m.sender?.userName ?? "system"}:</strong>{" "}
                        {m.deletedAt ? "(deleted)" : m.bodyText}
                        {m.editedAt && !m.deletedAt && (
                            <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 12 }}>
                                (edited)
                            </span>
                        )}
                    </li>
                ))}
                {messages.length === 0 && <li style={{ opacity: 0.5 }}>No messages yet.</li>}
            </ul>

            {error && (
                <div style={{ color: "crimson", padding: "4px 12px", fontSize: 12 }}>{error}</div>
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
                    placeholder="Message…"
                    disabled={busy}
                    style={{ flex: 1, padding: "4px 8px" }}
                    data-testid="messages-pane-v3-input"
                />
                <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    data-testid="messages-pane-v3-send"
                >
                    Send
                </button>
            </form>
        </div>
    );
}
