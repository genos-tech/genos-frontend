import { useState } from "react";
import Sheet from "@mui/joy/Sheet";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ModalCreateGM } from "./modals/ModalCreateGM";
import { ChatSearch } from "./ChatSearch";
import { ChatList } from "./ChatList";
import { DMDivider, GMDivider, PinnedDivider } from "./ChatSidebarDividers";
import { UserProps } from "../../../types/admin";
import { ChatProps, AllChatProps } from "../../../types/chat";

type ChatSidebarProps = {
    myself: UserProps;
    allChats: AllChatProps[];
    setAllChats: (chat: AllChatProps[]) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentMainChat: ChatProps;
    currentSubChat: ChatProps;
    socket: Socket | null;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
};

export const ChatSidebar = (props: ChatSidebarProps) => {
    const {
        myself,
        allChats,
        setAllChats,
        setCurrentMainChat,
        setCurrentSubChat,
        currentMainChat,
        currentSubChat,
        socket,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
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
                    allChats={allChats}
                    currentMainChat={currentMainChat}
                    currentSubChat={currentSubChat}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentSubChat={setCurrentSubChat}
                    isSubChatVisible={isSubChatVisible}
                    setIsSubChatVisible={setIsSubChatVisible}
                    setOpeningService={setOpeningService}
                />

                <DMDivider />

                <ChatList
                    socket={socket}
                    myself={myself}
                    isDm={true}
                    allChats={allChats}
                    currentMainChat={currentMainChat}
                    currentSubChat={currentSubChat}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentSubChat={setCurrentSubChat}
                    isSubChatVisible={isSubChatVisible}
                    setIsSubChatVisible={setIsSubChatVisible}
                    setOpeningService={setOpeningService}
                />
            </Sheet>
        </div>
    );
};
