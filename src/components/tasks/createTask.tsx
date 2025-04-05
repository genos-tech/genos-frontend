import * as React from 'react';
import { useState, useEffect } from "react";
import Avatar from '@mui/joy/Avatar';
import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import Divider from '@mui/joy/Divider';
import { Input, Button, Stack } from "@mui/joy";
import Snackbar from '@mui/joy/Snackbar';
import FileUpload from '../fileUpload/upload'
import IconButton from '@mui/joy/IconButton';
import CancelIcon from '@mui/icons-material/Cancel';
import GithubIcon from '../../assets/GithubIcon';
import CustomLinkIcon from '../../assets/CustomLinkIcon';
import { MarkdownEditor } from "../../components/markdownEditor/taskMdEditor";
import { UserProps, TaskProps, ProjectProps } from "../../types";
import Autocomplete from '@mui/joy/Autocomplete';
import Close from '@mui/icons-material/Close';
import FormControl from '@mui/joy/FormControl';
import { useAuth } from "../../components/admin/AuthContext";

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

const sampleProjects = [
    { id: 1, project: 'origin-marketing', color: 'primary' },
    { id: 2, project: 'origin-analytics', color: 'danger' },
    { id: 3, project: 'origin-ai', color: 'warning' }]


const sampleTags = [
    { tag: 'Frontend', color: 'primary' },
    { tag: 'Backend', color: 'danger' },
    { tag: 'Infra', color: 'warning' }
]

const status = [
    { id: 0, priority: 'Open', color: 'primary' },
    { id: 1, priority: 'WIP', color: 'warning' },
    { id: 3, priority: 'Close', color: 'success' },
    { id: 2, priority: 'Deleted', color: 'danger' }
]

const priorities = [
    { id: 0, priority: 'Low', color: 'primary' },
    { id: 1, priority: 'Medium', color: 'warning' },
    { id: 2, priority: 'High', color: 'danger' }
]

const effortLevel = [
    { id: 0, level: 'Low', color: 'primary' },
    { id: 1, level: 'Medium', color: 'warning' },
    { id: 2, level: 'High', color: 'danger' }
]

interface FormElements extends HTMLFormControlsCollection {
    title: HTMLInputElement;
}
interface CreateTaskFormElement extends HTMLFormElement {
    readonly elements: FormElements;
}

const parseDateString = (dateString: string): Date => {
    return new Date(dateString);
};

const getFormattedTodayDateStr = (): string => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Extracts 'YYYY-MM-DD' from ISO format
};

const getFormattedDateStr = (date: Date): string => {
    return date.toISOString().split("T")[0]; // Extract YYYY-MM-DD from ISO string
};

type TaskCreateResponse = {
    access: string | null;
    refresh: string | null;
    user: any | null;
    message: string;
};

type saveTaskProps = {
    myself: UserProps,
    taskContents: TaskProps,
    accessToken: string
}

const saveTask = async (props: saveTaskProps) => {
    const { myself, taskContents, accessToken } = props;

    try {
        const taskCreateResponse = await fetch(`${base_url}/task/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                team: myself.teamId,
                project: taskContents.project.projectId,
                assignee: taskContents.assignee.userId,
                reporter: taskContents.reporter.userId,
                title: taskContents.title,
                priority: taskContents.priority,
                effort_level: taskContents.effortLevel,
                status: taskContents.status,
                content: taskContents.body,
                due_date: taskContents.dueDate
            }),
        });

        const taskCreateData: TaskCreateResponse = await taskCreateResponse.json();

        if (!taskCreateResponse.ok) {
            throw new Error(taskCreateData.message || 'User Creation Failed');
        }
    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "An unknown error occurred during post task content.";

        console.error(errorMsg);
        return [];
    }
};

type TaskContentProps = {
    myself: UserProps,
    currentProject: ProjectProps,
    setIsCreatingTask: (value: boolean) => void;
    setIsTaskContentVisible: (value: boolean) => void;
};

export default function CreateTask(props: TaskContentProps) {
    const { myself, currentProject, setIsCreatingTask, setIsTaskContentVisible } = props
    const { accessToken } = useAuth();

    const [taskContents, setTaskContents] = useState<TaskProps>({
        project: currentProject,
        title: "",
        body: "",
        assignee: myself,
        reporter: myself,
        dueDate: getFormattedTodayDateStr(),
        status: "open",
        priority: null,
        effortLevel: null,
        tags: [],
        githubLink: null,
        generalLink: null,
        attachments: []
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
            setIsSubmitted(true)
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
            console.log("taskContents:", taskContents)
            saveTask({
                myself: myself,
                taskContents: taskContents,
                accessToken: accessToken || ""
            })
            setIsCreatingTask(false)
            setIsTaskContentVisible(true)
        }
    }, [isSubmitted])

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
            <form
                onSubmit={(event: React.FormEvent<CreateTaskFormElement>) => {
                    event.preventDefault(); // Needs for prevent reload page
                    const formElements = event.currentTarget.elements;
                    const title = formElements.title.value
                    setTaskTitle(title)
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
                                    type="title"
                                    name="title"
                                    placeholder='Task title'
                                    variant='soft'
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
                                <Typography sx={{ minWidth: "100px" }}>Assignee:</Typography>
                                <Avatar size="sm">K</Avatar>
                                <Autocomplete
                                    options={sampleUsers}
                                    getOptionLabel={(option) => `${option.userName} | ${option.userEmail}`}
                                    onChange={(event, value) => {
                                        if (value !== null) {
                                            setTaskContents(prevState => ({
                                                ...prevState,
                                                assignee: value
                                            }));
                                        }
                                    }}
                                    size="sm"
                                    sx={{ width: '100%' }}
                                />
                            </ListItem>

                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Reporter:</Typography>
                                <Avatar size="sm">R</Avatar>
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
                                    size="sm"
                                    sx={{ width: '100%' }}
                                />
                            </ListItem>

                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Project:</Typography>
                                <Autocomplete
                                    options={sampleProjects}
                                    getOptionLabel={(option) => option.project}
                                    onChange={(event, value) => {
                                        if (value !== null) {
                                            setTaskContents(prevState => ({
                                                ...prevState,
                                                project: {
                                                    projectId: value.id,
                                                    projectName: value.project
                                                }
                                            }));
                                        }
                                    }}
                                    size="sm"
                                    sx={{ width: '100%' }}
                                />
                            </ListItem>

                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Tags:</Typography>
                                <Autocomplete
                                    multiple
                                    options={sampleTags}
                                    getOptionLabel={(option) => option.tag}
                                    limitTags={3}
                                    renderTags={(tags, getTagProps) =>
                                        tags.map((item, index) => {
                                            const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                            return (
                                                <Chip
                                                    key={key} // pass the key directly
                                                    variant="soft"
                                                    color={item.color}
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
                                    size="sm"
                                    sx={{ width: "100%" }}
                                />
                            </ListItem>

                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Priority:</Typography>
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
                                                    color={item.color}
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
                                                priority: value.slice(-1)[0].priority
                                            }));
                                        }
                                    }}
                                    size="sm"
                                    sx={{ width: "100%" }}
                                />
                            </ListItem>

                            <ListItem sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ minWidth: "100px" }}>Effort Level:</Typography>
                                <Autocomplete
                                    multiple
                                    options={effortLevel}
                                    getOptionLabel={(option) => option.level}
                                    renderTags={(tags, getTagProps) =>
                                        tags.slice(-1).map((item, index) => {
                                            const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                                            return (
                                                <Chip
                                                    key={key} // pass the key directly
                                                    variant="soft"
                                                    color={item.color}
                                                    endDecorator={<Close />}
                                                    {...tagProps} // pass the props except the key
                                                >
                                                    {item.level}
                                                </Chip>
                                            );
                                        })
                                    }
                                    onChange={(event, value) => {
                                        if (value !== null) {
                                            setTaskContents(prevState => ({
                                                ...prevState,
                                                effortLevel: value.slice(-1)[0].level
                                            }));
                                        }
                                    }}
                                    size="sm"
                                    sx={{ width: "100%" }}
                                />
                            </ListItem>

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
                                            dueDate: null
                                        }));
                                    }}>
                                    TBD
                                </Button>
                            </ListItem>

                            <ListItem>
                                <GithubIcon />

                                {(!taskContents.githubLink?.url || taskContents.githubLink.url === "") && (
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
                                mdMode={"edit"} />
                        </div>
                    </Box>
                </Stack>

                <Divider sx={{ mt: 2 }} />

                <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                    Attachments
                </Typography>

                <FileUpload />

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
                    >
                        Create
                    </Button>
                    <Button
                        component='button'
                        variant="outlined"
                        color="danger"
                        size='sm'
                        onClick={() => { console.log("Cancel task") }}>
                        Cancel
                    </Button>
                </Stack>
            </form>
        </Sheet>
    );
}
