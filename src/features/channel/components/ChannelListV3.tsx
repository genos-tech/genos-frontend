/**
 * `ChannelListV3` — minimal v3 chat-list sidebar.
 *
 * Joy-UI styled now: the sidebar is a `Sheet` carrying the dark
 * purple surface; rows are styled `Box`es that visually echo the
 * legacy `MainChatPane`'s sidebar. All existing test ids are
 * preserved so the V3 test suite keeps passing.
 *
 * Click a row → `onSelect(channelId)`. Each row has a pin toggle
 * (📌); pinned channels float to the top via `useChannelList`'s
 * sort comparator. `stopPropagation` on the pin button so toggling
 * pin doesn't also open the channel.
 */

import { useSyncExternalStore } from "react";
import { Box, IconButton, Sheet, Stack, Typography } from "@mui/joy";

import { channelService } from "../../../services/channel/channelService";
import { purplePalette } from "../../../theme/purplePalette";
import { ChannelKind } from "../../../types/channel";
import { useChannelList } from "../hooks/useChannelList";

/** Single source of truth for the v3 chat surfaces' palette.
 *
 * Pinned to the dark variant because (a) the production chat panes
 * are dark-themed and (b) calling `useColorScheme()` here requires a
 * `CssVarsProvider` ancestor — the v3 component tests render in
 * isolation and would all crash otherwise. If light-mode support is
 * needed later, plumb the mode through props or wrap the tests in a
 * provider helper. */
const p = purplePalette.dark;

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
        <Sheet
            data-testid="channel-list-v3"
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: 260,
                borderRight: `1px solid ${p.border}`,
                background: p.surface,
                color: p.text,
            }}
        >
            <Box
                sx={{
                    px: 1.5,
                    py: 1,
                    borderBottom: `1px solid ${p.divider}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: p.surfaceElevated,
                }}
            >
                <Typography level="title-sm" sx={{ color: p.text, fontWeight: 700 }}>
                    Channels{" "}
                    <Typography component="span" level="body-xs" sx={{ color: p.textSubtle }}>
                        (v3)
                    </Typography>
                </Typography>
                <Typography
                    level="body-xs"
                    sx={{
                        color: p.textMuted,
                        background: p.chipBg,
                        border: `1px solid ${p.chipBorder}`,
                        borderRadius: 12,
                        px: 1,
                        py: 0.25,
                        minWidth: 24,
                        textAlign: "center",
                    }}
                    title={`DM ${unreadByKind[ChannelKind.DM]} | GM ${unreadByKind[ChannelKind.GM]} | PM ${unreadByKind[ChannelKind.PM]} | MDM ${unreadByKind[ChannelKind.MDM]}`}
                >
                    {totalUnread}
                </Typography>
            </Box>

            <Box
                component="ul"
                data-testid="channel-list-v3-list"
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                }}
            >
                {isLoading && (
                    <Box component="li" sx={{ p: 1.5, color: p.textSubtle, fontSize: 13 }}>
                        Loading…
                    </Box>
                )}
                {!isLoading && channels.length === 0 && (
                    <Box component="li" sx={{ p: 1.5, color: p.textSubtle, fontSize: 13 }}>
                        No channels yet.
                    </Box>
                )}
                {channels.map((c) => {
                    const selected = c.id === selectedChannelId;
                    const isPinned = snapshot.pinByChannelId.has(c.id);
                    return (
                        <Box
                            component="li"
                            key={c.id}
                            data-testid={`channel-list-v3-item-${c.id}`}
                            onClick={() => onSelect(c.id)}
                            sx={{
                                px: 1.5,
                                py: 1,
                                borderBottom: `1px solid ${p.divider}`,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                background: selected ? p.activeBg : "transparent",
                                "&:hover": {
                                    background: selected ? p.activeBg : p.hoverBg,
                                },
                                transition: "background 120ms ease",
                            }}
                        >
                            <Stack sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            color: p.textSubtle,
                                            fontSize: 9,
                                            fontWeight: 700,
                                            letterSpacing: 0.5,
                                        }}
                                    >
                                        {KIND_LABEL[c.kind]}
                                    </Typography>
                                    {isPinned && (
                                        <Typography
                                            component="span"
                                            data-testid={`channel-list-v3-pinned-indicator-${c.id}`}
                                            level="body-xs"
                                            sx={{ fontSize: 11 }}
                                            title="Pinned"
                                        >
                                            📌
                                        </Typography>
                                    )}
                                    <Typography
                                        level="title-sm"
                                        sx={{
                                            color: p.text,
                                            fontWeight: 600,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {c.title || c.id.slice(0, 8)}
                                    </Typography>
                                </Box>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: p.textMuted,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {c.latestMessage?.bodyText || "—"}
                                </Typography>
                            </Stack>
                            {c.unreadCount > 0 && (
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        background: p.primaryButtonBg,
                                        color: "#fff",
                                        borderRadius: 12,
                                        px: 0.75,
                                        py: 0.25,
                                        fontWeight: 700,
                                        boxShadow: p.shadowSoft,
                                    }}
                                >
                                    {c.unreadCount}
                                </Typography>
                            )}
                            <IconButton
                                size="sm"
                                variant="plain"
                                onClick={(e) => {
                                    // Stop the row's click handler from firing
                                    // → toggling pin shouldn't ALSO open the
                                    // channel.
                                    e.stopPropagation();
                                    void togglePin(c.id, isPinned);
                                }}
                                data-testid={`channel-list-v3-pin-${c.id}`}
                                title={isPinned ? "Unpin channel" : "Pin channel"}
                                sx={{
                                    minHeight: 24,
                                    minWidth: 24,
                                    fontSize: 14,
                                    opacity: isPinned ? 1 : 0.35,
                                    "&:hover": { opacity: 1, background: p.hoverBg },
                                }}
                            >
                                📌
                            </IconButton>
                        </Box>
                    );
                })}
            </Box>
        </Sheet>
    );
}
