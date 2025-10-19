import CancelIcon from "@mui/icons-material/Cancel";
import ChecklistIcon from "@mui/icons-material/Checklist";
import MoreVert from "@mui/icons-material/MoreVert";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { Badge, IconButton, Stack, Tooltip } from "@mui/joy";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { HeaderUserName } from "./HeaderUserName";

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
    incompleteTodoCount: number;
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
        incompleteTodoCount,
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
                    chat={chat}
                    funcSetAllChats={funcSetAllChats}
                    isYou={isYou}
                    myself={myself}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={teamMemberProfiles}
                />
            </Stack>
            <Stack direction="row" sx={{ alignItems: "center" }}>
                {(chat.chatType === 3 || chat.chatType === 4) && (
                    <Tooltip size="sm" title="Create a new task">
                        <IconButton
                            color="neutral"
                            component="a"
                            size="sm"
                            variant="plain"
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
                        >
                            <PlaylistAddIcon />
                        </IconButton>
                    </Tooltip>
                )}

                <Stack direction="row" sx={{ alignItems: "center" }}>
                    {isYou === true ? (
                        <>
                            {isToDoVisible === true ? (
                                <Tooltip size="sm" title="DM">
                                    <IconButton
                                        color="neutral"
                                        component="a"
                                        size="sm"
                                        variant="plain"
                                        onClick={() => setIsToDoVisible(false)}
                                    >
                                        <QuestionAnswerIcon />
                                    </IconButton>
                                </Tooltip>
                            ) : (
                                <Tooltip size="sm" title="To-Do">
                                    <Badge
                                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                        badgeContent={incompleteTodoCount}
                                        color="primary"
                                        size="sm"
                                        sx={{ "& .JoyBadge-badge": { zIndex: 1 }, mt: 1 }}
                                    >
                                        <IconButton
                                            color="neutral"
                                            component="a"
                                            size="sm"
                                            variant="plain"
                                            onClick={() => {
                                                setIsToDoVisible(true);
                                            }}
                                        >
                                            <ChecklistIcon />
                                        </IconButton>
                                    </Badge>
                                </Tooltip>
                            )}
                        </>
                    ) : null}

                    {isSubChatVisible && (
                        <div>
                            <IconButton
                                color="neutral"
                                component="a"
                                size="sm"
                                variant="plain"
                                onClick={() => swapChat()}
                            >
                                <SwapVertIcon />
                            </IconButton>
                        </div>
                    )}

                    <Tooltip title="More Options">
                        <IconButton color="neutral" component="a" size="sm" variant="plain">
                            <MoreVert />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Close">
                        <IconButton
                            color="neutral"
                            component="a"
                            size="sm"
                            variant="plain"
                            onClick={() => switchSubToMain()}
                        >
                            <CancelIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Stack>
    );
};
