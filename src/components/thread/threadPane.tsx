import * as React from 'react';
import { useState, useEffect, useRef } from "react";
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import ThreadBubble from './threadBubble';
import ThreadMessageInput from './threadMessageInput';
import { Socket } from "socket.io-client";
import ThreadPaneHeader from './threadPaneHeader';
import {
  UserProps,
  ThreadMessageProps,
  ThreadProps
} from '../../types';
import { VariableSizeList as List } from "react-window";
import InsertDMThreadMessageWorker from "../../workers/insertDMThreadMessageWorker.ts?worker";
import InsertGMThreadMessageWorker from "../../workers/insertGMThreadMessageWorker.ts?worker";

function getCurrentTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

type MessagesPaneProps = {
  thread: ThreadProps;
  myself: UserProps;
  socket: Socket;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsRightSideVisible: (value: boolean) => void;
};

const insertDMThreadMessage = async (newDMThreadMessage: ThreadMessageProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertDMThreadMessageWorker = new InsertDMThreadMessageWorker();
    insertDMThreadMessageWorker.postMessage({ dmThreadMessage: newDMThreadMessage });
    insertDMThreadMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertDMThreadMessageWorker.terminate();
    };
    insertDMThreadMessageWorker.onerror = (error) => {
      reject(error);
      insertDMThreadMessageWorker.terminate();
    };
  });
};

const insertGMThreadMessage = async (newGMThreadMessage: ThreadMessageProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertGMThreadMessageWorker = new InsertGMThreadMessageWorker();
    insertGMThreadMessageWorker.postMessage({ gmThreadMessage: newGMThreadMessage });
    insertGMThreadMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertGMThreadMessageWorker.terminate();
    };
    insertGMThreadMessageWorker.onerror = (error) => {
      reject(error);
      insertGMThreadMessageWorker.terminate();
    };
  });
};

export default function ThreadPane(props: MessagesPaneProps) {
  const { thread,
    myself,
    socket,
    setCurrentThreadChat,
    setIsRightSideVisible } = props;
  const [threadMessages, setThreadMessages] = React.useState(thread.messages || []);

  React.useEffect(() => {
    setThreadMessages(thread.messages || []);
  }, [thread.messages]);


  ////////////////////////////////////////////////////////////////////
  const listRef = useRef<List | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(window.innerHeight - 200);
  const [containerWidth, setContainerWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry.contentRect) {
          if (containerWidth === 0) {
            setContainerWidth(entry.contentRect.width);
          }
          else if (entry.contentRect.width > 400
            && Math.abs(containerWidth - entry.contentRect.width) > 100) {
            setContainerWidth(entry.contentRect.width);
          }
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [containerWidth]); // Add containerWidth as a dependency

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setListHeight(window.innerHeight - 210); // ✅ Get wrapper div height
      }
    };
    updateHeight(); // Initial height
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [thread]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(threadMessages.length - 1, "end"); // ✅ Scroll to latest message
    }
  }, [threadMessages.length]);

  // Calculate the height for each message based on its content
  const calculateMessageHeights = () => {
    return threadMessages.map(message => {
      const baseHeight = 90; // Base height for the message
      const extraHeightPerLine = 20; // Extra height per line of text
      const messageLength = message.content.length;

      const charactersPerLine = Math.max(Math.floor(containerWidth / 13), 1);
      // const lines = Math.ceil(messageLength / charactersPerLine);
      const lines = Math.ceil(messageLength / (Math.max((containerWidth / 16), 1)));
      return baseHeight + lines * extraHeightPerLine;
    });
  };

  // Pre-calculate heights for all messages
  const initMessageHeights = calculateMessageHeights()
  const [messageHeights, setMessageHeights] = useState<number[]>(calculateMessageHeights());

  useEffect(() => {
    const newHeights = calculateMessageHeights()
    setMessageHeights(newHeights);
  }, [containerWidth])

  const getItemSize = (index: number) => {
    var itemSizes: number[] = []
    if (initMessageHeights.length === messageHeights.length) {
      itemSizes = messageHeights;
    } else {
      itemSizes = initMessageHeights;
    }
    const size = itemSizes.at(index)
    if (typeof size === 'undefined') {
      return 120
    } else {
      return size
    }
  }
  ////////////////////////////////////////////////////////////////////

  return (
    <Sheet
      sx={{
        height: { xs: 'calc(100dvh - var(--Header-height))', md: '100dvh' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.level3',
      }}
    >
      <ThreadPaneHeader myself={myself} thread={thread} setCurrentThreadChat={setCurrentThreadChat} setIsRightSideVisible={setIsRightSideVisible} />

      <Box
        sx={{
          display: 'flex',
          minHeight: 0,
          px: 1,
          py: 1,
        }}
      >
        <div ref={containerRef} style={{ overflow: 'hidden', width: '100%' }}>
          <List
            ref={listRef}
            height={listHeight} // Dynamically updated height
            itemCount={threadMessages.length}
            itemSize={getItemSize} // Use the pre-calculated height array
            width="100%"
            className="thread-custom-scrollbar"
          >
            {({ index, style }) => {
              const message = threadMessages[index];
              const isYou = message.sender.userName === myself.userName;

              return (
                <div style={style}>
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{ flexDirection: isYou ? "row-reverse" : "row" }}
                  >
                    <ThreadBubble
                      variant={isYou ? 'sent' : 'received'}
                      {...message} />
                  </Stack>
                </div>
              );
            }}
          </List>
        </div>

      </Box>

      <Box sx={{ px: 0.3, pb: 0.5 }}>
        <ThreadMessageInput
          onSubmit={(messageContent: string) => {
            if (messageContent.trim()) {
              socket.emit("thread_message", {
                isInit: false,
                rootMessageTSSent: "",
                threadId: thread.threadId,
                threadMessage: messageContent,
                isDm: thread.isDm,
                senderEmail: myself.userEmail,
                senderName: myself.userName,
                destCGName: thread.chatName,
                destCGEmail: thread.chatEmail
              }, (ack: any) => {

                const updatedChat: ThreadProps = {
                  chatName: thread.chatName,
                  chatEmail: thread.chatEmail,
                  threadId: thread.threadId,
                  isDm: thread.isDm,
                  unread: false,
                  messages: [...thread.messages, {
                    messageIdWithChatEmailAndThreadId: `${thread.chatEmail}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                    threadId: thread.threadId,
                    messageId: String(Number(thread.messages.length) + 1),
                    chatEmail: thread.chatEmail,
                    content: messageContent,
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                  }],
                  TSLastMessage: getCurrentTimestamp(),
                };
                setCurrentThreadChat(updatedChat);

                const newThreadMessage: ThreadMessageProps = {
                  messageIdWithChatEmailAndThreadId: `${thread.chatEmail}-${thread.threadId}-${String(Number(thread.messages.length) + 1)}`,
                  threadId: thread.threadId,
                  messageId: String(Number(thread.messages.length) + 1),
                  chatEmail: thread.chatEmail,
                  content: messageContent,
                  sender: myself,
                  tsSent: getCurrentTimestamp(),
                };

                if (thread.isDm) {
                  insertDMThreadMessage(newThreadMessage);
                } else {
                  insertGMThreadMessage(newThreadMessage);
                }

                // TODO: Dynamically update the num of replies in the message pane.
                // if (currentMainChat.chatEmail === thread.chatEmail) {
                // } else if (currentSubChat.chatEmail === thread.chatEmail) {
                // }

              });
            }
          }}
        />
      </Box>

    </Sheet>
  );
}
