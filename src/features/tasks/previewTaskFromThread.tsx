import * as React from 'react';
import { useState, useEffect, useRef } from "react";
import { alpha } from '@mui/system';
import { io, Socket } from "socket.io-client";
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
import FileUpload from './upload'
import IconButton from '@mui/joy/IconButton';
import CancelIcon from '@mui/icons-material/Cancel';
import GithubIcon from '../../assets/GithubIcon';
import CustomLinkIcon from '../../assets/CustomLinkIcon';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import {
    UserProps,
    PreviewTaskProps,
    ProjectProps,
    TaskPriorityProps,
    TaskEffortLevelProps,
    AttachmentFileProps,
    TagListProps,
    TaskCommentProps,
    TaskStatusProps
} from "../../types/types";
import Autocomplete from '@mui/joy/Autocomplete';
import Close from '@mui/icons-material/Close';
import { useAuth } from "../../context/AuthContext";
import TaskCommentBubble from './TaskCommentBubble'
import updateSpecificTask from './services/updateSpecificTask';
import loadTeamProjects from './services/loadTeamProjects';
import { loadTeamMembers } from '../admin/services/loadTeamMembers';
import loadProjectTags from './services/loadProjectTags';
import Dropdown from '@mui/joy/Dropdown';
import Menu from '@mui/joy/Menu';
import MenuButton from '@mui/joy/MenuButton';
import MenuItem from '@mui/joy/MenuItem';
import MoreVert from '@mui/icons-material/MoreVert';
import loadTaskComments from './services/loadTaskComments';
import AutocompleteOption from '@mui/joy/AutocompleteOption';
import ListItemContent from '@mui/joy/ListItemContent';
import BnTaskPreview from '../../components/blockNote/bnTaskPreview'
import BnTaskCommentPreview from '../../components/blockNote/bnTaskCommentEditor'
import { PartialBlock } from "@blocknote/core";

const ws_url = import.meta.env.VITE_WS_BASE_URL;


const statuses: TaskStatusProps[] = [
    { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
    { code: 0, status: "WIP", color: "#ffff23", textColor: "black" },
    { code: 0, status: "Pending", color: "#ffa823", textColor: "white" },
    { code: 0, status: "Closed", color: "#1dc200", textColor: "white" },
    { code: 0, status: "Deleted", color: "#ff2323", textColor: "white" },
]

const priorities: TaskPriorityProps[] = [
    { code: 0, priority: 'Low', color: '#0044c2', textColor: "white" },
    { code: 0, priority: 'Medium', color: '#1dc200', textColor: "white" },
    { code: 0, priority: 'High', color: '#ff2323', textColor: "white" },
]

const effortLevels: TaskEffortLevelProps[] = [
    { code: 0, level: 'Low', color: '#0044c2', textColor: "white" },
    { code: 0, level: 'Medium', color: '#1dc200', textColor: "white" },
    { code: 0, level: 'High', color: '#ff2323', textColor: "white" },
]


const getFormattedTodayDateStr = (): string => {
    let today = new Date();
    today.setDate(today.getDate() + 7);
    return today.toISOString().split("T")[0]; // Extracts 'YYYY-MM-DD' from ISO format
};

const getFormattedDateStr = (date: Date): string => {
    return date.toISOString().split("T")[0]; // Extract YYYY-MM-DD from ISO string
};

type TaskContentProps = {
    myself: UserProps;
    currentPreviewTask: PreviewTaskProps;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    setIsOpeningTask: (value: boolean) => void;
    setIsCreatingTask: (value: boolean) => void;
    setIsTaskContentVisible: (value: boolean) => void;
    isNewProjectCreated: boolean;
    isNewTagCreated: boolean;
    setOpeningService: (value: number) => void;
};

export default function taskPreviewFromThread(props: TaskContentProps) {
    const {
        myself,
        currentPreviewTask,
        setOpenCreateProject,
        setOpenCreateTag,
        setIsOpeningTask,
        setIsCreatingTask,
        setIsTaskContentVisible,
        isNewProjectCreated,
        isNewTagCreated,
        setOpeningService
    } = props
    const { accessToken } = useAuth();
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>([]);
    const [taskUpdated, setTaskUpdate] = useState(false);
    const [currentTaskContent, setCurrentTaskContent] = useState<PreviewTaskProps>(currentPreviewTask);
    const [taskTitle, setTaskTitle] = useState<string | null>(null);
    const [body, setBody] = useState<PartialBlock[]>(currentPreviewTask.body);
    const [isCommentUpdated, setIsCommentUpdated] = useState(false);

    const socket: Socket = io(ws_url, {
        reconnection: true,          // Enable reconnection
        reconnectionAttempts: 5,     // Try to reconnect 5 times
        reconnectionDelay: 1000,     // Wait 1 second before reconnecting
        reconnectionDelayMax: 5000,  // Max delay between reconnection attempts
        timeout: 10000,               // Timeout for the connection attempt
        withCredentials: true,
        query: {
            teamId: localStorage.getItem("teamId"),
            userId: localStorage.getItem("userId"),
            userName: localStorage.getItem("userName"),
            userEmail: localStorage.getItem("userEmail"),
        },
        extraHeaders: {
            Authorization: accessToken || ""
        },
    });

    useEffect(() => {
        if (currentPreviewTask) {
            setCurrentTaskContent(currentPreviewTask)
        }
        setTaskTitle(currentPreviewTask?.title || null)
        setBody(currentPreviewTask?.body || [])
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

    // Get team members
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    useEffect(() => {
        // Load the latest project as initial process
        (async () => {
            const loadedTeamMembers: UserProps[] = await loadTeamMembers(myself, accessToken);
            if (loadedTeamMembers.length > 0) {
                setTeamMembers(loadedTeamMembers);
            }
        })();
    }, [])

    // Get team projects
    const [teamProjects, setTeamProjects] = useState<ProjectProps[]>([]);
    useEffect(() => {
        // Load the latest project as initial process
        (async () => {
            const loadedTeamProjects: ProjectProps[] = await loadTeamProjects({
                myself: myself, accessToken: accessToken || ""
            });
            if (loadedTeamProjects.length > 0) {
                setTeamProjects(loadedTeamProjects);
            }
        })();
    }, [isNewProjectCreated, currentTaskContent])

    // Get Project tags
    const [projectTags, setProjectTags] = useState<TagListProps[]>([]);
    useEffect(() => {
        (async () => {
            const loadedProjectTags: TagListProps[] = await loadProjectTags({
                myself: myself, projectId: currentPreviewTask.project.projectId, accessToken: accessToken || ""
            });
            if (loadedProjectTags.length > 0) {
                setProjectTags(loadedProjectTags);
            }
        })();
    }, [isNewTagCreated, currentTaskContent])

    // Get Task Comments
    const [taskComments, setTaskComments] = useState<TaskCommentProps[]>([]);
    useEffect(() => {
        (async () => {
            const loadedTaskComments: TaskCommentProps[] = await loadTaskComments({
                myself: myself, taskId: Number(currentPreviewTask.id), accessToken: accessToken || ""
            });
            if (loadedTaskComments.length > 0) {
                setTaskComments(loadedTaskComments);
            } else {
                setTaskComments([]);
            }
        })();
    }, [currentPreviewTask])

    // Web Socket handler
    useEffect(() => {
        socket.on("connect", () => {
            // console.log("WS connected from task home")
        });
        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
        });
        socket.on("message", (message) => {
            console.log("task_comment:", message)
            setIsCommentUpdated(true)
        })
        return () => {
            socket.off("message");
            socket.off("connect");
        };
    }, [accessToken, currentTaskContent]);

    // Update Project and Tag list
    const updateProjectOptions = () => {
        (async () => {
            const loadedTeamProjects: ProjectProps[] = await loadTeamProjects({
                myself: myself, accessToken: accessToken || ""
            });
            if (loadedTeamProjects.length > 0) {
                setTeamProjects(loadedTeamProjects);
            }
        })();
    };
    const updateTagOptions = () => {
        (async () => {
            const loadedProjectTags: TagListProps[] = await loadProjectTags({
                myself: myself, projectId: currentPreviewTask.project.projectId, accessToken: accessToken || ""
            });
            if (loadedProjectTags.length > 0) {
                setProjectTags(loadedProjectTags);
            }
        })();
    };


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
                            key={currentTaskContent.status.status}
                            size="lg"
                            variant="soft"
                            sx={{
                                backgroundColor: currentTaskContent.status.color ? alpha(currentTaskContent.status.color, 0.75) : 'transparent',
                                color: currentTaskContent.status.textColor,
                                fontWeight: 'bold'
                            }}
                        >
                            {currentTaskContent.status.status || "Open"}
                        </Chip>
                        <Input
                            key={'taskTitle'}
                            variant='soft'
                            placeholder="Task Title"
                            value={taskTitle || ""}
                            onChange={(e) => {
                                setTaskTitle(e.target.value)
                            }}
                            onBlur={() => { setTaskUpdate(true) }}
                            sx={{ width: '100%', fontSize: '20px', fontWeight: 'bold', backgroundColor: 'transparent' }}
                        />
                    </Box>
                    <Box>
                        <Typography
                            sx={{ ml: '10px', fontSize: '20px', fontWeight: 'bold', backgroundColor: 'transparent' }}
                        >
                            [ID:{currentTaskContent?.id}]
                        </Typography>
                    </Box>

                    <IconButton
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => {
                            setIsOpeningTask(false);
                            setIsTaskContentVisible(false);
                        }}
                    >
                        <CancelIcon />
                    </IconButton>
                    <Dropdown>
                        <MenuButton
                            size='sm'
                            slots={{ root: IconButton }}
                            slotProps={{ root: { color: 'neutral' } }}
                        >
                            <MoreVert />
                        </MenuButton>
                        <Menu size="sm">
                            <MenuItem onClick={() => { setOpenCreateProject(true) }}><AddIcon />New Project</MenuItem>
                            <MenuItem onClick={() => { setOpenCreateTag(true) }}><AddIcon />New Tag</MenuItem>
                            <MenuItem onClick={() => { setOpeningService(2) }}>Go to Task Home</MenuItem>
                        </Menu>
                    </Dropdown>
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
                        <ListItem sx={{ display: "flex", alignItems: "center", width: '65%' }}>
                            <Typography sx={{ minWidth: "80px" }}>Assignee:</Typography>
                            <Avatar size="sm">{currentTaskContent.assignee.userName[0]}</Avatar>
                            <Autocomplete
                                options={teamMembers}
                                getOptionLabel={(option) => `${option.userName} | ${option.userEmail}`}
                                value={currentTaskContent.assignee}
                                isOptionEqualToValue={(option, value) => option.userId === value.userId}
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
                                size="sm"
                                sx={{ width: '100%' }}
                            />
                        </ListItem>

                        <ListItem sx={{ display: "flex", alignItems: "center", width: '65%' }}>
                            <Typography sx={{ minWidth: "80px" }}>Reporter:</Typography>
                            <Avatar size="sm">{currentTaskContent.reporter.userName[0]}</Avatar>
                            <Autocomplete
                                options={teamMembers}
                                getOptionLabel={(option) => `${option.userName} | ${option.userEmail}`}
                                value={currentTaskContent.reporter}
                                isOptionEqualToValue={(option, value) => option.userId === value.userId}
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
                                size="sm"
                                sx={{ width: '100%' }}
                            />
                        </ListItem>

                        <Grid container spacing={2}>
                            <Grid key={1} xs={6}>
                                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                    <Typography sx={{ minWidth: "80px" }}>Project:</Typography>
                                    <Autocomplete
                                        options={teamProjects}
                                        getOptionLabel={(option) => option.projectName}
                                        value={currentTaskContent.project}
                                        isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
                                        onChange={(event, value) => {
                                            if (value !== null) {
                                                (async () => {
                                                    setCurrentTaskContent(prevState => ({
                                                        ...prevState,
                                                        project: {
                                                            projectId: value.projectId,
                                                            projectName: value.projectName
                                                        }
                                                    }));
                                                })();
                                                setTaskUpdate(true)
                                            }
                                        }}
                                        onOpen={() => { updateProjectOptions() }}
                                        size="sm"
                                        sx={{ width: '100%' }}
                                    />
                                </ListItem>
                            </Grid>
                            <Grid key={2} xs={6}>
                                <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                    <Typography sx={{ minWidth: "40px" }}>Tags:</Typography>
                                    <Autocomplete
                                        multiple
                                        options={projectTags}
                                        getOptionLabel={(option) => option.tagName}
                                        value={currentTaskContent.tags}
                                        isOptionEqualToValue={(option, value) => option.tagName === value.tagName}
                                        limitTags={4}
                                        renderTags={(tags, getTagProps) =>
                                            tags.map((item, index) => {
                                                const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                                return (
                                                    <Chip
                                                        key={item.tagName} // pass the key directly
                                                        variant="soft"
                                                        endDecorator={<Close />}
                                                        sx={{
                                                            backgroundColor: alpha(item.tagColor, 0.80),
                                                            color: item.tagTextColor,
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        {item.tagName}
                                                    </Chip>
                                                );
                                            })
                                        }
                                        renderOption={(props, option) => (
                                            <AutocompleteOption {...props} key={option.tagName}>
                                                <ListItemContent sx={{ fontSize: 'sm' }}>
                                                    <Chip
                                                        key={option.tagName}
                                                        variant="soft"
                                                        endDecorator={<Close />}
                                                        sx={{
                                                            backgroundColor: alpha(option.tagColor, 0.80),
                                                            color: option.tagTextColor,
                                                            fontWeight: 'bold',
                                                        }}
                                                    >
                                                        {option.tagName}
                                                    </Chip>
                                                </ListItemContent>
                                            </AutocompleteOption>
                                        )}
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
                                        onOpen={() => { updateTagOptions() }}
                                        size="sm"
                                        sx={{ width: "100%" }}
                                    />
                                    <IconButton
                                        size="sm"
                                        variant="soft"
                                        color="neutral"
                                        onClick={() => { setOpenCreateTag(true) }}
                                    >
                                        <AddIcon />
                                    </IconButton>
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
                                        getOptionLabel={(option) => option.priority || ""}
                                        value={
                                            (currentTaskContent.priority.priority !== null)
                                                ? [currentTaskContent.priority]
                                                : []
                                        }
                                        isOptionEqualToValue={(option, value) => option.priority === value.priority}
                                        renderTags={(tags, getTagProps) =>
                                            tags.slice(-1).map((item, index) => {
                                                const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                                return (
                                                    <Chip
                                                        key={key} // pass the key directly
                                                        variant="soft"
                                                        endDecorator={<Close />}
                                                        sx={{
                                                            backgroundColor: item.color ? alpha(item.color, 0.75) : 'transparent',
                                                            color: item.textColor,
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        {item.priority}
                                                    </Chip>
                                                );
                                            })
                                        }
                                        renderOption={(props, option) => (
                                            <AutocompleteOption {...props} key={option.priority}>
                                                <ListItemContent sx={{ fontSize: 'sm' }}>
                                                    <Chip
                                                        key={option.priority} // pass the key directly
                                                        variant="soft"
                                                        endDecorator={<Close />}
                                                        sx={{
                                                            backgroundColor: option.color ? alpha(option.color, 0.75) : 'transparent',
                                                            color: option.textColor,
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        {option.priority}
                                                    </Chip>
                                                </ListItemContent>
                                            </AutocompleteOption>
                                        )}
                                        onChange={(event, value) => {
                                            if (value !== null) {
                                                if (value.length > 0) {
                                                    (async () => {
                                                        setCurrentTaskContent(prevState => ({
                                                            ...prevState,
                                                            priority: value.slice(-1)[0]
                                                        }));
                                                    })();
                                                    setTaskUpdate(true)
                                                } else {
                                                    (async () => {
                                                        setCurrentTaskContent(prevState => ({
                                                            ...prevState,
                                                            priority: { code: 0, priority: null, color: null, textColor: null }
                                                        }));
                                                    })();
                                                    setTaskUpdate(true)
                                                }
                                            }
                                        }}
                                        size="sm"
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
                                        getOptionLabel={(option) => option.level || ""}
                                        value={
                                            (currentTaskContent.effortLevel.level !== null)
                                                ? [currentTaskContent.effortLevel]
                                                : []
                                        }
                                        isOptionEqualToValue={(option, value) => option.level === value.level}
                                        renderTags={(tags, getTagProps) =>
                                            tags.slice(-1).map((item, index) => {
                                                const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                                return (
                                                    <Chip
                                                        key={key} // pass the key directly
                                                        variant="soft"
                                                        endDecorator={<Close />}
                                                        sx={{
                                                            backgroundColor: item.color ? alpha(item.color, 0.75) : 'transparent',
                                                            color: item.textColor,
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        {(item) ? item.level : ""}
                                                    </Chip>
                                                );
                                            })
                                        }
                                        renderOption={(props, option) => (
                                            <AutocompleteOption  {...props} key={option.level}>
                                                <ListItemContent sx={{ fontSize: 'sm' }}>
                                                    <Chip
                                                        key={option.level} // pass the key directly
                                                        variant="soft"
                                                        endDecorator={<Close />}
                                                        sx={{
                                                            backgroundColor: option.color ? alpha(option.color, 0.75) : 'transparent',
                                                            color: option.textColor,
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        {option.level}
                                                    </Chip>
                                                </ListItemContent>
                                            </AutocompleteOption>
                                        )}
                                        onChange={(event, value) => {
                                            if (value !== null) {
                                                if (value.length > 0) {
                                                    (async () => {
                                                        setCurrentTaskContent(prevState => ({
                                                            ...prevState,
                                                            effortLevel: value.slice(-1)[0]
                                                        }));
                                                    })();
                                                    setTaskUpdate(true)
                                                } else {
                                                    (async () => {
                                                        setCurrentTaskContent(prevState => ({
                                                            ...prevState,
                                                            effortLevel: { code: 0, level: null, color: null, textColor: null }
                                                        }));
                                                    })();
                                                    setTaskUpdate(true)
                                                }
                                            }
                                        }}
                                        size="sm"
                                        sx={{ width: "100%" }}
                                    />
                                </ListItem>
                            </Grid>
                        </Grid>

                        <ListItem sx={{ width: '50%' }}>
                            <Typography sx={{ minWidth: "80px" }}>Status:</Typography>
                            <Autocomplete
                                multiple
                                options={statuses}
                                value={[currentTaskContent.status]}
                                getOptionLabel={(option) => option.status || ""}
                                isOptionEqualToValue={(option, value) => option.status === value.status}
                                renderTags={(tags, getTagProps) =>
                                    tags.slice(-1).map((item, index) => {
                                        const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                        return (
                                            <Chip
                                                key={key} // pass the key directly
                                                variant="soft"
                                                endDecorator={<Close />}
                                                sx={{
                                                    backgroundColor: item.color ? alpha(item.color, 0.75) : 'transparent',
                                                    color: item.textColor,
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {(item) ? item.status : ""}
                                            </Chip>
                                        );
                                    })
                                }
                                renderOption={(props, option) => (
                                    <AutocompleteOption  {...props} key={option.status}>
                                        <ListItemContent sx={{ fontSize: 'sm' }}>
                                            <Chip
                                                key={option.status} // pass the key directly
                                                variant="soft"
                                                endDecorator={<Close />}
                                                sx={{
                                                    backgroundColor: option.color ? alpha(option.color, 0.75) : 'transparent',
                                                    color: option.textColor,
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {option.status}
                                            </Chip>
                                        </ListItemContent>
                                    </AutocompleteOption>
                                )}
                                onChange={(event, value) => {
                                    if (value !== null && value.length > 0) {
                                        (async () => {
                                            setCurrentTaskContent(prevState => ({
                                                ...prevState,
                                                status: value.slice(-1)[0]
                                            }));
                                        })();
                                        setTaskUpdate(true)
                                    }
                                }}
                                size="sm"
                                sx={{ width: "100%" }}
                            />
                        </ListItem>


                        <ListItem>
                            <Typography sx={{ minWidth: "80px" }}>Due Date:</Typography>
                            <Input
                                type="date"
                                color="neutral"
                                variant="soft"
                                size="sm"
                                value={(currentPreviewTask?.dueDate) ? currentPreviewTask?.dueDate : ""}
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
                                        value={prTitle}
                                        onChange={(e) => {
                                            setPRTitle(e.target.value)
                                        }}
                                        sx={{ width: '150px', height: '30px' }}
                                    />
                                    <Input
                                        key={'prUrl'}
                                        size='sm'
                                        placeholder="PR URL"
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
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        sx={{ width: '150px', height: '30px' }}
                                    />
                                    <Input
                                        key={'url'}
                                        size='sm'
                                        placeholder="URL"
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
                                status: { code: 0, status: 'Closed', color: '#1dc200', textColor: 'white' },
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
                        setIsOpeningTask(false);
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
                                status: { code: 0, status: 'Deleted', color: '#ff2323', textColor: 'white' },
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
                    <BnTaskPreview
                        body={body}
                        setBody={setBody}
                        setTaskUpdate={setTaskUpdate}
                    />
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
                    <TaskCommentBubble taskComments={taskComments} />
                </Box>

                <BnTaskCommentPreview
                    myself={myself}
                    socket={socket}
                    projectId={currentPreviewTask.project.projectId}
                    taskId={Number(currentTaskContent.id)}
                    setTaskUpdate={setTaskUpdate}
                    taskComments={taskComments}
                    setTaskComments={setTaskComments}
                    isCommentUpdated={isCommentUpdated}
                    setIsCommentUpdated={setIsCommentUpdated}
                />
            </Box>

        </Sheet>
    );
}
