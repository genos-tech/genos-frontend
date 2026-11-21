import { useCallback, useEffect, useRef, useState } from "react";
import GroupsIcon from "@mui/icons-material/Groups";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Alert, Box, Button, Input, Typography } from "@mui/joy";

import { DataState } from "../../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { fmt, useTranslation } from "../../../../i18n";
import {
    channelService,
    type ChannelDirectoryRow,
} from "../../../../services/channel/channelService";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { type Channel } from "../../../../types/channel";
import { ChatProps } from "../../../../types/chat";

type Props = {
    open: boolean;
    myself: UserProps;
    useCM: ChatManagementState;
    onClose: () => void;
};

const PAGE = 24;

/**
 * Browse the team's public group chats (MIP-1694), modelled on the Join Project list: a name
 * search, one row per chat (name, one-line description, member count) and a Join / Open button.
 * The server lists only public, live chats of this team; joining uses the same self-join the
 * chat-search box uses. Paged, because a big team has hundreds.
 */
export const ModalGroupDirectory = ({ open, myself, useCM, onClose }: Props) => {
    const { t } = useTranslation();
    const copy = t.chat.groupDirectory;
    const [query, setQuery] = useState("");
    const [rows, setRows] = useState<ChannelDirectoryRow[] | null>(null);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // A late answer to an older search must not overwrite a newer one.
    const seq = useRef(0);

    const load = useCallback(
        async (q: string, offset: number) => {
            const mine = ++seq.current;
            if (offset === 0) setRows(null);
            setLoadFailed(false);
            try {
                const page = await channelService.listChannelDirectory(myself.teamId, {
                    q,
                    offset,
                    limit: PAGE,
                });
                if (mine !== seq.current) return;
                setRows((cur) =>
                    offset === 0 ? page.results : [...(cur ?? []), ...page.results]
                );
                setTotal(page.total);
                setHasMore(page.hasMore);
            } catch (e) {
                if (mine !== seq.current) return;
                console.error("[ModalGroupDirectory] list failed:", e);
                setLoadFailed(true);
            }
        },
        [myself.teamId]
    );

    // Every opening starts from a clean search; typing re-queries after a short pause.
    useEffect(() => {
        if (!open) return;
        setQuery("");
        setError(null);
    }, [open]);
    useEffect(() => {
        if (!open) return undefined;
        const timer = setTimeout(() => void load(query.trim(), 0), query ? 250 : 0);
        return () => clearTimeout(timer);
    }, [open, query, load]);

    const openChat = (channel: Channel, name: string) => {
        const chat: ChatProps = {
            chatId: channel.id,
            chatName: name,
            chatType: 2,
            dmPartnerUser: {
                userId: "",
                userName: "",
                userEmail: "",
                teamId: "",
                teamName: "",
                avatarImgPath: "",
                tsLastSeen: "",
                tsJoined: "",
            },
            isPrivate: channel.isPrivate,
            description: channel.description || undefined,
            lastReadMessageId: "",
            latestMessage: undefined as unknown as ChatProps["latestMessage"],
            latestMessageText: "",
            messages: [],
            profileImagePath: channel.profileImageUrl || undefined,
            TSLastMessage: channel.tsUpdated ?? channel.tsCreated ?? "",
        };
        useCM.setCurrentMainChat(chat);
        useCM.setIsMainChatVisible(true);
        onClose();
    };

    const act = async (row: ChannelDirectoryRow) => {
        setError(null);
        setBusyId(row.id);
        try {
            let channel: Channel | undefined = channelService.getSnapshot().channels.get(row.id);
            if (!row.isJoined || !channel) {
                channel = await channelService.joinChannel(row.id);
            }
            if (!channel) throw new Error("no channel");
            setRows((cur) =>
                (cur ?? []).map((r) => (r.id === row.id ? { ...r, isJoined: true } : r))
            );
            openChat(channel, row.title);
        } catch (e) {
            console.error("[ModalGroupDirectory] join failed:", e);
            setError(copy.joinError);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <ModalFrame
            description={copy.description}
            icon={<GroupsIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="md"
            title={copy.title}
            onClose={onClose}
        >
            <Input
                aria-label={copy.searchAria}
                placeholder={copy.searchPlaceholder}
                slotProps={{ input: { maxLength: 100 } }}
                startDecorator={<SearchRoundedIcon sx={{ fontSize: 18 }} />}
                sx={{ mb: 1.5 }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {error && (
                <Alert color="danger" role="alert" sx={{ mb: 1.5 }}>
                    {error}
                </Alert>
            )}
            <DataState
                error={loadFailed}
                errorState={{ title: copy.loadError, onRetry: () => void load(query.trim(), 0) }}
                hasData={rows !== null && rows.length > 0}
                loading={rows === null && !loadFailed}
                size="sm"
                skeleton={<SkeletonRows count={4} />}
                empty={{
                    title: query.trim() ? copy.noMatchTitle : copy.emptyTitle,
                    body: query.trim() ? copy.noMatchBody : copy.emptyBody,
                }}
            >
                <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                    {(rows ?? []).map((row) => (
                        <Box
                            key={row.id}
                            component="li"
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                py: 1,
                                borderBottom: `1px solid ${g.border.default}`,
                            }}
                        >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography
                                    level="title-sm"
                                    sx={{ color: g.text.primary, overflowWrap: "anywhere" }}
                                >
                                    {row.title}
                                </Typography>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: g.text.secondary,
                                        overflowWrap: "anywhere",
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}
                                >
                                    {row.description || copy.noDescription}
                                </Typography>
                                <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                                    {fmt(copy.members, { count: row.memberCount })}
                                </Typography>
                            </Box>
                            <Button
                                disabled={busyId !== null}
                                loading={busyId === row.id}
                                size="sm"
                                sx={{ flexShrink: 0, minHeight: 36 }}
                                variant={row.isJoined ? "outlined" : "solid"}
                                aria-label={fmt(row.isJoined ? copy.openAria : copy.joinAria, {
                                    name: row.title,
                                })}
                                onClick={() => void act(row)}
                            >
                                {row.isJoined ? copy.open : copy.join}
                            </Button>
                        </Box>
                    ))}
                </Box>
                {hasMore && (
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5 }}>
                        <Button
                            size="sm"
                            variant="plain"
                            onClick={() => void load(query.trim(), rows?.length ?? 0)}
                        >
                            {fmt(copy.showMore, { shown: rows?.length ?? 0, total })}
                        </Button>
                    </Box>
                )}
            </DataState>
        </ModalFrame>
    );
};
