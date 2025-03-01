import { useState } from "react";
import {
  Tooltip,
  Alert,
  Stack,
  Typography,
  IconButton,
  Modal,
  ModalDialog,
  Button,
  Input,
  Avatar,
} from '@mui/joy';
import CancelIcon from '@mui/icons-material/Cancel';
import ReplyIcon from '@mui/icons-material/Reply';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { ThreadProps, UserProps } from '../../types';

type MessagesPaneHeaderProps = {
  myself: UserProps;
  thread: ThreadProps;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsRightSideVisible: (value: boolean) => void;
};


export default function ThreadPaneHeader(props: MessagesPaneHeaderProps) {
  const { myself, thread, setCurrentThreadChat, setIsRightSideVisible } = props;
  const isYou = myself.userEmail === thread?.chatEmail;

  // Modal configs
  const [CreateTaskErrorMessage, setCreateTaskErrorMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [taskTitle, setTskTitle] = useState("");
  const handleCreateGroup = () => {
    if (taskTitle.trim()) {
      setOpen(false);
      setTskTitle(taskTitle);
    }
  };

  const dummyThreadChat: ThreadProps = {
    chatName: thread.chatName,
    chatEmail: thread.chatEmail,
    threadId: thread.threadId,
    isDm: thread.isDm,
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
            {isYou ? `${thread?.chatName} (me)` : thread?.chatName}
          </Typography>

          <Typography
            level="body-sm"
            sx={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '300px'
            }}
          >
            {thread?.chatEmail}
          </Typography>

        </div>
      </Stack>

      <Stack spacing={1} direction="row" sx={{ alignItems: 'center' }}>
        <Tooltip title="Create Task" size='sm'>
          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            onClick={() => setOpen(true)}
          >
            <PlaylistAddIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Close Thread" size='sm'>
          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            onClick={() => {
              setIsRightSideVisible(false);
              setCurrentThreadChat(dummyThreadChat);
            }
            }
          >
            <CancelIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Modal for creating a new chat group */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog>
          <Typography level="h4">Create New Task</Typography>
          <Input
            placeholder="Enter task title"
            value={taskTitle}
            onChange={(e) => setTskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && taskTitle.trim()) {
                handleCreateGroup();
              }
            }}
            sx={{ mt: 1 }}
          />
          {CreateTaskErrorMessage && CreateTaskErrorMessage !== "" && (
            <Alert color="danger">{CreateTaskErrorMessage}</Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!taskTitle.trim()}>
              Create
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>


    </Stack>
  );
}
