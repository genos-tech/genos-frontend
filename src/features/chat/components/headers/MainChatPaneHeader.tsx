import { Socket } from "socket.io-client";
import { IconButton, Stack, Tooltip } from "@mui/joy";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import ChecklistIcon from "@mui/icons-material/Checklist";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";

import { HeaderUserName } from "./HeaderUserName";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";

type MainChatPaneHeaderProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    chat: ChatProps;
    subChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    isSubChatVisible: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    setIsSubChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
};

export const MainChatPaneHeader = (props: MainChatPaneHeaderProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        chat,
        subChat,
        setCurrentMainChat,
        setCurrentSubChat,
        isSubChatVisible,
        setIsSubChatVisible,
        setIsMainChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        setIsCreatingTask,
        setOpeningService,
        funcSetAllChats,
        setIsToDoVisible,
        isToDoVisible,
    } = props;

    const isYou: boolean = myself.userId === chat.dmPartnerUser.userId;

    const switchSubToMain = () => {
        if (isSubChatVisible === true) {
            setCurrentMainChat(subChat);
            setIsSubChatVisible(false);
        } else {
            setIsMainChatVisible(false);
        }
    };

    const swapChat = () => {
        setCurrentMainChat(subChat);
        setCurrentSubChat(chat);
    };

    return (
        <Stack
            direction="row"
            sx={{
                justifyContent: "space-between",
                py: { xs: 2, md: 2 },
                px: { xs: 1, md: 2 },
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.body",
                height: "60px",
            }}
        >
            <Stack direction="row" spacing={{ xs: 1, md: 2 }} sx={{ alignItems: "center" }}>
                <HeaderUserName
                    teamMemberProfiles={teamMemberProfiles}
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    setCurrentMainChat={setCurrentMainChat}
                    chat={chat}
                    isYou={isYou}
                    funcSetAllChats={funcSetAllChats}
                />
            </Stack>
            <Stack spacing={1} direction="row" sx={{ alignItems: "center" }}>
                {(chat.chatType === 3 || chat.chatType === 4) && (
                    <Tooltip title="Create a new task" size="sm">
                        <IconButton
                            component="a"
                            size="sm"
                            variant="plain"
                            color="neutral"
                            onClick={() => {
                                setIsMainChatVisible(true);
                                setIsThreadVisible(false);
                                setIsTaskPreviewVisible(false);
                                setIsCreatingTask({
                                    flag: true,
                                    parentTaskId: null,
                                    rootTaskId: null,
                                });
                            }}
                            sx={{ px: "10px" }}
                        >
                            <PlaylistAddIcon />
                            New Task
                        </IconButton>
                    </Tooltip>
                )}

                <Stack spacing={0} direction="row" sx={{ alignItems: "center" }}>
                    {isYou === true ? (
                        <>
                            {isToDoVisible === true ? (
                                <Tooltip title="DM" size="sm">
                                    <IconButton
                                        component="a"
                                        size="sm"
                                        variant="plain"
                                        color="neutral"
                                        onClick={() => setIsToDoVisible(false)}
                                    >
                                        <QuestionAnswerIcon />
                                    </IconButton>
                                </Tooltip>
                            ) : (
                                <Tooltip title="To-Do" size="sm">
                                    <IconButton
                                        component="a"
                                        size="sm"
                                        variant="plain"
                                        color="neutral"
                                        onClick={() => setIsToDoVisible(true)}
                                    >
                                        <ChecklistIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </>
                    ) : null}

                    {isSubChatVisible && (
                        <div>
                            <IconButton
                                component="a"
                                size="sm"
                                variant="plain"
                                color="neutral"
                                onClick={() => swapChat()}
                            >
                                <SwapVertIcon />
                            </IconButton>
                        </div>
                    )}

                    <IconButton component="a" size="sm" variant="plain" color="neutral">
                        <MoreVertRoundedIcon />
                    </IconButton>
                    <IconButton
                        component="a"
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => switchSubToMain()}
                    >
                        <CancelIcon />
                    </IconButton>
                </Stack>
            </Stack>
        </Stack>
    );
};
