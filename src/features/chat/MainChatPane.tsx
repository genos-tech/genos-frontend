import { useState, useEffect, useRef } from "react";
import { Box, Sheet, Stack } from '@mui/joy';
import { Socket } from "socket.io-client";
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

import { MessageBubble } from './components/bubbles/MessageBubble';
import { MainChatPaneHeader } from './components/headers/MainChatPaneHeader';
import {
  useScrollToBottomOnNewMessage,
  useScrollToBottomOnChatChange
} from './hooks/messageBubbleHooks';
import { handleFileDrop } from "./services/handleFileDrop";
import { handleAtTop } from "./services/handleBubblePositionAction";
import { BnEditor } from '../../components/blockNote/bnEditor'
import { UserProps } from '../../types/admin';
import { ChatProps, ThreadProps } from '../../types/chat';
import { TaskProps } from '../../types/tasks';

type MessagesPaneProps = {
  currentWindowHeight: number;
  paneSizePCT: number;
  chat: ChatProps;
  subChat: ChatProps;
  myself: UserProps;
  socket: Socket | null;
  setCurrentMainChat: (chat: ChatProps) => void;
  setCurrentSubChat: (chat: ChatProps) => void;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsThreadVisible: (value: boolean) => void;
  isSubChatVisible: boolean;
  setIsSubChatVisible: (value: boolean) => void;
  currentMainChatId: number;
  setCurrentPreviewTask: (value: TaskProps | undefined) => void;
  setOpeningService: (value: number) => void;
};

export const MessagesPane = (props: MessagesPaneProps) => {
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
    setCurrentPreviewTask,
    setOpeningService } = props;
  const [chatMessages, setChatMessages] = useState(chat.messages);

  useEffect(() => {
    setChatMessages(chat.messages);
  }, [chat.messages]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null)

  useScrollToBottomOnNewMessage(virtuosoRef as React.RefObject<VirtuosoHandle>, chat);
  useScrollToBottomOnChatChange(virtuosoRef as React.RefObject<VirtuosoHandle>, currentMainChatId);

  return (
    <div
      onDrop={handleFileDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <Sheet sx={{ backgroundColor: 'background.surface' }}>
        <MainChatPaneHeader
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
                    <MessageBubble
                      myself={myself}
                      variant={isYou ? "sent" : "received"}
                      chat={chat}
                      socket={socket}
                      {...message}
                      setIsThreadVisible={setIsThreadVisible}
                      setCurrentThreadChat={setCurrentThreadChat}
                      setCurrentPreviewTask={setCurrentPreviewTask}
                      setOpeningService={setOpeningService}
                      setCurrentMainChat={setCurrentMainChat}
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
