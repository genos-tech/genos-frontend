import { Socket } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import {
    Box,
    Stack,
    Typography,
    IconButton,
    Button,
    FormControl,
    Input,
    Menu,
    MenuItem,
    Breadcrumbs,
    Tabs,
    TabList,
    TabPanel,
    Tab,
    Dropdown,
    MenuButton,
    Tooltip,
} from "@mui/joy";
import { PartialBlock } from "@blocknote/core";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import CheckIcon from "@mui/icons-material/Check";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CancelIcon from "@mui/icons-material/Cancel";

import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { BnTaskNoteEditor } from "../../../components/blockNote/bnTaskNoteEditor";
import { TaskNoteMetaProps, TaskNoteProps, TaskNoteMetaTreeNode } from "../../../types/notes";
import { sendUpdatedTaskNote } from "../services/sendUpdatedTaskNote";
import { useAuth } from "../../../context/AuthContext";
import { getCurrentTimestamp } from "../../../utils/dateUtils";
import { addNote } from "../services/addNote";
import { ModalDeleteTaskNote } from "../modals/ModalDeleteTaskNote";
import { getData } from "../../../db/crud";
import { STORES } from "../../../db/conf";
import { loadSpecificNote } from "../services/loadSpecificNote";

type TaskNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    currentNoteType: number;
    currentTaskNote: TaskNoteProps | null;
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    currentTaskNoteTitle: string;
    setCurrentTaskNoteTitle: (value: string) => void;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    taskNoteMeta: TaskNoteMetaProps[];
    setTaskNoteMeta: (value: TaskNoteMetaProps[]) => void;
    tabItems: TaskNoteProps[];
    setTabItems: (value: TaskNoteProps[]) => void;
    selectedTabIndex: number;
    setSelectedTabIndex: (value: number) => void;
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number
    ) => Promise<void>;
    currentTaskNoteChain: TaskNoteMetaTreeNode[];
    setCurrentNoteType: (value: number) => void;
    isInTaskPage: boolean;
    setIsTaskNoteVisible: (value: boolean) => void;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    isTaskPreviewVisible?: boolean;
    setIsTaskHomeVisible?: (value: boolean) => void;
};

export const TaskNoteMain = (props: TaskNoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        currentTaskNote,
        setCurrentTaskNote,
        currentTaskNoteTitle,
        setCurrentTaskNoteTitle,
        setOpeningService,
        setCurrentChat,
        currentNoteType,
        taskNoteMeta,
        setTaskNoteMeta,
        tabItems,
        setTabItems,
        selectedTabIndex,
        setSelectedTabIndex,
        handleCreateNewTaskNote,
        currentTaskNoteChain,
        setCurrentNoteType,
        isInTaskPage,
        setIsTaskNoteVisible,
        isCreatingTask,
        isTaskPreviewVisible,
        setIsTaskHomeVisible,
    } = props;

    const { accessToken } = useAuth();

    const breadcrumbsRef = useRef<HTMLDivElement>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (breadcrumbsRef.current && !breadcrumbsRef.current.contains(event.target as Node)) {
                handleClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const [noteUpdated, setNoteUpdated] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getCurrentTimestamp());

    // Send updated note to the backend when note is updated
    const updateNote = async () => {
        if (currentTaskNote) {
            const newNote: TaskNoteProps = {
                ...currentTaskNote,
                title: currentTaskNoteTitle,
                body: body || [],
            };
            // Send the update note to the backend
            await sendUpdatedTaskNote(myself, newNote, accessToken);

            // Add the updated note to the indexedDB
            await addNote(2, newNote);

            setStartIntervalUpdatingNote(false);
            setNoteBodyEdited(false);
            setNoteBodySaved(true);
            setNoteUpdated(false);

            // This needs to update the note title on the tab.
            setTabItems(
                tabItems.map((item) =>
                    item.noteType === currentTaskNote?.noteType &&
                    item.noteId === currentTaskNote?.noteId
                        ? { ...item, title: currentTaskNoteTitle }
                        : item
                )
            );

            // This needs to update the note title in the sidebar.
            setTaskNoteMeta(
                taskNoteMeta.map((item) =>
                    item.noteType === newNote.noteType && item.noteId === newNote.noteId
                        ? {
                              noteType: newNote.noteType,
                              noteId: newNote.noteId,
                              parentNoteId: newNote.parentNoteId,
                              projectId: newNote.projectId,
                              taskId: newNote.taskId,
                              title: newNote.title,
                              tsUpdated: newNote.tsUpdated,
                          }
                        : item
                )
            );
        }
    };

    useEffect(() => {
        if (noteUpdated) {
            updateNote();
        }
    }, [noteUpdated]);

    useEffect(() => {
        if (startIntervalUpdatingNote) {
            updateNote();
        }
    }, [startIntervalUpdatingNote]);

    // Auto save note body every Nms if needed
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (noteBodyEdited === true) {
                setStartIntervalUpdatingNote(true);
            }
        }, 3000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [noteBodyEdited]);

    // Tab management
    const [isUpdatingTabContents, setIsUpdatingTabContents] = useState(true);

    useEffect(() => {
        if (currentTaskNote) {
            setBody(currentTaskNote.body);
            setTsBody(getCurrentTimestamp()); // This must be executed together with "setBody" !!!!
            setCurrentTaskNoteTitle(currentTaskNote.title);

            if (
                isUpdatingTabContents === true &&
                (tabItems.length === 0 ||
                    (tabItems.length > 0 &&
                        tabItems.some((note) => note.noteId === currentTaskNote.noteId)) === false)
            ) {
                // Add the clicked note to the tab.
                setTabItems([...tabItems, currentTaskNote]);
                // Also, update the index to the clicked note.
                setSelectedTabIndex(tabItems.length); // switch to new tab
            } else {
                // Update the index when an user click a note in the sidebar
                setSelectedTabIndex(
                    tabItems.findIndex((note) => note.noteId === currentTaskNote.noteId)
                );
            }

            setIsUpdatingTabContents(true);
        }
    }, [currentTaskNote]);

    const setNote = async (noteId: number) => {
        const note: TaskNoteProps = await getData({
            storeName: STORES.TASK_NOTES,
            key: noteId,
        });
        if (note) {
            setTabItems([note]);
            setCurrentTaskNote(note);
        } else {
            setTabItems([]);
        }
        setSelectedTabIndex(0);
    };

    const handleCloseTab = (closedNoteId: number) => {
        if (tabItems.length > 1) {
            setTabItems(tabItems.filter((t) => t.noteId !== closedNoteId));
            if (selectedTabIndex >= tabItems.length - 1) {
                setSelectedTabIndex(tabItems.length - 2); // fallback to previous tab
            } else {
                setIsUpdatingTabContents(false);
            }
        } else if (taskNoteMeta.length > 0) {
            setNote(taskNoteMeta[0].noteId);
        }
    };

    useEffect(() => {
        if (isUpdatingTabContents === false) {
            if (tabItems[selectedTabIndex]) {
                setCurrentTaskNote(tabItems[selectedTabIndex]);
            }
        }
    }, [isUpdatingTabContents]);

    useEffect(() => {
        setNoteBodySaved(false);
        if (tabItems[selectedTabIndex] && tabItems[selectedTabIndex].noteType === 1) {
            setCurrentTaskNote(tabItems[selectedTabIndex]);
        }
    }, [selectedTabIndex]);

    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    const LoadNote = async (noteId: number) => {
        const note: TaskNoteProps = await getData({
            storeName: STORES.TASK_NOTES,
            key: noteId,
        });
        if (note) {
            setCurrentTaskNote(note);
        } else {
            const note: TaskNoteProps = await loadSpecificNote(myself, 2, noteId, accessToken);
            if (!note.error) {
                addNote(2, note);
                setCurrentTaskNote(note);
            }
        }
    };

    const titleInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <>
            {taskNoteMeta.length === 0 && (
                <Box
                    sx={{
                        height: "100%",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                    }}
                >
                    <IconButton
                        component="button"
                        variant="soft"
                        color="neutral"
                        sx={{
                            fontSize: "15px",
                            padding: "10px",
                        }}
                    >
                        Not Found
                    </IconButton>
                </Box>
            )}

            {taskNoteMeta.length > 0 && (
                <Stack direction={"column"} sx={{ width: "100%" }}>
                    {body && (
                        <>
                            {currentNoteType !== 0 && (
                                <Stack direction={"column"} sx={{ width: "100%" }}>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{
                                            width: "100%",
                                            height: "30px",
                                            mt: "10px",
                                            mb: "5px",
                                        }}
                                    >
                                        <Breadcrumbs separator="›" aria-label="breadcrumbs">
                                            <IconButton
                                                component="button"
                                                variant="soft"
                                                color="success"
                                                sx={{
                                                    fontSize: "14px",
                                                }}
                                            >
                                                <AssignmentRoundedIcon sx={{ fontSize: "20px" }} />
                                                Task Notes
                                            </IconButton>
                                            {currentTaskNoteChain.map((node) => (
                                                <Typography
                                                    level="title-sm"
                                                    component="button"
                                                    onClick={() => {
                                                        LoadNote(node.noteId);
                                                    }}
                                                    sx={{
                                                        background: "none",
                                                        border: "none",
                                                        padding: 0,
                                                        cursor: "pointer",
                                                        color: "#646CFF",
                                                        textAlign: "left",
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    {node.title.length > 19
                                                        ? `${node.title.slice(0, 19)}...`
                                                        : node.title}
                                                </Typography>
                                            ))}
                                        </Breadcrumbs>

                                        <Stack direction={"row"}>
                                            {isInTaskPage && currentTaskNote && (
                                                <IconButton
                                                    component="button"
                                                    variant="plain"
                                                    color="neutral"
                                                    sx={{
                                                        fontSize: "14px",
                                                        paddingRight: "10px",
                                                        height: "5px",
                                                    }}
                                                    onClick={() => {
                                                        handleCreateNewTaskNote(
                                                            currentTaskNote.noteId,
                                                            currentTaskNote.projectId,
                                                            currentTaskNote.taskId
                                                        );
                                                    }}
                                                >
                                                    <AddIcon />
                                                    Child Note
                                                </IconButton>
                                            )}

                                            {isInTaskPage && (
                                                <Tooltip title="Open in Notes">
                                                    <IconButton
                                                        size="sm"
                                                        color="neutral"
                                                        variant="plain"
                                                        sx={{ mb: "5px" }}
                                                        onClick={() => {
                                                            setOpeningService(3);
                                                        }}
                                                    >
                                                        <OpenInNewIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Dropdown>
                                                <MenuButton
                                                    slots={{ root: IconButton }}
                                                    slotProps={{
                                                        root: { color: "neutral" },
                                                    }}
                                                    sx={{ mb: "5px" }}
                                                >
                                                    <MoreVert />
                                                </MenuButton>
                                                <Menu size="sm">
                                                    <MenuItem
                                                        onClick={() => {
                                                            if (currentTaskNote) {
                                                                handleCreateNewTaskNote(
                                                                    currentTaskNote.noteId,
                                                                    currentTaskNote.projectId,
                                                                    currentTaskNote.taskId
                                                                );
                                                            } else {
                                                                console.error(
                                                                    "Can't parent note ID to create a child note."
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <AddIcon />
                                                        Child Note
                                                    </MenuItem>
                                                    <MenuItem
                                                        onClick={() => {
                                                            setOpenDeleteNote(true);
                                                        }}
                                                        sx={{
                                                            color: "red",
                                                            fontWeight: "bold",
                                                        }}
                                                    >
                                                        <DeleteIcon sx={{ color: "red" }} />
                                                        Delete Note
                                                    </MenuItem>
                                                </Menu>
                                            </Dropdown>

                                            {isInTaskPage === true && (
                                                <Tooltip title="Close Notes">
                                                    <IconButton
                                                        size="sm"
                                                        color="neutral"
                                                        variant="plain"
                                                        sx={{ mb: "5px" }}
                                                        onClick={() => {
                                                            setIsTaskNoteVisible(false);

                                                            // Open task-home (task table) when both task-preview and task-create-form are closed.
                                                            if (
                                                                isCreatingTask.flag === false &&
                                                                isTaskPreviewVisible === false &&
                                                                setIsTaskHomeVisible
                                                            ) {
                                                                setIsTaskHomeVisible(true);
                                                            }
                                                        }}
                                                    >
                                                        <CancelIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Stack>
                                        {currentTaskNote && (
                                            <ModalDeleteTaskNote
                                                myself={myself}
                                                openDeleteNote={openDeleteNote}
                                                setOpenDeleteNote={setOpenDeleteNote}
                                                taskNoteMeta={taskNoteMeta}
                                                setTaskNoteMeta={setTaskNoteMeta}
                                                currentTaskNote={currentTaskNote}
                                                handleCloseTab={handleCloseTab}
                                            />
                                        )}
                                    </Stack>

                                    <Tabs
                                        key={`tabs-${tabItems.length}`}
                                        value={selectedTabIndex}
                                        onChange={(_, val) => {
                                            setCurrentTaskNote(tabItems[Number(val)]);
                                            setSelectedTabIndex(Number(val));
                                            setCurrentNoteType(tabItems[Number(val)].noteType);
                                        }}
                                        aria-label="Scrollable tabs"
                                        sx={{ width: "100%" }}
                                    >
                                        <TabList
                                            sx={{
                                                px: "5px",
                                                overflowX: "auto",
                                                scrollSnapType: "x mandatory",
                                                "&::-webkit-scrollbar": { display: "none" },
                                            }}
                                        >
                                            {tabItems.map((tab, index) => (
                                                <Tab
                                                    key={`tab-main-${index}-${tsBody}`}
                                                    sx={{
                                                        task: "3px",
                                                        flex: "none",
                                                        scrollSnapAlign: "start",
                                                        borderRadius: "5px",
                                                    }}
                                                    variant="soft"
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            height: "20px",
                                                            maxWidth: "200px",
                                                        }}
                                                    >
                                                        {tab.title.length > 19
                                                            ? `${tab.title.slice(0, 19)}...`
                                                            : tab.title}

                                                        {tabItems.length > 1 && (
                                                            <IconButton
                                                                component="span"
                                                                size="sm"
                                                                variant="plain"
                                                                color="neutral"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCloseTab(
                                                                        Number(tab.noteId)
                                                                    );
                                                                }}
                                                                sx={{ ml: 1 }}
                                                            >
                                                                <CloseIcon />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </Tab>
                                            ))}
                                        </TabList>

                                        {tabItems.map((tabNote, index) => (
                                            <Box key={index}>
                                                {isInTaskPage === true &&
                                                    tabNote.noteType === 2 && (
                                                        <TabPanel
                                                            key={`tab-note-body-${tabNote.noteType}-${tabNote.noteId}-${tsBody}`}
                                                            value={index}
                                                            sx={{
                                                                paddingX: "5px",
                                                                paddingTop: "0px",
                                                                paddingBottom: "5px",
                                                            }}
                                                        >
                                                            <FormControl
                                                                required
                                                                sx={{
                                                                    mt: "10px",
                                                                    ml: "10px",
                                                                    justifyContent: "center",
                                                                    position: "absolute",
                                                                    zIndex: 100,
                                                                }}
                                                            >
                                                                <Input
                                                                    startDecorator={
                                                                        <NoteAltIcon />
                                                                    }
                                                                    key={"currentTaskNoteTitle"}
                                                                    variant="soft"
                                                                    placeholder="Note Title"
                                                                    value={currentTaskNoteTitle}
                                                                    onChange={(e) => {
                                                                        setCurrentTaskNoteTitle(
                                                                            e.target.value
                                                                        );
                                                                    }}
                                                                    slotProps={{
                                                                        input: {
                                                                            ref: titleInputRef,
                                                                            onKeyDown: (
                                                                                e: React.KeyboardEvent<HTMLInputElement>
                                                                            ) => {
                                                                                if (
                                                                                    e.key ===
                                                                                    "Enter"
                                                                                ) {
                                                                                    e.preventDefault(); // stop form submission if inside <form>
                                                                                    titleInputRef.current?.blur();
                                                                                }
                                                                            },
                                                                        },
                                                                    }}
                                                                    onBlur={() => {
                                                                        setNoteUpdated(true);
                                                                    }}
                                                                    sx={{
                                                                        fontSize: "22px",
                                                                        fontWeight: "bold",
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            {noteBodySaved === true && (
                                                                <Box
                                                                    sx={{
                                                                        position: "absolute",
                                                                        mt: "12px",
                                                                        ml: "335px",
                                                                        zIndex: 100,
                                                                    }}
                                                                >
                                                                    <Button
                                                                        variant="outlined"
                                                                        color="neutral"
                                                                        size="sm"
                                                                        startDecorator={
                                                                            <CheckIcon
                                                                                sx={{
                                                                                    fontSize:
                                                                                        "15px",
                                                                                }}
                                                                            />
                                                                        }
                                                                    >
                                                                        Saved
                                                                    </Button>
                                                                </Box>
                                                            )}
                                                            {currentTaskNote && (
                                                                <>
                                                                    <BnTaskNoteEditor
                                                                        teamMemberProfiles={
                                                                            teamMemberProfiles
                                                                        }
                                                                        myself={myself}
                                                                        setMyself={setMyself}
                                                                        socket={socket}
                                                                        teamMembers={teamMembers}
                                                                        currentTaskNote={
                                                                            currentTaskNote
                                                                        }
                                                                        body={body}
                                                                        setBody={setBody}
                                                                        setNoteBodyEdited={
                                                                            setNoteBodyEdited
                                                                        }
                                                                        setNoteBodySaved={
                                                                            setNoteBodySaved
                                                                        }
                                                                        setCurrentChat={
                                                                            setCurrentChat
                                                                        }
                                                                        setOpeningService={
                                                                            setOpeningService
                                                                        }
                                                                    />
                                                                </>
                                                            )}
                                                        </TabPanel>
                                                    )}
                                                {isInTaskPage === false && (
                                                    <TabPanel
                                                        key={`tab-note-body-${tabNote.noteType}-${tabNote.noteId}-${tsBody}`}
                                                        value={index}
                                                        sx={{
                                                            paddingX: "5px",
                                                            paddingTop: "0px",
                                                            paddingBottom: "5px",
                                                        }}
                                                    >
                                                        <FormControl
                                                            required
                                                            sx={{
                                                                mt: "10px",
                                                                ml: "10px",
                                                                justifyContent: "center",
                                                                position: "absolute",
                                                                zIndex: 100,
                                                            }}
                                                        >
                                                            <Input
                                                                startDecorator={<NoteAltIcon />}
                                                                key={"currentTaskNoteTitle"}
                                                                variant="soft"
                                                                placeholder="Note Title"
                                                                value={currentTaskNoteTitle}
                                                                onChange={(e) => {
                                                                    setCurrentTaskNoteTitle(
                                                                        e.target.value
                                                                    );
                                                                }}
                                                                onBlur={() => {
                                                                    setNoteUpdated(true);
                                                                }}
                                                                sx={{
                                                                    fontSize: "22px",
                                                                    fontWeight: "bold",
                                                                }}
                                                            />
                                                        </FormControl>
                                                        {noteBodySaved === true && (
                                                            <Box
                                                                sx={{
                                                                    position: "absolute",
                                                                    mt: "12px",
                                                                    ml: "335px",
                                                                    zIndex: 100,
                                                                }}
                                                            >
                                                                <Button
                                                                    variant="outlined"
                                                                    color="neutral"
                                                                    size="sm"
                                                                    startDecorator={
                                                                        <CheckIcon
                                                                            sx={{
                                                                                fontSize: "15px",
                                                                            }}
                                                                        />
                                                                    }
                                                                >
                                                                    Saved
                                                                </Button>
                                                            </Box>
                                                        )}
                                                        {currentTaskNote && (
                                                            <>
                                                                <BnTaskNoteEditor
                                                                    teamMemberProfiles={
                                                                        teamMemberProfiles
                                                                    }
                                                                    myself={myself}
                                                                    setMyself={setMyself}
                                                                    socket={socket}
                                                                    teamMembers={teamMembers}
                                                                    currentTaskNote={
                                                                        currentTaskNote
                                                                    }
                                                                    body={body}
                                                                    setBody={setBody}
                                                                    setNoteBodyEdited={
                                                                        setNoteBodyEdited
                                                                    }
                                                                    setNoteBodySaved={
                                                                        setNoteBodySaved
                                                                    }
                                                                    setCurrentChat={setCurrentChat}
                                                                    setOpeningService={
                                                                        setOpeningService
                                                                    }
                                                                />
                                                            </>
                                                        )}
                                                    </TabPanel>
                                                )}
                                            </Box>
                                        ))}
                                    </Tabs>
                                </Stack>
                            )}
                        </>
                    )}
                </Stack>
            )}
        </>
    );
};
