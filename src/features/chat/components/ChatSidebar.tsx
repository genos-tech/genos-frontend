import { useState } from "react";
import Sheet from "@mui/joy/Sheet";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

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

                <PinnedDivider />

                <GMDivider setOpenCreateGM={setOpenCreateGM} />

                <ModalCreateGM
                    socket={socket}
                    myself={myself}
                    open={openCreateGM}
                    setOpen={setOpenCreateGM}
                    allChats={allChats}
                    setAllChats={setAllChats}
                    setCurrentMainChat={setCurrentMainChat}
                />

                <ChatList
                    socket={socket}
                    myself={myself}
                    isDm={false}
                    chatType={2}
                    activityMessages={[]}
                    allChats={allChats}
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

                <DMDivider />

                <ChatList
                    socket={socket}
                    myself={myself}
                    isDm={true}
                    chatType={1}
                    activityMessages={[]}
                    allChats={allChats}
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

                <PMDivider />

                <ChatList
                    socket={socket}
                    myself={myself}
                    isDm={true}
                    chatType={3}
                    activityMessages={[]}
                    allChats={allChats}
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

                <ActivityDivider />

                <ChatList
                    socket={socket}
                    myself={myself}
                    isDm={true}
                    chatType={-1}
                    activityMessages={activityMessages}
                    allChats={[]}
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
            </Sheet>
        </div>
    );
};
