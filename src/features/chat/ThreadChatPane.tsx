import { useState, useEffect, useRef } from "react";
import { Box, Sheet, Stack } from '@mui/joy';
import { Socket } from "socket.io-client";
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

import { ThreadMessageBubble } from './components/bubbles/ThreadMessageBubble';
import { ThreadChatPaneHeader } from './components/headers/ThreadChatPaneHeader';
import {
  useScrollToBottomOnNewMessage,
  useScrollToBottomOnChatChange
} from './hooks/messageBubbleHooks';
import { handleFileDrop } from "./services/handleFileDrop";
import { handleAtTop } from "./services/handleBubblePositionAction";
import { BnThreadEditor } from '../../components/blockNote/bnThreadEditor'
import { UserProps } from '../../types/admin';
import { ThreadProps } from '../../types/chat';
import { TaskProps } from '../../types/tasks';

type MessagesPaneProps = {
  thread: ThreadProps;
  myself: UserProps;
  socket: Socket | null;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsThreadVisible: (value: boolean) => void;
  currentThreadChatId: number;
  setIsTaskContentVisible: (value: boolean) => void;
  setIsOpeningTask: (value: boolean) => void;
  setIsCreatingTask: (value: boolean) => void;
  currentPreviewTask?: TaskProps;
};

export const ThreadPane = (props: MessagesPaneProps) => {
  const { thread,
    myself,
    socket,
    setCurrentThreadChat,
    setIsThreadVisible,
    currentThreadChatId,
    setIsTaskContentVisible,
    setIsOpeningTask,
    setIsCreatingTask,
    currentPreviewTask
  } = props;

  const [threadMessages, setThreadMessages] = useState(thread.messages || []);

  useEffect(() => {
    setThreadMessages(thread.messages || []);
  }, [thread.messages]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null)

  useScrollToBottomOnNewMessage(virtuosoRef as React.RefObject<VirtuosoHandle>, thread);
  useScrollToBottomOnChatChange(virtuosoRef as React.RefObject<VirtuosoHandle>, currentThreadChatId);

  // Calculate thread pane height dynamically
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(window.innerHeight - 270);
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        // This is very very important to set the height of the message bubble !!!!!!!
        const currentHeight: number = containerRef.current.clientHeight
        setListHeight(currentHeight - 270)
      }
    };

    updateHeight(); // Initial height
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [thread]);

  return (
    <>
      <div
        onDrop={handleFileDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <Sheet
          ref={containerRef}
          sx={{
            height: { xs: 'calc(100dvh - var(--Header-height))', md: '100dvh' },
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.body',
          }}
        >
          <ThreadChatPaneHeader
            myself={myself}
            thread={thread}
            setCurrentThreadChat={setCurrentThreadChat}
            setIsThreadVisible={setIsThreadVisible}
            setIsTaskContentVisible={setIsTaskContentVisible}
            setIsOpeningTask={setIsOpeningTask}
            setIsCreatingTask={setIsCreatingTask}
            currentPreviewTask={currentPreviewTask}
          />

          <Box sx={{ px: 0.3, my: 0.2 }}>
            <Virtuoso
              ref={virtuosoRef}
              className="custom-scrollbar"
              style={{ height: listHeight }}
              totalCount={threadMessages.length}
              initialTopMostItemIndex={threadMessages.length - 1}
              atTopThreshold={64}
              atTopStateChange={handleAtTop}
              atBottomThreshold={128}
              itemContent={(index) => {
                const message = threadMessages[index];
                const isYou = myself.userId === message.sender.userId;
                return (
                  <div>
                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{ flexDirection: isYou ? "row-reverse" : "row", paddingY: 2, paddingX: 0.5 }}
                    >
                      <ThreadMessageBubble
                        thread={thread}
                        variant={isYou ? 'sent' : 'received'}
                        {...message} />
                    </Stack>
                  </div>
                );
              }}
            />
          </Box>

          <Box sx={{ paddingLeft: 1, paddingRight: 1 }}>

            <BnThreadEditor
              myself={myself}
              socket={socket}
              thread={thread}
              setCurrentThreadChat={setCurrentThreadChat}
            />
          </Box>

        </Sheet>
      </div>
    </>
  );
}
