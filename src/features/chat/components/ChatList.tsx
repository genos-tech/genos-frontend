import List from '@mui/joy/List';
import { ChatListItem } from './chatListItem';
import { ChatProps, AllChatProps, UserProps } from '../../../types/types';

type ChatListProps = {
    myself: UserProps;
    isDm: boolean;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentMainChat: ChatProps;
    currentSubChat: ChatProps;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
}

export const ChatList = (props: ChatListProps) => {
    const {
        myself,
        isDm,
        allChats,
        setCurrentMainChat,
        setCurrentSubChat,
        currentMainChat,
        currentSubChat,
        isSubChatVisible,
        setIsSubChatVisible,
    } = props

    return (
        <List
            size='sm'
            sx={{
                py: 0,
                '--ListItem-paddingY': '0.3rem',
                '--ListItem-paddingX': '1rem',
                maxHeight: '40vh',
                overflowY: 'auto',
                overflowX: "hidden",
            }}
            className="custom-scrollbar"
        >
            {allChats
                .slice() // Avoid mutating the original array
                .sort((a, b) =>
                    new Date(b.TSLastMessage.replace(" ", "T")).getTime() -
                    new Date(a.TSLastMessage.replace(" ", "T")).getTime()
                ) // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss" for proper parsing
                .map((chat) =>
                    chat.isDm === isDm && (
                        <ChatListItem
                            key={chat.chatId}
                            chat={chat}
                            myself={myself}
                            currentMainChat={currentMainChat}
                            currentSubChat={currentSubChat}
                            setCurrentMainChat={setCurrentMainChat}
                            setCurrentSubChat={setCurrentSubChat}
                            isSubChatVisible={isSubChatVisible}
                            setIsSubChatVisible={setIsSubChatVisible}
                        />
                    )
                )}
        </List>
    )
}