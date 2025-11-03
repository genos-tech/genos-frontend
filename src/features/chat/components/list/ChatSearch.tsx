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
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../components/common/GMAvatar";
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
    TEM: TeamManagementState;
    setMyself: (value: UserProps) => void;
    CM: ChatManagementState;
    UIM: UIStateManagementState;
};

export const ChatSearch = (props: ChatSearchProps) => {
    const {
        myself,
        socket,
        openSearchBox,
        setOpenSearchBox,
        setOpenJoinGM,
        TEM,
        setMyself,
        UIM,
        CM,
    } = props;
    const { accessToken } = useAuth();
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
                                CM,
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
        <Box sx={{ px: 2, pb: 0.5, mt: 2 }}>
            <Autocomplete
                aria-label="Search"
                groupBy={(option) => option.type}
                isOptionEqualToValue={(option, value) => option.name === value.name}
                loading={loading}
                open={openSearchBox}
                options={options}
                placeholder={"Search"}
                size="sm"
                startDecorator={<SearchRoundedIcon />}
                endDecorator={
                    loading ? (
                        <CircularProgress size="sm" sx={{ bgcolor: "background.surface" }} />
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
                    const gmChat: AllChatProps | undefined = CM.allChats.find(
                        (chat) => chat.chatId === option.id
                    );
                    return (
                        <AutocompleteOption
                            {...props}
                            key={`ac-render-option-chatsearch-${option.name}-${option.id}`}
                        >
                            <ListItemContent sx={{ fontSize: "sm" }}>
                                <Stack direction="row" spacing={1}>
                                    {option.type === "People" && (
                                        <AvatarWithStatus
                                            key={`ac-render-option-chatsearch-user-avatar-${option.name}-${option.id}`}
                                            CM={CM}
                                            isYou={option.dmPartnerUser.userId === myself.userId}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            UIM={UIM}
                                            avatarUser={
                                                TEM.teamMemberProfiles[option.dmPartnerUser.userId]
                                            }
                                        />
                                    )}
                                    {option.type === "Group" && gmChat && (
                                        <GMAvatar
                                            CM={CM}
                                            gmChat={gmChat}
                                            isYou={false}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            TEM={TEM}
                                            UIM={UIM}
                                        />
                                    )}
                                    <Typography level="body-md" sx={{ pt: 0.5, pl: 1 }}>
                                        {option.type === "People"
                                            ? option.email === myself.userEmail
                                                ? `${option.name} (You) - ${option.email}`
                                                : `${option.name} - ${option.email}`
                                            : option.isPrivate
                                              ? `🔒 ${option.name}`
                                              : option.name}
                                    </Typography>
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
