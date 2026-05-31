/**
 * `ChannelListV3` — v3 chat-list sidebar.
 *
 * Session 3 brings parity-track features on top of the proof-of-life
 * surface that earlier sessions shipped:
 *
 *   - **Search filter**: type to narrow the list by channel title or
 *     latest-message preview text. Case-insensitive substring match.
 *   - **Kind grouping**: channels are split into DM / GM / PM / MDM
 *     sections, each with a collapsible header. Per-kind unread badges
 *     live on the section header.
 *   - **Empty sections are hidden**: when no channels match a kind
 *     (either no channels of that kind, or all filtered out), the
 *     section header itself is omitted so the sidebar doesn't show
 *     empty buckets.
 *
 * Sort order within a section is unchanged from earlier sessions —
 * pinned channels first, then recency desc on `latestMessage.tsSent`.
 *
 * Collapse state lives in component state, not persistence. A reload
 * resets every section to expanded. Adding persistence is cheap when
 * needed; the v3 surface doesn't have a sticky-prefs store yet.
 */

import { Fragment, useMemo, useState, useSyncExternalStore } from "react";

import { channelService } from "../../../services/channel/channelService";
import { ChannelKind, type Channel } from "../../../types/channel";
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

/** Render order for the kind sections — DM first (highest signal-to-
 *  noise for most users), then GM/PM/MDM. Matches the legacy sidebar's
 *  default kind ordering. */
const KIND_ORDER: ChannelKind[] = [
    ChannelKind.DM,
    ChannelKind.GM,
    ChannelKind.PM,
    ChannelKind.MDM,
];

function channelMatchesQuery(c: Channel, q: string): boolean {
    if (!q) return true;
    const title = (c.title || c.id).toLowerCase();
    if (title.includes(q)) return true;
    const preview = c.latestMessage?.bodyText?.toLowerCase();
    return !!preview && preview.includes(q);
}

export function ChannelListV3({ selectedChannelId, onSelect }: ChannelListV3Props) {
    const { channels, unreadByKind, totalUnread, isLoading } = useChannelList();
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );

    const [query, setQuery] = useState("");
    const [collapsedKinds, setCollapsedKinds] = useState<Set<ChannelKind>>(new Set());

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return channels;
        return channels.filter((c) => channelMatchesQuery(c, q));
    }, [channels, query]);

    /** Group the (already-sorted) filtered list by kind. Preserves
     *  the sort order so pinned-first / recency-desc still applies
     *  within each section. */
    const byKind = useMemo(() => {
        const groups = new Map<ChannelKind, Channel[]>();
        for (const c of filtered) {
            const arr = groups.get(c.kind);
            if (arr) arr.push(c);
            else groups.set(c.kind, [c]);
        }
        return groups;
    }, [filtered]);

    function toggleKindCollapse(kind: ChannelKind) {
        setCollapsedKinds((prev) => {
            const next = new Set(prev);
            if (next.has(kind)) next.delete(kind);
            else next.add(kind);
            return next;
        });
    }

    async function togglePin(channelId: string, isPinned: boolean) {
        try {
            if (isPinned) await channelService.unpinChannel(channelId);
            else await channelService.pinChannel(channelId);
        } catch {
            /* optimistic UI rolls back on failure */
        }
    }

    const visibleKinds = KIND_ORDER.filter((k) => (byKind.get(k)?.length ?? 0) > 0);
    const hasResults = filtered.length > 0;

    return (
        <aside
            data-testid="channel-list-v3"
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: 240,
                borderRight: "1px solid #ddd",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            <header
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #ddd",
                    background: "#fafafa",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <strong>Channels (v3)</strong>
                <span
                    data-testid="channel-list-v3-total-unread"
                    style={{ opacity: 0.7 }}
                    title={`DM ${unreadByKind[ChannelKind.DM]} | GM ${unreadByKind[ChannelKind.GM]} | PM ${unreadByKind[ChannelKind.PM]} | MDM ${unreadByKind[ChannelKind.MDM]}`}
                >
                    {totalUnread}
                </span>
            </header>

            <div
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #eee",
                    background: "#fff",
                }}
            >
                <input
                    data-testid="channel-list-v3-search"
                    placeholder="Search channels…"
                    type="search"
                    value={query}
                    style={{
                        width: "100%",
                        padding: "4px 8px",
                        boxSizing: "border-box",
                        fontSize: 13,
                    }}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <ul
                data-testid="channel-list-v3-list"
                style={{
                    flex: 1,
                    overflowY: "auto",
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                }}
            >
                {isLoading && <li style={{ padding: 12, opacity: 0.5 }}>Loading…</li>}
                {!isLoading && channels.length === 0 && (
                    <li style={{ padding: 12, opacity: 0.5 }}>No channels yet.</li>
                )}
                {!isLoading && channels.length > 0 && !hasResults && (
                    <li
                        data-testid="channel-list-v3-no-results"
                        style={{ padding: 12, opacity: 0.5 }}
                    >
                        No channels match “{query}”.
                    </li>
                )}
                {visibleKinds.map((kind) => {
                    const items = byKind.get(kind) ?? [];
                    const collapsed = collapsedKinds.has(kind);
                    const kindUnread = unreadByKind[kind];
                    return (
                        <Fragment key={kind}>
                            <li
                                data-collapsed={collapsed ? "true" : "false"}
                                data-testid={`channel-list-v3-section-header-${kind}`}
                                style={{
                                    padding: 0,
                                    borderBottom: "1px solid #eee",
                                    background: "#f7f7f7",
                                }}
                            >
                                <button
                                    aria-expanded={!collapsed}
                                    data-testid={`channel-list-v3-section-toggle-${kind}`}
                                    type="button"
                                    style={{
                                        width: "100%",
                                        padding: "6px 12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        textAlign: "left",
                                        font: "inherit",
                                    }}
                                    onClick={() => toggleKindCollapse(kind)}
                                >
                                    <span style={{ fontSize: 10, opacity: 0.6 }}>
                                        {collapsed ? "▶" : "▼"}
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                                        {KIND_LABEL[kind]}
                                    </span>
                                    <span style={{ opacity: 0.5, fontSize: 11 }}>
                                        ({items.length})
                                    </span>
                                    {kindUnread > 0 && (
                                        <span
                                            data-testid={`channel-list-v3-section-unread-${kind}`}
                                            style={{
                                                marginLeft: "auto",
                                                background: "#c33",
                                                color: "white",
                                                borderRadius: 10,
                                                padding: "1px 6px",
                                                fontSize: 10,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {kindUnread}
                                        </span>
                                    )}
                                </button>
                            </li>
                            {!collapsed &&
                                items.map((c) => {
                                    const selected = c.id === selectedChannelId;
                                    const isPinned = snapshot.pinByChannelId.has(c.id);
                                    return (
                                        <li
                                            key={c.id}
                                            data-testid={`channel-list-v3-item-${c.id}`}
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
                                            onClick={() => onSelect(c.id)}
                                        >
                                            <span
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                }}
                                            >
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
                                                data-testid={`channel-list-v3-pin-${c.id}`}
                                                title={isPinned ? "Unpin channel" : "Pin channel"}
                                                type="button"
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    cursor: "pointer",
                                                    padding: 0,
                                                    fontSize: 14,
                                                    opacity: isPinned ? 1 : 0.35,
                                                }}
                                                onClick={(e) => {
                                                    // Stop the row's click handler from firing
                                                    // → toggling pin shouldn't ALSO open the
                                                    // channel.
                                                    e.stopPropagation();
                                                    void togglePin(c.id, isPinned);
                                                }}
                                            >
                                                📌
                                            </button>
                                        </li>
                                    );
                                })}
                        </Fragment>
                    );
                })}
            </ul>
        </aside>
    );
}
