import { useState } from "react";
import {
    Stack,
    Sheet,
    IconButton,
    Tooltip,
    Badge,
    Typography,
    Switch,
    Dropdown,
    Menu,
    MenuItem,
    MenuButton,
    Box,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";
import PushPinIcon from "@mui/icons-material/PushPin";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import MoreVert from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import FlagIcon from "@mui/icons-material/Flag";

import { ModalCreateGM } from "./modals/ModalCreateGM";
import { ChatSearch } from "./ChatSearch";
import { ChatList } from "./ChatList";
import { ActivityDivider } from "./ChatSidebarDividers";
import { UserProps } from "../../../types/admin";
import { ProjectProps } from "../../../types/tasks";
import {
    MessageProps,
    ChatProps,
    AllChatProps,
    ActivityMessageProps,
    ThreadProps,
    FlaggedMessageProps,
} from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { defaultChat } from "../utils/defaults";
import { ModalJoinGM } from "./modals/ModalJoinGM";

type ChatSidebarProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
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
    isTaskPreviewVisible: boolean;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    unReadChatCounts?: Record<string, number>;
    unReadActivityMessageCounts: number;
    funcSetAllChats: () => Promise<void>;
    incompleteTodoCount: number;
    setIsToDoVisible: (value: boolean) => void;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
};

export const ChatSidebar = (props: ChatSidebarProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
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
        isTaskPreviewVisible,
        isCreatingTask,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
        setCurrentPreviewTaskId,
        setCurrentProject,
        unReadChatCounts,
        unReadActivityMessageCounts,
        funcSetAllChats,
        incompleteTodoCount,
        setIsToDoVisible,
        flaggedMessages,
        setFlaggedMessages,
    } = props;
    const { mode } = useColorScheme();
    const [openSearchBox, setOpenSearchBox] = useState(false);
    const [openCreateGM, setOpenCreateGM] = useState(false);
    const [showOnlyUnreadItems, setShowOnlyUnreadItems] = useState(false);
    const [openJoinGM, setOpenJoinGM] = useState({
        flag: false,
        chatId: -1,
        chatName: "",
    });

    // 0: none, 1: thread, 2: task, 3: mention, 4: reaction
    const [currentActivityMessageType, setCurrentActivityMessageType] = useState<number>(0);

    const defineNewChat = (lastChat: AllChatProps, messages: MessageProps[]) => {
        const newMessages: ChatProps = {
            chatId: lastChat.chatId,
            chatName: lastChat.chatName,
            chatType: lastChat.chatType,
            dmPartnerUser: lastChat.dmPartnerUser,
            lastReadMessageId: messages[messages.length - 1].messageId,
            messages: messages,
            latestMessage: lastChat.latestMessage,
            latestMessageText: lastChat.latestMessageText,
            TSLastMessage: lastChat.TSLastMessage,
            systemUserId: lastChat.systemUserId,
            project: lastChat.project,
            isPrivate: lastChat.isPrivate,
            profileImagePath: lastChat.profileImagePath,
        };
        return newMessages;
    };
    const onChatIconClickedHandler = (chatType: number) => {
        localStorage.setItem("lastChatType", chatType.toString());
        let lastChat: AllChatProps | undefined = undefined;
        let lastChatId: number = -1;
        let lastChatType: number = -1;
        if (chatType === 1) {
            const lastChatIdStr: string = localStorage.getItem("lastDMChatId") || "";
            if (lastChatIdStr !== "") {
                lastChatId = parseInt(lastChatIdStr);
                lastChat = allChats.filter((chat) => chat.chatId === lastChatId)[0];
                lastChatType = 1;
            }
        }
        if (chatType === 2) {
            const lastChatIdStr: string = localStorage.getItem("lastGMChatId") || "";
            if (lastChatIdStr !== "") {
                lastChatId = parseInt(lastChatIdStr);
                lastChat = allChats.filter((chat) => chat.chatId === lastChatId)[0];
                lastChatType = 2;
            }
        }
        if (chatType === 3) {
            const lastChatIdStr: string = localStorage.getItem("lastPMChatId") || "";
            if (lastChatIdStr !== "") {
                lastChatId = parseInt(lastChatIdStr);
                lastChat = allChats.filter((chat) => chat.chatId === lastChatId)[0];
                lastChatType = 3;
            }
        }
        if (chatType === 4) {
            const lastChatIdStr: string = localStorage.getItem("lastPinnedChatId") || "";
            const lastChatTypeStr: string = localStorage.getItem("lastPinnedChatType") || "";
            if (lastChatIdStr !== "" && lastChatTypeStr !== "") {
                lastChatId = parseInt(lastChatIdStr);
                lastChat = allChats.filter((chat) => chat.chatId === lastChatId)[0];
                lastChatType = parseInt(lastChatTypeStr);
            }
        }

        if (lastChat !== undefined) {
            toggleMessagesPane();
            popSpecificMessages(lastChatId, lastChatType)
                .then((messages: MessageProps[]) => {
                    if (messages.length > 0) {
                        const newChat: ChatProps = defineNewChat(lastChat, messages);
                        setCurrentMainChat(newChat);

                        // Switch Thread to Main
                        if (isThreadVisible) {
                            setIsMainChatVisible(true);
                            if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                                setIsThreadVisible(false);
                            }
                        }
                    }
                })
                .catch((error) => console.error(error));
        } else {
            setCurrentMainChat(defaultChat);
        }
    };

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
                    setOpenJoinGM={setOpenJoinGM}
                    setCurrentChatPaneType={setCurrentChatPaneType}
                    teamMemberProfiles={teamMemberProfiles}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    funcSetAllChats={funcSetAllChats}
                />

                <ModalJoinGM
                    socket={socket}
                    myself={myself}
                    openJoinGM={openJoinGM}
                    setOpenJoinGM={setOpenJoinGM}
                />

                <Stack direction="row" alignItems="center" sx={{ mt: "7px", overflowX: "clip" }}>
                    {/* Centered buttons */}
                    <Stack direction="row" spacing={1} justifyContent="center" flexGrow={1}>
                        {/* For DM */}
                        {unReadChatCounts && (unReadChatCounts[1] || 0) > 0 && (
                            <Tooltip
                                title="Direct Messages"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <Badge
                                    badgeContent={unReadChatCounts[1]}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 1 ? "solid" : "plain"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(1);
                                            localStorage.setItem("currentChatPaneType", "1");
                                            onChatIconClickedHandler(1);
                                        }}
                                    >
                                        <PersonIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(unReadChatCounts && (unReadChatCounts[1] || 0) > 0) && (
                            <Tooltip
                                title="Direct Messages"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 1 ? "solid" : "plain"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(1);
                                        localStorage.setItem("currentChatPaneType", "1");
                                        onChatIconClickedHandler(1);
                                    }}
                                >
                                    <PersonIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For GM */}
                        {unReadChatCounts && (unReadChatCounts[2] || 0) > 0 && (
                            <Tooltip
                                title="Group Messages"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <Badge
                                    badgeContent={unReadChatCounts[2]}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 2 ? "solid" : "plain"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(2);
                                            localStorage.setItem("currentChatPaneType", "2");
                                            onChatIconClickedHandler(2);
                                        }}
                                    >
                                        <GroupsIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(unReadChatCounts && (unReadChatCounts[2] || 0) > 0) && (
                            <Tooltip
                                title="Group Messages"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 2 ? "solid" : "plain"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(2);
                                        localStorage.setItem("currentChatPaneType", "2");
                                        onChatIconClickedHandler(2);
                                    }}
                                >
                                    <GroupsIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For PM */}
                        {unReadChatCounts && (unReadChatCounts[3] || 0) > 0 && (
                            <Tooltip
                                title="Project Messages"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <Badge
                                    badgeContent={unReadChatCounts[3]}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 3 ? "solid" : "plain"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(3);
                                            localStorage.setItem("currentChatPaneType", "3");
                                            onChatIconClickedHandler(3);
                                        }}
                                    >
                                        <AccountTreeIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(unReadChatCounts && (unReadChatCounts[3] || 0) > 0) && (
                            <Tooltip
                                title="Project Messages"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 3 ? "solid" : "plain"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(3);
                                        localStorage.setItem("currentChatPaneType", "3");
                                        onChatIconClickedHandler(3);
                                    }}
                                >
                                    <AccountTreeIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For Pinned */}
                        {unReadChatCounts && (unReadChatCounts[4] || 0) > 0 && (
                            <Tooltip title="Pinned Chats" sx={{ zIndex: "10020" }} placement="top">
                                <Badge
                                    badgeContent={unReadChatCounts[4]}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 4 ? "solid" : "plain"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(4);
                                            localStorage.setItem("currentChatPaneType", "4");
                                            onChatIconClickedHandler(4);
                                        }}
                                    >
                                        <PushPinIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(unReadChatCounts && (unReadChatCounts[4] || 0) > 0) && (
                            <Tooltip title="Pinned Chats" sx={{ zIndex: "10020" }} placement="top">
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 4 ? "solid" : "plain"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(4);
                                        localStorage.setItem("currentChatPaneType", "4");
                                        onChatIconClickedHandler(4);
                                    }}
                                >
                                    <PushPinIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For Flagged */}
                        {flaggedMessages.length > 0 && (
                            <Tooltip
                                title="Flagged Messages"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <Badge
                                    badgeContent={flaggedMessages.length}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 6 ? "solid" : "plain"}
                                        size="sm"
                                        onClick={() => {
                                            setCurrentChatPaneType(6);
                                            localStorage.setItem("currentChatPaneType", "6");
                                        }}
                                    >
                                        <FlagIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(flaggedMessages.length > 0) && (
                            <Tooltip
                                title="Flagged Messages"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 6 ? "solid" : "plain"}
                                    size="sm"
                                    onClick={() => {
                                        setCurrentChatPaneType(6);
                                        localStorage.setItem("currentChatPaneType", "6");
                                    }}
                                >
                                    <FlagIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For Activity */}
                        {unReadActivityMessageCounts > 0 && (
                            <Tooltip
                                title="Recent Activities"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <Badge
                                    badgeContent={unReadActivityMessageCounts}
                                    color="primary"
                                    size="sm"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{
                                        "& .JoyBadge-badge": { zIndex: 1 },
                                    }}
                                >
                                    <IconButton
                                        component="p"
                                        variant={currentChatPaneType === 5 ? "solid" : "plain"}
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
                            <Tooltip
                                title="Recent Activities"
                                sx={{ zIndex: "10020" }}
                                placement="top"
                            >
                                <IconButton
                                    component="p"
                                    variant={currentChatPaneType === 5 ? "solid" : "plain"}
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

                    <Switch
                        checked={showOnlyUnreadItems}
                        onChange={() => setShowOnlyUnreadItems(!showOnlyUnreadItems)}
                        slotProps={{
                            track: {
                                children: (
                                    <Typography
                                        component="span"
                                        level="inherit"
                                        sx={{
                                            ml: showOnlyUnreadItems ? "6px" : "22px",
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
                            marginLeft: "20px",
                        }}
                    />

                    <Dropdown>
                        <Tooltip title="More Options">
                            <MenuButton
                                slots={{ root: IconButton }}
                                slotProps={{
                                    root: { color: "neutral" },
                                }}
                            >
                                <MoreVert />
                            </MenuButton>
                        </Tooltip>
                        <Menu size="sm">
                            <MenuItem
                                onClick={() => {
                                    setOpenCreateGM(true);
                                }}
                            >
                                <AddIcon />
                                Group Messages
                            </MenuItem>
                        </Menu>
                    </Dropdown>
                </Stack>

                {/* For Direct Messages */}
                {currentChatPaneType === 1 && (
                    <Box>
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
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            setIsToDoVisible={setIsToDoVisible}
                            flaggedMessages={flaggedMessages}
                            setFlaggedMessages={setFlaggedMessages}
                        />
                    </Box>
                )}

                {/* For Group Messages */}
                {currentChatPaneType === 2 && (
                    <Box>
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
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            setIsToDoVisible={setIsToDoVisible}
                            flaggedMessages={flaggedMessages}
                            setFlaggedMessages={setFlaggedMessages}
                        />
                    </Box>
                )}

                {/* For PM Chats */}
                {currentChatPaneType === 3 && (
                    <Box>
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
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            setIsToDoVisible={setIsToDoVisible}
                            flaggedMessages={flaggedMessages}
                            setFlaggedMessages={setFlaggedMessages}
                        />
                    </Box>
                )}

                {/* For Pinned Chats */}
                {currentChatPaneType === 4 && (
                    <Box>
                        <ChatList
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            chatType={4}
                            activityMessages={[]}
                            setActivityMessages={setActivityMessages}
                            allChats={allChats.filter((chat) => chat.isPinned)}
                            currentActivityMessageType={-1}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            flaggedMessages={flaggedMessages}
                            setFlaggedMessages={setFlaggedMessages}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            setIsToDoVisible={setIsToDoVisible}
                        />
                    </Box>
                )}

                {/* For Activity Messages */}
                {currentChatPaneType === 5 && (
                    <Box>
                        <ActivityDivider
                            currentActivityMessageType={currentActivityMessageType}
                            setCurrentActivityMessageType={setCurrentActivityMessageType}
                        />
                        <ChatList
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            chatType={5}
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
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            setIsToDoVisible={setIsToDoVisible}
                            flaggedMessages={flaggedMessages}
                            setFlaggedMessages={setFlaggedMessages}
                        />
                    </Box>
                )}

                {/* For Flagged Messages */}
                {currentChatPaneType === 6 && (
                    <Box>
                        <ChatList
                            teamMemberProfiles={teamMemberProfiles}
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            chatType={6}
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
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            setIsToDoVisible={setIsToDoVisible}
                            flaggedMessages={flaggedMessages}
                            setFlaggedMessages={setFlaggedMessages}
                        />
                    </Box>
                )}
            </Sheet>

            <ModalCreateGM
                socket={socket}
                myself={myself}
                open={openCreateGM}
                setOpen={setOpenCreateGM}
                allChats={allChats}
                setAllChats={setAllChats}
                setCurrentMainChat={setCurrentMainChat}
            />
        </div>
    );
};
