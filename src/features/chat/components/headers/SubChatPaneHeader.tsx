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

type SubChatPaneHeaderProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    chat?: ChatProps;
    subChat?: ChatProps;
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

    const isYou: boolean = myself.userId === subChat?.dmPartnerUser.userId;

    const swapChat = () => {
        if (chat && subChat) {
            setCurrentMainChat(subChat);
            setCurrentSubChat(chat);
        }
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
                    chat={subChat}
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
            <Stack direction="row" spacing={0} sx={{ alignItems: "center" }}>
                {subChat && (subChat.chatType === 3 || subChat.chatType === 4) && (
                    <Tooltip size="sm" title="Create a new task" variant="outlined">
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
                    <IconButton
                        color="neutral"
                        component="a"
                        size="sm"
                        variant="plain"
                        onClick={() => swapChat()}
                    >
                        <SwapVertIcon />
                    </IconButton>

                    {/* To-Do Related */}
                    {isYou === true ? (
                        <>
                            {isToDoVisible === true ? (
                                <Tooltip size="sm" title="Back to DM" variant="outlined">
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
                                <Tooltip size="sm" title="To-Do" variant="outlined">
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
                                            onClick={() => setIsToDoVisible(true)}
                                        >
                                            <ChecklistIcon />
                                        </IconButton>
                                    </Badge>
                                </Tooltip>
                            )}
                        </>
                    ) : null}

                    <Tooltip placement="left" size="sm" title="More Options" variant="outlined">
                        <IconButton color="neutral" component="a" size="sm" variant="plain">
                            <MoreVert />
                        </IconButton>
                    </Tooltip>

                    <Tooltip size="sm" title="Close" variant="outlined">
                        <IconButton
                            color="neutral"
                            component="a"
                            size="sm"
                            variant="plain"
                            onClick={() => setIsSubChatVisible(false)}
                        >
                            <CancelIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Stack>
    );
};
