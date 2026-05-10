import { useCallback, useEffect, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Box, IconButton, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { upsertNoteCache } from "../../../../hooks/notes/useNoteData";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { NoteHeaderActions } from "../../common/components/NoteHeaderActions";
import { useNoteAutoSave } from "../../common/hooks/useNoteAutoSave";
import { useTaskPreview } from "../../common/hooks/useTaskPreview";
import { ModalDeleteTaskNote } from "../modals/ModalDeleteTaskNote";
import { ACTaskNotes } from "./autocompletes/ACTaskNotes";
import { TaskNoteHeader } from "./TaskNoteHeader";
import { TaskNoteTabs } from "./TaskNoteTabs";

type TaskNoteMainProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    isInTaskPage: boolean;
    setIsTaskTableVisible?: (value: boolean) => void;
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
        setIsTaskTableVisible,
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
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    // Custom hooks
    const { noteBodyEdited, noteBodySaved, setNoteBodyEdited, setNoteBodySaved, updateNote } =
        useNoteAutoSave({
            currentTaskNote: useNM.currentTaskNote,
            currentTaskNoteTitle,
            body,
            myself,
            accessToken: accessToken || "",
        });

    const { currentTask } = useTaskPreview({
        currentTaskNote: useNM.currentTaskNote,
        myself,
        accessToken: accessToken || "",
        setCurrentPreviewTask: useTM.setCurrentPreviewTask,
    });

    // Effects
    // Re-sync local body/title only when the user actually switches to a
    // different task note. Reference-only updates (e.g. an in-place save that
    // produces a new currentTaskNote object) must NOT trigger this — the
    // single TabPanel inside <NoteTabs> is keyed by `noteType-noteId` so it
    // remounts the editor on real switches and leaves the title input alone
    // during typing.
    useEffect(() => {
        if (useNM.currentTaskNote) {
            setBody(useNM.currentTaskNote.body);
            setCurrentTaskNoteTitle(useNM.currentTaskNote.title);
        }
    }, [useNM.currentTaskNote?.noteType, useNM.currentTaskNote?.noteId]);

    useEffect(() => {
        setNoteBodySaved(false);
    }, [useNM.selectedTabIndex]);

    // The notes-home tab strip mixes all kinds (my/task/chat). Look up
    // the tab by index in `tabsApi.tabs` so we close the right one,
    // regardless of whether it's a task tab. Falls back to a noteId
    // search if the index drifted (e.g. another tab was closed in the
    // same render cycle).
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
            const all = useNM.tabsApi.tabs;
            const target = all[tabIndex] ?? all.find((t) => t.noteId === closingNoteId) ?? null;
            if (target) useNM.tabsApi.closeTab(target.id);
        },
        [useNM.tabsApi]
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
            setIsTaskTableVisible
        ) {
            setIsTaskTableVisible(true);
            useTM.setIsSprintBoardVisible(false);
        }
    }, [useNM, useTM, setIsTaskTableVisible]);

    const handleTitleChange = useCallback((title: string) => {
        setCurrentTaskNoteTitle(title);
    }, []);

    const handleTitleBlur = useCallback(() => {
        updateNote();
    }, [updateNote]);

    const handleCopyNoteLink = useCallback(async () => {
        if (useNM.currentTaskNote) {
            const note = useNM.currentTaskNote;
            const noteUrl = `${window.location.origin}/workspace/notes/task/project/${note.projectId}/task/${note.taskId}/note/${note.noteId}`;
            try {
                await navigator.clipboard.writeText(noteUrl);
            } catch (err) {
                console.error("Failed to copy link:", err);
            }
        }
    }, [useNM.currentTaskNote]);

    // Handle note updates after auto-save
    useEffect(() => {
        if (
            noteBodySaved &&
            useNM.currentTaskNote &&
            currentTaskNoteTitle !== useNM.currentTaskNote.title
        ) {
            useNM.tabsApi.updateTabTitle(
                useNM.currentTaskNote.noteId,
                "task",
                currentTaskNoteTitle
            );

            useNM.setTaskNoteMeta(
                useNM.taskNoteMeta.map((item) =>
                    item.noteType === useNM.currentTaskNote?.noteType &&
                    item.noteId === useNM.currentTaskNote?.noteId
                        ? { ...item, title: currentTaskNoteTitle }
                        : item
                )
            );

            const nextTaskNote = {
                ...useNM.currentTaskNote,
                title: currentTaskNoteTitle,
            };
            upsertNoteCache(nextTaskNote);
            useNM.setCurrentTaskNote(nextTaskNote);
        }
    }, [noteBodySaved, useNM, currentTaskNoteTitle]);

    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            useNM.currentTaskNote &&
            chat.chatId === useNM.currentTaskNote.projectId
    );

    // If tabs exist but currentTaskNote is not loaded yet, return null
    if (useNM.currentTaskNote === null) {
        return null;
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
                            useNM={useNM}
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
                            onCopyNoteLink={handleCopyNoteLink}
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

                    <TaskNoteTabs
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
