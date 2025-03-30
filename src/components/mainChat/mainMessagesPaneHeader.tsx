import Avatar from '@mui/joy/Avatar';
import Button from '@mui/joy/Button';
import Chip from '@mui/joy/Chip';
import IconButton from '@mui/joy/IconButton';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import CircleIcon from '@mui/icons-material/Circle';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import GroupsIcon from '@mui/icons-material/Groups';
import CancelIcon from '@mui/icons-material/Cancel';
import { ChatProps, UserProps } from '../../types';

type MessagesPaneHeaderProps = {
  myself: UserProps;
  chat: ChatProps;
  subChat: ChatProps;
  setCurrentMainChat: (chat: ChatProps) => void;
  setCurrentSubChat: (chat: ChatProps) => void;
  isSubChatVisible: boolean;
  setIsSubChatVisible: (value: boolean) => void;
};

export default function MessagesPaneHeader(props: MessagesPaneHeaderProps) {
  const { myself,
    chat,
    subChat,
    setCurrentMainChat,
    setCurrentSubChat,
    isSubChatVisible,
    setIsSubChatVisible } = props;
  const isYou = myself.userId === chat.dmPartnerUserId;

  const switchSubToMain = () => {
    setCurrentMainChat(subChat)
    setIsSubChatVisible(false)
  }

  const swapChat = () => {
    setCurrentMainChat(subChat)
    setCurrentSubChat(chat)
  }

  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: 'space-between',
        py: { xs: 2, md: 2 },
        px: { xs: 1, md: 2 },
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.body',
        height: "60px"
      }}
    >
      <Stack
        direction="row"
        spacing={{ xs: 1, md: 2 }}
        sx={{ alignItems: 'center' }}
      >

        <div>
          {chat.isDm ? (
            <Avatar src={chat.CGAvatarImgPath} />
          ) : (
            <Avatar >
              <GroupsIcon sx={{ fontSize: 32 }} />
            </Avatar>
          )}
        </div>
        <div>
          <Typography
            component="h2"
            noWrap
            endDecorator={
              chat.isDm ? (
                <Chip
                  variant="outlined"
                  size="sm"
                  color="neutral"
                  sx={{ borderRadius: 'sm' }}
                  startDecorator={
                    <CircleIcon sx={{ fontSize: 8 }} color="success" />
                  }
                  slotProps={{ root: { component: 'span' } }}
                >
                  Online
                </Chip>
              ) : undefined
            }
            sx={{ fontWeight: 'lg', fontSize: 'lg' }}
          >
            {isYou ? `${chat.chatName} (you)` : chat.chatName}
          </Typography>
        </div>
      </Stack>
      <Stack spacing={1} direction="row" sx={{ alignItems: 'center' }}>
        <Button
          component='a'
          startDecorator={<PhoneInTalkRoundedIcon />}
          color="neutral"
          variant="outlined"
          size="sm"
          sx={{ display: { xs: 'none', md: 'inline-flex' } }}
        >
          Call
        </Button>
        {isSubChatVisible
          ? <div>
            <IconButton
              component='a'
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => swapChat()}>
              <SwapVertIcon />
            </IconButton>
            <IconButton
              component='a'
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => switchSubToMain()}>
              <CancelIcon />
            </IconButton>
          </div>
          : ""
        }
        <IconButton
          component='a'
          size="sm"
          variant="plain"
          color="neutral">
          <MoreVertRoundedIcon />
        </IconButton>
      </Stack>
    </Stack>
  );
}
