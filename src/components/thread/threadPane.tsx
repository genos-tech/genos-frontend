import * as React from 'react';
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

  return (
    <Sheet
      sx={{
        height: { xs: 'calc(100dvh - var(--Header-height))', md: '100dvh' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.level3',
      }}
    >
      <ThreadPaneHeader myself={myself} thread={thread} setIsRightSideVisible={setIsRightSideVisible} />

      <Box
        sx={{
          display: 'flex',
          minHeight: 0,
          px: 1,
          py: 5,
          overflowY: 'scroll',
          flexDirection: 'column-reverse',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(165, 165, 165, 0.5)',
            transition: 'opacity 0.3s ease-in-out',
          },
        }}
      >
        <Stack spacing={5} sx={{ justifyContent: 'flex-end' }}>

          {threadMessages.map((message: ThreadMessageProps, index: number) => {

            const isYou = message.sender.userName === myself.userName;

            return (
              <Stack
                key={index}
                direction="row"
                spacing={2}
                sx={{ flexDirection: isYou ? 'row-reverse' : 'row' }}
              >

                <ThreadBubble
                  variant={isYou ? 'sent' : 'received'}
                  {...message} />

              </Stack>
            );
          })}

        </Stack>
      </Box>

      <Box sx={{ px: 1, pb: 1 }}>
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
              });
            }
          }}
        />
      </Box>

    </Sheet>
  );
}
