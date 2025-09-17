import { useEffect, useState } from "react";
import { Stack, Sheet, IconButton, Tooltip, Badge, Typography, Switch } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";
import PushPinIcon from "@mui/icons-material/PushPin";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

import { ModalCreateGM } from "./modals/ModalCreateGM";
import { ChatSearch } from "./ChatSearch";
import { ChatList } from "./ChatList";
import {
    DMDivider,
    GMDivider,
    PMDivider,
    PinnedDivider,
    ActivityDivider,
} from "./ChatSidebarDividers";
import { UserProps } from "../../../types/admin";
import { ProjectProps } from "../../../types/tasks";
import { ChatProps, AllChatProps, ActivityMessageProps, ThreadProps } from "../../../types/chat";

type ChatSidebarProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    funcSetAllChats: () => void;
    currentChatPaneType: number;
    setCurrentChatPaneType: (value: number) => void;
    activityMessages: ActivityMessageProps[];
    setActivityMessages: (value: ActivityMessageProps[]) => void;
    allChats: AllChatProps[];
    setAllChats: (chat: AllChatProps[]) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (value: ThreadProps) => void;
    currentMainChat: ChatProps;
    currentSubChat: ChatProps;
    socket: Socket | null;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    isThreadVisible: boolean;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsTaskCreationVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    isTaskCreationVisible: boolean;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
};

export const ChatSidebar = (props: ChatSidebarProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        funcSetAllChats,
        currentChatPaneType,
        setCurrentChatPaneType,
        activityMessages,
        setActivityMessages,
        allChats,
        setAllChats,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        currentMainChat,
        currentSubChat,
        socket,
        setIsMainChatVisible,
        setIsThreadVisible,
        isThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
        isTaskPreviewVisible,
        isTaskCreationVisible,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
        setCurrentPreviewTaskId,
        setCurrentProject,
    } = props;
    const { mode } = useColorScheme();
    const [openSearchBox, setOpenSearchBox] = useState(false);
    const [openCreateGM, setOpenCreateGM] = useState(false);
    const [onlyUnread, setOnlyUnread] = useState(false);

    // 0: none, 1: thread, 2: task, 3: mention, 4: reaction
    const [currentActivityMessageType, setCurrentActivityMessageType] = useState<number>(0);

    const [unReadChatCounts, setUnReadChatCounts] = useState<Record<string, number>>();
    const countUnreadChats = (chats: AllChatProps[]): Record<string, number> => {
        return chats.reduce<Record<string, number>>((acc, chat) => {
            if (chat.latestMessage && chat.lastReadMessageId < chat.latestMessage.messageId) {
                acc[chat.chatType] = (acc[chat.chatType] ?? 0) + 1;
            }
            return acc;
        }, {});
    };
    useEffect(() => {
        setUnReadChatCounts(countUnreadChats(allChats));
    }, []);
    useEffect(() => {
        setUnReadChatCounts(countUnreadChats(allChats));
    }, [allChats]);

    const [unReadActivityMessageCounts, setUnReadActivityMessageCounts] = useState<number>(-1);
    const countUnreadActivityMessages = (activityMessages: ActivityMessageProps[]): number => {
        return activityMessages.reduce<number>((acc, activity) => {
            if (activity.isRead === false) {
                acc += 1;
            }
            return acc;
        }, 0);
    };
    useEffect(() => {
        // Exclude the first thread message cause it's actually not a thread message.
        const tmpActivityMessages: ActivityMessageProps[] = activityMessages.filter(
            (item) => !(item.isThread === true && item.messageId === 1)
        );
        setUnReadActivityMessageCounts(countUnreadActivityMessages(tmpActivityMessages));
    }, [activityMessages]);

    return (
        <div style={{ display: "flex", height: "100dvh" }}>
            <Sheet
                sx={{
                    width: "100%",
                    borderRight: "1px solid",
                    borderColor: mode === "dark" ? "black" : "white",
                    overflowY: "hidden",
                    position: "relative",
                    transition: "width 0.2s ease-in-out",
                }}
            >
                <ChatSearch
                    myself={myself}
                    socket={socket}
                    openSearchBox={openSearchBox}
                    setOpenSearchBox={setOpenSearchBox}
                    setCurrentMainChat={setCurrentMainChat}
                    allChats={allChats}
                    setAllChats={setAllChats}
                />

                <Stack
                    direction="row"
                    alignItems="center"
                    sx={{ ml: "70px", mt: "7px" }}
                    flexWrap="wrap"
                >
                    {/* Centered buttons */}
                    <Stack direction="row" spacing={1.5} justifyContent="center" flexGrow={1}>
                        {/* For DM */}
                        {unReadChatCounts && (unReadChatCounts[1] || 0) > 0 && (
                            <Tooltip title="Direct Message" sx={{ zIndex: "10020" }}>
                                <Badge
                                    badgeContent={unReadChatCounts[1]}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 1 ? "solid" : "soft"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(1);
                                            localStorage.setItem("currentChatPaneType", "1");
                                        }}
                                    >
                                        <PersonIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(unReadChatCounts && (unReadChatCounts[1] || 0) > 0) && (
                            <Tooltip title="Direct Message" sx={{ zIndex: "10020" }}>
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 1 ? "solid" : "soft"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(1);
                                        localStorage.setItem("currentChatPaneType", "1");
                                    }}
                                >
                                    <PersonIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For GM */}
                        {unReadChatCounts && (unReadChatCounts[2] || 0) > 0 && (
                            <Tooltip title="Group Message" sx={{ zIndex: "10020" }}>
                                <Badge
                                    badgeContent={unReadChatCounts[2]}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 2 ? "solid" : "soft"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(2);
                                            localStorage.setItem("currentChatPaneType", "2");
                                        }}
                                    >
                                        <GroupsIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(unReadChatCounts && (unReadChatCounts[2] || 0) > 0) && (
                            <Tooltip title="Group Message" sx={{ zIndex: "10020" }}>
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 2 ? "solid" : "soft"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(2);
                                        localStorage.setItem("currentChatPaneType", "2");
                                    }}
                                >
                                    <GroupsIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For PM */}
                        {unReadChatCounts && (unReadChatCounts[3] || 0) > 0 && (
                            <Tooltip title="Project Message" sx={{ zIndex: "10020" }}>
                                <Badge
                                    badgeContent={unReadChatCounts[3]}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 3 ? "solid" : "soft"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(3);
                                            localStorage.setItem("currentChatPaneType", "3");
                                        }}
                                    >
                                        <AccountTreeIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(unReadChatCounts && (unReadChatCounts[3] || 0) > 0) && (
                            <Tooltip title="Project Updates" sx={{ zIndex: "10020" }}>
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 3 ? "solid" : "soft"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(3);
                                        localStorage.setItem("currentChatPaneType", "3");
                                    }}
                                >
                                    <AccountTreeIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For Pinned */}
                        <Tooltip title="Pinned" sx={{ zIndex: "10020" }}>
                            <IconButton
                                component="p"
                                variant={currentChatPaneType === 4 ? "solid" : "soft"}
                                size="sm"
                                onClick={() => {
                                    setCurrentChatPaneType(4);
                                    localStorage.setItem("currentChatPaneType", "4");
                                }}
                            >
                                <PushPinIcon />
                            </IconButton>
                        </Tooltip>

                        {/* For Activity */}
                        {unReadActivityMessageCounts > 0 && (
                            <Tooltip title="Recent Activities" sx={{ zIndex: "10020" }}>
                                <Badge
                                    badgeContent={unReadActivityMessageCounts}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 5 ? "solid" : "soft"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(5);
                                            localStorage.setItem("currentChatPaneType", "5");
                                        }}
                                    >
                                        <NotificationsActiveIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {unReadActivityMessageCounts === 0 && (
                            <Tooltip title="Recent Activities" sx={{ zIndex: "10020" }}>
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 5 ? "solid" : "soft"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(5);
                                        localStorage.setItem("currentChatPaneType", "5");
                                    }}
                                >
                                    <NotificationsActiveIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>

                    {/* Switch on the right */}
                    <Switch
                        checked={onlyUnread}
                        onChange={() => setOnlyUnread(!onlyUnread)}
                        slotProps={{
                            track: {
                                children: (
                                    <Typography
                                        component="span"
                                        level="inherit"
                                        sx={{
                                            ml: onlyUnread ? "6px" : "22px",
                                            fontWeight: "bold",
                                        }}
                                    >
                                        Unread
                                    </Typography>
                                ),
                            },
                        }}
                        size="sm"
                        variant="soft"
                        sx={{
                            "--Switch-thumbSize": "15px",
                            "--Switch-trackWidth": "70px",
                            "--Switch-trackHeight": "23px",
                            paddingRight: "10px",
                        }}
                    />
                </Stack>

                {currentChatPaneType === 1 && (
                    <>
                        <DMDivider />
                        <ChatList
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            chatType={1}
                            activityMessages={[]}
                            setActivityMessages={setActivityMessages}
                            allChats={allChats.filter((chat) => chat.chatType === 1)}
                            currentActivityMessageType={-1}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            isThreadVisible={isThreadVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isTaskCreationVisible={isTaskCreationVisible}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            onlyUnread={onlyUnread}
                        />
                    </>
                )}
                {currentChatPaneType === 2 && (
                    <>
                        <GMDivider setOpenCreateGM={setOpenCreateGM} />
                        <ChatList
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            chatType={2}
                            activityMessages={[]}
                            setActivityMessages={setActivityMessages}
                            allChats={allChats.filter((chat) => chat.chatType === 2)}
                            currentActivityMessageType={-1}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            isThreadVisible={isThreadVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isTaskCreationVisible={isTaskCreationVisible}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            onlyUnread={onlyUnread}
                        />
                        <ModalCreateGM
                            socket={socket}
                            myself={myself}
                            open={openCreateGM}
                            setOpen={setOpenCreateGM}
                            allChats={allChats}
                            setAllChats={setAllChats}
                            setCurrentMainChat={setCurrentMainChat}
                        />
                    </>
                )}
                {currentChatPaneType === 3 && (
                    <>
                        <PMDivider />
                        <ChatList
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            chatType={3}
                            activityMessages={[]}
                            setActivityMessages={setActivityMessages}
                            allChats={allChats.filter((chat) => chat.chatType === 3)}
                            currentActivityMessageType={-1}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            isThreadVisible={isThreadVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isTaskCreationVisible={isTaskCreationVisible}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            onlyUnread={onlyUnread}
                        />
                    </>
                )}
                {currentChatPaneType === 4 && (
                    <>
                        <PinnedDivider />
                    </>
                )}
                {currentChatPaneType === 5 && (
                    <>
                        <ActivityDivider
                            currentActivityMessageType={currentActivityMessageType}
                            setCurrentActivityMessageType={setCurrentActivityMessageType}
                        />
                        <ChatList
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            chatType={-1}
                            activityMessages={activityMessages}
                            setActivityMessages={setActivityMessages}
                            allChats={allChats}
                            currentActivityMessageType={currentActivityMessageType}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            isThreadVisible={isThreadVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isTaskCreationVisible={isTaskCreationVisible}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            onlyUnread={onlyUnread}
                        />
                    </>
                )}
            </Sheet>
        </div>
    );
};
