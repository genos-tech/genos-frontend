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
  Grid
} from '@mui/joy';
import Textarea from '@mui/joy/Textarea';
import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import CancelIcon from '@mui/icons-material/Cancel';
import ReplyIcon from '@mui/icons-material/Reply';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { ThreadProps, UserProps } from '../../types';
import GithubIcon from '../../assets/GithubIcon';
import CustomLinkIcon from '../../assets/CustomLinkIcon';
import { MarkdownEditor } from "../../components/markdownEditor/taskMdEditor";

// Temp data
import { taskContents } from '../tasks/sampleTaskContents';

type MessagesPaneHeaderProps = {
  myself: UserProps;
  thread: ThreadProps;
  setCurrentThreadChat: (chat: ThreadProps) => void;
  setIsThreadVisible: (value: boolean) => void;
  setIsTaskContentVisible: (value: boolean) => void;
};


export default function ThreadPaneHeader(props: MessagesPaneHeaderProps) {
  const { myself, thread, setCurrentThreadChat, setIsThreadVisible, setIsTaskContentVisible } = props;
  const isYou = myself.userEmail === thread?.chatEmail;

  const [taskContent, setTaskContent] = useState(taskContents.content);

  // Modal configs
  const [CreateTaskErrorMessage, setCreateTaskErrorMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const handleCreateGroup = () => {
    if (taskTitle.trim()) {
      setOpen(false);
      setTaskTitle(taskTitle);
    }
  };

  const dummyThreadChat: ThreadProps = {
    chatId: thread.chatId,
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
            component='a'
            size="md"
            variant="plain"
            color="neutral"
            onClick={() => setOpen(true)}
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

      {/* Modal for creating a new chat group */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog>
          <Typography level="h4">Create New Task</Typography>

          <Input
            placeholder="Enter task title"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            sx={{ width: '500px' }}
          />

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <List aria-labelledby="decorated-list-demo">
                  <Grid container spacing={2}>
                    <Grid key={1} xs={6}>
                      <ListItem>
                        Assignee: <Avatar size="sm"></Avatar>
                        <Textarea
                          name="Neutral"
                          variant="outlined"
                          color="neutral"
                          size="md"
                          sx={{ width: '150px' }}
                        />
                      </ListItem>
                    </Grid>
                    <Grid key={2} xs={6}>
                      <ListItem>
                        Reporter: <Avatar size="sm">{myself.userName[0]}</Avatar>
                        <Textarea
                          name="Neutral"
                          variant="plain"
                          color="neutral"
                          size="md"
                          defaultValue={myself.userName}
                          sx={{ width: '150px' }}
                        />
                      </ListItem>
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid key={1} xs={6}>
                      <ListItem>
                        Project: &nbsp;&nbsp;<Textarea
                          name="Neutral"
                          variant="outlined"
                          color="neutral"
                          size="md"
                          sx={{ width: '150px' }}
                        />
                      </ListItem>
                    </Grid>
                    <Grid key={2} xs={6}>
                      <ListItem>
                        Due date: <Input
                          type="date"
                          color="neutral"
                          variant="outlined"
                          slotProps={{
                            input: {
                              min: new Date().toISOString().split('T')[0]
                            },
                          }}
                        />
                      </ListItem>

                    </Grid>
                  </Grid>

                  <ListItem>
                    Tags: <Chip
                      variant="soft"
                      color="warning"
                      sx={{ cursor: "pointer" }}
                    >
                      DWH
                    </Chip>
                  </ListItem>

                  <ListItem>
                    <GithubIcon />
                    <Stack direction="row" spacing={1.5}>
                      <Input
                        key={'prTitle'}
                        size='sm'
                        placeholder="Enter PR Title"
                        sx={{ width: '150px', height: '30px' }}
                      />
                      <Input
                        key={'prUrl'}
                        size='sm'
                        placeholder="Enter PR URL"
                        type="url"
                        sx={{ width: '150px', height: '30px' }}
                      />
                    </Stack>
                  </ListItem>

                  <ListItem>
                    <CustomLinkIcon />
                    <Stack direction="row" spacing={1.5}>
                      <Input
                        key={'prTitle'}
                        size='sm'
                        placeholder="Enter Title"
                        sx={{ width: '150px', height: '30px' }}
                      />
                      <Input
                        key={'prUrl'}
                        size='sm'
                        placeholder="Enter URL"
                        type="url"
                        sx={{ width: '150px', height: '30px' }}
                      />
                    </Stack>
                  </ListItem>
                </List>
              </Box>
            </Box>
          </Box>

          <Box sx={{ mt: 2, width: '1000px' }}>
            <div className="md-content">
              <MarkdownEditor
                content={taskContent}
                setContent={setTaskContent}
                height={500}
                mdMode={"edit"} />
            </div>
          </Box>

          <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
            <Button component='a' color="neutral" variant="outlined" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button component='a' color="neutral" onClick={handleCreateGroup} disabled={!taskTitle.trim()}>
              Create
            </Button>
          </Stack>

          {CreateTaskErrorMessage && CreateTaskErrorMessage !== "" && (
            <Alert color="danger">{CreateTaskErrorMessage}</Alert>
          )}
        </ModalDialog>
      </Modal>


    </Stack>
  );
}
