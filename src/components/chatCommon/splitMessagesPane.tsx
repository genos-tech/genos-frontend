import Stack from '@mui/joy/Stack';
import Sheet from '@mui/joy/Sheet';
import MessagesPane from '../mainChat/mainMessagesPane';
import MessagesSubPane from '../subChat/subMessagesPane';
import { Socket } from "socket.io-client";
import {
    ChatProps,
    UserProps,
    ThreadProps
} from '../../types';

type MessagesSplitPaneProps = {
    chat: ChatProps;
    subChat: ChatProps;
    myself: UserProps;
    socket: Socket;
    setIsSubChatVisible: (value: boolean) => void;
    isSubChatVisible: boolean;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsRightSideVisible: (value: boolean) => void;
    currentMainChatEmail: string;
    currentSubChatEmail: string;
};

export default function MessagesSplitPane(props: MessagesSplitPaneProps) {
    const { chat,
        subChat,
        myself,
        socket,
        setIsSubChatVisible,
        isSubChatVisible,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        setIsRightSideVisible,
        currentMainChatEmail,
        currentSubChatEmail } = props;

    return (
        <Sheet
            sx={{
                width: '100%',
                minWidth: '600px',
                height: { xs: 'calc(100dvh - var(--Header-height))', md: '100dvh' },
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                backgroundColor: 'background.level1',
                maxWidth: '100%',
                borderRight: '1px solid',
                borderColor: 'divider',
                overflowY: 'auto',
                position: 'relative',
                transition: 'width 0.2s ease-in-out',
                zIndex: 1000,
            }}
        >

            <Stack
                direction="column"
                sx={{
                    maxHeight: "100vh",
                    overflow: "hidden",
                    flexGrow: 1,
                    position: "relative",
                }}
            >
                {/* Top Messages Pane with Close Button */}
                {isSubChatVisible && (
                    <MessagesSubPane
                        myself={myself}
                        chat={chat}
                        subChat={subChat}
                        socket={socket}
                        setCurrentMainChat={setCurrentMainChat}
                        setCurrentSubChat={setCurrentSubChat}
                        setCurrentThreadChat={setCurrentThreadChat}
                        setIsSubChatVisible={setIsSubChatVisible}
                        setIsRightSideVisible={setIsRightSideVisible}
                        currentSubChatEmail={currentSubChatEmail} />
                )}

                {/* Bottom Messages Pane (Expands when Top Pane is Hidden) */}
                <MessagesPane
                    chat={chat}
                    subChat={subChat}
                    myself={myself}
                    socket={socket}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentSubChat={setCurrentSubChat}
                    setCurrentThreadChat={setCurrentThreadChat}
                    setIsRightSideVisible={setIsRightSideVisible}
                    isSubChatVisible={isSubChatVisible}
                    setIsSubChatVisible={setIsSubChatVisible}
                    currentMainChatEmail={currentMainChatEmail}
                />
            </Stack>
        </Sheet>
    );
}