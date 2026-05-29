/**
 * `ChannelListV3` — minimal v3 chat-list sidebar.
 *
 * Proof-of-life surface for the unified v3 architecture. Renders the
 * user's channels sorted by `latestMessage.tsSent` desc, with per-kind
 * unread badges. Click → calls the parent's `onSelect(channelId)`.
 *
 * Same caveats as `MessagesPaneV3`: intentionally unstyled, intended
 * to verify the hook + service end-to-end before the production
 * sidebar is migrated.
 */

import { useSyncExternalStore } from "react";

import { channelService } from "../../../services/channel/channelService";
import { ChannelKind } from "../../../types/channel";
import { useChannelList } from "../hooks/useChannelList";

interface ChannelListV3Props {
    selectedChannelId: string | null;
    onSelect: (channelId: string) => void;
}

const KIND_LABEL: Record<ChannelKind, string> = {
    [ChannelKind.DM]: "DM",
    [ChannelKind.GM]: "GM",
    [ChannelKind.PM]: "PM",
    [ChannelKind.MDM]: "MDM",
};

export function ChannelListV3({ selectedChannelId, onSelect }: ChannelListV3Props) {
    const { channels, unreadByKind, totalUnread, isLoading } = useChannelList();
    // Subscribe to the store directly to get the pin index (the list
    // hook already memoizes on `pinByChannelId`, but we re-read it
    // here so each row's pin button knows whether to render as
    // selected without a prop dance).
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );

    async function togglePin(channelId: string, isPinned: boolean) {
        try {
            if (isPinned) await channelService.unpinChannel(channelId);
            else await channelService.pinChannel(channelId);
        } catch {
            /* optimistic UI rolls back on failure */
        }
    }

    return (
        <aside
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: 240,
                borderRight: "1px solid #ddd",
                fontFamily: "system-ui, sans-serif",
            }}
            data-testid="channel-list-v3"
        >
            <header
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #ddd",
                    background: "#fafafa",
                    display: "flex",
                    justifyContent: "space-between",
                }}
            >
                <strong>Channels (v3)</strong>
                <span
                    title={`DM ${unreadByKind[ChannelKind.DM]} | GM ${unreadByKind[ChannelKind.GM]} | PM ${unreadByKind[ChannelKind.PM]} | MDM ${unreadByKind[ChannelKind.MDM]}`}
                    style={{ opacity: 0.7 }}
                >
                    {totalUnread}
                </span>
            </header>

            <ul
                style={{
                    flex: 1,
                    overflowY: "auto",
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                }}
                data-testid="channel-list-v3-list"
            >
                {isLoading && <li style={{ padding: 12, opacity: 0.5 }}>Loading…</li>}
                {!isLoading && channels.length === 0 && (
                    <li style={{ padding: 12, opacity: 0.5 }}>No channels yet.</li>
                )}
                {channels.map((c) => {
                    const selected = c.id === selectedChannelId;
                    const isPinned = snapshot.pinByChannelId.has(c.id);
                    return (
                        <li
                            key={c.id}
                            data-testid={`channel-list-v3-item-${c.id}`}
                            onClick={() => onSelect(c.id)}
                            style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #eee",
                                background: selected ? "#eef" : "transparent",
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                                <span
                                    style={{
                                        fontSize: 10,
                                        opacity: 0.6,
                                        marginRight: 6,
                                    }}
                                >
                                    {KIND_LABEL[c.kind]}
                                </span>
                                {isPinned && (
                                    <span
                                        data-testid={`channel-list-v3-pinned-indicator-${c.id}`}
                                        style={{ marginRight: 4, fontSize: 11 }}
                                        title="Pinned"
                                    >
                                        📌
                                    </span>
                                )}
                                <strong>{c.title || c.id.slice(0, 8)}</strong>
                                <div
                                    style={{
                                        fontSize: 11,
                                        opacity: 0.6,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {c.latestMessage?.bodyText || "—"}
                                </div>
                            </span>
                            {c.unreadCount > 0 && (
                                <span
                                    style={{
                                        background: "#c33",
                                        color: "white",
                                        borderRadius: 12,
                                        padding: "1px 6px",
                                        fontSize: 11,
                                    }}
                                >
                                    {c.unreadCount}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={(e) => {
                                    // Stop the row's click handler from firing
                                    // → toggling pin shouldn't ALSO open the
                                    // channel.
                                    e.stopPropagation();
                                    void togglePin(c.id, isPinned);
                                }}
                                data-testid={`channel-list-v3-pin-${c.id}`}
                                title={isPinned ? "Unpin channel" : "Pin channel"}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                    fontSize: 14,
                                    opacity: isPinned ? 1 : 0.35,
                                }}
                            >
                                📌
                            </button>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}
