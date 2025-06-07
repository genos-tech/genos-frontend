import * as React from 'react';
import { Box, Stack, Sheet } from '@mui/joy';
import { Socket } from "socket.io-client";

import { addThreadMessage } from "../../services/addThreadMessage";
import { popSpecificThreadMessages } from "../../services/popSpecificThreadMessages";
import { BubbleReactionButton } from "./BubbleReactionButton";
import { BubbleUserName } from "./BubbleUserName";
import { BubbleReplyButton } from "./BubbleReplyButton";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { loadSpecificTaskByThreadId } from '../../../tasks/services/loadSpecificTaskByThreadId';
import { extractHHMM, getCurrentTimestamp } from "../../../../utils/dateUtils";
import { UserProps } from '../../../../types/admin';
import {
  ChatProps,
  MessageProps,
  ThreadProps,
  ThreadMessageProps
} from '../../../../types/chat';
import { TaskProps } from '../../../../types/tasks';
import { useAuth } from "../../../../context/AuthContext";
import { BnPreview } from '../../../../components/blockNote/bnPreview';
import { AvatarWithStatus } from '../../../../components/utils/avatarWithStatus';

type MessageBubbleProps = MessageProps & {
  myself: UserProps;
  variant: 'sent' | 'received';
  chat: ChatProps;
  socket: Socket | null;
  setIsThreadVisible: (value: boolean) => void;
  setCurrentThreadChat: (value: ThreadProps) => void;
  setCurrentPreviewTask: (value: TaskProps | undefined) => void;
  setOpeningService: (service: number) => void;
  setCurrentMainChat: (chat: ChatProps) => void;
};

export const MessageBubble = (props: MessageBubbleProps) => {
  const {
    myself,
    variant,
    chat,
    socket,
    content,
    messageId,
    tsSent,
    attachment = undefined,
    sender,
    numReplies,
    setIsThreadVisible,
    setCurrentThreadChat,
    setCurrentPreviewTask,
    setOpeningService,
    setCurrentMainChat,
  } = props;
  const isSent = variant === 'sent';
  const [isLiked, setIsLiked] = React.useState<boolean>(false);
  const _tsSent = extractHHMM(tsSent)
  const { accessToken } = useAuth();

  // Load the thread task if exists
  const loadTask = (threadId: number) => {
    (async () => {
      const chatType: string = (chat.isDm) ? "dm" : "gm"
      const loadedTask: TaskProps[] = await loadSpecificTaskByThreadId(
        myself, chatType, chat.chatId, threadId, accessToken
      );

      if (loadedTask.length > 0) {
        setCurrentPreviewTask(loadedTask[0]);
      } else {
        setCurrentPreviewTask(undefined)
      }

    })();
  };

  const replayHandler = () => {
    loadTask(messageId);

    // Show thread pane on the right side.
    setIsThreadVisible(true);

    if (socket !== null) {
      socket.emit("thread_message", {
        isInit: true,
        rootMessageTSSent: tsSent,
        threadId: messageId,
        threadMessage: content,
        isDm: chat.isDm,
        dmPartnerUserId: chat.isDm ? chat.dmPartnerUserId : null,
        senderId: myself.userId,
        senderName: myself.userName,
        destCGName: chat.chatName,
        destCGId: chat.chatId,
      }, async (ack: any) => {

        const newThreadMessage: ThreadMessageProps = {
          messageIdWithChatIdAndThreadId: `${chat.chatId}-${messageId}-1`,
          chatId: chat.chatId,
          threadId: messageId,
          messageId: 1,
          content: content,
          contentText: "Need to add",
          sender: myself,
          taskId: null,
          tsSent: getCurrentTimestamp(),
        };

        if (newThreadMessage) {
          if (chat.isDm) {
            await addThreadMessage(newThreadMessage, chat.isDm);
            const threadMessages: ThreadMessageProps[] = await popSpecificThreadMessages(
              newThreadMessage.chatId, newThreadMessage.threadId, chat.isDm
            )
            if (threadMessages) {
              const newThread: ThreadProps = {
                chatId: newThreadMessage.chatId,
                chatName: chat.chatName,
                threadId: newThreadMessage.threadId,
                isDm: true,
                dmPartnerUserId: chat.dmPartnerUserId,
                taskId: null,
                unread: false,
                messages: threadMessages,
                TSLastMessage: getCurrentTimestamp(),
              };
              if (newThread) {
                setCurrentThreadChat(newThread)
              }
            }
          } else {
            await addThreadMessage(newThreadMessage, chat.isDm);
            const threadMessages: ThreadMessageProps[] = await popSpecificThreadMessages(
              newThreadMessage.chatId, newThreadMessage.threadId, chat.isDm
            )
            if (threadMessages) {
              const newThread: ThreadProps = {
                chatId: newThreadMessage.chatId,
                chatName: chat.chatName,
                threadId: newThreadMessage.threadId,
                isDm: false,
                dmPartnerUserId: null,
                taskId: null,
                unread: false,
                messages: threadMessages,
                TSLastMessage: getCurrentTimestamp(),
              };
              if (newThread) {
                setCurrentThreadChat(newThread)
              }
            }
          }

        }
      });
    }
  }


  return (
    <Box
      sx={{
        maxWidth: '90%',
        minWidth: 'auto',
        whiteSpace: 'normal',
        wordBreak: 'break-word'
      }}>

      {attachment ? (
        <BubbleAttachmentSheet
          fileName={attachment.fileName}
          fileSize={attachment.size}
          isSent={isSent}
        />
      ) : (
        <Box
          sx={{ position: 'relative' }}
        >
          <Sheet
            color={isSent ? 'neutral' : 'neutral'}
            variant={isSent ? 'solid' : 'soft'}
            sx={[
              {
                p: 1,
                borderRadius: 'lg',
              },
              isSent
                ? {
                  borderTopRightRadius: 0,
                }
                : {
                  borderTopRightRadius: 'lg',
                },
              isSent
                ? {
                  borderTopLeftRadius: 'lg',
                }
                : {
                  borderTopLeftRadius: 0,
                },
              isSent
                ? {
                  backgroundColor: 'neutral.plainColor',
                }
                : {
                  backgroundColor: 'neutral.outlinedBorder',
                },
            ]}
          >

            <Stack direction="column" spacing={1.5}>
              <Stack direction="row" spacing={1.5}>
                <Box sx={{ flex: 1 }}>
                  <AvatarWithStatus
                    myself={myself}
                    socket={socket}
                    chat={chat}
                    online={sender.online}
                    setOpeningService={setOpeningService}
                    setCurrentMainChat={setCurrentMainChat}
                  />
                </Box>
                <Box sx={{ flex: 20 }}>
                  <Stack direction="row" spacing={1}>
                    <BubbleUserName
                      userName={sender.userName}
                      isSent={isSent}
                      tsSent={_tsSent}
                    />
                    <BubbleReactionButton
                      isLiked={isLiked}
                      setIsLiked={setIsLiked}
                      isSent={isSent}
                      replayHandler={replayHandler}
                    />
                  </Stack>
                </Box>
              </Stack>

              {content.length > 0
                && <BnPreview
                  key={`${chat.chatId}-${messageId}-${chat.isDm}-${tsSent}`}
                  content={content}
                  isSent={isSent}
                />}

            </Stack>

            {(numReplies > 0)
              ? <BubbleReplyButton
                numReplies={numReplies}
                isSent={isSent}
                replayHandler={replayHandler}
              />
              : ""
            }
          </Sheet >
        </Box >
      )}
    </Box >
  );
}
