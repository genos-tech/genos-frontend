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
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { HeaderUserName } from "./HeaderUserName";

type MainChatPaneHeaderProps = {
    chat: ChatProps;
    incompleteTodoCount: number;
    isToDoVisible: boolean;
    myself: UserProps;
    setIsToDoVisible: (value: boolean) => void;
    setMyself: (value: UserProps) => void;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    CM: ChatManagementState;
    TM: TaskManagementState;
};

export const MainChatPaneHeader = (props: MainChatPaneHeaderProps) => {
    const {
        chat,
        incompleteTodoCount,
        isToDoVisible,
        myself,
        setIsToDoVisible,
        setMyself,
        UIM,
        socket,
        TEM,
        CM,
        TM,
    } = props;

    const isYou: boolean = myself.userId === chat.dmPartnerUser.userId;

    const switchSubToMain = () => {
        if (CM.isSubChatVisible === true) {
            CM.setCurrentMainChat(CM.currentSubChat as ChatProps);
            CM.setIsSubChatVisible(false);
        } else {
            CM.setIsMainChatVisible(false);
        }
    };

    const swapChat = () => {
        CM.setCurrentMainChat(CM.currentSubChat as ChatProps);
        CM.setCurrentSubChat(chat);
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
                    CM={CM}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    TEM={TEM}
                    UIM={UIM}
                />
            </Stack>
            <Stack direction="row" sx={{ alignItems: "center" }}>
                {(chat.chatType === 3 || chat.chatType === 4) && (
                    <Tooltip size="sm" title="Create a new task" variant="outlined">
                        <IconButton
                            color="neutral"
                            component="a"
                            size="sm"
                            variant="plain"
                            onClick={() => {
                                CM.setIsMainChatVisible(true);
                                CM.setIsThreadVisible(false);
                                TM.setIsTaskPreviewVisible(false);
                                TM.setIsCreatingTask({
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

                    {CM.isSubChatVisible && (
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

                    <Tooltip size="sm" title="Close" variant="outlined">
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
