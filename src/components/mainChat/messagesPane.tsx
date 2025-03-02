import * as React from 'react';
import { useState, useEffect, useRef } from "react";
import Box from '@mui/joy/Box';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import ChatBubble from '../chatCommon/chatBubble';
import MessageInput from '../chatCommon/messageInput';
import { Socket } from "socket.io-client";
import MessagesPaneHeader from './messagesPaneHeader';
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
import "../../tests/Md.css";
import { MarkdownEditor } from "../markdownEditor/MarkdownEditor";

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
  setCurrentMainChat: (chat: ChatProps) => void;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsRightSideVisible: (value: boolean) => void;
  isSubChatVisible: boolean;
};

export default function MessagesPane(props: MessagesPaneProps) {
  const { chat,
    myself,
    socket,
    setCurrentMainChat,
    setCurrentThreadChat,
    setIsRightSideVisible,
    isSubChatVisible } = props;
  const [chatMessages, setChatMessages] = React.useState(chat.messages);

  const [content, setContent] = useState("");


  React.useEffect(() => {
    setChatMessages(chat.messages);
  }, [chat.messages]);


  const listRef = useRef<List | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(window.innerHeight - 310);
  const [containerWidth, setContainerWidth] = useState<number>(window.innerWidth);

  // useEffect(() => {
  //   if (isSubChatVisible) {
  //     setListHeight(window.innerHeight - 955)
  //   } else {
  //     setListHeight(window.innerHeight - 310)
  //   }

  // },[isSubChatVisible])

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
        // This is very very important to set the height of the message bubble !!!!!!!
        const currentHeight: number = containerRef.current.clientHeight
        setListHeight(currentHeight - 310) 
      }
    };

    updateHeight(); // Initial height
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [chat, isSubChatVisible]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(chatMessages.length - 1, "end"); // ✅ Scroll to latest message
    }
  }, [chatMessages.length, isSubChatVisible]);

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

  // useEffect(() => {
  // }, [messageHeights])

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
      ref={containerRef}
      sx={{
        height: { xs: 'calc(100dvh - var(--Header-height))', md: '100dvh' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.level1',
        flex: 1,
        overflow: 'hidden'
      }}
    >
      <MessagesPaneHeader myself={myself} chat={chat} />

      <Box
        sx={{ px: 0.5, py: 0.5 }}
      >
        <List
          ref={listRef}
          height={listHeight} // Dynamically updated height of chat bubble
          itemCount={chatMessages.length}
          itemSize={getItemSize} // Use the pre-calculated height array
          width="100%"
          className="custom-scrollbar"
        >
          {({ index, style }) => {
            const message = chatMessages[index];
            const isYou = message.sender.userName === myself.userName;

            return (
              <div style={style} >
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

      </Box>
      <Box sx={{ px: 0.5, py: 0 }}>
        <div className="md-content">
          <MarkdownEditor myself={myself}
            socket={socket}
            chat={chat}
            messageContent={content}
            setContent={setContent}
            setCurrentMainChat={setCurrentMainChat} />
        </div>
      </Box>
    </Sheet >
  );
}
