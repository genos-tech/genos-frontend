import * as React from 'react';
import { Box, Stack, Sheet } from '@mui/joy';
import { Socket } from "socket.io-client";

import { BubbleAttachmentSheet } from './BubbleAttachmentSheet';
import { BubbleReactionButton } from "./BubbleReactionButton";
import { BubbleUserName } from "./BubbleUserName";
import { ThreadMessageProps, ThreadProps } from '../../../../types/chat';
import { AvatarWithStatus } from '../../../../components/utils/avatarWithStatus';
import { extractHHMM } from '../../../../utils/dateUtils';
import { BnPreview } from '../../../../components/blockNote/bnPreview';
import { UserProps } from '../../../../types/admin';
import { ChatProps } from '../../../../types/chat';

type threadMessageBubbleProps = ThreadMessageProps & {
  myself: UserProps;
  socket: Socket | null;
  thread: ThreadProps;
  variant: 'sent' | 'received';
  setOpeningService: (service: number) => void;
  setCurrentMainChat: (chat: ChatProps) => void;
};

export const ThreadMessageBubble = (props: threadMessageBubbleProps) => {
  const {
    myself,
    socket,
    thread,
    variant,
    content,
    tsSent,
    attachment = undefined,
    sender,
    setOpeningService,
    setCurrentMainChat,
  } = props;
  const isSent = variant === 'sent';
  const [isLiked, setIsLiked] = React.useState<boolean>(false);
  const _tsSent = extractHHMM(tsSent)

  return (
    <Box sx={{
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
            color={isSent ? 'primary' : 'neutral'}
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
                    thread={thread}
                    online={sender.online}
                    setOpeningService={setOpeningService}
                    setCurrentMainChat={setCurrentMainChat}
                  />
                </Box>
                <Box sx={{ flex: 20 }}>
                  <Stack direction="row" spacing={2}>
                    <BubbleUserName
                      userName={sender.userName}
                      isSent={isSent}
                      tsSent={_tsSent}
                    />
                    <BubbleReactionButton
                      isLiked={isLiked}
                      setIsLiked={setIsLiked}
                      isSent={isSent}
                    />
                  </Stack>
                </Box>
              </Stack>

              {content.length > 0
                && <BnPreview
                  key={`${thread.chatId}-${thread.threadId}-${thread.isDm}-${tsSent}`}
                  content={content}
                  isSent={isSent}
                />}

            </Stack>
          </Sheet>
        </Box>
      )}
    </Box>
  );
}
