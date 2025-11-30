import { useState } from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddIcon from "@mui/icons-material/Add";
import FlagIcon from "@mui/icons-material/Flag";
import GroupsIcon from "@mui/icons-material/Groups";
import MoreVert from "@mui/icons-material/MoreVert";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PersonIcon from "@mui/icons-material/Person";
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
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";
import { toggleMessagesPane } from "../../../../utils/sidebarUtils";
import { popSpecificMessages } from "../../services/popSpecificMessages";
import { defaultChat } from "../../utils/defaults";
import { ModalCreateGM } from "../modals/ModalCreateGM";
import { ModalJoinGM } from "../modals/ModalJoinGM";
import { ChatList } from "./ChatList";
import { ChatSearch } from "./ChatSearch";
import { ActivityDivider } from "./ChatSidebarDividers";

type ChatSidebarProps = {
    incompleteTodoCount: number;
    myself: UserProps;
    setIsToDoVisible: (value: boolean) => void;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
};

export const ChatSidebar = (props: ChatSidebarProps) => {
    const {
        incompleteTodoCount,
        myself,
        setIsToDoVisible,
        setMyself,
        useUISM,
        socket,
        useTEM,
        useCM,
        useTM,
        usePM,
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
                lastChat = useCM.allChats.filter((chat) => chat.chatId === lastChatId)[0];
                lastChatType = 1;
            }
        }
        if (chatType === 2) {
            const lastChatIdStr: string = localStorage.getItem("lastGMChatId") || "";
            if (lastChatIdStr !== "") {
                lastChatId = parseInt(lastChatIdStr);
                lastChat = useCM.allChats.filter((chat) => chat.chatId === lastChatId)[0];
                lastChatType = 2;
            }
        }
        if (chatType === 3) {
            const lastChatIdStr: string = localStorage.getItem("lastPMChatId") || "";
            if (lastChatIdStr !== "") {
                lastChatId = parseInt(lastChatIdStr);
                lastChat = useCM.allChats.filter((chat) => chat.chatId === lastChatId)[0];
                lastChatType = 3;
            }
        }
        if (chatType === 4) {
            const lastChatIdStr: string = localStorage.getItem("lastPinnedChatId") || "";
            const lastChatTypeStr: string = localStorage.getItem("lastPinnedChatType") || "";
            if (lastChatIdStr !== "" && lastChatTypeStr !== "") {
                lastChatId = parseInt(lastChatIdStr);
                lastChat = useCM.allChats.filter((chat) => chat.chatId === lastChatId)[0];
                lastChatType = parseInt(lastChatTypeStr);
            }
        }

        if (lastChat !== undefined) {
            toggleMessagesPane();
            popSpecificMessages(lastChatId, lastChatType)
                .then((messages: MessageProps[]) => {
                    if (messages.length > 0) {
                        const newChat: ChatProps = defineNewChat(lastChat, messages);
                        useCM.setCurrentMainChat(newChat);

                        // Switch Thread to Main
                        if (useCM.isThreadVisible) {
                            useCM.setIsMainChatVisible(true);
                            if (useTM.isCreatingTask.flag === true || useTM.isTaskPreviewVisible) {
                                useCM.setIsThreadVisible(false);
                            }
                        }
                    }
                })
                .catch((error) => console.error(error));
        } else {
            useCM.setCurrentMainChat(defaultChat);
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
                    useCM={useCM}
                    myself={myself}
                    openSearchBox={openSearchBox}
                    setMyself={setMyself}
                    setOpenJoinGM={setOpenJoinGM}
                    setOpenSearchBox={setOpenSearchBox}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />

                <ModalJoinGM
                    myself={myself}
                    openJoinGM={openJoinGM}
                    setOpenJoinGM={setOpenJoinGM}
                    socket={socket}
                />

                <Stack
                    className="custom-scrollbar"
                    alignItems="center"
                    direction="row"
                    sx={{ overflowX: "scroll" }}
                >
                    {/* Centered buttons */}
                    <Stack
                        direction="row"
                        flexGrow={1}
                        justifyContent="center"
                        spacing={2}
                        sx={{
                            pt:
                                (useCM.unReadChatCounts && (useCM.unReadChatCounts[0] || 0) > 0) ||
                                (useCM.unReadChatCounts && (useCM.unReadChatCounts[1] || 0) > 0) ||
                                (useCM.unReadChatCounts && (useCM.unReadChatCounts[2] || 0) > 0) ||
                                (useCM.unReadChatCounts && (useCM.unReadChatCounts[3] || 0) > 0) ||
                                useCM.flaggedMessages.length > 0
                                    ? "10px"
                                    : "3px",
                        }}
                    >
                        {/* For DM */}
                        {useCM.unReadChatCounts && (useCM.unReadChatCounts[1] || 0) > 0 && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Direct Messages"
                                variant="outlined"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={useCM.unReadChatCounts[1]}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={
                                            useCM.currentChatPaneType === 1 ? "solid" : "plain"
                                        }
                                        onClick={() => {
                                            useCM.setCurrentChatPaneType(1);
                                            localStorage.setItem("currentChatPaneType", "1");
                                            onChatIconClickedHandler(1);
                                        }}
                                    >
                                        <PersonIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(useCM.unReadChatCounts && (useCM.unReadChatCounts[1] || 0) > 0) && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Direct Messages"
                                variant="outlined"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={useCM.currentChatPaneType === 1 ? "solid" : "plain"}
                                    onClick={() => {
                                        useCM.setCurrentChatPaneType(1);
                                        localStorage.setItem("currentChatPaneType", "1");
                                        onChatIconClickedHandler(1);
                                    }}
                                >
                                    <PersonIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For GM */}
                        {useCM.unReadChatCounts && (useCM.unReadChatCounts[2] || 0) > 0 && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Group Messages"
                                variant="outlined"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={useCM.unReadChatCounts[2]}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={
                                            useCM.currentChatPaneType === 2 ? "solid" : "plain"
                                        }
                                        onClick={() => {
                                            useCM.setCurrentChatPaneType(2);
                                            localStorage.setItem("currentChatPaneType", "2");
                                            onChatIconClickedHandler(2);
                                        }}
                                    >
                                        <GroupsIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(useCM.unReadChatCounts && (useCM.unReadChatCounts[2] || 0) > 0) && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Group Messages"
                                variant="outlined"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={useCM.currentChatPaneType === 2 ? "solid" : "plain"}
                                    onClick={() => {
                                        useCM.setCurrentChatPaneType(2);
                                        localStorage.setItem("currentChatPaneType", "2");
                                        onChatIconClickedHandler(2);
                                    }}
                                >
                                    <GroupsIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For PM */}
                        {useCM.unReadChatCounts && (useCM.unReadChatCounts[3] || 0) > 0 && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Project Updates"
                                variant="outlined"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={useCM.unReadChatCounts[3]}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={
                                            useCM.currentChatPaneType === 3 ? "solid" : "plain"
                                        }
                                        onClick={() => {
                                            useCM.setCurrentChatPaneType(3);
                                            localStorage.setItem("currentChatPaneType", "3");
                                            onChatIconClickedHandler(3);
                                        }}
                                    >
                                        <AccountTreeIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(useCM.unReadChatCounts && (useCM.unReadChatCounts[3] || 0) > 0) && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Project Updates"
                                variant="outlined"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={useCM.currentChatPaneType === 3 ? "solid" : "plain"}
                                    onClick={() => {
                                        useCM.setCurrentChatPaneType(3);
                                        localStorage.setItem("currentChatPaneType", "3");
                                        onChatIconClickedHandler(3);
                                    }}
                                >
                                    <AccountTreeIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For Flagged */}
                        {useCM.flaggedMessages.length > 0 && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Flagged Messages"
                                variant="outlined"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={useCM.flaggedMessages.length}
                                    color="primary"
                                    size="sm"
                                    sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={
                                            useCM.currentChatPaneType === 6 ? "solid" : "plain"
                                        }
                                        onClick={() => {
                                            useCM.setCurrentChatPaneType(6);
                                            localStorage.setItem("currentChatPaneType", "6");
                                        }}
                                    >
                                        <FlagIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {!(useCM.flaggedMessages.length > 0) && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Flagged Messages"
                                variant="outlined"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={useCM.currentChatPaneType === 6 ? "solid" : "plain"}
                                    onClick={() => {
                                        useCM.setCurrentChatPaneType(6);
                                        localStorage.setItem("currentChatPaneType", "6");
                                    }}
                                >
                                    <FlagIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* For Activity */}
                        {useCM.unReadActivityMessageCounts > 0 && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Recent Activities"
                                variant="outlined"
                            >
                                <Badge
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    badgeContent={useCM.unReadActivityMessageCounts}
                                    color="primary"
                                    size="sm"
                                    sx={{
                                        "& .JoyBadge-badge": { zIndex: 1 },
                                    }}
                                >
                                    <IconButton
                                        component="p"
                                        size="sm"
                                        variant={
                                            useCM.currentChatPaneType === 5 ? "solid" : "plain"
                                        }
                                        onClick={() => {
                                            useCM.setCurrentChatPaneType(5);
                                            localStorage.setItem("currentChatPaneType", "5");
                                        }}
                                    >
                                        <NotificationsActiveIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        )}
                        {useCM.unReadActivityMessageCounts === 0 && (
                            <Tooltip
                                placement="top"
                                size="sm"
                                sx={{ zIndex: "10020" }}
                                title="Recent Activities"
                                variant="outlined"
                            >
                                <IconButton
                                    component="p"
                                    size="sm"
                                    variant={useCM.currentChatPaneType === 5 ? "solid" : "plain"}
                                    onClick={() => {
                                        useCM.setCurrentChatPaneType(5);
                                        localStorage.setItem("currentChatPaneType", "5");
                                    }}
                                >
                                    <NotificationsActiveIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>

                    <Stack direction="row" sx={{ px: "10px", width: "120px" }}>
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
                            }}
                            onChange={() => setShowOnlyUnreadItems(!showOnlyUnreadItems)}
                        />

                        <Dropdown>
                            <MenuButton
                                slots={{ root: IconButton }}
                                slotProps={{
                                    root: { color: "neutral" },
                                }}
                            >
                                <MoreVert />
                            </MenuButton>
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
                </Stack>

                {/* For Direct Messages */}
                {useCM.currentChatPaneType === 1 && (
                    <Box>
                        <ChatList
                            usePM={usePM}
                            targetChatType={1}
                            useCM={useCM}
                            currentActivityMessageType={-1}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{
                                setIsToDoVisible,
                            }}
                            data={{
                                myself,
                                setMyself,
                            }}
                            state={{
                                showOnlyUnreadItems,
                                incompleteTodoCount,
                            }}
                        />
                    </Box>
                )}

                {/* For Group Messages */}
                {useCM.currentChatPaneType === 2 && (
                    <Box>
                        <ChatList
                            usePM={usePM}
                            targetChatType={2}
                            useCM={useCM}
                            currentActivityMessageType={-1}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{
                                setIsToDoVisible,
                            }}
                            data={{
                                myself,
                                setMyself,
                            }}
                            state={{
                                showOnlyUnreadItems,
                                incompleteTodoCount,
                            }}
                        />
                    </Box>
                )}

                {/* For PM Chats */}
                {useCM.currentChatPaneType === 3 && (
                    <Box>
                        <ChatList
                            usePM={usePM}
                            targetChatType={3}
                            useCM={useCM}
                            currentActivityMessageType={-1}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{
                                setIsToDoVisible,
                            }}
                            data={{
                                myself,
                                setMyself,
                            }}
                            state={{
                                showOnlyUnreadItems,
                                incompleteTodoCount,
                            }}
                        />
                    </Box>
                )}

                {/* For Activity Messages */}
                {useCM.currentChatPaneType === 5 && (
                    <Box>
                        <ActivityDivider
                            currentActivityMessageType={currentActivityMessageType}
                            setCurrentActivityMessageType={setCurrentActivityMessageType}
                        />
                        <ChatList
                            usePM={usePM}
                            targetChatType={5}
                            useCM={useCM}
                            currentActivityMessageType={currentActivityMessageType}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{
                                setIsToDoVisible,
                            }}
                            data={{
                                myself,
                                setMyself,
                            }}
                            state={{
                                showOnlyUnreadItems,
                                incompleteTodoCount,
                            }}
                        />
                    </Box>
                )}

                {/* For Flagged Messages */}
                {useCM.currentChatPaneType === 6 && (
                    <Box>
                        <ChatList
                            usePM={usePM}
                            targetChatType={6}
                            useCM={useCM}
                            currentActivityMessageType={currentActivityMessageType}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{
                                setIsToDoVisible,
                            }}
                            data={{
                                myself,
                                setMyself,
                            }}
                            state={{
                                showOnlyUnreadItems,
                                incompleteTodoCount,
                            }}
                        />
                    </Box>
                )}
            </Sheet>

            <ModalCreateGM
                useCM={useCM}
                myself={myself}
                open={openCreateGM}
                setOpen={setOpenCreateGM}
                socket={socket}
            />
        </div>
    );
};
