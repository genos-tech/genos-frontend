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
import IconButton from '@mui/joy/IconButton';
import CancelIcon from '@mui/icons-material/Cancel';
import GithubIcon from '../../assets/GithubIcon';
import CustomLinkIcon from '../../assets/CustomLinkIcon';
import { MarkdownEditor } from "../../components/markdownEditor/taskMdEditor";
import {
    UserProps,
    CreateTaskProps,
    ProjectProps,
    TaskPriorityProps,
    TaskEffortLevelProps,
    AttachmentFileProps
} from "../../types";
import Autocomplete from '@mui/joy/Autocomplete';
import Close from '@mui/icons-material/Close';
import FormControl from '@mui/joy/FormControl';
import { useAuth } from "../../components/admin/AuthContext";
import FileUpload from '../fileUpload/upload'

const base_url = import.meta.env.VITE_API_BASE_URL;

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

type saveTaskProps = {
    myself: UserProps,
    taskContents: CreateTaskProps,
    accessToken: string,
    setIsSubmitted: (value: boolean) => void,
    setTitleError: (value: string) => void,
    setTitleErrorOpen: (value: boolean) => void,
}

const saveTask = async (props: saveTaskProps) => {
    const { myself,
        taskContents,
        accessToken,
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen } = props;

    if (taskContents.title === "") {
        setTitleError("Task title is required !!!")
        setTitleErrorOpen(true);
    } else {
        try {
            const taskCreateResponse = await fetch(`${base_url}/task/create/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    team: myself.teamId,
                    project: taskContents.project.id,
                    assignee: taskContents.assignee.userId,
                    reporter: taskContents.reporter.userId,
                    title: taskContents.title,
                    priority: (taskContents.priority.priority !== "") ? taskContents.priority.priority : null,
                    effort_level: (taskContents.effortLevel.level !== "") ? taskContents.effortLevel.level : null,
                    status: (taskContents.status.status !== "") ? taskContents.status.status : null,
                    content: (taskContents.body !== "") ? taskContents.body : null,
                    due_date: (taskContents.dueDate !== "") ? taskContents.dueDate : null,
                    github_url: (taskContents.githubLink.url !== "") ? taskContents.githubLink.url : null,
                    github_url_title: (taskContents.githubLink.title !== "") ? taskContents.githubLink.title : null,
                    general_url: (taskContents.generalLink.url !== "") ? taskContents.generalLink.url : null,
                    general_url_title: (taskContents.generalLink.title !== "") ? taskContents.generalLink.title : null,
                    tags: taskContents.tags,
                }),
            });

            const taskCreateData = await taskCreateResponse.json();
            console.log("taskCreateData:", taskCreateData)

            if (!taskCreateResponse.ok) {
                throw new Error('Failed to create a task');
            } else {
                for (const attachment of taskContents.attachments) {
                    const formData = new FormData()
                    formData.append("task", taskCreateData.task_id)
                    formData.append("attached_file", attachment.file)
                    formData.append("attached_type", attachment.file.type)

                    const uploadAttachmentResponse = await fetch(`${base_url}/task/addTaskAttachment/`, {
                        method: 'POST',
                        headers: {
                            "Authorization": `Bearer ${accessToken}`
                        },
                        body: formData,
                    });

                    const uploadAttachmentData = await uploadAttachmentResponse.json();
                    console.log("uploadAttachmentData:", uploadAttachmentData)

                    if (!uploadAttachmentResponse.ok) {
                        throw new Error(uploadAttachmentData.message || 'Attachment Upload Failed');
                    }
                }

                setIsSubmitted(true)
            }
        } catch (error) {
            console.error(error);
            return [];
        }
    }

};

type TaskContentProps = {
    myself: UserProps,
    currentProject: ProjectProps,
    setIsCreatingTask: (value: boolean) => void;
    setIsTaskContentVisible: (value: boolean) => void;
};

const initUploadingFiles: AttachmentFileProps[] = []

export default function CreateTask(props: TaskContentProps) {
    const { myself, currentProject, setIsCreatingTask, setIsTaskContentVisible } = props
    const { accessToken } = useAuth();
    const [uploadedFiles, setUploadedFiles] = useState<AttachmentFileProps[]>(initUploadingFiles);

    const [taskContents, setTaskContents] = useState<CreateTaskProps>({
        project: currentProject,
        title: "",
        body: "",
        assignee: myself,
        reporter: myself,
        dueDate: getFormattedTodayDateStr(),
        status: { code: 0, status: 'open', color: 'primary' },
        priority: { code: -1, priority: '', color: '' },
        effortLevel: { code: -1, level: '', color: '' },
        tags: [],
        githubLink: { url: '', title: '' },
        generalLink: { url: '', title: '' },
        attachments: initUploadingFiles
    });
    const [taskTitle, setTaskTitle] = useState<string>("");
    const [body, setBody] = useState<string>("");
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        if (taskTitle !== "") {
            setTaskContents(prevState => ({
                ...prevState,
                title: taskTitle
            }));
        }
    }, [taskTitle])

    useEffect(() => {
        setTaskContents(prevState => ({
            ...prevState,
            body: body
        }));
    }, [body])

    useEffect(() => {
        if (isSubmitted) {
            setIsCreatingTask(false)
            setIsTaskContentVisible(true)
        }
    }, [isSubmitted])

    useEffect(() => {
        setTaskContents(prevState => ({
            ...prevState,
            attachments: uploadedFiles
        }));
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
                setTaskContents(prevState => ({
                    ...prevState,
                    attachments: [{ file: file }]
                }));
            })
        }
    };

    function getMdHeight(text: string): number {
        const height: number = Math.min(Math.max(text.split('\n').length * 20, 450), 800)
        return height;
    }

    // Github URL link manager
    const [prUrl, setPRUrl] = useState("");
    const [prTitle, setPRTitle] = useState("");
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
            setTaskContents(prevState => ({
                ...prevState,
                githubLink: { url: prUrl, title: prTitle }
            }));
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
            setTaskContents(prevState => ({
                ...prevState,
                generalLink: { url: url, title: title }
            }));
            setError("");
        } else {
            setErrorOpen(true);
            setError("Please enter a valid URL.");
        }
    };
    const [errorOpen, setErrorOpen] = React.useState(false);

    const [titleErrorOpen, setTitleErrorOpen] = React.useState(false);
    const [titleError, setTitleError] = useState("");

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
                    {/* Wrap the title and task status in the same Box */}
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
                        <FormControl required sx={{ width: '100%' }}>
                            <Input
                                key={'taskTitle'}
                                variant='soft'
                                placeholder="Task Title"
                                defaultValue={taskTitle}
                                onChange={(e) => {
                                    setTaskTitle(e.target.value)
                                }}
                                onBlur={() => { console.log("update title") }}
                                sx={{ fontSize: '20px', fontWeight: 'bold', backgroundColor: 'transparent' }}
                            />
                        </FormControl>
                    </Box>

                    <IconButton
                        size="sm"
                        variant="plain"
                        color="neutral"
                        onClick={() => { setIsCreatingTask(false) }}
                    >
                        <CancelIcon />
                    </IconButton>
                    {titleError && <Snackbar
                        autoHideDuration={5000}
                        open={titleErrorOpen}
                        variant='soft'
                        color='danger'
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                        onClose={(event, reason) => {
                            if (reason === 'clickaway') {
                                return;
                            }
                            setTitleErrorOpen(false);
                        }}
                    >
                        {titleError}
                    </Snackbar>}
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
                                defaultValue={sampleUsers[0]}
                                onChange={(event, value) => {
                                    if (value !== null) {
                                        setTaskContents(prevState => ({
                                            ...prevState,
                                            assignee: value
                                        }));
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
                                defaultValue={sampleUsers[0]}
                                onChange={(event, value) => {
                                    if (value !== null) {
                                        setTaskContents(prevState => ({
                                            ...prevState,
                                            reporter: value
                                        }));
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
                                        onChange={(event, value) => {
                                            if (value !== null) {
                                                setTaskContents(prevState => ({
                                                    ...prevState,
                                                    project: {
                                                        id: value.id,
                                                        name: value.name,
                                                        color: value.color,
                                                    }
                                                }));
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
                                                setTaskContents(prevState => ({
                                                    ...prevState,
                                                    tags: value
                                                }));
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
                                                setTaskContents(prevState => ({
                                                    ...prevState,
                                                    priority: value.slice(-1)[0]
                                                }));
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
                                                setTaskContents(prevState => ({
                                                    ...prevState,
                                                    effortLevel: value.slice(-1)[0]
                                                }));
                                            }
                                        }}
                                        size="md"
                                        sx={{ width: "100%" }}
                                    />
                                </ListItem>

                            </Grid>
                        </Grid>

                        <ListItem>
                            <Typography sx={{ minWidth: "100px" }}>Due Date:</Typography>
                            <Input
                                type="date"
                                color="neutral"
                                variant="outlined"
                                size="sm"
                                value={(taskContents.dueDate) ? taskContents.dueDate : ""}
                                onChange={(e) => {
                                    setTaskContents(prevState => ({
                                        ...prevState,
                                        dueDate: getFormattedDateStr(new Date(e.target.value)),
                                    }));
                                }}
                                slotProps={{
                                    input: {
                                        min: getFormattedTodayDateStr(),
                                    },
                                }}
                            />
                            <Button
                                component='a'
                                variant="outlined"
                                color="neutral"
                                size='sm'
                                onClick={() => {
                                    setTaskContents(prevState => ({
                                        ...prevState,
                                        dueDate: ""
                                    }));
                                }}>
                                TBD
                            </Button>
                        </ListItem>

                        <ListItem>
                            <GithubIcon />

                            {(!taskContents.githubLink?.url || taskContents.githubLink.url === "") && (
                                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
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
                                        component='a'
                                        variant="outlined"
                                        color="neutral"
                                        size='sm'
                                        onClick={handlePRSave}>
                                        Set
                                    </Button>
                                </Stack>
                            )}

                            {taskContents.githubLink?.url && (
                                <Typography>
                                    <a href={taskContents.githubLink.url} target="_blank" rel="noopener noreferrer">
                                        {prTitle}
                                    </a>
                                </Typography>
                            )}
                        </ListItem>

                        <ListItem>
                            <CustomLinkIcon />

                            {(!taskContents.generalLink?.url || taskContents.generalLink.url === "") && (
                                <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
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
                                        component='a'
                                        variant="outlined"
                                        color="neutral"
                                        size='sm'
                                        onClick={handleSave}>
                                        Set
                                    </Button>
                                </Stack>
                            )}

                            {taskContents.generalLink?.url && (
                                <Typography>
                                    <a href={taskContents.generalLink.url} target="_blank" rel="noopener noreferrer">
                                        {taskContents.generalLink.title}
                                    </a>
                                </Typography>
                            )}
                        </ListItem>
                    </List>
                </Box>
            </Box>

            <Divider sx={{ mt: 1, mb: 1 }} />

            <Stack direction={"column"} sx={{ width: '100%' }}>
                <Box sx={{ mt: 2 }}>
                    <div className="md-content">
                        <MarkdownEditor
                            content={body}
                            setBody={setBody}
                            height={getMdHeight(body)}
                            mdMode={"edit"}
                            isTaskBody={true}
                            setTaskUpdate={(val) => { val }}
                        />
                    </div>
                </Box>
            </Stack>

            <Divider sx={{ m: 2 }} />

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

            <FileUpload
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                setTaskUpdate={() => { }}
            />

            <Divider sx={{ m: 2 }} />

            <Stack
                direction="row"
                sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}
            >
                <Button
                    component='button'
                    type="submit"
                    variant="soft"
                    color="primary"
                    onClick={() => {
                        saveTask({
                            myself: myself,
                            taskContents: taskContents,
                            accessToken: accessToken || "",
                            setIsSubmitted: setIsSubmitted,
                            setTitleError: setTitleError,
                            setTitleErrorOpen: setTitleErrorOpen
                        })
                    }}
                >
                    Create
                </Button>
                <Button
                    component='button'
                    variant="outlined"
                    color="danger"
                    size='sm'
                    onClick={() => { setIsCreatingTask(false) }}>
                    Cancel
                </Button>
            </Stack>
        </Sheet>
    );
}
