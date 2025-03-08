import { useState } from "react";
import Avatar from '@mui/joy/Avatar';
import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import Card from '@mui/joy/Card';
import CardOverflow from '@mui/joy/CardOverflow';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import AspectRatio from '@mui/joy/AspectRatio';
import Divider from '@mui/joy/Divider';
import { Input } from "@mui/joy";

import IconButton from '@mui/joy/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';

import { MarkdownEditor } from "../../components/markdownEditor/taskMdEditor";

// Temp data
import { taskContents } from './sampleTaskContents';

export default function taskContent() {
  const taskId: string = "task-001"
  const taskSummary: string = "This is a Task for XXX"
  const dueDate: string = "21 Oct 2022"
  const taskState: string = "WIP"
  const nextStatus: string = "Close"
  const assignee: string = "Ken"
  const [taskContent, setTaskContent] = useState(taskContents.content);
  const [comment, setComment] = useState("");

  function getMdHeight(text: string): number {
    const height: number = Math.min(Math.max(text.split('\n').length * 20, 200), 800)
    return height;
  }

  const createdDate = '2025-03-08';
  const [selectedDate, setSelectedDate] = useState(createdDate);
  const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format


  return (
    <Sheet
      variant="outlined"
      sx={{ minHeight: 500, borderRadius: 'sm', p: 2, overflowY: 'scroll', overflowX: 'hidden' }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography
              level="h3"
              textColor="text.primary"
              endDecorator={
                <Chip component="span" size="md" variant="soft" color="primary">
                  {taskState}
                </Chip>
              }
            >
              [ {taskId} ] {taskSummary}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{ display: 'flex', height: '32px', flexDirection: 'row', gap: 1.5 }}
        >
          <IconButton
            component='p'
            variant="soft"
            color='success'
            sx={{
              fontSize: '14px',
              paddingX: '7px',
            }}>
            <CheckCircleOutlineIcon sx={{ fontSize: '15px' }} />
            {nextStatus}
          </IconButton>

          <IconButton
            component='p'
            variant="soft"
            color='danger'
            sx={{
              fontSize: '14px',
              paddingX: '7px',
            }}>
            <DeleteIcon sx={{ fontSize: '15px' }} />
            Delete
          </IconButton>

          <IconButton
            component='p'
            variant="outlined"
            sx={{
              fontSize: '14px',
              paddingX: '7px'
            }}>
            <AddIcon />
            Sub Task
          </IconButton>
        </Box>
      </Box>

      <Divider sx={{ mt: 2 }} />

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Box>
            <List aria-labelledby="decorated-list-demo">
              <ListItem>
                Assignee: <Avatar size="sm">K</Avatar> {assignee}
              </ListItem>
              <ListItem>
                Due date: <Input
                  type="date"
                  color="primary"
                  variant="soft"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  slotProps={{
                    input: {
                      min: today, // Set minimum date to today
                    },
                  }}
                />
              </ListItem>
              <ListItem>
                Tags:<Chip component="span" size="md" variant="soft" color="warning">
                  Frontend
                </Chip>
              </ListItem>
              <ListItem>
                Reporter: <Avatar size="sm">K</Avatar> {assignee}
              </ListItem>
            </List>
          </Box>
        </Box>
        <Box
          sx={{ display: 'flex', flexDirection: 'row' }}
        >
          <IconButton
            component='p'
            variant="outlined"
            sx={{
              fontSize: '14px',
              paddingX: '7px'
            }}>
            <EditIcon sx={{ fontSize: '15px' }} />
            Edit
          </IconButton>
        </Box>
      </Box>

      <Divider sx={{ mt: 2 }} />

      <Box sx={{ mt: 2 }}>
        <div className="md-content">
          <MarkdownEditor
            content={taskContent}
            setContent={setTaskContent}
            height={getMdHeight(taskContent)}
            mdMode={"preview"} />
        </div>
      </Box>

      <Divider sx={{ mt: 2 }} />

      <Typography level="title-sm" sx={{ mt: 2, mb: 2 }}>
        Attachments
      </Typography>
      <Box
        sx={(theme) => ({
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          '& > div': {
            boxShadow: 'none',
            '--Card-padding': '0px',
            '--Card-radius': theme.vars.radius.sm,
          },
        })}
      >
        <Card variant="outlined">
          <AspectRatio ratio="1" sx={{ minWidth: 80 }}>
            <img
              src="https://images.unsplash.com/photo-1527549993586-dff825b37782?auto=format&h=80"
              srcSet="https://images.unsplash.com/photo-1527549993586-dff825b37782?auto=format&h=160 2x"
              alt="Yosemite National Park"
            />
          </AspectRatio>
        </Card>
        <Card variant="outlined">
          <AspectRatio ratio="1" sx={{ minWidth: 80 }}>
            <img
              src="https://images.unsplash.com/photo-1532614338840-ab30cf10ed36?auto=format&h=80"
              srcSet="https://images.unsplash.com/photo-1532614338840-ab30cf10ed36?auto=format&h=160 2x"
              alt="Yosemite National Park"
            />
          </AspectRatio>
        </Card>
        <Card variant="outlined" orientation="horizontal">
          <CardOverflow>
            <AspectRatio ratio="1" sx={{ minWidth: 80 }}>
              <div>
                <FolderIcon />
              </div>
            </AspectRatio>
          </CardOverflow>
          <Box sx={{ py: { xs: 1, sm: 2 }, pr: 2 }}>
            <Typography level="title-sm" color="primary">
              videos-hike.zip
            </Typography>
            <Typography level="body-xs">100 MB</Typography>
          </Box>
        </Card>
      </Box>

      <Divider sx={{ mt: 2 }} />

      <Box sx={{ mt: 2 }}>
        <Typography level="title-sm" sx={{ mt: 2, mb: 2 }}>
          Comments
        </Typography>
        <div className="md-content">
          <MarkdownEditor content={comment} setContent={setComment} height={200} mdMode={"edit"} />
        </div>
      </Box>

    </Sheet>
  );
}
