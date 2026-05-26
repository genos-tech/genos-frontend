import { useCallback, useMemo, useState } from "react";
import { Box, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import type { NoteTab } from "../../../../hooks/notes/useNoteTabs";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { NoteHeaderActions } from "../../common/components/NoteHeaderActions";
import { useTaskPreview } from "../../common/hooks/useTaskPreview";
import { ModalDeleteTaskNote } from "../modals/ModalDeleteTaskNote";
import { ACTaskNotes } from "./autocompletes/ACTaskNotes";
import { TaskNoteEditorPanel } from "./TaskNoteEditorPanel";
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

    const [openSearchBox, setOpenSearchBox] = useState(false);
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    // The BlockNote editor + autosave hook now lives in
    // `TaskNoteEditorPanel`, one instance per live tab. This Main owns
    // only the active-tab-bound chrome: header, modal, task-preview link.
    const { currentTask } = useTaskPreview({
        currentTaskNote: useNM.currentTaskNote,
        myself,
        accessToken: accessToken || "",
        setCurrentPreviewTask: useTM.setCurrentPreviewTask,
    });

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

    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            useNM.currentTaskNote &&
            chat.chatId === useNM.currentTaskNote.projectId
    );

    // In task-page mode TaskNoteMain renders standalone — the editor
    // pool lives in `NoteContentRenderer`, which is only mounted on
    // notes-home. So we render a single inline editor panel for the
    // active task tab here. We derive the tab from `currentTaskNote`
    // (set by `setCurrentTaskNote` in the active-tab sync effect) rather
    // than from `tabsApi.activeTabId` so the body still renders during
    // the brief sync gap right after a tab switch.
    const inlineTaskTab = useMemo<(NoteTab & { kind: "task" }) | null>(() => {
        if (!isInTaskPage) return null;
        const n = useNM.currentTaskNote;
        if (!n || !myself.teamId) return null;
        return {
            kind: "task",
            noteType: 2,
            noteId: n.noteId,
            projectId: n.projectId,
            taskId: n.taskId,
            id: `task-${n.noteId}`,
            title: n.title,
            teamId: myself.teamId,
        };
    }, [isInTaskPage, useNM.currentTaskNote, myself.teamId]);

    // If tabs exist but currentTaskNote is not loaded yet, return null
    if (useNM.currentTaskNote === null) {
        return null;
    }

    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            {useNM.currentNoteType !== 0 && (
                <>
                    {/* Note Header */}
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        sx={{
                            width: "100%",
                            height: "30px",
                            mt: isInTaskPage ? "-15px" : "10px",
                            mb: "5px",
                        }}
                    >
                        {isInTaskPage === true && (
                            <Box
                                sx={{
                                    ml: "5px",
                                    mb: "5px",
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

                        {isInTaskPage === false && (
                            <TaskNoteHeader
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                useCM={useCM}
                                useNM={useNM}
                                useUISM={useUISM}
                            />
                        )}

                        <NoteHeaderActions
                            currentTask={currentTask}
                            isInTaskPage={isInTaskPage}
                            myself={myself}
                            noteType={2}
                            pmChat={pmChat}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
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

                    {/* Just the tab strip — in notes-home mode the
                        editor body comes from the LRU pool in
                        NoteContentRenderer; in task-page mode we render
                        a single inline panel just below. */}
                    <TaskNoteTabs useNM={useNM} onCloseTab={handleCloseTab} />

                    {/* Task-page inline editor — task-page panel is
                        single-note, so this is one panel, always
                        active. The `key` is critical: BlockNote
                        treats `body` as an initial value and won't
                        sync subsequent body changes from props, so a
                        switch from parent → child note (e.g. via the
                        header's "Child Note" action) must force a
                        full remount, otherwise the editor keeps
                        showing the parent's document. */}
                    {isInTaskPage && inlineTaskTab && (
                        <TaskNoteEditorPanel
                            key={inlineTaskTab.id}
                            accessToken={accessToken}
                            isActive
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            tab={inlineTaskTab}
                            useCM={useCM}
                            useNM={useNM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    )}
                </>
            )}
        </Stack>
    );
};
