import {
  Tooltip,
  Stack,
  Typography,
  IconButton,
  Avatar,
} from '@mui/joy';
import CancelIcon from '@mui/icons-material/Cancel';
import ReplyIcon from '@mui/icons-material/Reply';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { ThreadProps, UserProps } from '../../types';

type MessagesPaneHeaderProps = {
  myself: UserProps;
  thread: ThreadProps;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsThreadVisible: (value: boolean) => void;
  setIsTaskContentVisible: (value: boolean) => void;
  setIsOpeningTask: (value: boolean) => void;
  setIsCreatingTask: (value: boolean) => void;
};


export default function ThreadPaneHeader(props: MessagesPaneHeaderProps) {
  const { myself,
    thread,
    setCurrentThreadChat,
    setIsThreadVisible,
    setIsTaskContentVisible,
    setIsOpeningTask,
    setIsCreatingTask } = props;
  const isYou = myself.userId === thread.dmPartnerUserId;

  const dummyThreadChat: ThreadProps = {
    chatId: thread.chatId,
    chatName: thread.chatName,
    threadId: thread.threadId,
    isDm: thread.isDm,
    dmPartnerUserId: thread.dmPartnerUserId,
    taskId: thread.taskId,
    unread: false,
    messages: [],
    TSLastMessage: thread.TSLastMessage,
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
        spacing={{ xs: 1, md: 1 }}
        sx={{ alignItems: 'center' }}
      >

        <Avatar sx={{ backgroundColor: 'transparent' }}>
          <ReplyIcon sx={{ fontSize: 30 }} />
        </Avatar>

        <div>
          <Typography
            component="h2"
            noWrap
            sx={{ fontWeight: 'lg', fontSize: 'lg' }}
          >
            {isYou ? `${thread?.chatName} (you)` : thread?.chatName}
          </Typography>

        </div>
      </Stack>

      <Stack spacing={1} direction="row" sx={{ alignItems: 'center' }}>
        {/* {thread.taskId === null && (
          <>
            <Tooltip title="Create Task" size='sm'>
              <IconButton
                component='a'
                size="md"
                variant="plain"
                color="neutral"
                onClick={() => {
                  setIsTaskContentVisible(true)
                  setIsCreatingTask(true)
                }}
              >
                <PlaylistAddIcon />
              </IconButton>
            </Tooltip>
          </>
        )}

        {thread.taskId !== null && (
          <>
            <Tooltip title="Open Task" size='sm'>
              <IconButton
                component='a'
                size="md"
                variant="plain"
                color="neutral"
                onClick={() => {
                  setIsTaskContentVisible(true)
                  setIsOpeningTask(true)
                }
                }
              >
                <MenuOpenIcon />
              </IconButton>
            </Tooltip>
          </>
        )} */}

        <Tooltip title="Create Task" size='sm'>
          <IconButton
            component='a'
            size="md"
            variant="plain"
            color="neutral"
            onClick={() => {
              setIsTaskContentVisible(true)
              setIsCreatingTask(true)
            }}
          >
            <PlaylistAddIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Open Task" size='sm'>
          <IconButton
            component='a'
            size="md"
            variant="plain"
            color="neutral"
            onClick={() => {
              setIsTaskContentVisible(true)
              setIsOpeningTask(true)
            }
            }
          >
            <MenuOpenIcon />
          </IconButton>
        </Tooltip>

        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={() => {
            setIsThreadVisible(false);
            setIsTaskContentVisible(false);
            setCurrentThreadChat(dummyThreadChat);
          }
          }
        >
          <CancelIcon />
        </IconButton>
      </Stack>

    </Stack>
  );
}
