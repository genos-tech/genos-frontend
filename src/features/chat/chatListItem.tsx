import * as React from 'react';
import {
  Avatar,
  Box,
  Tooltip,
  ListDivider,
  ListItem,
  Stack,
  Typography,
  IconButton
} from '@mui/joy';
import ListItemButton, { ListItemButtonProps } from '@mui/joy/ListItemButton';
import CircleIcon from '@mui/icons-material/Circle';
import GroupsIcon from '@mui/icons-material/Groups';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { popDMSpecificMessages } from "./services/popDMSpecificMessages";
import { popGMSpecificMessages } from "./services/popGMSpecificMessages";
import AvatarWithStatus from '../../components/utils/avatarWithStatus';
import { AllChatProps, ChatProps, UserProps } from '../../types/types';
import { toggleMessagesPane } from '../../utils';
import { extractMMDDHHMM } from '../../components/utils/getTime';

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
  const isYou = myself.userId === chat.dmPartnerUserId;

  const always_online: boolean = true; // TODO: need to get status from WS

  const defineNewMessages = (messages: any) => {
    const newMessages: ChatProps = {
      chatId: chat.chatId,
      chatName: chat.chatName,
      isDm: chat.isDm,
      dmPartnerUserId: chat.dmPartnerUserId,
      unread: false,
      messages: messages,
      latestMessage: messages[messages.length - 1],
      latestMessageText: messages[messages.length - 1].contentText,
      TSLastMessage: chat.TSLastMessage
    }
    return newMessages
  }

  const onClickHandler = () => {
    if (isSubChatVisible === false
      || (`${currentSubChat.chatId}-${currentSubChat.chatName}` !== `${chat.chatId}-${chat.chatName}`)) {
      toggleMessagesPane();
      chat.unread = Boolean(false);
      if (chat.isDm) {
        popDMSpecificMessages(chat.chatId)
          .then((messages) => {
            setCurrentMainChat(defineNewMessages(messages));
          })
          .catch((error) => console.error(error));
      } else {
        popGMSpecificMessages(chat.chatId)
          .then((messages) => {
            setCurrentMainChat(defineNewMessages(messages));
          })
          .catch((error) => console.error(error));
      }
    }
  };

  const splitOpenHandler = () => {
    if (`${currentMainChat.chatId}-${currentMainChat.chatName}` !== `${chat.chatId}-${chat.chatName}`) {
      toggleMessagesPane();
      if (chat.isDm) {
        popDMSpecificMessages(chat.chatId)
          .then((messages) => {
            setCurrentSubChat(defineNewMessages(messages));
          })
          .catch((error) => console.error(error));
      } else {
        popGMSpecificMessages(chat.chatId)
          .then((messages) => {
            setCurrentSubChat(defineNewMessages(messages));
          })
          .catch((error) => console.error(error));
      }
      setIsSubChatVisible(true)
    }
  };

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
                    <AvatarWithStatus size="sm" chatName={chat.chatName} online={always_online} src="" />
                  ) : (
                    <Avatar size="md">
                      <GroupsIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                  )}
                </div>
                <Box>
                  <Typography noWrap level="title-sm">
                    {isYou ? `${chat.chatName} (you)` : chat.chatName}
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
                  {chat.latestMessage ? extractMMDDHHMM(chat.latestMessage.tsSent) : ""}
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
                {chat.latestMessageText}
              </Typography>
            </Box>
          </Stack>
        </ListItemButton>
      </ListItem>
      <ListDivider sx={{ margin: 0 }} />
    </React.Fragment>
  );
}
