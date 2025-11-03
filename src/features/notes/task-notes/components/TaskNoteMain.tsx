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
import { NoteHeaderActions } from "../../shared/components/NoteHeaderActions";
import { NoteTabs } from "../../shared/components/NoteTabs";
import { useNoteAutoSave } from "../../shared/hooks/useNoteAutoSave";
import { useTaskPreview } from "../../shared/hooks/useTaskPreview";
import { ModalDeleteTaskNote } from "../modals/ModalDeleteTaskNote";
import { ACTaskNotes } from "./autocompletes/ACTaskNotes";
import { TaskNoteHeader } from "./TaskNoteHeader";

type TaskNoteMainProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
    CM: ChatManagementState;
    isInTaskPage: boolean;
    setIsTaskHomeVisible?: (value: boolean) => void;
    NM: NoteManagementState;
    TM: TaskManagementState;
};

export const TaskNoteMain = (props: TaskNoteMainProps) => {
    const { TEM, socket, myself, setMyself, UIM, CM, isInTaskPage, setIsTaskHomeVisible, NM, TM } =
        props;

    const { accessToken } = useAuth();

    // Local state
    const [currentTaskNoteTitle, setCurrentTaskNoteTitle] = useState<string>(
        NM.currentTaskNote?.title || ""
    );
    const [openSearchBox, setOpenSearchBox] = useState(false);
    const [body, setBody] = useState<PartialBlock[]>();
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    // Custom hooks
    const { noteBodyEdited, noteBodySaved, setNoteBodyEdited, setNoteBodySaved, updateNote } =
        useNoteAutoSave({
            currentTaskNote: NM.currentTaskNote,
            currentTaskNoteTitle,
            body,
            myself,
            accessToken: accessToken || "",
            setTabItems: NM.setTabItems,
            setTaskNoteMeta: NM.setTaskNoteMeta,
        });

    const { currentTask } = useTaskPreview({
        currentTaskNote: NM.currentTaskNote,
        myself,
        accessToken: accessToken || "",
        setCurrentPreviewTask: TM.setCurrentPreviewTask,
    });

    // Effects
    useEffect(() => {
        if (NM.currentTaskNote) {
            setBody(NM.currentTaskNote.body);
            setTsBody(getLocalCurrentTimestamp());
            setCurrentTaskNoteTitle(NM.currentTaskNote.title);
        }
    }, [NM.currentTaskNote]);

    useEffect(() => {
        setNoteBodySaved(false);
    }, [NM.selectedTabIndex]);

    // Event handlers
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
            const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
            const nextTabIndex = Math.max(tabIndex - 1, 0);
            NM.setTabItems(NM.tabItems.filter((t) => t.noteId !== closingNoteId));
            await NM.loadNote(
                NM.tabItems[indexOfNextNote].noteType,
                NM.tabItems[indexOfNextNote].noteId,
                nextTabIndex
            );
        },
        [NM]
    );

    const handleCreateChildNote = useCallback(() => {
        if (NM.currentTaskNote) {
            NM.handleCreateNewTaskNote(
                NM.currentTaskNote.noteId,
                NM.currentTaskNote.projectId,
                NM.currentTaskNote.taskId
            );
        }
    }, [NM]);

    const handleOpenTask = useCallback(() => {
        NM.setIsTaskVisibleInNote(true);
    }, [NM]);

    const handleDeleteNote = useCallback(() => {
        setOpenDeleteNote(true);
    }, []);

    const handleCloseNotes = useCallback(() => {
        NM.setIsTaskNoteVisible(false);
        if (
            TM.isCreatingTask.flag === false &&
            TM.isTaskPreviewVisible === false &&
            setIsTaskHomeVisible
        ) {
            setIsTaskHomeVisible(true);
        }
    }, [NM, TM, setIsTaskHomeVisible]);

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
            NM.currentTaskNote &&
            currentTaskNoteTitle !== NM.currentTaskNote.title
        ) {
            // Update the note title on the tab
            NM.setTabItems(
                NM.tabItems.map((item) =>
                    item.noteType === NM.currentTaskNote?.noteType &&
                    item.noteId === NM.currentTaskNote?.noteId
                        ? { ...item, title: currentTaskNoteTitle }
                        : item
                )
            );

            // Update the note title in the sidebar
            NM.setTaskNoteMeta(
                NM.taskNoteMeta.map((item) =>
                    item.noteType === NM.currentTaskNote?.noteType &&
                    item.noteId === NM.currentTaskNote?.noteId
                        ? { ...item, title: currentTaskNoteTitle }
                        : item
                )
            );

            NM.setCurrentTaskNote({
                ...NM.currentTaskNote,
                title: currentTaskNoteTitle,
            });
        }
    }, [noteBodySaved, NM, currentTaskNoteTitle]);

    const pmChat = CM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            NM.currentTaskNote &&
            chat.chatId === NM.currentTaskNote.projectId
    );

    // Early return for empty state
    if (NM.tabItems.length === 0 || NM.currentTaskNote === null) {
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
            {body && NM.currentNoteType !== 0 && (
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
                                    NM={NM}
                                />
                            </Box>
                        )}

                        {isInTaskPage === false && <TaskNoteHeader NM={NM} />}

                        <NoteHeaderActions
                            CM={CM}
                            currentTask={currentTask}
                            isInTaskPage={isInTaskPage}
                            myself={myself}
                            noteType={2}
                            pmChat={pmChat}
                            setMyself={setMyself}
                            socket={socket}
                            TEM={TEM}
                            UIM={UIM}
                            onCloseNotes={handleCloseNotes}
                            onCreateChildNote={handleCreateChildNote}
                            onCreateNewNote={() => {}} // Don't create new task note in task note page
                            onDeleteNote={handleDeleteNote}
                            onOpenTask={handleOpenTask}
                        />

                        {NM.currentTaskNote && (
                            <ModalDeleteTaskNote
                                handleCloseTab={handleCloseTab}
                                myself={myself}
                                openDeleteNote={openDeleteNote}
                                setOpenDeleteNote={setOpenDeleteNote}
                                NM={NM}
                            />
                        )}
                    </Stack>

                    <NoteTabs
                        body={body}
                        CM={CM}
                        NM={NM}
                        currentTaskNoteTitle={currentTaskNoteTitle}
                        myself={myself}
                        noteBodySaved={noteBodySaved}
                        setBody={setBody}
                        setMyself={setMyself}
                        setNoteBodyEdited={setNoteBodyEdited}
                        setNoteBodySaved={setNoteBodySaved}
                        socket={socket}
                        TEM={TEM}
                        tsBody={tsBody}
                        UIM={UIM}
                        onCloseTab={handleCloseTab}
                        onTitleBlur={handleTitleBlur}
                        onTitleChange={handleTitleChange}
                    />
                </>
            )}
        </Stack>
    );
};
