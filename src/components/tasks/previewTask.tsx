import * as React from 'react';
import { useState, useEffect, useRef } from "react";
import Avatar from '@mui/joy/Avatar';
import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import Divider from '@mui/joy/Divider';
import { Input, Grid, Button, Stack } from "@mui/joy";
import Snackbar from '@mui/joy/Snackbar';
import FileUpload from '../fileUpload/upload'
import IconButton from '@mui/joy/IconButton';
import CancelIcon from '@mui/icons-material/Cancel';
import GithubIcon from '../../assets/GithubIcon';
import CustomLinkIcon from '../../assets/CustomLinkIcon';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { MarkdownEditor } from "../markdownEditor/taskMdEditor";
import {
    UserProps,
    PreviewTaskProps,
    ProjectProps,
    TaskStatusProps,
    TaskPriorityProps,
    TaskEffortLevelProps,
    AttachmentFileProps
} from "../../types";
import Autocomplete from '@mui/joy/Autocomplete';
import Close from '@mui/icons-material/Close';
import FormControl from '@mui/joy/FormControl';
import { useAuth } from "../admin/AuthContext";
import TaskCommentBubble from './TaskCommentBubble'
import updateSpecificTask from '../backendOperation/updateSpecificTask';

// sampleUsers[0] must be my self
const sampleUsers: UserProps[] = [
    {
        teamId: "d5918417-471a-4949-b234-f74b27495bd2",
        userId: "0bed59ca-909a-4cca-ba90-88cbc89c7a72",
        userName: "Ken",
        userEmail: "ken@origin.tech",
        avatarImgPath: null,
        online: false,
    },
    {
        teamId: "a",
        userId: "a",
        userName: "Jun",
        userEmail: "jun@origin.tech",
        avatarImgPath: null,
        online: false,
    },
    {
        teamId: "a",
        userId: "a",
        userName: "Ryan",
        userEmail: "ryan@origin.tech",
        avatarImgPath: null,
        online: false,
    },
]

const sampleProjects: ProjectProps[] = [
    { id: 1, name: 'origin-marketing', color: 'primary' },
    { id: 2, name: 'origin-analytics', color: 'danger' },
    { id: 3, name: 'origin-ai', color: 'warning' }]


const sampleTags = [
    { tag: 'Frontend', color: 'primary' },
    { tag: 'Backend', color: 'danger' },
    { tag: 'Infra', color: 'warning' }
]

const statuses: TaskStatusProps[] = [
    { code: 0, status: 'Open', color: 'primary' },
    { code: 1, status: 'WIP', color: 'warning' },
    { code: 2, status: 'Close', color: 'success' },
    { code: 3, status: 'Deleted', color: 'danger' }
]

const priorities: TaskPriorityProps[] = [
    { code: 0, priority: 'Low', color: 'primary' },
    { code: 1, priority: 'Medium', color: 'warning' },
    { code: 2, priority: 'High', color: 'danger' }
]

const effortLevels: TaskEffortLevelProps[] = [
    { code: 0, level: 'Low', color: 'primary' },
    { code: 1, level: 'Medium', color: 'warning' },
    { code: 2, level: 'High', color: 'danger' }
]


const getFormattedTodayDateStr = (): string => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Extracts 'YYYY-MM-DD' from ISO format
};

const getFormattedDateStr = (date: Date): string => {
    return date.toISOString().split("T")[0]; // Extract YYYY-MM-DD from ISO string
};

type TaskContentProps = {
    myself: UserProps,
    currentProject: ProjectProps,
    currentPreviewTask: PreviewTaskProps,
    setCurrentPreviewTask: (value: PreviewTaskProps) => void;
    setIsCreatingTask: (value: boolean) => void;
    setIsTaskContentVisible: (value: boolean) => void;
};

export default function taskPreview(props: TaskContentProps) {
    const {
        myself,
        currentProject,
        currentPreviewTask,
        setCurrentPreviewTask,
        setIsCreatingTask,
        setIsTaskContentVisible
    } = props
    const { accessToken } = useAuth();
    const [comment, setComment] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>([]);
    const nextStatus: string = "Close"
    const [taskUpdated, setTaskUpdate] = useState(false);
    const [currentTaskContent, setCurrentTaskContent] = useState<PreviewTaskProps>(currentPreviewTask);
    const [taskTitle, setTaskTitle] = useState<string | null>(null);
    const [body, setBody] = useState<string | null>(null);
    const initAutocompleteValues = {
        project: sampleProjects[0],
        assignee: sampleUsers[0],
        reporter: sampleUsers[0],
        status: statuses[0],
        priority: priorities[0],
        effortLevel: effortLevels[0],
        tags: sampleTags,
    }

    useEffect(() => {
        if (currentPreviewTask) {
            setCurrentTaskContent(currentPreviewTask)
        }
        setTaskTitle(currentPreviewTask?.title || null)
        setBody(currentPreviewTask?.body || null)
        setUploadedFiles(currentPreviewTask?.attachments || [])
    }, [currentPreviewTask])

    useEffect(() => {
        if (taskUpdated === true) {
            (async () => {
                await updateSpecificTask({
                    myself: myself,
                    updatedData: currentTaskContent,
                    accessToken: accessToken || ""
                });
            })();
            setTaskUpdate(false)
        }
    }, [taskUpdated])

    useEffect(() => {
        if (currentTaskContent !== null
            && currentTaskContent !== undefined
            && currentTaskContent.title !== taskTitle
            && taskTitle !== null) {
            (async () => {
                setCurrentTaskContent(prevState => ({
                    ...prevState,
                    title: taskTitle
                }));
            })();
        }
    }, [taskTitle])

    useEffect(() => {
        if (currentTaskContent !== null
            && currentTaskContent !== undefined
            && currentTaskContent.body !== body
            && taskTitle !== null) {
            (async () => {
                setCurrentTaskContent(prevState => ({
                    ...prevState,
                    body: body
                }));
            })();
        }
    }, [body])

    useEffect(() => {
        if (currentTaskContent !== null && currentTaskContent !== undefined && uploadedFiles.length > 0) {
            (async () => {
                setCurrentTaskContent(prevState => ({
                    ...prevState,
                    attachments: uploadedFiles
                }));
            })();
        }
    }, [uploadedFiles])

    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleButtonClick = () => {
        inputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files
        if (files) {
            // TODO: Need to add files to setUploadedFiles
            console.log("Selected files:", Array.from(files));

            Array.from(files).map((file, index) => {
                (async () => {
                    setCurrentTaskContent(prevState => ({
                        ...prevState,
                        attachments: [{ file: file }]
                    }));
                })();
                setTaskUpdate(true)
            })
        }
    };


    function getMdHeight(text: string): number {
        const height: number = Math.min(Math.max(text.split('\n').length * 20, 450), 800)
        return height;
    }

    // Github URL link manager
    const [prUrl, setPRUrl] = useState<string>(currentPreviewTask?.githubLink?.url || "");
    const [prTitle, setPRTitle] = useState<string>(currentPreviewTask?.githubLink?.title || "");
    const [prError, setPRError] = useState("");
    const isValidGitHubPR = (url: string) => {
        // return /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(url);
        return /^https:\/\/github\.com\/.+/.test(url);
    };
    const handlePRSave = () => {
        if (!prTitle.trim()) {
            setPRErrorOpen(true);
            setPRError("PR title cannot be empty!");
            return;
        }
        if (isValidGitHubPR(prUrl)) {
            (async () => {
                setCurrentTaskContent(prevState => ({
                    ...prevState,
                    githubLink: { url: prUrl, title: prTitle }
                }));
            })();
            setTaskUpdate(true)
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
    const [title, setTitle] = useState("");
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
        if (!title.trim()) {
            setErrorOpen(true);
            setError("Title cannot be empty!");
            return;
        }
        if (isValidUrl(url)) {
            (async () => {
                setCurrentTaskContent(prevState => ({
                    ...prevState,
                    generalLink: { url: url, title: title }
                }));
            })();
            setTaskUpdate(true)
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
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
                        <Chip
                            key={currentPreviewTask.status.status}
                            size="lg"
                            variant="soft"
                            color="primary"
                            startDecorator={<CheckCircleOutlineIcon style={{ color: "#2bc8ff" }} />}
                        >
                            {currentPreviewTask.status.status}
                        </Chip>
                        <FormControl required sx={{ width: '100%' }}>
                            <Input
                                key={'taskTitle'}
                                variant='soft'
                                placeholder="Task Title"
                                defaultValue={taskTitle || ""}
                                onChange={(e) => {
                                    setTaskTitle(e.target.value)
                                }}
                                onBlur={() => { setTaskUpdate(true) }}
                                sx={{ fontSize: '20px', fontWeight: 'bold', backgroundColor: 'transparent' }}
                            />
                        </FormControl>
                    </Box>
                    <Box>
                        <Typography
                            sx={{ ml: '10px', fontSize: '20px', fontWeight: 'bold', backgroundColor: 'transparent' }}
                        >
                            [ID:{currentPreviewTask?.id}]
                        </Typography>
                    </Box>

                    <IconButton
                        size="md"
                        variant="plain"
                        color="neutral"
                        onClick={() => { setIsTaskContentVisible(false) }}
                    >
                        <CancelIcon />
                    </IconButton>
                </Stack>
            </Box>

            <Divider sx={{ mt: 1, mb: 1 }} />

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <List aria-labelledby="decorated-list-demo">
                        <ListItem sx={{ display: "flex", alignItems: "center" }}>
                            <Typography sx={{ minWidth: "80px" }}>Assignee:</Typography>
                            <Avatar size="md">K</Avatar>
                            <Autocomplete
                                options={sampleUsers}
                                getOptionLabel={(option) => `${option.userName} | ${option.userEmail}`}
                                defaultValue={initAutocompleteValues.assignee}
                                onChange={(event, value) => {
                                    if (value !== null) {
                                        (async () => {
                                            setCurrentTaskContent(prevState => ({
                                                ...prevState,
                                                assignee: value
                                            }));
                                        })();
                                        setTaskUpdate(true)
                                    }
                                }}
                                size="md"
                                sx={{ width: '100%' }}
                            />
                        </ListItem>

                        <ListItem sx={{ display: "flex", alignItems: "center" }}>
                            <Typography sx={{ minWidth: "80px" }}>Reporter:</Typography>
                            <Avatar size="md">R</Avatar>
                            <Autocomplete
                                options={sampleUsers}
                                getOptionLabel={(option) => `${option.userName} | ${option.userEmail}`}
                                defaultValue={initAutocompleteValues.reporter}
                                onChange={(event, value) => {
                                    if (value !== null) {
                                        (async () => {
                                            setCurrentTaskContent(prevState => ({
                                                ...prevState,
                                                reporter: value
                                            }));
                                        })();
                                        setTaskUpdate(true)
                                    }
                                }}
                                size="md"
                                sx={{ width: '100%' }}
                            />
                        </ListItem>

                        <Grid container spacing={2}>
                            <Grid key={1} xs={6}>
                                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                    <Typography sx={{ minWidth: "80px" }}>Project:</Typography>
                                    <Autocomplete
                                        options={sampleProjects}
                                        getOptionLabel={(option) => option.name}
                                        defaultValue={initAutocompleteValues.project}
                                        onChange={(event, value) => {
                                            if (value !== null) {
                                                (async () => {
                                                    setCurrentTaskContent(prevState => ({
                                                        ...prevState,
                                                        project: {
                                                            id: value.id,
                                                            name: value.name,
                                                            color: value.color,
                                                        }
                                                    }));
                                                })();
                                                setTaskUpdate(true)
                                            }
                                        }}
                                        size="md"
                                        sx={{ width: '100%' }}
                                    />
                                </ListItem>
                            </Grid>
                            <Grid key={2} xs={6}>
                                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                    <Typography sx={{ minWidth: "40px" }}>Tags:</Typography>
                                    <Autocomplete
                                        multiple
                                        options={sampleTags}
                                        getOptionLabel={(option) => option.tag}
                                        defaultValue={initAutocompleteValues.tags}
                                        limitTags={4}
                                        renderTags={(tags, getTagProps) =>
                                            tags.map((item, index) => {
                                                const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                                return (
                                                    <Chip
                                                        key={key} // pass the key directly
                                                        variant="soft"
                                                        color='danger'
                                                        endDecorator={<Close />}
                                                        {...tagProps} // pass the props except the key
                                                    >
                                                        {item.tag}
                                                    </Chip>
                                                );
                                            })
                                        }
                                        onChange={(event, value) => {
                                            if (value !== null) {
                                                (async () => {
                                                    setCurrentTaskContent(prevState => ({
                                                        ...prevState,
                                                        tags: value
                                                    }));
                                                })();
                                                setTaskUpdate(true)
                                            }
                                        }}
                                        size="md"
                                        sx={{ width: "100%" }}
                                    />
                                </ListItem>
                            </Grid>
                        </Grid>

                        <Grid container spacing={2}>
                            <Grid key={1} xs={6}>
                                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                    <Typography sx={{ minWidth: "80px" }}>Priority:</Typography>
                                    <Autocomplete
                                        multiple
                                        options={priorities}
                                        getOptionLabel={(option) => option.priority}
                                        defaultValue={[initAutocompleteValues.priority]}
                                        renderTags={(tags, getTagProps) =>
                                            tags.slice(-1).map((item, index) => {
                                                const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                                return (
                                                    <Chip
                                                        key={key} // pass the key directly
                                                        variant="soft"
                                                        color='success'
                                                        endDecorator={<Close />}
                                                        {...tagProps} // pass the props except the key
                                                    >
                                                        {item.priority}
                                                    </Chip>
                                                );
                                            })
                                        }
                                        onChange={(event, value) => {
                                            if (value !== null) {
                                                (async () => {
                                                    setCurrentTaskContent(prevState => ({
                                                        ...prevState,
                                                        priority: value.slice(-1)[0]
                                                    }));
                                                })();
                                                setTaskUpdate(true)
                                            }
                                        }}
                                        size="md"
                                        sx={{ width: "100%" }}
                                        openOnFocus={true}
                                    />
                                </ListItem>
                            </Grid>
                            <Grid key={2} xs={6}>

                                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                    <Typography sx={{ minWidth: "100px" }}>Effort Level:</Typography>
                                    <Autocomplete
                                        multiple
                                        options={effortLevels}
                                        getOptionLabel={(option) => option.level}
                                        defaultValue={[initAutocompleteValues.effortLevel]}
                                        renderTags={(tags, getTagProps) =>
                                            tags.slice(-1).map((item, index) => {
                                                const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                                return (
                                                    <Chip
                                                        key={key} // pass the key directly
                                                        variant="soft"
                                                        color='primary'
                                                        endDecorator={<Close />}
                                                        {...tagProps} // pass the props except the key
                                                    >
                                                        {(item) ? item.level : ""}
                                                    </Chip>
                                                );
                                            })
                                        }
                                        onChange={(event, value) => {
                                            if (value !== null) {
                                                (async () => {
                                                    setCurrentTaskContent(prevState => ({
                                                        ...prevState,
                                                        effortLevel: value.slice(-1)[0]
                                                    }));
                                                })();
                                                setTaskUpdate(true)
                                            }
                                        }}
                                        size="md"
                                        sx={{ width: "100%" }}
                                    />
                                </ListItem>

                            </Grid>
                        </Grid>


                        <ListItem>
                            <Typography sx={{ minWidth: "80px" }}>Due Date:</Typography>
                            <Input
                                type="date"
                                color="neutral"
                                variant="soft"
                                size="md"
                                defaultValue={(currentPreviewTask?.dueDate) ? currentPreviewTask?.dueDate : ""}
                                onChange={(e) => {
                                    (async () => {
                                        setCurrentTaskContent(prevState => ({
                                            ...prevState,
                                            dueDate: getFormattedDateStr(new Date(e.target.value)),
                                        }));
                                    })();
                                    setTaskUpdate(true)
                                }}
                                slotProps={{
                                    input: {
                                        min: getFormattedTodayDateStr(),
                                    },
                                }}
                            />
                        </ListItem>

                        <ListItem>
                            <GithubIcon />

                            {(!currentPreviewTask?.githubLink?.url || currentPreviewTask?.githubLink.url === "") && (
                                <Stack direction="row" spacing={1.5}>
                                    <Input
                                        key={'prTitle'}
                                        size='sm'
                                        placeholder="PR Title"
                                        defaultValue={prTitle}
                                        onChange={(e) => {
                                            setPRTitle(e.target.value)
                                        }}
                                        sx={{ width: '150px', height: '30px' }}
                                    />
                                    <Input
                                        key={'prUrl'}
                                        size='sm'
                                        placeholder="PR URL"
                                        defaultValue={prUrl}
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
                                        component='p'
                                        variant="outlined"
                                        color="neutral"
                                        size='sm'
                                        onClick={handlePRSave}>
                                        Set
                                    </Button>
                                </Stack>
                            )}

                            {currentPreviewTask?.githubLink?.url && (
                                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                                    <Typography>
                                        <a href={currentPreviewTask?.githubLink.url} target="_blank" rel="noopener noreferrer">
                                            {prTitle}
                                        </a>
                                    </Typography>
                                    <IconButton
                                        component='p'
                                        variant="outlined"
                                        color="neutral"
                                        size='sm'
                                        onClick={() => { console.log("Edit pr link") }}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                </Stack>
                            )}
                        </ListItem>

                        <ListItem>
                            <CustomLinkIcon />

                            {(!currentPreviewTask?.generalLink?.url || currentPreviewTask?.generalLink.url === "") && (
                                <Stack direction="row" spacing={1.5}>
                                    <Input
                                        key={'title'}
                                        size='sm'
                                        placeholder="Title"
                                        defaultValue={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        sx={{ width: '150px', height: '30px' }}
                                    />
                                    <Input
                                        key={'url'}
                                        size='sm'
                                        placeholder="URL"
                                        defaultValue={url}
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
                                        component='p'
                                        variant="outlined"
                                        color="neutral"
                                        size='sm'
                                        onClick={handleSave}>
                                        Set
                                    </Button>
                                </Stack>
                            )}

                            {currentPreviewTask?.generalLink?.url && (
                                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                                    <Typography>
                                        <a href={currentPreviewTask?.generalLink.url} target="_blank" rel="noopener noreferrer">
                                            {currentPreviewTask?.generalLink.title}
                                        </a>
                                    </Typography>
                                    <IconButton
                                        component='p'
                                        variant="outlined"
                                        color="neutral"
                                        size='sm'
                                        onClick={() => { console.log("Edit general link") }}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                </Stack>
                            )}
                        </ListItem>
                    </List>
                </Box>
            </Box>

            <Divider sx={{ mt: 1, mb: 1 }} />

            <Stack direction="row" sx={{ width: '100%', alignItems: 'center', gap: 1 }}>
                {/* Next Status IconButton */}
                <IconButton
                    component="p"
                    variant="outlined"
                    color="success"
                    size='sm'
                    sx={{
                        fontSize: '14px',
                        paddingX: '7px',
                    }}
                    onClick={() => {
                        (async () => {
                            setCurrentTaskContent(prevState => ({
                                ...prevState,
                                status: { code: 2, status: 'Close', color: 'success' },
                            }));
                        })();
                        setTaskUpdate(true)
                    }}
                >
                    <CheckCircleOutlineIcon sx={{ fontSize: '15px' }} />
                    Close
                </IconButton>

                {/* Sub Task IconButton aligned to the right */}
                <IconButton
                    component="p"
                    variant="outlined"
                    size='sm'
                    sx={{
                        fontSize: '14px',
                        paddingX: '7px',
                        marginLeft: 'auto',
                    }}
                    onClick={() => {
                        setIsTaskContentVisible(false);
                        setIsCreatingTask(true);
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
                    size='sm'
                    sx={{
                        fontSize: '14px',
                        paddingX: '7px',
                    }}
                    onClick={() => {
                        (async () => {
                            setCurrentTaskContent(prevState => ({
                                ...prevState,
                                status: { code: 3, status: 'Deleted', color: 'danger' },
                            }));
                        })();
                        setTaskUpdate(true)
                    }}
                >
                    <DeleteIcon sx={{ fontSize: '15px' }} />
                    Delete
                </IconButton>
            </Stack>


            <Stack direction={"column"} sx={{ width: '100%' }}>
                <Box sx={{ mt: 2 }}>
                    <div className="md-content">
                        <MarkdownEditor
                            content={body || ""}
                            setBody={setBody}
                            height={getMdHeight(body || "")}
                            mdMode={"preview"}
                            isTaskBody={true}
                            setTaskUpdate={setTaskUpdate}
                        />
                    </div>
                </Box>
            </Stack>

            <Divider sx={{ mt: 2 }} />

            <Stack direction="row" alignItems="center" sx={{ width: '100%' }}>
                <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                    Attachments
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <input
                    type="file"
                    accept="*"
                    multiple={true}
                    ref={inputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
                <Button
                    component='p'
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    onClick={handleButtonClick}
                >
                    Select File
                </Button>
            </Stack>

            <FileUpload uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles} setTaskUpdate={setTaskUpdate} />

            <Divider sx={{ m: 2 }} />

            <Box sx={{ mt: 2 }}>
                <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                    Comments
                </Typography>

                <Box sx={{ mb: 1 }}>
                    <TaskCommentBubble />
                </Box>

                <div className="md-content">
                    <MarkdownEditor
                        content={comment}
                        setBody={setComment}
                        height={200}
                        mdMode={"edit"}
                        isTaskBody={false}
                        setTaskUpdate={setTaskUpdate}
                    />
                </div>
            </Box>

        </Sheet>
    );
}
