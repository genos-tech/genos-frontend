import * as React from 'react';
import { useState, useEffect, useRef } from "react";
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import ThreadBubble from './threadBubble';
import { Socket } from "socket.io-client";
import ThreadPaneHeader from './threadPaneHeader';
import {
  UserProps,
  ThreadProps
} from '../../types';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { MarkdownEditor } from "../markdownEditor/threadMdEditor";

type MessagesPaneProps = {
  thread: ThreadProps;
  myself: UserProps;
  socket: Socket;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsThreadVisible: (value: boolean) => void;
  currentThreadChatEmail: string;
  setIsTaskContentVisible: (value: boolean) => void;
};



export default function ThreadPane(props: MessagesPaneProps) {
  const { thread,
    myself,
    socket,
    setCurrentThreadChat,
    setIsThreadVisible,
    currentThreadChatEmail,
    setIsTaskContentVisible } = props;
  const [threadMessages, setThreadMessages] = React.useState(thread.messages || []);
  const [content, setContent] = useState("");

  React.useEffect(() => {
    setThreadMessages(thread.messages || []);
  }, [thread.messages]);

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
  }, [thread])

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
  }, [currentThreadChatEmail])

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
    <Sheet
      ref={containerRef}
      sx={{
        height: { xs: 'calc(100dvh - var(--Header-height))', md: '100dvh' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.body',
      }}
    >
      <ThreadPaneHeader
        myself={myself}
        thread={thread}
        setCurrentThreadChat={setCurrentThreadChat}
        setIsThreadVisible={setIsThreadVisible}
        setIsTaskContentVisible={setIsTaskContentVisible} />

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
          atBottomStateChange={handleAtBottom}
          itemContent={(index) => {
            const message = threadMessages[index];
            const isYou = message.sender.userName === myself.userName;
            return (
              <div>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ flexDirection: isYou ? "row-reverse" : "row", paddingY: 2, paddingX: 0.5 }}
                >
                  <ThreadBubble
                    variant={isYou ? 'sent' : 'received'}
                    {...message} />
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
            thread={thread}
            messageContent={content}
            setContent={setContent}
            setCurrentThreadChat={setCurrentThreadChat} />
        </div>
      </Box>

    </Sheet>
  );
}
