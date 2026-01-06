import { useEffect, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Autocomplete,
    AutocompleteOption,
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
import { UserProps } from "../../../../types/admin";
import { AllChatProps, SearchListProps } from "../../../../types/chat";
import { loadSearchList } from "../../services/loadChatSearchList";
import { moveToSelectedChat } from "../../services/moveToChat";

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
    const isDark = mode === "dark";

    const [options, setOptions] = useState<SearchListProps[]>([]);
    const loading = openSearchBox && options.length === 0;

    const onChangeHandler = async (value: any) => {
        if (value !== null && socket !== null) {
            let _chatType: number;
            if (value.type === "Group") {
                _chatType = 2;
            } else {
                _chatType = 1;
            }

            // If the user tries to join a private GM, show the modal to get approval from the GM owner.
            if (_chatType === 2 && value.isPrivate === true && value.isJoined === false) {
                setOpenJoinGM({ flag: true, chatId: value.id, chatName: value.name });
            } else {
                socket.emit(
                    "join",
                    {
                        joiningCGId: value.id, // dm_id or gm_id
                        joiningCGName: value.name, // dm_name or gm_name
                        chatType: _chatType,
                        dmPartnerUserId: value.dmPartnerUser.userId,
                    },
                    (ack: any) => {
                        // Since the existing DM/GM obviously has its own chatId (value.id),
                        // the user can move the the DM/GM.
                        if (Number(value.id) !== -1) {
                            moveToSelectedChat(
                                myself,
                                accessToken,
                                socket,
                                value.id,
                                value.name,
                                value.type === "Group" ? 2 : 1,
                                value.isPrivate,
                                value.dmPartnerUser,
                                useCM,
                                setOpenSearchBox
                            );
                        } else {
                            // If the user tries to join a new DM (try to make a DM with a new friend),
                            // there is no chat (chatId) yet, so need to wait till the first message
                            // will be arrived via WS. (the above "join" ws message will generate
                            // the first message for the user).
                            // Joining a new DM -> value.id = -1. User will get the first message via WS.
                        }
                    }
                );
            }
        }
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
                aria-label="Search"
                groupBy={(option) => option.type}
                isOptionEqualToValue={(option, value) => option.name === value.name}
                loading={loading}
                open={openSearchBox}
                options={options}
                placeholder="Search people & groups..."
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
                    const gmChat: AllChatProps | undefined = useCM.allChats.find(
                        (chat) => chat.chatId === option.id
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
                                    {option.type === "Group" && gmChat && (
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
                                    )}
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
