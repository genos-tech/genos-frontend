import * as React from 'react';
import { useState, useEffect, useRef } from "react";
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import ChatBubble from '../chatCommon/chatBubble';
import MessageInput from '../chatCommon/messageInput';
import { Socket } from "socket.io-client";
import SubMessagesPaneHeader from './subMessagesPaneHeader';
import {
  ChatProps,
  UserProps,
  AllChatProps,
  ThreadProps
} from '../../types';
import { VariableSizeList as List } from "react-window";
import InsertDMChatWorker from "../../workers/insertDMChatWorker.ts?worker";
import InsertDMMessageWorker from "../../workers/insertDMMessageWorker.ts?worker";
import InsertGMChatWorker from "../../workers/insertGMChatWorker.ts?worker";
import InsertGMMessageWorker from "../../workers/insertGMMessageWorker.ts?worker";

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


const insertDMChatAndMessage = async (newDMChat: AllChatProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertDMMessageWorker = new InsertDMMessageWorker();
    insertDMMessageWorker.postMessage({ dmMessage: newDMChat.latestMessage });
    insertDMMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertDMMessageWorker.terminate();
    };
    insertDMMessageWorker.onerror = (error) => {
      reject(error);
      insertDMMessageWorker.terminate();
    };

    const insertDMChatWorker = new InsertDMChatWorker();
    insertDMChatWorker.postMessage({ dmChat: newDMChat });
    insertDMChatWorker.onmessage = (event) => {
      resolve(event.data);
      insertDMChatWorker.terminate();
    };
    insertDMChatWorker.onerror = (error) => {
      reject(error);
      insertDMChatWorker.terminate();
    };
  });
};

const insertGMChatAndMessage = async (newGMChat: AllChatProps): Promise<string> => {
  return new Promise((resolve, reject) => {
    const insertGMMessageWorker = new InsertGMMessageWorker();
    insertGMMessageWorker.postMessage({ gmMessage: newGMChat.latestMessage });
    insertGMMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertGMMessageWorker.terminate();
    };
    insertGMMessageWorker.onerror = (error) => {
      reject(error);
      insertGMMessageWorker.terminate();
    };

    const insertGMChatWorker = new InsertGMChatWorker();
    insertGMChatWorker.postMessage({ gmChat: newGMChat });
    insertGMChatWorker.onmessage = (event) => {
      resolve(event.data);
      insertGMChatWorker.terminate();
    };
    insertGMChatWorker.onerror = (error) => {
      reject(error);
      insertGMChatWorker.terminate();
    };
  });
};

type MessagesPaneProps = {
  chat: ChatProps;
  myself: UserProps;
  socket: Socket;
  setCurrentSubChat: (chat: ChatProps) => void;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsSubChatVisible: (value: boolean) => void;
  setIsRightSideVisible: (value: boolean) => void;
};

export default function MessagesSubPane(props: MessagesPaneProps) {
  const { chat,
    myself,
    socket,
    setCurrentSubChat,
    setCurrentThreadChat,
    setIsSubChatVisible,
    setIsRightSideVisible } = props;
  const [chatMessages, setChatMessages] = React.useState(chat.messages);

  // console.log("subChat:", chat)

  React.useEffect(() => {
    setChatMessages(chat.messages);
  }, [chat.messages]);


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
        setListHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight(); // Initial height
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [chat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(chatMessages.length - 1, "end"); // ✅ Scroll to latest message
    }
  }, [chatMessages.length]);

  // Calculate the height for each message based on its content
  const calculateMessageHeights = () => {
    return chatMessages.map(message => {
      const baseHeight = 105; // Base height for the message
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

  return (
    <Sheet
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

      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          px: 1.0,
          py: 1.0,
        }}
      >
        <div ref={containerRef} style={{ overflow: 'hidden', width: '100%' }}>
          <List
            ref={listRef}
            height={listHeight} // Dynamically updated height
            itemCount={chatMessages.length}
            itemSize={getItemSize} // Use the pre-calculated height array
            width="100%"
            className="custom-scrollbar"
          >
            {({ index, style }) => {
              const message = chatMessages[index];
              const isYou = message.sender.userName === myself.userName;

              return (
                <div
                  style={style}
                > {/* Apply virtualization styles */}
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{ flexDirection: isYou ? "row-reverse" : "row" }}
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
            }}
          </List>
        </div>
      </Box>

      <Box sx={{ px: 0.3, pb: 0.5 }}>
        <MessageInput
          onSubmit={(messageContent: string) => {
            if (messageContent.trim()) {
              socket.emit("message", {
                message: messageContent,
                destCGName: chat.chatName,
                destCGEmail: chat.chatEmail,
                isDm: chat.isDm,
              }, (ack: any) => {

                const updatedChat: ChatProps = {
                  chatName: chat.chatName,
                  chatEmail: chat.chatEmail,
                  isDm: chat.isDm,
                  unread: false,
                  messages: [...chat.messages, {
                    messageIdWithChatEmail: `${chat.chatEmail}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                    messageId: String(Number(chat.latestMessage?.messageId) + 1),
                    chatEmail: chat.chatEmail,
                    content: messageContent,
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                    numReplies: 0,
                  }],
                  latestMessage: {
                    messageIdWithChatEmail: `${chat.chatEmail}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                    messageId: String(Number(chat.latestMessage?.messageId) + 1),
                    chatEmail: chat.chatEmail,
                    content: messageContent,
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                    numReplies: 0,
                  },
                  TSLastMessage: getCurrentTimestamp(),
                };
                setCurrentSubChat(updatedChat);

                const newChat: AllChatProps = {
                  chatName: chat.chatName,
                  chatEmail: chat.chatEmail,
                  isDm: chat.isDm,
                  unread: false,
                  latestMessage: {
                    messageIdWithChatEmail: `${chat.chatEmail}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                    messageId: String(Number(chat.latestMessage?.messageId) + 1),
                    chatEmail: chat.chatEmail,
                    content: messageContent,
                    sender: myself,
                    tsSent: getCurrentTimestamp(),
                    numReplies: 0,
                  },
                  TSLastMessage: getCurrentTimestamp(),
                }
                if (chat.isDm) {
                  insertDMChatAndMessage(newChat)
                } else {
                  insertGMChatAndMessage(newChat)
                }
              });
            }
          }}
        />
      </Box>
    </Sheet>
  );
}
