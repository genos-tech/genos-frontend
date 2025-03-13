import * as React from 'react';
import { useState } from "react";
import Avatar from '@mui/joy/Avatar';
import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import Divider from '@mui/joy/Divider';
import { Input, Grid, Menu, MenuItem, Button, Stack } from "@mui/joy";
import Textarea from '@mui/joy/Textarea';
import { ChevronDown } from "lucide-react";
import Snackbar, { SnackbarProps } from '@mui/joy/Snackbar';
import TaskCommentBubble from './TaskCommentBubble'

import FileUpload from '../fileUpload/upload'

import IconButton from '@mui/joy/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';

import GithubIcon from '../../assets/GithubIcon';
import CustomLinkIcon from '../../assets/CustomLinkIcon';

import { MarkdownEditor } from "../../components/markdownEditor/taskMdEditor";

import { TaskCommentProps } from "../../types"

// Temp data
import { taskContents } from './sampleTaskContents';

type TaskContentProps = {
  setIsTaskContentVisible: (value: boolean) => void;
};

export default function taskContent(props: TaskContentProps) {
  const { setIsTaskContentVisible } = props
  const taskId: string = "task-001"
  const taskSummary: string = "This is a Task for XXX"
  const dueDate: string = "21 Oct 2022"
  const taskState: string = "WIP"
  const nextStatus: string = "Close"
  const assignee: string = "Ken"
  const reporter: string = "Ryan"
  const [taskContent, setTaskContent] = useState(taskContents.content);
  const [comment, setComment] = useState("");

  const testComments: TaskCommentProps[] = [
    {
      email: "ken@ken",
      name: "ken",
      content: "good1",
    },
    {
      email: "ken@ken",
      name: "ken",
      content: "good2",
    },
    {
      email: "ken@ken",
      name: "ken",
      content: "good3",
    },
    {
      email: "ken@ken",
      name: "ken",
      content: "good2",
    },
    {
      email: "ken@ken",
      name: "ken",
      content: "good3",
    }
  ]

  function getMdHeight(text: string): number {
    const height: number = Math.min(Math.max(text.split('\n').length * 20, 200), 800)
    return height;
  }

  const createdDate = '2025-03-08';
  const [selectedDate, setSelectedDate] = useState(createdDate);
  const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format


  // Editable Chip for Tag
  const predefinedLabels = ["Q1", "Q2", "Q3"];
  const [isEditing, setIsEditing] = useState(false);
  const [chipLabel, setChipLabel] = useState("Q4");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleBlur = () => {
    setIsEditing(false);
  };
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChipLabel(event.target.value);
  };
  const handleSelectLabel = (label: string) => {
    setChipLabel(label);
    setAnchorEl(null);
  };

  // Github URL link manager
  const [prUrl, setPRUrl] = useState("");
  const [prTitle, setPRTitle] = useState("");
  const [savedPRUrl, setSavedPRUrl] = useState("");
  const [prError, setPRError] = useState("");
  const isValidGitHubPR = (url: string) => {
    return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(url);
  };
  const handlePRSave = () => {
    if (!prTitle.trim()) {
      setPRErrorOpen(true);
      setPRError("PR title cannot be empty!");
      return;
    }
    if (isValidGitHubPR(prUrl)) {
      setSavedPRUrl(prUrl);
      setPRTitle(prTitle);
      setPRError("");
    } else {
      setPRErrorOpen(true);
      setPRError("Please enter a valid GitHub PR URL.");
    }
  };
  const [prErrorOpen, setPRErrorOpen] = React.useState(false);


  // Any URL link manager
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [savedAlias, setSavedAlias] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [error, setError] = useState("");
  const isValidUrl = (inputUrl: string) => {
    try {
      new URL(inputUrl);
      return true;
    } catch {
      return false;
    }
  };
  const handleSave = () => {
    if (!alias.trim()) {
      setErrorOpen(true);
      setError("Title cannot be empty!");
      return;
    }
    if (isValidUrl(url)) {
      setSavedUrl(url);
      setSavedAlias(alias);
      setError("");
    } else {
      setErrorOpen(true);
      setError("Please enter a valid URL.");
    }
  };
  const [errorOpen, setErrorOpen] = React.useState(false);

  return (
    <Sheet
      className="custom-scrollbar"
      variant="outlined"
      sx={{
        minHeight: 500,
        borderRadius: 'sm',
        p: 2,
        overflowY: 'scroll',
        overflowX: 'hidden'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" sx={{ width: '100%', alignItems: 'center' }}>
          {/* Wrap the title and task state in the same Box */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
            <Chip
              key={taskState}
              size="lg"
              variant="soft"
              color="primary"
              sx={{ fontSize: '15px' }}
            >
              {taskState}
            </Chip>
            <Textarea
              variant="plain"
              size="lg"
              defaultValue={`[ ${taskId} ] ${taskSummary}`}
              sx={{ width: '500px', fontSize: '25px', fontWeight: 'bold' }}
            />
          </Box>

          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            onClick={() => { setIsTaskContentVisible(false); }}
          >
            <CancelIcon />
          </IconButton>
        </Stack>
      </Box>

      <Divider />

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
                    Assignee: <Avatar size="sm">K</Avatar>
                    <Textarea
                      name="Neutral"
                      variant="plain"
                      color="neutral"
                      size="md"
                      defaultValue={assignee}
                      sx={{ width: '150px' }}
                    />
                  </ListItem>
                </Grid>
                <Grid key={2} xs={6}>
                  <ListItem>
                    Reporter: <Avatar size="sm">R</Avatar>
                    <Textarea
                      name="Neutral"
                      variant="plain"
                      color="neutral"
                      size="md"
                      defaultValue={reporter}
                      sx={{ width: '150px' }}
                    />
                  </ListItem>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid key={1} xs={6} sx={{ display: "flex", alignItems: "center" }}>
                  <ListItem>
                    Project: <Chip
                      variant="soft"
                      color="primary"
                      sx={{ cursor: "pointer" }}
                    >
                      origin-initial-project
                    </Chip>
                  </ListItem>
                </Grid>
                <Grid key={2} xs={6}>
                  <ListItem>
                    Due date: <Input
                      type="date"
                      color="neutral"
                      variant="outlined"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      slotProps={{
                        input: {
                          min: today, // Set minimum date to today
                        },
                      }}
                    />
                  </ListItem>
                </Grid>
              </Grid>

              <ListItem>
                Tags:
                {isEditing ? (
                  <Input
                    autoFocus
                    value={chipLabel}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleBlur()}
                    size="sm"
                    placeholder="Enter Tag"
                  />
                ) : (
                  <div>
                    {predefinedLabels.map((label) => (
                      <Chip
                        key={label}
                        variant="soft"
                        color="warning"
                        onClick={() => setIsEditing(true)}
                        sx={{ cursor: "pointer" }}
                      >
                        {label}
                      </Chip>
                    ))}
                    <Chip
                      variant="soft"
                      color="warning"
                      onClick={() => setIsEditing(true)}
                      sx={{ cursor: "pointer" }}
                    >
                      {chipLabel}
                    </Chip>
                  </div>
                )}

                <IconButton
                  component="a"
                  size="sm"
                  variant="outlined"
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                >
                  <ChevronDown size={16} />
                </IconButton>

                <Menu
                  anchorEl={anchorEl}
                  open={!!anchorEl}
                  onClose={() => setAnchorEl(null)}
                >
                  {predefinedLabels.map((label) => (
                    <MenuItem key={label} onClick={() => handleSelectLabel(label)}>
                      {label}
                    </MenuItem>
                  ))}
                </Menu>
              </ListItem>

              <ListItem>
                <GithubIcon />

                {(!savedPRUrl || savedPRUrl === "") && (
                  <Stack direction="row" spacing={1.5}>
                    <Input
                      key={'prTitle'}
                      size='sm'
                      placeholder="Enter PR Title"
                      value={prTitle}
                      onChange={(e) => setPRTitle(e.target.value)}
                      sx={{ width: '150px', height: '30px' }}
                    />
                    <Input
                      key={'prUrl'}
                      size='sm'
                      placeholder="Enter PR URL"
                      value={prUrl}
                      onChange={(e) => setPRUrl(e.target.value)}
                      type="url"
                      sx={{ width: '150px', height: '30px' }}
                    />
                    {prError && <Snackbar
                      autoHideDuration={5000}
                      open={prErrorOpen}
                      variant='soft'
                      color='danger'
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                      onClose={(event, reason) => {
                        if (reason === 'clickaway') {
                          return;
                        }
                        setPRErrorOpen(false);
                      }}
                    >
                      {prError}
                    </Snackbar>}
                    <Button
                      component='a'
                      variant="outlined"
                      color="neutral"
                      onClick={handlePRSave}>Save</Button>
                  </Stack>
                )}

                {savedPRUrl && (
                  <Typography>
                    <a href={savedPRUrl} target="_blank" rel="noopener noreferrer">
                      {prTitle}
                    </a>
                  </Typography>
                )}
              </ListItem>

              <ListItem>
                <CustomLinkIcon />

                {(!savedUrl || savedUrl === "") && (
                  <Stack direction="row" spacing={1.5}>
                    <Input
                      key={'title'}
                      size='sm'
                      placeholder="Enter Title"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      sx={{ width: '150px', height: '30px' }}
                    />
                    <Input
                      key={'url'}
                      size='sm'
                      placeholder="Enter URL"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      type="url"
                      sx={{ width: '150px', height: '30px' }}
                    />
                    {error && <Snackbar
                      autoHideDuration={5000}
                      open={errorOpen}
                      variant='soft'
                      color='danger'
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                      onClose={(event, reason) => {
                        if (reason === 'clickaway') {
                          return;
                        }
                        setErrorOpen(false);
                      }}
                    >
                      {error}
                    </Snackbar>}
                    <Button
                      component='a'
                      variant="outlined"
                      color="neutral"
                      onClick={handleSave}>Save</Button>
                  </Stack>
                )}

                {savedUrl && (
                  <Typography>
                    <a href={savedUrl} target="_blank" rel="noopener noreferrer">
                      {savedAlias}
                    </a>
                  </Typography>
                )}
              </ListItem>
            </List>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mt: 1, mb: 1 }} />

      <Stack direction={"column"} sx={{ width: '100%' }}>
        <Stack direction="row" sx={{ width: '100%', alignItems: 'center', gap: 1 }}>
          {/* Next Status IconButton */}
          <IconButton
            component="p"
            variant="outlined"
            color="success"
            sx={{
              fontSize: '14px',
              paddingX: '7px',
            }}
          >
            <CheckCircleOutlineIcon sx={{ fontSize: '15px' }} />
            {nextStatus}
          </IconButton>

          {/* Sub Task IconButton aligned to the right */}
          <IconButton
            component="p"
            variant="outlined"
            sx={{
              fontSize: '14px',
              paddingX: '7px',
              marginLeft: 'auto',
            }}
          >
            <AddIcon />
            Sub Task
          </IconButton>

          {/* Delete IconButton */}
          <IconButton
            component="p"
            variant="outlined"
            color="danger"
            sx={{
              fontSize: '14px',
              paddingX: '7px',
            }}
          >
            <DeleteIcon sx={{ fontSize: '15px' }} />
            Delete
          </IconButton>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <div className="md-content">
            <MarkdownEditor
              content={taskContent}
              setContent={setTaskContent}
              height={getMdHeight(taskContent)}
              mdMode={"preview"} />
          </div>
        </Box>
      </Stack>

      <Divider sx={{ mt: 2 }} />

      <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
        Attachments
      </Typography>

      <FileUpload />


      <Divider sx={{ mt: 2 }} />

      <Box sx={{ mt: 2 }}>
        <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
          Comments
        </Typography>

        <Box sx={{ mb: 1 }}>
          <TaskCommentBubble />
        </Box>

        <div className="md-content">
          <MarkdownEditor content={comment} setContent={setComment} height={200} mdMode={"edit"} />
        </div>
      </Box>

    </Sheet>
  );
}
