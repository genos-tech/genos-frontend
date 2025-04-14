import { alpha } from '@mui/system';
import {
  Tooltip,
  Stack,
  Typography,
  IconButton,
} from '@mui/joy';
import Chip from '@mui/joy/Chip';
import CancelIcon from '@mui/icons-material/Cancel';
import ReplyIcon from '@mui/icons-material/Reply';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import { ThreadProps, UserProps, PreviewTaskProps } from '../../types';

type MessagesPaneHeaderProps = {
  myself: UserProps;
  thread: ThreadProps;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsThreadVisible: (value: boolean) => void;
  setIsTaskContentVisible: (value: boolean) => void;
  setIsOpeningTask: (value: boolean) => void;
  setIsCreatingTask: (value: boolean) => void;
  currentPreviewTask?: PreviewTaskProps;
};


export default function ThreadPaneHeader(props: MessagesPaneHeaderProps) {
  const { myself,
    thread,
    setCurrentThreadChat,
    setIsThreadVisible,
    setIsTaskContentVisible,
    setIsOpeningTask,
    setIsCreatingTask,
    currentPreviewTask } = props;
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

        <Chip
          size="lg"
          variant="solid"
          color="neutral"
          startDecorator={<ReplyIcon />}
          sx={{ borderRadius: '4px' }}
        >
          Thread
        </Chip>

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
        {((currentPreviewTask === undefined) || (currentPreviewTask && currentPreviewTask.id === "null")) && (
          <>
            <Tooltip title="New Task" size='sm'>
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

        {currentPreviewTask && currentPreviewTask.id !== "null" && (
          <>
            <Tooltip title="Open Task" size='sm'>
              <IconButton
                component='button'
                size="sm"
                variant="soft"
                color="neutral"
                onClick={() => {
                  setIsTaskContentVisible(true)
                  setIsOpeningTask(true)
                }}
                sx={{ pl: '3px', pr: '5px' }}
              >
                <AssignmentRoundedIcon />
                <Chip
                  key={currentPreviewTask.status.status}
                  size="sm"
                  variant="soft"
                  sx={{
                    backgroundColor: alpha(currentPreviewTask.status.color, 0.80),
                    color: currentPreviewTask.status.textColor,
                    fontWeight: 'bold',
                    ml: '5px'
                  }}
                >
                  {currentPreviewTask.status.status}
                </Chip>
              </IconButton>
            </Tooltip>
          </>
        )}

        <Tooltip title="Close Thread" size='sm'>
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
        </Tooltip>
      </Stack>

    </Stack>
  );
}
