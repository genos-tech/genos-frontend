import { Socket } from "socket.io-client";
import List from "@mui/joy/List";

import { ChatListItem } from "./chatListItem";
import { UserProps } from "../../../types/admin";
import { ChatProps, AllChatProps } from "../../../types/chat";

type ChatListProps = {
    socket: Socket | null;
    myself: UserProps;
    isDm: boolean;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentMainChat: ChatProps;
    currentSubChat: ChatProps;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    setOpeningService: (value: number) => void;
};

export const ChatList = (props: ChatListProps) => {
    const {
        socket,
        myself,
        isDm,
        allChats,
        setCurrentMainChat,
        setCurrentSubChat,
        currentMainChat,
        currentSubChat,
        isSubChatVisible,
        setIsSubChatVisible,
        setOpeningService,
    } = props;

    return (
        <List
            size="sm"
            sx={{
                py: 0,
                "--ListItem-paddingY": "0.3rem",
                "--ListItem-paddingX": "1rem",
                maxHeight: "40vh",
                overflowY: "auto",
                overflowX: "hidden",
            }}
            className="custom-scrollbar"
        >
            {allChats
                .slice() // Avoid mutating the original array
                .sort(
                    (a, b) =>
                        new Date(b.TSLastMessage.replace(" ", "T")).getTime() -
                        new Date(a.TSLastMessage.replace(" ", "T")).getTime()
                ) // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss" for proper parsing
                .map(
                    (chat) =>
                        chat.isDm === isDm && (
                            <ChatListItem
                                key={`${chat.chatId}-${chat.isDm}-${chat.chatName}`}
                                socket={socket}
                                chat={chat}
                                myself={myself}
                                currentMainChat={currentMainChat}
                                currentSubChat={currentSubChat}
                                setCurrentMainChat={setCurrentMainChat}
                                setCurrentSubChat={setCurrentSubChat}
                                isSubChatVisible={isSubChatVisible}
                                setIsSubChatVisible={setIsSubChatVisible}
                                setOpeningService={setOpeningService}
                            />
                        )
                )}
        </List>
    );
};
