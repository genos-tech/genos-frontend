import { useEffect, useMemo, useState } from "react";
import GroupsIcon from "@mui/icons-material/Groups";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Avatar,
    Box,
    ListItemContent,
    Stack,
    Typography,
} from "@mui/joy";
import CircularProgress from "@mui/joy/CircularProgress";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { ChannelKind, type Channel } from "../../../../types/channel";
import { AllChatProps, ChatProps, SearchListProps } from "../../../../types/chat";
import { loadSearchList } from "../../services/loadChatSearchList";

type ChatSearchProps = {
    myself: UserProps;
    socket: Socket | null;
    openSearchBox: boolean;
    setOpenSearchBox: (value: boolean) => void;
    setOpenJoinGM: (value: { flag: boolean; chatId: string; chatName: string }) => void;
    useTEM: TeamManagementState;
    setMyself: (value: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};

export const ChatSearch = (props: ChatSearchProps) => {
    const {
        myself,
        socket,
        openSearchBox,
        setOpenSearchBox,
        setOpenJoinGM,
        useTEM,
        setMyself,
        useUISM,
        useCM,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const mediaUrl = useMemo(() => import.meta.env.VITE_MEDIA_ROOT_DJANGO, []);
    const [options, setOptions] = useState<SearchListProps[]>([]);
    const loading = openSearchBox && options.length === 0;

    const onChangeHandler = async (value: any) => {
        if (value === null) return;
        const isGroup = value.type === "Group";
        const _chatType = isGroup ? 2 : 1;

        // If the user tries to join a private GM, show the modal to get
        // approval from the GM owner. v3 GMs have no legacy id, so the join
        // flow keys on the v3 channel UUID (`channelId`).
        if (_chatType === 2 && value.isPrivate === true && value.isJoined === false) {
            setOpenJoinGM({ flag: true, chatId: value.channelId ?? "", chatName: value.name });
            return;
        }

        // v3 resolution — the search endpoint now returns v3 ids directly:
        // Groups carry `channelId`, People carry `userId`. No legacy-id
        // round-trip / snapshot scan needed for the happy path.
        const snapshot = channelService.getSnapshot();
        let channel: Channel | undefined;
        if (isGroup) {
            channel = value.channelId ? snapshot.channels.get(value.channelId) : undefined;
            // Snapshot miss (e.g. joined in another tab, not yet synced
            // here): refresh the channel list once and retry by UUID, so
            // the click isn't a silent no-op.
            if (!channel && value.channelId) {
                try {
                    const fresh = await channelService.listChannels();
                    const match = fresh.find((c) => c.id === value.channelId);
                    if (match) {
                        channelService.handleChannelCreated(match);
                        channel = match;
                    }
                } catch (e) {
                    console.error("[ChatSearch] channel-list refresh failed:", e);
                }
            }
        } else if (value.userId) {
            const otherUserId = value.userId;
            // Self-DM (you searched your own name): the personal scratch
            // chat that backs the todo / calendar panes. Its roster is just
            // {you} (size 1), so the size===2 partner scan below can't match
            // it — and guessing it from roster size risks grabbing a regular
            // DM that decayed to one member. Skip the snapshot scan and let
            // the backend resolve it authoritatively: createChannel is
            // idempotent by canonical pair, so it returns the existing
            // self-DM (created on team join) rather than a duplicate.
            const isSelfDm = otherUserId === myself.userId;
            if (!isSelfDm) {
                for (const c of snapshot.channels.values()) {
                    if (c.kind !== ChannelKind.DM) continue;
                    const roster = snapshot.membersByChannel.get(c.id) ?? [];
                    const ids = new Set(roster.map((m) => m.userId));
                    if (ids.size === 2 && ids.has(myself.userId) && ids.has(otherUserId)) {
                        channel = c;
                        break;
                    }
                }
            }
            if (!channel) {
                // No DM yet (or the self-DM) — ask the backend. createChannel
                // is idempotent for DM (via `ChannelDirectPair`), so a race
                // against another tab — or a self-DM that already exists —
                // returns the existing channel rather than erroring.
                try {
                    channel = await channelService.createChannel({
                        kind: ChannelKind.DM,
                        otherUserId,
                        teamId: myself.teamId,
                    });
                } catch (e) {
                    console.error("[ChatSearch] DM create failed:", e);
                    return;
                }
            }
        }
        if (!channel) {
            return;
        }

        // Minimal DM-partner stub from the search row (the chat header /
        // adapter resolves the full partner from channel members). Empty
        // for Groups, which render off `chatName`.
        const dmPartner: UserProps = {
            userId: value.userId ?? "",
            userName: isGroup ? "" : value.name,
            userEmail: value.email ?? "",
            teamId: "",
            teamName: "",
            avatarImgPath: value.profileImageUrl ?? "",
            tsLastSeen: "",
            tsJoined: "",
        };

        const initialChat: ChatProps = {
            chatId: channel.id,
            chatName: value.name,
            chatType: _chatType,
            dmPartnerUser: dmPartner,
            isPrivate: channel.isPrivate,
            lastReadMessageId: "",
            latestMessage: undefined as unknown as ChatProps["latestMessage"],
            latestMessageText: "",
            messages: [],
            profileImagePath: channel.profileImageUrl || undefined,
            TSLastMessage: channel.tsUpdated ?? channel.tsCreated ?? "",
        };
        useCM.setCurrentMainChat(initialChat);
        useCM.setIsMainChatVisible(true);
        setOpenSearchBox(false);
    };

    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedUsers: SearchListProps[] = await loadSearchList(myself, accessToken);

            if (active) {
                setOptions([...loadedUsers]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading]);

    useEffect(() => {
        if (!open) {
            setOptions([]);
        }
    }, [openSearchBox]);

    return (
        <Box
            sx={{
                px: 1.5,
                pt: 1.5,
                pb: 1,
            }}
        >
            <Autocomplete
                aria-label={t.chat.sidebar.searchAriaLabel}
                groupBy={(option) => option.type}
                isOptionEqualToValue={(option, value) => option.name === value.name}
                loading={loading}
                open={openSearchBox}
                options={options}
                placeholder={t.chat.sidebar.searchPlaceholder}
                size="sm"
                endDecorator={
                    loading ? (
                        <CircularProgress
                            size="sm"
                            sx={{
                                "--CircularProgress-size": "16px",
                                "--CircularProgress-trackThickness": "2px",
                                "--CircularProgress-progressThickness": "2px",
                            }}
                        />
                    ) : null
                }
                getOptionLabel={(option) =>
                    option.type === "People"
                        ? option.email === myself.userEmail
                            ? `${option.name} (You) - ${option.email}`
                            : `${option.name} - ${option.email}`
                        : option.isPrivate
                          ? `🔒 ${option.name}`
                          : option.name
                }
                renderOption={(props, option) => {
                    // Resolve the GM's cached chat row by its v3 channel
                    // UUID (the search result now carries `channelId`
                    // directly — no legacy-id stringify needed).
                    const gmChat: AllChatProps | undefined = useCM.allChats.find(
                        (chat) => chat.chatId === option.channelId && chat.chatType === 2
                    );
                    const optKey = option.userId ?? option.channelId ?? option.name;
                    return (
                        <AutocompleteOption
                            {...props}
                            key={`ac-render-option-chatsearch-${option.name}-${optKey}`}
                        >
                            <ListItemContent sx={{ fontSize: "sm" }}>
                                <Stack alignItems="center" direction="row" spacing={1.5}>
                                    {option.type === "People" && (
                                        <AvatarWithStatus
                                            key={`ac-render-option-chatsearch-user-avatar-${option.name}-${optKey}`}
                                            isYou={option.userId === myself.userId}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useCM={useCM}
                                            useUISM={useUISM}
                                            avatarUser={
                                                useTEM.teamMemberProfiles[option.userId ?? ""]
                                            }
                                        />
                                    )}
                                    {option.type === "Group" && gmChat ? (
                                        <GMAvatar
                                            gmChat={gmChat}
                                            isYou={false}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useCM={useCM}
                                            useTEM={useTEM}
                                            useUISM={useUISM}
                                        />
                                    ) : option.type === "Group" ? (
                                        <Avatar
                                            size="sm"
                                            src={
                                                option.profileImageUrl
                                                    ? `${mediaUrl}/${option.profileImageUrl}`
                                                    : undefined
                                            }
                                        >
                                            <GroupsIcon sx={{ fontSize: 20 }} />
                                        </Avatar>
                                    ) : null}
                                    <Box>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                fontWeight: 500,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.9)"
                                                    : "rgba(0,0,0,0.85)",
                                            }}
                                        >
                                            {option.type === "People"
                                                ? option.email === myself.userEmail
                                                    ? `${option.name} (You)`
                                                    : option.name
                                                : option.isPrivate
                                                  ? `🔒 ${option.name}`
                                                  : option.name}
                                        </Typography>
                                        {option.type === "People" && (
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.45)"
                                                        : "rgba(0,0,0,0.45)",
                                                }}
                                            >
                                                {option.email}
                                            </Typography>
                                        )}
                                    </Box>
                                </Stack>
                            </ListItemContent>
                        </AutocompleteOption>
                    );
                }}
                slotProps={{
                    listbox: {
                        sx: {
                            borderRadius: "12px",
                            boxShadow: isDark
                                ? "0 8px 32px rgba(0,0,0,0.5)"
                                : "0 8px 32px rgba(0,0,0,0.12)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                            "& .MuiAutocomplete-option": {
                                borderRadius: "8px",
                                mx: 0.5,
                                my: 0.25,
                            },
                        },
                    },
                }}
                startDecorator={
                    <SearchRoundedIcon
                        sx={{
                            fontSize: 18,
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                        }}
                    />
                }
                sx={{
                    "--Input-focusedThickness": "0px",
                    borderRadius: "12px",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                    },
                    "&.Mui-focused": {
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)",
                        borderColor: isDark ? "rgba(139,92,246,0.4)" : "rgba(124,58,237,0.3)",
                        boxShadow: isDark
                            ? "0 0 0 3px rgba(139,92,246,0.15)"
                            : "0 0 0 3px rgba(124,58,237,0.1)",
                    },
                    "& .MuiAutocomplete-input": {
                        fontSize: "0.85rem",
                        "&::placeholder": {
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            opacity: 1,
                        },
                    },
                }}
                onChange={(event, value) => onChangeHandler(value)}
                onClose={() => {
                    setOpenSearchBox(false);
                }}
                onOpen={() => {
                    setOpenSearchBox(true);
                }}
            />
        </Box>
    );
};
