import { useState } from "react";
import { Stack, Sheet, IconButton, Tooltip } from "@mui/joy";
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
    myself: UserProps;
    currentChatPaneType: number;
    setCurrentChatPaneType: (value: number) => void;
    activityMessages: ActivityMessageProps[];
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
        myself,
        currentChatPaneType,
        setCurrentChatPaneType,
        activityMessages,
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

    // 0: none, 1: thread, 2: task, 3: mention, 4: reaction
    const [currentActivityMessageType, setCurrentActivityMessageType] = useState<number>(0);

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
                    spacing={1}
                    justifyContent="center"
                    alignItems="center"
                    flexWrap="wrap"
                >
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
                </Stack>

                {currentChatPaneType === 1 && (
                    <>
                        <DMDivider />
                        <ChatList
                            socket={socket}
                            myself={myself}
                            chatType={1}
                            activityMessages={[]}
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
                            setIsTaskCreationVisible={setIsTaskCreationVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isTaskCreationVisible={isTaskCreationVisible}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                        />
                    </>
                )}
                {currentChatPaneType === 2 && (
                    <>
                        <GMDivider setOpenCreateGM={setOpenCreateGM} />
                        <ChatList
                            socket={socket}
                            myself={myself}
                            chatType={2}
                            activityMessages={[]}
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
                            setIsTaskCreationVisible={setIsTaskCreationVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isTaskCreationVisible={isTaskCreationVisible}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
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
                            socket={socket}
                            myself={myself}
                            chatType={3}
                            activityMessages={[]}
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
                            setIsTaskCreationVisible={setIsTaskCreationVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isTaskCreationVisible={isTaskCreationVisible}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
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
                            socket={socket}
                            myself={myself}
                            chatType={-1}
                            activityMessages={activityMessages}
                            allChats={[]}
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
                            setIsTaskCreationVisible={setIsTaskCreationVisible}
                            isTaskPreviewVisible={isTaskPreviewVisible}
                            isTaskCreationVisible={isTaskCreationVisible}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                            setOpeningService={setOpeningService}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                            setCurrentProject={setCurrentProject}
                        />
                    </>
                )}
            </Sheet>
        </div>
    );
};
