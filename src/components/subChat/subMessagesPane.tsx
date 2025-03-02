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
import "../../tests/Md.css";
import { MarkdownEditor } from "../markdownEditor/MarkdownEditor";
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

type MessagesPaneProps = {
  chat: ChatProps;
  myself: UserProps;
  socket: Socket;
  setCurrentSubChat: (chat: ChatProps) => void;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsSubChatVisible: (value: boolean) => void;
  setIsRightSideVisible: (value: boolean) => void;
  currentSubChatEmail: string;
};

export default function MessagesSubPane(props: MessagesPaneProps) {
  const { chat,
    myself,
    socket,
    setCurrentSubChat,
    setCurrentThreadChat,
    setIsSubChatVisible,
    setIsRightSideVisible,
    currentSubChatEmail } = props;
  const [chatMessages, setChatMessages] = useState(chat.messages);
  const [content, setContent] = useState("");

  useEffect(() => {
    setChatMessages(chat.messages);
  }, [chat.messages]);



  const virtuosoRef = useRef<VirtuosoHandle | null>(null)
  const ref = useRef({
    nearBottom: false,
  })

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
  }, [chat])

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

  // TODO: limit initial num of messages, and load more after
  const handleAtTop = (atTop: boolean) => {
    if (atTop) {
      // loadMore()
    }
  }

  // Detecting if scroll bar is near the bottom
  const handleAtBottom = (atBottom: boolean) => {
    ref.current.nearBottom = atBottom
  }

  // Calculate chat pane height dynamically
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(window.innerHeight - 310);
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        // This is very very important to set the height of the message bubble !!!!!!!
        const currentHeight: number = containerRef.current.clientHeight
        setListHeight(currentHeight - 310)
      }
    };

    updateHeight(); // Initial height
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [chat]);




  return (
    <Sheet
      ref={containerRef}
      sx={{
        height: { xs: 'calc(100dvh - var(--Header-height))', md: '100dvh' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.level2',
        maxWidth: '100%',
        borderRight: '1px solid',
        borderColor: 'divider',
        overflowY: 'auto',
        position: 'relative',
        flex: 1,
        overflow: 'auto',
        borderBottom: 2,
        borderBottomColor: 'LightGray'
      }}
    >
      <SubMessagesPaneHeader myself={myself} chat={chat} setIsSubChatVisible={setIsSubChatVisible} />

      <Box sx={{ px: 0.3, py: 0.5 }}>
        <Virtuoso
          ref={virtuosoRef}
          className="custom-scrollbar"
          style={{ height: listHeight }}
          totalCount={chatMessages.length}
          initialTopMostItemIndex={chatMessages.length - 1}
          atTopThreshold={64}
          atTopStateChange={handleAtTop}
          atBottomThreshold={128}
          atBottomStateChange={handleAtBottom}
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
                    chat={chat}
                    socket={socket}
                    {...message}
                    setIsRightSideVisible={setIsRightSideVisible}
                    setCurrentThreadChat={setCurrentThreadChat}
                  />
                </Stack>
              </div>

            );
          }
          }
        />
      </Box>
      <Box sx={{ px: 0.5, py: 0 }}>
        <div className="md-content">
          <MarkdownEditor myself={myself}
            socket={socket}
            chat={chat}
            messageContent={content}
            setContent={setContent}
            setCurrentChat={setCurrentSubChat} />
        </div>
      </Box>
    </Sheet>
  );
}
