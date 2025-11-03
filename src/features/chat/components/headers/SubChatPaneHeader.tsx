import CancelIcon from "@mui/icons-material/Cancel";
import ChecklistIcon from "@mui/icons-material/Checklist";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { Badge, IconButton, Stack, Tooltip } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { HeaderUserName } from "./HeaderUserName";

type SubChatPaneHeaderProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    UIM: UIStateManagementState;
    CM: ChatManagementState;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    incompleteTodoCount: number;
};

export const SubChatPaneHeader = (props: SubChatPaneHeaderProps) => {
    const {
        incompleteTodoCount,
        isToDoVisible,
        myself,
        setIsCreatingTask,
        setIsTaskPreviewVisible,
        setIsToDoVisible,
        setMyself,
        UIM,
        socket,
        TEM,
        CM,
    } = props;

    const isYou: boolean = myself.userId === CM.currentSubChat?.dmPartnerUser.userId;

    const swapChat = () => {
        if (CM.currentMainChat && CM.currentSubChat) {
            CM.setCurrentMainChat(CM.currentSubChat);
            CM.setCurrentSubChat(CM.currentMainChat);
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
                    chat={CM.currentSubChat}
                    CM={CM}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    TEM={TEM}
                    UIM={UIM}
                />
            </Stack>
            <Stack direction="row" spacing={0} sx={{ alignItems: "center" }}>
                {CM.currentSubChat &&
                    (CM.currentSubChat.chatType === 3 || CM.currentSubChat.chatType === 4) && (
                        <Tooltip size="sm" title="Create a new task" variant="outlined">
                            <IconButton
                                color="neutral"
                                component="a"
                                size="sm"
                                variant="plain"
                                onClick={() => {
                                    CM.setIsMainChatVisible(true);
                                    CM.setIsThreadVisible(false);
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

                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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

                    <Tooltip size="sm" title="Close" variant="outlined">
                        <IconButton
                            color="neutral"
                            component="a"
                            size="sm"
                            variant="plain"
                            onClick={() => CM.setIsSubChatVisible(false)}
                        >
                            <CancelIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Stack>
    );
};
