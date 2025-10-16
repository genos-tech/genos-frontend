import { useCallback, useEffect, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { Box, IconButton, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { useNoteAutoSave } from "../../shared/hooks/useNoteAutoSave";
import { useTaskPreview } from "../../shared/hooks/useTaskPreview";
import { ModalDeleteTaskNote } from "../modals/ModalDeleteTaskNote";
import { NoteActions } from "../../shared/components/NoteActions";
import { NoteHeader } from "../../shared/components/NoteHeader";
import { NoteTabs } from "../../shared/components/NoteTabs";

type TaskNoteMainProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
    setCurrentChat: (chat: ChatProps) => void;
    isInTaskPage: boolean;
    setIsTaskHomeVisible?: (value: boolean) => void;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: ChatProps) => void;
    funcSetAllChats: () => Promise<void>;
    NM: NoteManagementState;
    TM: TaskManagementState;
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
        setIsTaskHomeVisible,
        allChats,
        setCurrentMainChat,
        funcSetAllChats,
        NM,
        TM,
    } = props;

    const { accessToken } = useAuth();

    // Local state
    const [currentTaskNoteTitle, setCurrentTaskNoteTitle] = useState<string>(
        NM.currentTaskNote?.title || ""
    );
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

    const handleOpenInNotes = useCallback(() => {
        setOpeningService(3);
    }, [setOpeningService]);

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
        if (noteBodySaved && NM.currentTaskNote) {
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
        }
    }, [noteBodySaved, NM, currentTaskNoteTitle]);

    const pmChat = allChats.find(
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
                        <NoteHeader
                            currentTaskNoteChain={NM.currentTaskNoteChain || null}
                            onLoadNote={NM.loadNote}
                        />

                        <NoteActions
                            isInTaskPage={isInTaskPage}
                            currentTask={currentTask}
                            pmChat={pmChat}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            funcSetAllChats={funcSetAllChats}
                            setCurrentMainChat={setCurrentMainChat}
                            setOpeningService={setOpeningService}
                            teamMemberProfiles={teamMemberProfiles}
                            onCreateChildNote={handleCreateChildNote}
                            onOpenInNotes={handleOpenInNotes}
                            onOpenTask={handleOpenTask}
                            onDeleteNote={handleDeleteNote}
                            onCloseNotes={handleCloseNotes}
                        />

                        {NM.currentTaskNote && (
                            <ModalDeleteTaskNote
                                currentTabIndex={NM.selectedTabIndex}
                                currentTaskNote={NM.currentTaskNote}
                                handleCloseTab={handleCloseTab}
                                myself={myself}
                                openDeleteNote={openDeleteNote}
                                setOpenDeleteNote={setOpenDeleteNote}
                                setTaskNoteMeta={NM.setTaskNoteMeta}
                                taskNoteMeta={NM.taskNoteMeta}
                            />
                        )}
                    </Stack>

                    <NoteTabs
                        tabItems={NM.tabItems}
                        selectedTabIndex={NM.selectedTabIndex}
                        currentTaskNote={NM.currentTaskNote}
                        currentTaskNoteTitle={currentTaskNoteTitle}
                        body={body}
                        noteBodySaved={noteBodySaved}
                        tsBody={tsBody}
                        myself={myself}
                        setBody={setBody}
                        setCurrentChat={setCurrentChat}
                        setMyself={setMyself}
                        setNoteBodyEdited={setNoteBodyEdited}
                        setNoteBodySaved={setNoteBodySaved}
                        setOpeningService={setOpeningService}
                        socket={socket}
                        teamMemberProfiles={teamMemberProfiles}
                        teamMembers={teamMembers}
                        onLoadNote={NM.loadNote}
                        onCloseTab={handleCloseTab}
                        onTitleChange={handleTitleChange}
                        onTitleBlur={handleTitleBlur}
                    />
                </>
            )}
        </Stack>
    );
};
