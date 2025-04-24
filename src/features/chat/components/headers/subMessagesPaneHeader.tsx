import SwapVertIcon from '@mui/icons-material/SwapVert';
import { Button, IconButton, Stack } from '@mui/joy';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import CancelIcon from '@mui/icons-material/Cancel';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';

import { HeaderUserName } from './HeaderUserName';
import { ChatProps, UserProps } from '../../../../types/types';

type MessagesPaneHeaderProps = {
  myself: UserProps;
  chat: ChatProps;
  subChat: ChatProps;
  setCurrentMainChat: (chat: ChatProps) => void;
  setCurrentSubChat: (chat: ChatProps) => void;
  setIsSubChatVisible: (value: boolean) => void;
};

export const SubMessagesPaneHeader = (props: MessagesPaneHeaderProps) => {
  const { myself,
    chat,
    subChat,
    setCurrentMainChat,
    setCurrentSubChat,
    setIsSubChatVisible } = props;
  const isYou = myself.userId === subChat.dmPartnerUserId;

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
        <HeaderUserName chat={subChat} isYou={isYou} />
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

        <div>
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
            onClick={() => setIsSubChatVisible(false)}>
            <CancelIcon />
          </IconButton>
        </div>

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
