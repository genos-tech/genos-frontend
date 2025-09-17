import SwapVertIcon from "@mui/icons-material/SwapVert";
import { Button, IconButton, Stack, Tooltip } from "@mui/joy";
import PhoneInTalkRoundedIcon from "@mui/icons-material/PhoneInTalkRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";

import { HeaderUserName } from "./HeaderUserName";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { Socket } from "socket.io-client";

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
    setIsTaskCreationVisible: (value: boolean) => void;
    setIsCreatingTask: (value: boolean) => void;
    setOpeningService: (value: number) => void;
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
        setIsTaskCreationVisible,
        setIsCreatingTask,
        setOpeningService,
    } = props;

    const isYou: boolean = myself.userId === chat.dmPartnerUser.userId;

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
                />
            </Stack>
            <Stack spacing={1} direction="row" sx={{ alignItems: "center" }}>
                {(subChat.chatType === 3 || subChat.chatType === 4) && (
                    <Tooltip title="Create a new task" size="sm">
                        <IconButton
                            component="a"
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            onClick={() => {
                                setIsMainChatVisible(true);
                                setIsThreadVisible(false);
                                setIsTaskPreviewVisible(false);
                                setIsTaskCreationVisible(true);
                                setIsCreatingTask(true);
                            }}
                            sx={{ px: "10px" }}
                        >
                            <PlaylistAddIcon />
                            New Task
                        </IconButton>
                    </Tooltip>
                )}
                {subChat.chatType !== 3 && subChat.chatType !== 4 && (
                    <Button
                        component="a"
                        startDecorator={<PhoneInTalkRoundedIcon />}
                        color="neutral"
                        variant="outlined"
                        size="sm"
                        sx={{ display: { xs: "none", md: "inline-flex" } }}
                    >
                        Call (TBD)
                    </Button>
                )}

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

                    <IconButton
                        component="a"
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => setIsSubChatVisible(false)}
                    >
                        <CancelIcon />
                    </IconButton>
                </div>

                <IconButton component="a" size="sm" variant="plain" color="neutral">
                    <MoreVertRoundedIcon />
                </IconButton>
            </Stack>
        </Stack>
    );
};
