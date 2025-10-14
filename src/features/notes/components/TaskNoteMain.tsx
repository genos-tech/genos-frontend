import { alpha } from "@mui/system";
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
    Chip,
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
import { useColorScheme } from "@mui/joy/styles";

import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";
import { BnTaskNoteEditor } from "../../../components/blockNote/bnTaskNoteEditor";
import { TaskNoteProps } from "../../../types/notes";
import { sendUpdatedTaskNote } from "../services/sendUpdatedTaskNote";
import { useAuth } from "../../../context/AuthContext";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { addNote } from "../services/addNote";
import { ModalDeleteTaskNote } from "../modals/ModalDeleteTaskNote";
import { TaskProps } from "../../../types/tasks";
import { loadSpecificTask } from "../../tasks/services/loadSpecificTask";
import { ProjectAvatar } from "../../../components/common/ProjectAvatar";
import { NoteManagementState } from "../../../hooks/useNoteManagement";

type TaskNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    isInTaskPage: boolean;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    isTaskPreviewVisible?: boolean;
    setIsTaskHomeVisible?: (value: boolean) => void;
    currentPreviewTask?: TaskProps;
    setCurrentPreviewTask: (value: TaskProps) => void;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: ChatProps) => void;
    funcSetAllChats: () => Promise<void>;
    NM: NoteManagementState;
};

export const TaskNoteMain = (props: TaskNoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        setOpeningService,
        setCurrentChat,
        isInTaskPage,
        isCreatingTask,
        isTaskPreviewVisible,
        setIsTaskHomeVisible,
        currentPreviewTask,
        setCurrentPreviewTask,
        allChats,
        setCurrentMainChat,
        funcSetAllChats,
        NM,
    } = props;

    const { mode } = useColorScheme();
    const { accessToken } = useAuth();

    const [noteUpdated, setNoteUpdated] = useState(false);
    const [startIntervalUpdatingNote, setStartIntervalUpdatingNote] = useState(false);
    const [currentTaskNoteTitle, setCurrentTaskNoteTitle] = useState<string>(
        NM.currentTaskNote?.title || ""
    );
    const [noteBodyEdited, setNoteBodyEdited] = useState(false);
    const [noteBodySaved, setNoteBodySaved] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    // Auto save note body every Nms if needed
    useEffect(() => {
        if (startIntervalUpdatingNote) {
            updateNote();
        }
    }, [startIntervalUpdatingNote]);
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (noteBodyEdited === true) {
                setStartIntervalUpdatingNote(true);
            }
        }, 3000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [noteBodyEdited]);

    // Send updated note to the backend when note is updated
    const updateNote = async () => {
        if (NM.currentTaskNote) {
            let newNoteTitle = currentTaskNoteTitle;

            // If the note title is empty, use the note original title.
            // (not updating the title to empty)
            if (currentTaskNoteTitle === "") {
                newNoteTitle = NM.currentTaskNote.title;
                setCurrentTaskNoteTitle(newNoteTitle);
            }

            const newNote: TaskNoteProps = {
                ...NM.currentTaskNote,
                title: newNoteTitle,
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
            NM.setTabItems(
                NM.tabItems.map((item) =>
                    item.noteType === NM.currentTaskNote?.noteType &&
                    item.noteId === NM.currentTaskNote?.noteId
                        ? newNote
                        : item
                )
            );

            // This needs to update the note title in the sidebar.
            NM.setTaskNoteMeta(
                NM.taskNoteMeta.map((item) =>
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

    const [currentTask, setCurrentTask] = useState<TaskProps | undefined>(currentPreviewTask);
    const setPreviewTask = async (projectId: number, taskId: number) => {
        const loadedTask: TaskProps[] = await loadSpecificTask(
            myself,
            projectId,
            taskId,
            accessToken
        );
        if (loadedTask.length === 1) {
            setCurrentPreviewTask(loadedTask[0]);
            setCurrentTask(loadedTask[0]);
        }
    };
    useEffect(() => {
        if (NM.currentTaskNote) {
            setPreviewTask(NM.currentTaskNote.projectId, NM.currentTaskNote.taskId);
        }
    }, [NM.currentTaskNote]);

    useEffect(() => {
        if (noteUpdated) {
            updateNote();
        }
    }, [noteUpdated]);

    useEffect(() => {
        if (NM.currentTaskNote) {
            setBody(NM.currentTaskNote.body);
            setTsBody(getLocalCurrentTimestamp());
            setCurrentTaskNoteTitle(NM.currentTaskNote.title);
        }
    }, [NM.currentTaskNote]);

    const handleCloseTab = async (tabIndex: number, closingNoteId: number) => {
        const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
        const nextTabIndex = Math.max(tabIndex - 1, 0);
        NM.setTabItems(NM.tabItems.filter((t) => t.noteId !== closingNoteId));
        await NM.loadNote(
            NM.tabItems[indexOfNextNote].noteType,
            NM.tabItems[indexOfNextNote].noteId,
            nextTabIndex
        );
    };

    useEffect(() => {
        setNoteBodySaved(false);
    }, [NM.selectedTabIndex]);

    const pmChat = allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            NM.currentTaskNote &&
            chat.chatId === NM.currentTaskNote.projectId
    );

    return (
        <>
            {(NM.tabItems.length === 0 || NM.currentTaskNote === null) && (
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
                        No Chat Selected
                    </IconButton>
                </Box>
            )}

            {!(NM.tabItems.length === 0 || NM.currentTaskNote === null) && (
                <Stack direction={"column"} sx={{ width: "100%" }}>
                    {body && (
                        <>
                            {NM.currentNoteType !== 0 && (
                                <Stack direction={"column"} sx={{ width: "100%" }}>
                                    {/* Note Header */}
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
                                            {NM.currentTaskNoteChain &&
                                                NM.currentTaskNoteChain.map((node) => (
                                                    <Typography
                                                        level="title-sm"
                                                        component="button"
                                                        onClick={() => {
                                                            NM.loadNote(2, node.noteId, -1);
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
                                                        {node.title.length > 14
                                                            ? `${node.title.slice(0, 14)}...`
                                                            : node.title}
                                                    </Typography>
                                                ))}
                                        </Breadcrumbs>

                                        <Stack direction={"row"}>
                                            {isInTaskPage && NM.currentTaskNote && (
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
                                                        if (NM.currentTaskNote) {
                                                            NM.handleCreateNewTaskNote(
                                                                NM.currentTaskNote.noteId,
                                                                NM.currentTaskNote.projectId,
                                                                NM.currentTaskNote.taskId
                                                            );
                                                        }
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

                                            {isInTaskPage === false && (
                                                <>
                                                    {currentTask && (
                                                        <>
                                                            {pmChat && (
                                                                <Box sx={{ mt: "2px" }}>
                                                                    <ProjectAvatar
                                                                        teamMemberProfiles={
                                                                            teamMemberProfiles
                                                                        }
                                                                        myself={myself}
                                                                        setMyself={setMyself}
                                                                        socket={socket}
                                                                        pmChat={pmChat}
                                                                        setOpeningService={
                                                                            setOpeningService
                                                                        }
                                                                        setCurrentMainChat={
                                                                            setCurrentMainChat
                                                                        }
                                                                        funcSetAllChats={
                                                                            funcSetAllChats
                                                                        }
                                                                    />
                                                                </Box>
                                                            )}
                                                            {currentTask.id && (
                                                                <Tooltip title="Open Task">
                                                                    <Chip
                                                                        key={`task-note-task-id${currentTask.id}`}
                                                                        variant="outlined"
                                                                        color="neutral"
                                                                        sx={{
                                                                            mt: "3px",
                                                                            mx: "5px",
                                                                            height: "30px",
                                                                            borderRadius: "5px",
                                                                            fontWeight: "bold",
                                                                        }}
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            NM.setIsTaskVisibleInNote(
                                                                                true
                                                                            );
                                                                        }}
                                                                    >
                                                                        ID: {currentTask.id}
                                                                    </Chip>
                                                                </Tooltip>
                                                            )}
                                                            <Chip
                                                                key={`task-title-${currentTask.id}`}
                                                                variant="outlined"
                                                                color="primary"
                                                                sx={{
                                                                    mt: "3px",
                                                                    mr: "5px",
                                                                    height: "30px",
                                                                    borderRadius: "5px",
                                                                    fontWeight: "bold",
                                                                }}
                                                                size="sm"
                                                            >
                                                                Title:{" "}
                                                                {currentTask.title.length > 14
                                                                    ? `${currentTask.title.slice(
                                                                          0,
                                                                          14
                                                                      )}...`
                                                                    : currentTask.title || "N/A"}
                                                            </Chip>
                                                            {currentTask.status.status && (
                                                                <Chip
                                                                    key={`task-status-${currentTask.status.status}`}
                                                                    size="sm"
                                                                    sx={{
                                                                        mt: "3px",
                                                                        mr: "5px",
                                                                        height: "30px",
                                                                        backgroundColor:
                                                                            currentTask.status
                                                                                .color
                                                                                ? alpha(
                                                                                      currentTask
                                                                                          .status
                                                                                          .color,
                                                                                      mode ===
                                                                                          "dark"
                                                                                          ? 0.5
                                                                                          : 0.75
                                                                                  )
                                                                                : "transparent",
                                                                        color: currentTask.status
                                                                            .textColor,
                                                                        fontWeight: "bold",
                                                                        borderRadius: "5px",
                                                                    }}
                                                                >
                                                                    {currentTask.status.status}
                                                                </Chip>
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            <Dropdown>
                                                <Tooltip title="More Options">
                                                    <MenuButton
                                                        slots={{ root: IconButton }}
                                                        slotProps={{
                                                            root: { color: "neutral" },
                                                        }}
                                                        sx={{ mb: "5px" }}
                                                    >
                                                        <MoreVert />
                                                    </MenuButton>
                                                </Tooltip>
                                                <Menu size="sm">
                                                    <MenuItem
                                                        onClick={() => {
                                                            if (NM.currentTaskNote) {
                                                                NM.handleCreateNewTaskNote(
                                                                    NM.currentTaskNote.noteId,
                                                                    NM.currentTaskNote.projectId,
                                                                    NM.currentTaskNote.taskId
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
                                                            NM.setIsTaskNoteVisible(false);

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
                                        {NM.currentTaskNote && (
                                            <ModalDeleteTaskNote
                                                myself={myself}
                                                openDeleteNote={openDeleteNote}
                                                setOpenDeleteNote={setOpenDeleteNote}
                                                taskNoteMeta={NM.taskNoteMeta}
                                                setTaskNoteMeta={NM.setTaskNoteMeta}
                                                currentTaskNote={NM.currentTaskNote}
                                                handleCloseTab={handleCloseTab}
                                                currentTabIndex={NM.selectedTabIndex}
                                            />
                                        )}
                                    </Stack>

                                    <Tabs
                                        value={NM.selectedTabIndex}
                                        onChange={(_, val) => {
                                            NM.loadNote(
                                                NM.tabItems[Number(val)].noteType,
                                                NM.tabItems[Number(val)].noteId,
                                                Number(val)
                                            );
                                        }}
                                        sx={{ width: "100%" }}
                                    >
                                        <TabList
                                            sx={{
                                                px: "5px",
                                                overflow: "auto",
                                                scrollSnapType: "x mandatory",
                                                "&::-webkit-scrollbar": { display: "none" },
                                            }}
                                        >
                                            {NM.tabItems.map((tab, index) => (
                                                <Tab
                                                    key={`tab-${index}`}
                                                    sx={{
                                                        mx: "2px",
                                                        my: "4px",
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
                                                        {tab.title.length > 14
                                                            ? `${tab.title.slice(0, 14)}...`
                                                            : tab.title}

                                                        {NM.tabItems.length > 1 && (
                                                            <IconButton
                                                                component="span"
                                                                size="sm"
                                                                variant="plain"
                                                                color="neutral"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCloseTab(
                                                                        index,
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

                                        {NM.tabItems.map((tabNote, index) => (
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
                                                        slotProps={{
                                                            input: {
                                                                ref: titleInputRef,
                                                                onKeyDown: (
                                                                    e: React.KeyboardEvent<HTMLInputElement>
                                                                ) => {
                                                                    if (e.key === "Enter") {
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
                                                                        fontSize: "15px",
                                                                    }}
                                                                />
                                                            }
                                                        >
                                                            Saved
                                                        </Button>
                                                    </Box>
                                                )}
                                                {NM.currentTaskNote && (
                                                    <>
                                                        <BnTaskNoteEditor
                                                            teamMemberProfiles={teamMemberProfiles}
                                                            myself={myself}
                                                            setMyself={setMyself}
                                                            socket={socket}
                                                            teamMembers={teamMembers}
                                                            currentTaskNote={NM.currentTaskNote}
                                                            body={body}
                                                            setBody={setBody}
                                                            setNoteBodyEdited={setNoteBodyEdited}
                                                            setNoteBodySaved={setNoteBodySaved}
                                                            setCurrentChat={setCurrentChat}
                                                            setOpeningService={setOpeningService}
                                                        />
                                                    </>
                                                )}
                                            </TabPanel>
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
