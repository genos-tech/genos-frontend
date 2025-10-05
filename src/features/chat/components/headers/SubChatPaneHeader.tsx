import { Socket } from "socket.io-client";
import ChecklistIcon from "@mui/icons-material/Checklist";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { Badge, IconButton, Stack, Tooltip } from "@mui/joy";
import CancelIcon from "@mui/icons-material/Cancel";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";

import { HeaderUserName } from "./HeaderUserName";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";

type SubChatPaneHeaderProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    chat: ChatProps;
    subChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
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

export const SubChatPaneHeader = (props: SubChatPaneHeaderProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        chat,
        subChat,
        setCurrentMainChat,
        setCurrentSubChat,
        setIsMainChatVisible,
        setIsSubChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        setIsCreatingTask,
        setOpeningService,
        funcSetAllChats,
        isToDoVisible,
        setIsToDoVisible,
        incompleteTodoCount,
    } = props;

    const isYou: boolean = myself.userId === subChat.dmPartnerUser.userId;

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
                    chat={subChat}
                    isYou={isYou}
                    funcSetAllChats={funcSetAllChats}
                />
            </Stack>
            <Stack spacing={1} direction="row" sx={{ alignItems: "center" }}>
                {(subChat.chatType === 3 || subChat.chatType === 4) && (
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

                <Stack spacing={0.5} direction="row" sx={{ alignItems: "center" }}>
                    <IconButton
                        component="a"
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => swapChat()}
                    >
                        <SwapVertIcon />
                    </IconButton>

                    {/* To-Do Related */}
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
                                    <Badge
                                        badgeContent={incompleteTodoCount}
                                        color="primary"
                                        size="sm"
                                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                        sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                    >
                                        <IconButton
                                            component="a"
                                            size="sm"
                                            variant="plain"
                                            color="neutral"
                                            onClick={() => setIsToDoVisible(true)}
                                        >
                                            <ChecklistIcon />
                                        </IconButton>
                                    </Badge>
                                </Tooltip>
                            )}
                        </>
                    ) : null}

                    <IconButton component="a" size="sm" variant="plain" color="neutral">
                        <MoreVertRoundedIcon />
                    </IconButton>

                    <IconButton
                        component="a"
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => setIsSubChatVisible(false)}
                    >
                        <CancelIcon />
                    </IconButton>
                </Stack>
            </Stack>
        </Stack>
    );
};
