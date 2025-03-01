import * as React from 'react';
import Avatar from '@mui/joy/Avatar';
import Tooltip from '@mui/joy/Tooltip';
import Box from '@mui/joy/Box';
import IconButton from '@mui/joy/IconButton';
import Stack from '@mui/joy/Stack';
import Sheet from '@mui/joy/Sheet';
import { Socket } from "socket.io-client";
import Typography from '@mui/joy/Typography';
import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ReplyIcon from '@mui/icons-material/Reply';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import AvatarWithStatus from '../utils/avatarWithStatus';
import {
  UserProps,
  ChatProps,
  MessageProps,
  ThreadProps,
  ThreadMessageProps
} from '../../types';
import InsertDMThreadMessageWorker from "../../workers/insertDMThreadMessageWorker.ts?worker";
import InsertGMThreadMessageWorker from "../../workers/insertGMThreadMessageWorker.ts?worker";
import FetchSpecificDMThreadMessagesWorker from "../../workers/fetchSpecificDMThreadMessagesWorker.ts?worker";
import FetchSpecificGMThreadMessagesWorker from "../../workers/fetchSpecificGMThreadMessagesWorker.ts?worker";

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

type ChatBubbleProps = MessageProps & {
  myself: UserProps;
  variant: 'sent' | 'received';
  chat: ChatProps;
  socket: Socket;
  setIsRightSideVisible: (value: boolean) => void;
  setCurrentThreadChat: (chat: ThreadProps) => void;
};

function extractHHMM(ts: string) {
  return ts.split(' ')[1].slice(0, 5);
}


const insertDMThreadMessage = async (
  threadName: string,
  newDMThreadMessage: ThreadMessageProps,
  setCurrentThreadChat: (chat: ThreadProps) => void
): Promise<string> => {

  return new Promise((resolve, reject) => {
    // Insert the initial thread message (insert even if it already exists)
    const insertDMThreadMessageWorker = new InsertDMThreadMessageWorker();
    insertDMThreadMessageWorker.postMessage({ dmThreadMessage: newDMThreadMessage });
    insertDMThreadMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertDMThreadMessageWorker.terminate();

      // Fetch DM thread messages (new message and previous messages if exist)
      const fetchSpecificDMThreadMessagesWorker = new FetchSpecificDMThreadMessagesWorker();
      fetchSpecificDMThreadMessagesWorker.postMessage({
        chatEmail: newDMThreadMessage.chatEmail,
        threadId: newDMThreadMessage.threadId,
      });
      fetchSpecificDMThreadMessagesWorker.onmessage = (event) => {
        const fetchedMessages: ThreadMessageProps[] = event.data;
        if (fetchedMessages !== undefined) {
          // set up states for thread
          const newThread: ThreadProps = {
            chatName: threadName,
            chatEmail: newDMThreadMessage.chatEmail,
            threadId: newDMThreadMessage.threadId,
            isDm: true,
            unread: false,
            messages: fetchedMessages,
            TSLastMessage: getCurrentTimestamp(),
          };
          setCurrentThreadChat(newThread)
        } else {
          console.error("Failed to fetch thread DM fetchedMessages:", fetchedMessages)
        }
        resolve(event.data);
        fetchSpecificDMThreadMessagesWorker.terminate();
      };
      fetchSpecificDMThreadMessagesWorker.onerror = (error) => {
        reject(error);
        fetchSpecificDMThreadMessagesWorker.terminate();
      };
    };
    insertDMThreadMessageWorker.onerror = (error) => {
      reject(error);
      insertDMThreadMessageWorker.terminate();
    };
  });
};

const insertGMThreadMessage = async (
  threadName: string,
  newGMThreadMessage: ThreadMessageProps,
  setCurrentThreadChat: (chat: ThreadProps) => void
): Promise<string> => {

  return new Promise((resolve, reject) => {
    // Insert the initial thread message (insert even if it already exists)
    const insertGMThreadMessageWorker = new InsertGMThreadMessageWorker();
    insertGMThreadMessageWorker.postMessage({ gmThreadMessage: newGMThreadMessage });
    insertGMThreadMessageWorker.onmessage = (event) => {
      resolve(event.data);
      insertGMThreadMessageWorker.terminate();

      // Fetch GM thread messages (new message and previous messages if exist)
      const fetchSpecificGMThreadMessagesWorker = new FetchSpecificGMThreadMessagesWorker();
      fetchSpecificGMThreadMessagesWorker.postMessage({
        chatEmail: newGMThreadMessage.chatEmail,
        threadId: newGMThreadMessage.threadId,
      });
      fetchSpecificGMThreadMessagesWorker.onmessage = (event) => {
        const fetchedMessages: ThreadMessageProps[] = event.data;
        if (fetchedMessages !== undefined) {
          // set up states for thread
          const newThread: ThreadProps = {
            chatName: threadName,
            chatEmail: newGMThreadMessage.chatEmail,
            threadId: newGMThreadMessage.threadId,
            isDm: false,
            unread: false,
            messages: fetchedMessages,
            TSLastMessage: getCurrentTimestamp(),
          };
          setCurrentThreadChat(newThread)
        } else {
          console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages)
        }
        resolve(event.data);
        fetchSpecificGMThreadMessagesWorker.terminate();
      };
      fetchSpecificGMThreadMessagesWorker.onerror = (error) => {
        reject(error);
        fetchSpecificGMThreadMessagesWorker.terminate();
      };
    };
    insertGMThreadMessageWorker.onerror = (error) => {
      reject(error);
      insertGMThreadMessageWorker.terminate();
    };
  });
};


export default function ChatBubble(props: ChatBubbleProps) {
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
    setIsRightSideVisible,
    setCurrentThreadChat } = props;
  const isSent = variant === 'sent';
  const [isLiked, setIsLiked] = React.useState<boolean>(false);
  const [isCelebrated, setIsCelebrated] = React.useState<boolean>(false);

  const _tsSent = extractHHMM(tsSent)

  return (
    <Box sx={{
      maxWidth: '90%',
      minWidth: 'auto',
      whiteSpace: 'normal',
      wordBreak: 'break-word'
    }}>

      {attachment ? (
        <Sheet
          variant="outlined"
          sx={[
            {
              px: 1.75,
              py: 1.25,
              borderRadius: 'lg',
            },
            isSent ? { borderTopRightRadius: 0 } : { borderTopRightRadius: 'lg' },
            isSent ? { borderTopLeftRadius: 'lg' } : { borderTopLeftRadius: 0 },
          ]}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar color="primary" size="lg">
              <InsertDriveFileRoundedIcon />
            </Avatar>
            <div>
              <Typography sx={{ fontSize: 'sm' }}>{attachment.fileName}</Typography>
              <Typography level="body-sm">{attachment.size}</Typography>
            </div>
          </Stack>
        </Sheet>
      ) : (
        <Box
          sx={{ position: 'relative' }}
        >
          <Sheet
            color={isSent ? 'primary' : 'neutral'}
            variant={isSent ? 'solid' : 'soft'}
            sx={[
              {
                p: 1.25,
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
                  backgroundColor: 'var(--joy-palette-primary-solidBg)',
                }
                : {
                  backgroundColor: 'background.body',
                },
            ]}
          >

            <Stack direction="row" spacing={1.5}>
              <Box sx={{ flex: 1 }}>
                <AvatarWithStatus
                  online={sender.online}
                  src={sender.avatarImgPath}
                />
              </Box>
              <Box sx={{ flex: 20 }}>

                <Stack direction="row" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      level="body-xs"
                      sx={[
                        {
                          lineHeight: 2
                        },
                        isSent
                          ? {
                            color: 'var(--joy-palette-common-white)',
                          }
                          : {
                            color: 'var(--joy-palette-text-primary)',
                          },
                      ]}
                    >
                      {sender.userName} &nbsp;  {_tsSent}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: 'right' }}>
                    <Tooltip title="Reply in thread" size='sm'>
                      <IconButton
                        sx={{ '&:hover': { backgroundColor: 'transparent' } }}
                        onClick={() => {
                          // Show thread pane on the right side.
                          setIsRightSideVisible(true);

                          socket.emit("thread_message", {
                            isInit: true,
                            rootMessageTSSent: tsSent,
                            threadId: messageId,
                            threadMessage: content,
                            isDm: chat.isDm,
                            senderEmail: myself.userEmail,
                            senderName: myself.userName,
                            destCGName: chat.chatName,
                            destCGEmail: chat.chatEmail
                          }, (ack: any) => {

                            const newThreadMessage: ThreadMessageProps = {
                              messageIdWithChatEmailAndThreadId: `${chat.chatEmail}-${messageId}-1`,
                              threadId: messageId,
                              messageId: '1',
                              chatEmail: chat.chatEmail,
                              content: content,
                              sender: myself,
                              tsSent: getCurrentTimestamp(),
                            };

                            if (chat.isDm) {
                              insertDMThreadMessage(chat.chatName, newThreadMessage, setCurrentThreadChat);
                            } else {
                              insertGMThreadMessage(chat.chatName, newThreadMessage, setCurrentThreadChat);
                            }
                          });

                        }
                        }>
                        <ReplyIcon sx={{ fontSize: 20, color: isSent ? '#fff' : 'primary' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                </Stack>

                <Typography
                  level="body-sm"
                  sx={[
                    {
                      lineHeight: 2
                    },
                    isSent
                      ? {
                        color: 'var(--joy-palette-common-white)',
                      }
                      : {
                        color: 'var(--joy-palette-text-primary)',
                      },
                  ]}
                >
                  {content}
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction="row"
              sx={{
                justifyContent: isSent ? 'flex-end' : 'flex-start',
                position: 'absolute',
                p: 1.3,
              }}
            >
              <Box>
                <IconButton
                  variant={isLiked ? 'soft' : 'plain'}
                  color={isLiked ? 'danger' : 'neutral'}
                  size="sm"
                  onClick={() => setIsLiked((prevState) => !prevState)}
                >
                  {isLiked ? '❤️' : <FavoriteBorderIcon />}
                </IconButton>
                <IconButton
                  variant={isCelebrated ? 'soft' : 'plain'}
                  color={isCelebrated ? 'warning' : 'neutral'}
                  size="sm"
                  onClick={() => setIsCelebrated((prevState) => !prevState)}
                >
                  {isCelebrated ? '🎉' : <CelebrationOutlinedIcon />}
                </IconButton>
              </Box>

            </Stack>

          </Sheet >
        </Box >
      )
      }
    </Box >
  );
}
