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
    setOpenJoinGM: (value: { flag: boolean; chatId: number; chatName: string }) => void;
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

        // If the user tries to join a private GM, show the modal to
        // get approval from the GM owner.
        if (_chatType === 2 && value.isPrivate === true && value.isJoined === false) {
            setOpenJoinGM({ flag: true, chatId: value.id, chatName: value.name });
            return;
        }

        // v3 channel resolution. The search backend still returns
        // legacy ids, so locate the corresponding v3 Channel by
        // matching kind + (DM partner | GM name) in the snapshot.
        const snapshot = channelService.getSnapshot();
        let channel: Channel | undefined;
        if (isGroup) {
            for (const c of snapshot.channels.values()) {
                if (c.kind !== ChannelKind.GM) continue;
                if ((c.title || "") === value.name) {
                    channel = c;
                    break;
                }
            }
        } else {
            for (const c of snapshot.channels.values()) {
                if (c.kind !== ChannelKind.DM) continue;
                const roster = snapshot.membersByChannel.get(c.id) ?? [];
                const ids = new Set(roster.map((m) => m.userId));
                if (
                    ids.size === 2 &&
                    ids.has(myself.userId) &&
                    ids.has(value.dmPartnerUser.userId)
                ) {
                    channel = c;
                    break;
                }
            }
            if (!channel) {
                // No DM yet — ask the backend to create one.
                // createChannel is idempotent for DM (via
                // `ChannelDirectPair`) so a race against another tab
                // is safe.
                try {
                    channel = await channelService.createChannel({
                        kind: ChannelKind.DM,
                        otherUserId: value.dmPartnerUser.userId,
                        teamId: myself.teamId,
                    });
                } catch (e) {
                    console.error("[ChatSearch] DM create failed:", e);
                    return;
                }
            }
        }
        if (!channel) {
            console.warn("[ChatSearch] no v3 channel found for search result", value);
            return;
        }

        const initialChat: ChatProps = {
            chatId: channel.id,
            chatName: value.name,
            chatType: _chatType,
            dmPartnerUser: value.dmPartnerUser,
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
                startDecorator={
                    <SearchRoundedIcon
                        sx={{
                            fontSize: 18,
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                        }}
                    />
                }
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
                    // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId`
                    // is `string` post-flip; `option.id` is the legacy
                    // numeric GM id. Stringify at the comparison.
                    const gmChat: AllChatProps | undefined = useCM.allChats.find(
                        (chat) => chat.chatId === String(option.id) && chat.chatType === 2
                    );
                    return (
                        <AutocompleteOption
                            {...props}
                            key={`ac-render-option-chatsearch-${option.name}-${option.id}`}
                        >
                            <ListItemContent sx={{ fontSize: "sm" }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    {option.type === "People" && (
                                        <AvatarWithStatus
                                            key={`ac-render-option-chatsearch-user-avatar-${option.name}-${option.id}`}
                                            useCM={useCM}
                                            isYou={option.dmPartnerUser.userId === myself.userId}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useUISM={useUISM}
                                            avatarUser={
                                                useTEM.teamMemberProfiles[
                                                    option.dmPartnerUser.userId
                                                ]
                                            }
                                        />
                                    )}
                                    {option.type === "Group" && gmChat ? (
                                        <GMAvatar
                                            useCM={useCM}
                                            gmChat={gmChat}
                                            isYou={false}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useTEM={useTEM}
                                            useUISM={useUISM}
                                        />
                                    ) : option.type === "Group" ? (
                                        <Avatar
                                            size="sm"
                                            src={
                                                option.profileImagePath
                                                    ? `${mediaUrl}/${option.profileImagePath}`
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
