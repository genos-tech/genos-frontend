import { useState, useEffect, useRef } from "react";
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import ChatBubble from './chatBubble';
import { Socket } from "socket.io-client";
import SubMessagesPaneHeader from './subMessagesPaneHeader';
import {
  ChatProps,
  UserProps,
  ThreadProps,
  PreviewTaskProps
} from '../../types/types';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { useColorScheme } from '@mui/joy/styles';
import BnEditor from '../../components/richTextEditor/bnEditor'


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
  currentSubChatId: number;
  setCurrentPreviewTask: (value: PreviewTaskProps | undefined) => void;
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
    currentSubChatId,
    setCurrentPreviewTask } = props;
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
  }, [currentSubChatId])

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
              console.log("uploaded image:", img.baseURI)
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
                      chat={subChat}
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
        <Box sx={{ paddingBottom: 1, paddingLeft: 1, paddingRight: 1 }}>
          <BnEditor
            myself={myself}
            socket={socket}
            chat={subChat}
            setCurrentChat={setCurrentSubChat}
          />
        </Box>
      </Sheet>
    </div>
  );
}
