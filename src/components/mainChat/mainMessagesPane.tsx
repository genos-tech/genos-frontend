import { useState, useEffect, useRef } from "react";
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import ChatBubble from '../chatCommon/chatBubble';
import { Socket } from "socket.io-client";
import MessagesPaneHeader from './mainMessagesPaneHeader';
import {
  ChatProps,
  UserProps,
  ThreadProps,
  PreviewTaskProps
} from '../../types';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { useColorScheme } from '@mui/joy/styles';
import BnEditor from '../../components/richTextEditor/bnEditor'

type MessagesPaneProps = {
  currentWindowHeight: number;
  paneSizePCT: number;
  chat: ChatProps;
  subChat: ChatProps;
  myself: UserProps;
  socket: Socket;
  setCurrentMainChat: (chat: ChatProps) => void;
  setCurrentSubChat: (chat: ChatProps) => void;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsThreadVisible: (value: boolean) => void;
  isSubChatVisible: boolean;
  setIsSubChatVisible: (value: boolean) => void;
  currentMainChatId: number;
  setCurrentPreviewTask: (value: PreviewTaskProps | undefined) => void;
};

export default function MessagesPane(props: MessagesPaneProps) {
  const {
    currentWindowHeight,
    paneSizePCT,
    chat,
    subChat,
    myself,
    socket,
    setCurrentMainChat,
    setCurrentSubChat,
    setCurrentThreadChat,
    setIsThreadVisible,
    isSubChatVisible,
    setIsSubChatVisible,
    currentMainChatId,
    setCurrentPreviewTask } = props;
  const [chatMessages, setChatMessages] = useState(chat.messages);

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
      }, 200) // wait 200ms
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
      }, 300) // wait 300ms
    }
  }, [currentMainChatId])

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

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFiles = (selectedFiles: File[]) => {
    selectedFiles.forEach((file) => {
      const fileType = file.type;
      if (fileType === "image/jpeg" || fileType === "image/png") {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            const img = new Image();
            img.src = e.target.result as string;
            img.onload = () => {
              console.log("uploaded image:", img.src)
            }
          }
        };
        reader.readAsDataURL(file);
      } else {
        const fileURL = URL.createObjectURL(file);
      }
    });
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <Sheet sx={{ backgroundColor: 'background.surface' }}>
        <MessagesPaneHeader
          myself={myself}
          chat={chat}
          subChat={subChat}
          setCurrentMainChat={setCurrentMainChat}
          setCurrentSubChat={setCurrentSubChat}
          isSubChatVisible={isSubChatVisible}
          setIsSubChatVisible={setIsSubChatVisible}
        />
        <Box sx={{ px: 0.3, my: 0.2 }}>
          <Virtuoso
            ref={virtuosoRef}
            className="custom-scrollbar"
            style={{
              height: isSubChatVisible
                ? currentWindowHeight * paneSizePCT * 0.01 - 270
                : currentWindowHeight - 270
            }}
            totalCount={chatMessages.length}
            initialTopMostItemIndex={chatMessages.length - 1}
            atTopThreshold={64}
            atTopStateChange={handleAtTop}
            atBottomThreshold={128}
            atBottomStateChange={handleAtBottom}
            itemContent={(index) => {
              const message = chatMessages[index];
              const isYou = myself.userId === message.sender.userId;
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
                      setIsThreadVisible={setIsThreadVisible}
                      setCurrentThreadChat={setCurrentThreadChat}
                      setCurrentPreviewTask={setCurrentPreviewTask}
                    />
                  </Stack>
                </div>
              );
            }}
          />
        </Box>
        <Box sx={{ paddingLeft: 1, paddingRight: 1 }}>
          <BnEditor
            myself={myself}
            socket={socket}
            chat={chat}
            setCurrentChat={setCurrentMainChat}
          />
        </Box>
      </Sheet >
    </div>
  );
}
