import { useState, useEffect, useRef } from "react";
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import ChatBubble from '../chatCommon/chatBubble';
import { Socket } from "socket.io-client";
import SubMessagesPaneHeader from './subMessagesPaneHeader';
import {
  ChatProps,
  UserProps,
  ThreadProps
} from '../../types';
import { MarkdownEditor } from "../markdownEditor/mdEditor";
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { useColorScheme } from '@mui/joy/styles';


type MessagesPaneProps = {
  currentWindowHeight: number;
  paneSizePCT: number;
  myself: UserProps;
  chat: ChatProps;
  subChat: ChatProps;
  socket: Socket;
  setCurrentMainChat: (chat: ChatProps) => void;
  setCurrentSubChat: (chat: ChatProps) => void;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsSubChatVisible: (value: boolean) => void;
  setIsThreadVisible: (value: boolean) => void;
  currentSubChatEmail: string;
};

export default function MessagesSubPane(props: MessagesPaneProps) {
  const {
    currentWindowHeight,
    paneSizePCT,
    myself,
    chat,
    subChat,
    socket,
    setCurrentMainChat,
    setCurrentSubChat,
    setCurrentThreadChat,
    setIsSubChatVisible,
    setIsThreadVisible,
    currentSubChatEmail } = props;
  const [chatMessages, setChatMessages] = useState(subChat.messages);
  const [content, setContent] = useState("");

  useEffect(() => {
    setChatMessages(subChat.messages);
  }, [subChat.messages]);

  const { mode } = useColorScheme();

  const virtuosoRef = useRef<VirtuosoHandle | null>(null)

  // Scroll to the bottom when a new message comes.
  useEffect(() => {
    const virtuoso = virtuosoRef.current
    if (virtuoso === null) {
      return
    } else {
      setTimeout(() => {
        virtuoso.scrollToIndex({
          index: 'LAST',
          behavior: 'smooth',
        })
      }, 200)
    }
  }, [subChat])

  // Scroll to the bottom at first.
  useEffect(() => {
    const virtuoso = virtuosoRef.current
    if (virtuoso === null) {
      return
    } else {
      setTimeout(() => {
        virtuoso.scrollToIndex({
          index: 'LAST',
        })
      }, 300)
    }
  }, [currentSubChatEmail])

  return (
    <Sheet sx={{ backgroundColor: 'background.level1' }}>
      <SubMessagesPaneHeader
        myself={myself}
        chat={chat}
        subChat={subChat}
        setCurrentMainChat={setCurrentMainChat}
        setCurrentSubChat={setCurrentSubChat}
        setIsSubChatVisible={setIsSubChatVisible} />

      <Box sx={{ px: 0.3, my: 0.2 }}>
        <Virtuoso
          ref={virtuosoRef}
          className="custom-scrollbar"
          style={{ height: currentWindowHeight * paneSizePCT * 0.01 - 270 }}
          totalCount={chatMessages.length}
          initialTopMostItemIndex={chatMessages.length - 1}
          atTopThreshold={64}
          atBottomThreshold={128}
          itemContent={(index) => {
            const message = chatMessages[index];
            const isYou = message.sender.userName === myself.userName;
            return (
              <div>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ flexDirection: isYou ? "row-reverse" : "row", paddingY: 2, paddingX: 0.5 }}
                >
                  <ChatBubble
                    myself={myself}
                    variant={isYou ? "sent" : "received"}
                    chat={subChat}
                    socket={socket}
                    {...message}
                    setIsThreadVisible={setIsThreadVisible}
                    setCurrentThreadChat={setCurrentThreadChat}
                  />
                </Stack>
              </div>
            );
          }}
        />
      </Box>
      <Box sx={{ paddingLeft: 1, paddingRight: 1 }}>
        <div className="md-content">
          <MarkdownEditor myself={myself}
            socket={socket}
            chat={subChat}
            messageContent={content}
            setContent={setContent}
            setCurrentChat={setCurrentSubChat} />
        </div>
      </Box>
    </Sheet>
  );
}
