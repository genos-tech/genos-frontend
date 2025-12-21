import { useCallback, useEffect, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Box, IconButton, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { NoteHeaderActions } from "../../shared-notes/components/NoteHeaderActions";
import { NoteTabs } from "../../shared-notes/components/NoteTabs";
import { useNoteAutoSave } from "../../shared-notes/hooks/useNoteAutoSave";
import { useTaskPreview } from "../../shared-notes/hooks/useTaskPreview";
import { ModalDeleteTaskNote } from "../modals/ModalDeleteTaskNote";
import { ACTaskNotes } from "./autocompletes/ACTaskNotes";
import { TaskNoteHeader } from "./TaskNoteHeader";

type TaskNoteMainProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    isInTaskPage: boolean;
    setIsTaskHomeVisible?: (value: boolean) => void;
    useNM: NoteManagementState;
    useTM: TaskManagementState;
};

export const TaskNoteMain = (props: TaskNoteMainProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        useUISM,
        useCM,
        isInTaskPage,
        setIsTaskHomeVisible,
        useNM,
        useTM,
    } = props;

    const { accessToken } = useAuth();

    // Local state
    const [currentTaskNoteTitle, setCurrentTaskNoteTitle] = useState<string>(
        useNM.currentTaskNote?.title || ""
    );
    const [openSearchBox, setOpenSearchBox] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    // Custom hooks
    const { noteBodyEdited, noteBodySaved, setNoteBodyEdited, setNoteBodySaved, updateNote } =
        useNoteAutoSave({
            currentTaskNote: useNM.currentTaskNote,
            currentTaskNoteTitle,
            body,
            myself,
            accessToken: accessToken || "",
            setTabItems: useNM.setTabItems,
            setTaskNoteMeta: useNM.setTaskNoteMeta,
        });

    const { currentTask } = useTaskPreview({
        currentTaskNote: useNM.currentTaskNote,
        myself,
        accessToken: accessToken || "",
        setCurrentPreviewTask: useTM.setCurrentPreviewTask,
    });

    // Effects
    useEffect(() => {
        if (useNM.currentTaskNote) {
            setBody(useNM.currentTaskNote.body);
            setTsBody(getLocalCurrentTimestamp());
            setCurrentTaskNoteTitle(useNM.currentTaskNote.title);
        }
    }, [useNM.currentTaskNote]);

    useEffect(() => {
        setNoteBodySaved(false);
    }, [useNM.selectedTabIndex]);

    // Event handlers
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
            const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
            const nextTabIndex = Math.max(tabIndex - 1, 0);
            useNM.setTabItems(useNM.tabItems.filter((t) => t.noteId !== closingNoteId));
            await useNM.loadNote(
                useNM.tabItems[indexOfNextNote].noteType,
                useNM.tabItems[indexOfNextNote].noteId,
                nextTabIndex
            );
        },
        [useNM]
    );

    const handleCreateChildNote = useCallback(() => {
        if (useNM.currentTaskNote) {
            useNM.handleCreateNewTaskNote(
                useNM.currentTaskNote.noteId,
                useNM.currentTaskNote.projectId,
                useNM.currentTaskNote.taskId
            );
        }
    }, [useNM]);

    const handleOpenTask = useCallback(() => {
        useNM.setIsTaskVisibleInNote(true);
    }, [useNM]);

    const handleDeleteNote = useCallback(() => {
        setOpenDeleteNote(true);
    }, []);

    const handleCloseNotes = useCallback(() => {
        useNM.setIsTaskNoteVisible(false);
        if (
            useTM.isCreatingTask.flag === false &&
            useTM.isTaskPreviewVisible === false &&
            setIsTaskHomeVisible
        ) {
            setIsTaskHomeVisible(true);
            useTM.setIsSprintBoardVisible(false);
        }
    }, [useNM, useTM, setIsTaskHomeVisible]);

    const handleTitleChange = useCallback((title: string) => {
        setCurrentTaskNoteTitle(title);
    }, []);

    const handleTitleBlur = useCallback(() => {
        updateNote();
    }, [updateNote]);

    // Handle note updates after auto-save
    useEffect(() => {
        if (
            noteBodySaved &&
            useNM.currentTaskNote &&
            currentTaskNoteTitle !== useNM.currentTaskNote.title
        ) {
            // Update the note title on the tab
            useNM.setTabItems(
                useNM.tabItems.map((item) =>
                    item.noteType === useNM.currentTaskNote?.noteType &&
                    item.noteId === useNM.currentTaskNote?.noteId
                        ? { ...item, title: currentTaskNoteTitle }
                        : item
                )
            );

            // Update the note title in the sidebar
            useNM.setTaskNoteMeta(
                useNM.taskNoteMeta.map((item) =>
                    item.noteType === useNM.currentTaskNote?.noteType &&
                    item.noteId === useNM.currentTaskNote?.noteId
                        ? { ...item, title: currentTaskNoteTitle }
                        : item
                )
            );

            useNM.setCurrentTaskNote({
                ...useNM.currentTaskNote,
                title: currentTaskNoteTitle,
            });
        }
    }, [noteBodySaved, useNM, currentTaskNoteTitle]);

    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            useNM.currentTaskNote &&
            chat.chatId === useNM.currentTaskNote.projectId
    );

    // Early return for empty state
    if (useNM.tabItems.length === 0 || useNM.currentTaskNote === null) {
        return (
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
                    color="neutral"
                    component="button"
                    variant="soft"
                    sx={{
                        fontSize: "15px",
                        padding: "10px",
                    }}
                >
                    No Chat Selected
                </IconButton>
            </Box>
        );
    }

    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            {body && useNM.currentNoteType !== 0 && (
                <>
                    {/* Note Header */}
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        sx={{
                            width: "100%",
                            height: "30px",
                            mt: "10px",
                            mb: "5px",
                        }}
                    >
                        {isInTaskPage === true && (
                            <Box
                                sx={{
                                    ml: "5px",
                                    mb: "10px",
                                    width: "40%",
                                }}
                            >
                                <ACTaskNotes
                                    myself={myself}
                                    openSearchBox={openSearchBox}
                                    setOpenSearchBox={setOpenSearchBox}
                                    useNM={useNM}
                                />
                            </Box>
                        )}

                        {isInTaskPage === false && <TaskNoteHeader useNM={useNM} />}

                        <NoteHeaderActions
                            useCM={useCM}
                            currentTask={currentTask}
                            isInTaskPage={isInTaskPage}
                            myself={myself}
                            noteType={2}
                            pmChat={pmChat}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            onCloseNotes={handleCloseNotes}
                            onCreateChildNote={handleCreateChildNote}
                            onCreateNewNote={() => {}} // Don't create new task note in task note page
                            onDeleteNote={handleDeleteNote}
                            onOpenTask={handleOpenTask}
                        />

                        {useNM.currentTaskNote && (
                            <ModalDeleteTaskNote
                                handleCloseTab={handleCloseTab}
                                myself={myself}
                                openDeleteNote={openDeleteNote}
                                setOpenDeleteNote={setOpenDeleteNote}
                                useNM={useNM}
                            />
                        )}
                    </Stack>

                    <NoteTabs
                        body={body}
                        useCM={useCM}
                        useNM={useNM}
                        currentTaskNoteTitle={currentTaskNoteTitle}
                        myself={myself}
                        noteBodySaved={noteBodySaved}
                        setBody={setBody}
                        setMyself={setMyself}
                        setNoteBodyEdited={setNoteBodyEdited}
                        setNoteBodySaved={setNoteBodySaved}
                        socket={socket}
                        useTEM={useTEM}
                        tsBody={tsBody}
                        useUISM={useUISM}
                        onCloseTab={handleCloseTab}
                        onTitleBlur={handleTitleBlur}
                        onTitleChange={handleTitleChange}
                    />
                </>
            )}
        </Stack>
    );
};
