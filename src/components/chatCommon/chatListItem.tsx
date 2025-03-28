import * as React from 'react';
import Box from '@mui/joy/Box';
import Tooltip from '@mui/joy/Tooltip';
import ListDivider from '@mui/joy/ListDivider';
import ListItem from '@mui/joy/ListItem';
import ListItemButton, { ListItemButtonProps } from '@mui/joy/ListItemButton';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import CircleIcon from '@mui/icons-material/Circle';
import GroupsIcon from '@mui/icons-material/Groups';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Avatar from '@mui/joy/Avatar';
import AvatarWithStatus from '../utils/avatarWithStatus';
import {
  MessageProps,
  AllChatProps,
  ChatProps,
  UserProps
} from '../../types';
import { toggleMessagesPane } from '../../utils';
import { IconButton } from '@mui/joy';
import FetchSpecificDMMessagesWorker from "../../workers/fetchSpecificDMMessagesWorker.ts?worker";
import FetchSpecificGMMessagesWorker from "../../workers/fetchSpecificGMMessagesWorker.ts?worker";

type ChatListItemProps = ListItemButtonProps & {
  chat: AllChatProps;
  myself: UserProps;
  currentMainChat: ChatProps;
  currentSubChat: ChatProps;
  setCurrentMainChat: (chat: ChatProps) => void;
  setCurrentSubChat: (chat: ChatProps) => void;
  isSubChatVisible: boolean;
  setIsSubChatVisible: (value: boolean) => void;
};

function extractHHMM(ts: string) {
  if (ts !== undefined) {
    return ts.slice(5, 16);
  } else {
    return ""
  }
}

function _FetchSpecificDMMessagesWorker(chatEmail: string): Promise<MessageProps[]> {
  return new Promise((resolve, reject) => {
    const fetchSpecificDMMessagesWorker = new FetchSpecificDMMessagesWorker();

    fetchSpecificDMMessagesWorker.postMessage({ chatEmail });

    fetchSpecificDMMessagesWorker.onmessage = (event) => {
      resolve(event.data);
      fetchSpecificDMMessagesWorker.terminate(); // Clean up the worker
    };

    fetchSpecificDMMessagesWorker.onerror = (error) => {
      reject(error);
      fetchSpecificDMMessagesWorker.terminate(); // Ensure cleanup on error
    };
  });
}

function _FetchSpecificGMMessagesWorker(chatEmail: string): Promise<MessageProps[]> {
  return new Promise((resolve, reject) => {
    const fetchSpecificGMMessagesWorker = new FetchSpecificGMMessagesWorker();

    fetchSpecificGMMessagesWorker.postMessage({ chatEmail });

    fetchSpecificGMMessagesWorker.onmessage = (event) => {
      resolve(event.data);
      fetchSpecificGMMessagesWorker.terminate(); // Clean up the worker
    };

    fetchSpecificGMMessagesWorker.onerror = (error) => {
      reject(error);
      fetchSpecificGMMessagesWorker.terminate(); // Ensure cleanup on error
    };
  });
}

export default function ChatListItem(props: ChatListItemProps) {
  const { chat,
    myself,
    currentMainChat,
    currentSubChat,
    setCurrentMainChat,
    setCurrentSubChat,
    isSubChatVisible,
    setIsSubChatVisible } = props;
  const selected = currentMainChat.chatName === chat.chatName || (isSubChatVisible && currentSubChat.chatName === chat.chatName);
  const isYou = myself.userEmail === chat.chatEmail;

  const always_online: boolean = true; // TODO: need to get status from WS

  const onClickHandler = () => {
    if (isSubChatVisible === false || currentSubChat.chatEmail !== chat.chatEmail) {
      toggleMessagesPane();
      chat.unread = Boolean(false);
      if (chat.isDm) {
        _FetchSpecificDMMessagesWorker(chat.chatEmail)
          .then((messages) => {
            const newMessages: ChatProps = {
              chatName: chat.chatName,
              chatEmail: chat.chatEmail,
              isDm: chat.isDm,
              unread: false,
              messages: messages,
              latestMessage: messages[messages.length - 1],
              TSLastMessage: chat.TSLastMessage
            }
            console.log("newMessages:",newMessages)
            setCurrentMainChat(newMessages);
          })
          .catch((error) => console.error(error));
      } else {
        _FetchSpecificGMMessagesWorker(chat.chatEmail)
          .then((messages) => {
            const newMessages: ChatProps = {
              chatName: chat.chatName,
              chatEmail: chat.chatEmail,
              isDm: chat.isDm,
              unread: false,
              messages: messages,
              latestMessage: messages[messages.length - 1],
              TSLastMessage: chat.TSLastMessage
            }
            console.log("newMessages:",newMessages)
            setCurrentMainChat(newMessages);
          })
          .catch((error) => console.error(error));
      }
    }
  };

  const splitOpenHandler = () => {
    if (currentMainChat.chatEmail !== chat.chatEmail) {
      toggleMessagesPane();
      if (chat.isDm) {
        _FetchSpecificDMMessagesWorker(chat.chatEmail)
          .then((messages) => {
            const newMessages: ChatProps = {
              chatName: chat.chatName,
              chatEmail: chat.chatEmail,
              isDm: chat.isDm,
              unread: false,
              messages: messages,
              latestMessage: messages[messages.length - 1],
              TSLastMessage: chat.TSLastMessage
            }
            setCurrentSubChat(newMessages);
          })
          .catch((error) => console.error(error));
      } else {
        _FetchSpecificGMMessagesWorker(chat.chatEmail)
          .then((messages) => {
            const newMessages: ChatProps = {
              chatName: chat.chatName,
              chatEmail: chat.chatEmail,
              isDm: chat.isDm,
              unread: false,
              messages: messages,
              latestMessage: messages[messages.length - 1],
              TSLastMessage: chat.TSLastMessage
            }
            setCurrentSubChat(newMessages);
          })
          .catch((error) => console.error(error));
      }
      setIsSubChatVisible(true)
    }
  };

  var tsSent: string = ""
  if (chat.latestMessage === undefined) {
    tsSent = "N/A"
  } else {
    tsSent = extractHHMM(chat.latestMessage.tsSent)
  }

  return (
    <React.Fragment>
      <ListItem>
        <ListItemButton
          onClick={onClickHandler}
          selected={selected}
          color="neutral"
          sx={{ flexDirection: 'column', alignItems: 'initial', gap: 1 }}
        >
          <Stack direction="column">
            <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1}>
                <div>
                  {chat.isDm ? (
                    <AvatarWithStatus size="sm" online={always_online} src="" />
                  ) : (
                    <Avatar size="md">
                      <GroupsIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                  )}
                </div>
                <Box>
                  <Typography noWrap level="title-sm">
                    {isYou ? `${chat.chatName} (me)` : chat.chatName}
                  </Typography>
                </Box>
              </Stack>

              {/* Right-aligned content */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography
                  level="body-xs"
                  noWrap
                  sx={{ display: { xs: "none", md: "block" } }}
                >
                  {tsSent}
                </Typography>
                {chat.unread && <CircleIcon sx={{ fontSize: 12 }} color="primary" />}
                <Tooltip title="Split View " size="sm">
                  <IconButton
                    component="a"
                    onClick={(event) => {
                      event.stopPropagation(); // Stop the click from reaching ListItemButton
                      splitOpenHandler(); // Call the intended function
                    }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            <Box sx={{ lineHeight: 0, textAlign: 'right' }}>
              <Typography
                level="body-sm"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {chat.latestMessage?.content}
              </Typography>
            </Box>
          </Stack>
        </ListItemButton>
      </ListItem>
      <ListDivider sx={{ margin: 0 }} />
    </React.Fragment>
  );
}
