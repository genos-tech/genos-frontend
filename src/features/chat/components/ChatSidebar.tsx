import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddIcon from "@mui/icons-material/Add";
import FlagIcon from "@mui/icons-material/Flag";
import GroupsIcon from "@mui/icons-material/Groups";
import MoreVert from "@mui/icons-material/MoreVert";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PersonIcon from "@mui/icons-material/Person";
import PushPinIcon from "@mui/icons-material/PushPin";
import {
    Badge,
    Box,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Sheet,
    Stack,
    Switch,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useState } from "react";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadProps,
} from "../../../types/chat";
import { ProjectProps } from "../../../types/tasks";
import { toggleMessagesPane } from "../../../utils";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { defaultChat } from "../utils/defaults";
import { ChatList } from "./ChatList";
import { ChatSearch } from "./ChatSearch";
import { ActivityDivider } from "./ChatSidebarDividers";
import { ModalCreateGM } from "./modals/ModalCreateGM";
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
    currentMainChat?: ChatProps;
    currentSubChat?: ChatProps;
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
                    allChats={allChats}
                    funcSetAllChats={funcSetAllChats}
                    myself={myself}
                    openSearchBox={openSearchBox}
                    setAllChats={setAllChats}
                    setCurrentChatPaneType={setCurrentChatPaneType}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    setOpenJoinGM={setOpenJoinGM}
                    setOpenSearchBox={setOpenSearchBox}
                    socket={socket}
                    teamMemberProfiles={teamMemberProfiles}
                />

                <ModalJoinGM
                    myself={myself}
                    openJoinGM={openJoinGM}
                    setOpenJoinGM={setOpenJoinGM}
                    socket={socket}
                />

                <Stack alignItems="center" direction="row" sx={{ mt: "7px", overflowX: "clip" }}>
                    {/* Centered buttons */}
                    <Stack direction="row" flexGrow={1} justifyContent="center" spacing={1}>
                        {/* For DM */}
                        {unReadChatCounts && (unReadChatCounts[1] || 0) > 0 && (
                            <Tooltip
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Direct Messages"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={unReadChatCounts[1]}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={currentChatPaneType === 1 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Direct Messages"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={currentChatPaneType === 1 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Group Messages"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={unReadChatCounts[2]}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={currentChatPaneType === 2 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Group Messages"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={currentChatPaneType === 2 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Project Messages"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={unReadChatCounts[3]}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={currentChatPaneType === 3 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Project Messages"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={currentChatPaneType === 3 ? "solid" : "plain"}
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
                            <Tooltip placement="top" sx={{ zIndex: "10020" }} title="Pinned Chats">
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={unReadChatCounts[4]}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={currentChatPaneType === 4 ? "solid" : "plain"}
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
                            <Tooltip placement="top" sx={{ zIndex: "10020" }} title="Pinned Chats">
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={currentChatPaneType === 4 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Flagged Messages"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={flaggedMessages.length}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={currentChatPaneType === 6 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Flagged Messages"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={currentChatPaneType === 6 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Recent Activities"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={unReadActivityMessageCounts}
                                    color="primary"
                                    size="sm"
                                    sx={{
                                        "& .JoyBadge-badge": { zIndex: 1 },
                                    }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={currentChatPaneType === 5 ? "solid" : "plain"}
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
                                placement="top"
                                sx={{ zIndex: "10020" }}
                                title="Recent Activities"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={currentChatPaneType === 5 ? "solid" : "plain"}
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
                        size="sm"
                        variant="soft"
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
                        sx={{
                            "--Switch-thumbSize": "15px",
                            "--Switch-trackWidth": "70px",
                            "--Switch-trackHeight": "23px",
                            marginLeft: "20px",
                        }}
                        onChange={() => setShowOnlyUnreadItems(!showOnlyUnreadItems)}
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
                            activityMessages={[]}
                            allChats={allChats.filter((chat) => chat.chatType === 1)}
                            chatType={1}
                            currentActivityMessageType={-1}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            flaggedMessages={flaggedMessages}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            myself={myself}
                            setActivityMessages={setActivityMessages}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setFlaggedMessages={setFlaggedMessages}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                        />
                    </Box>
                )}

                {/* For Group Messages */}
                {currentChatPaneType === 2 && (
                    <Box>
                        <ChatList
                            activityMessages={[]}
                            allChats={allChats.filter((chat) => chat.chatType === 2)}
                            chatType={2}
                            currentActivityMessageType={-1}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            flaggedMessages={flaggedMessages}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            myself={myself}
                            setActivityMessages={setActivityMessages}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setFlaggedMessages={setFlaggedMessages}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                        />
                    </Box>
                )}

                {/* For PM Chats */}
                {currentChatPaneType === 3 && (
                    <Box>
                        <ChatList
                            activityMessages={[]}
                            allChats={allChats.filter((chat) => chat.chatType === 3)}
                            chatType={3}
                            currentActivityMessageType={-1}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            flaggedMessages={flaggedMessages}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            myself={myself}
                            setActivityMessages={setActivityMessages}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setFlaggedMessages={setFlaggedMessages}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                        />
                    </Box>
                )}

                {/* For Pinned Chats */}
                {currentChatPaneType === 4 && (
                    <Box>
                        <ChatList
                            activityMessages={[]}
                            allChats={allChats.filter((chat) => chat.isPinned)}
                            chatType={4}
                            currentActivityMessageType={-1}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            flaggedMessages={flaggedMessages}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            myself={myself}
                            setActivityMessages={setActivityMessages}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setFlaggedMessages={setFlaggedMessages}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
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
                            activityMessages={activityMessages}
                            allChats={allChats}
                            chatType={5}
                            currentActivityMessageType={currentActivityMessageType}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            flaggedMessages={flaggedMessages}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            myself={myself}
                            setActivityMessages={setActivityMessages}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setFlaggedMessages={setFlaggedMessages}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                        />
                    </Box>
                )}

                {/* For Flagged Messages */}
                {currentChatPaneType === 6 && (
                    <Box>
                        <ChatList
                            activityMessages={activityMessages}
                            allChats={allChats}
                            chatType={6}
                            currentActivityMessageType={currentActivityMessageType}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            flaggedMessages={flaggedMessages}
                            funcSetAllChats={funcSetAllChats}
                            incompleteTodoCount={incompleteTodoCount}
                            isCreatingTask={isCreatingTask}
                            isSubChatVisible={isSubChatVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            myself={myself}
                            setActivityMessages={setActivityMessages}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                            setCurrentSubChat={setCurrentSubChat}
                            setCurrentThreadChat={setCurrentThreadChat}
                            setFlaggedMessages={setFlaggedMessages}
                            setIsMainChatVisible={setIsMainChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                            setIsThreadVisible={setIsThreadVisible}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            setOpeningService={setOpeningService}
                            showOnlyUnreadItems={showOnlyUnreadItems}
                            socket={socket}
                            teamMemberProfiles={teamMemberProfiles}
                        />
                    </Box>
                )}
            </Sheet>

            <ModalCreateGM
                allChats={allChats}
                myself={myself}
                open={openCreateGM}
                setAllChats={setAllChats}
                setCurrentMainChat={setCurrentMainChat}
                setOpen={setOpenCreateGM}
                socket={socket}
            />
        </div>
    );
};
