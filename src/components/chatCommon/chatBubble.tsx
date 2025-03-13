import * as React from 'react';
import Avatar from '@mui/joy/Avatar';
import Tooltip from '@mui/joy/Tooltip';
import Box from '@mui/joy/Box';
import IconButton from '@mui/joy/IconButton';
import Button from '@mui/joy/Button';
import Stack from '@mui/joy/Stack';
import Sheet from '@mui/joy/Sheet';
import { Socket } from "socket.io-client";
import Typography from '@mui/joy/Typography';
import CircleIcon from '@mui/icons-material/Circle';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ReplyIcon from '@mui/icons-material/Reply';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import AvatarWithStatus from '../utils/avatarWithStatus';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { useColorScheme } from '@mui/joy/styles';
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
  setIsThreadVisible: (value: boolean) => void;
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
    numReplies,
    setIsThreadVisible,
    setCurrentThreadChat } = props;
  const isSent = variant === 'sent';
  const [isLiked, setIsLiked] = React.useState<boolean>(false);
  const _tsSent = extractHHMM(tsSent)
  const { mode } = useColorScheme();

  return (
    <Box
      sx={{
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
                              color: 'background.body',
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
                      <Tooltip title="Reply" size='sm'>
                        <IconButton
                          component='a'
                          sx={{ '&:hover': { backgroundColor: 'transparent' } }}
                          onClick={() => {
                            // Show thread pane on the right side.
                            setIsThreadVisible(true);

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
                          <ReplyIcon sx={{ fontSize: 20, color: isSent ? 'background.body' : 'neutral.plainColor' }} />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        component='a'
                        size="sm"
                        onClick={() => setIsLiked((prevState) => !prevState)}
                        sx={{
                          backgroundColor: "transparent", // No background
                          outline: "none", // No focus outline
                          padding: 0, // Remove extra space
                          "&:hover": { backgroundColor: "transparent" }, // No hover effect
                          "&:focus, &:focusVisible": { outline: "none", boxShadow: "none" }, // No focus effect
                          "&:active": { transform: "none" }, // Prevents click animation (scaling effect)
                          transition: "none", // No color fade animation
                        }}
                      >
                        {isLiked ? (
                          <FavoriteIcon sx={{ color: "#FF0000", transition: "none" }} /> // Red when liked
                        ) : (
                          <FavoriteBorderIcon sx={{ color: "#888888", transition: "none" }} /> // Gray when not liked
                        )}
                      </IconButton>
                    </Box>
                  </Stack>
                </Box>
              </Stack>

              <MarkdownPreview
                className="markdown-preview"
                source={content}
                style={{
                  backgroundColor: 'transparent',
                  padding: 1,
                  color: mode === 'dark'
                    ? (isSent ? 'black' : 'white')
                    : (isSent ? 'white' : 'black')
                }}
              />
            </Stack>


            {(numReplies > 0)
              ? <Stack
                direction="row"
                sx={{
                  justifyContent: isSent ? "flex-end" : "flex-start",
                  position: "absolute",
                  p: 0.5,
                  width: '100%',
                  overflow: "hidden", // Prevents unwanted scrollbar
                  left: 0, // Ensures full-width alignment
                }}
              >
                <Button
                  component='a'
                  size="sm"
                  variant="plain" // Removes background & border
                  onClick={() => {
                    // Show thread pane on the right side.
                    setIsThreadVisible(true);

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
                  }}
                  sx={{
                    backgroundColor: "transparent",
                    marginLeft: "auto", // Push to right
                    padding: "2px 6px", // Reduce padding for a compact look
                    minWidth: "auto", // Removes default button width
                    fontSize: "12px", // Makes text smaller
                    textTransform: "none", // Prevents uppercase text
                    "&:hover": {
                      backgroundColor: "transparent",
                      color: "transparent",
                      fontWeight: "bold"
                    },
                  }}
                >
                  {/* TODO: read/unread for thread replies */}
                  {(numReplies == 1)
                    ? <Box sx={{ color: 'neutral.plainColor' }}>
                      <CircleIcon sx={{ fontSize: 10 }} color="success" />
                      &nbsp;
                      {numReplies} reply
                    </Box>
                    : <Box sx={{ color: 'neutral.plainColor' }}>
                      {numReplies} replies
                    </Box>
                  }
                </Button>
              </Stack>
              : ""
            }
          </Sheet >
        </Box >
      )}
    </Box >
  );
}
