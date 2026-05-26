import { useCallback, useMemo, useState } from "react";
import { Stack, Tabs } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import type { NoteTab } from "../../../../hooks/notes/useNoteTabs";
import { UserProps } from "../../../../types/admin";
import { EmptyState } from "../../common/components/EmptyState";
import { NoteHeaderActions } from "../../common/components/NoteHeaderActions";
import { NoteTabList } from "../../common/components/NoteTabList";
import { MyNoteHeader } from "../components/MyNoteHeader";
import { ModalDeleteMyNote } from "../modals/ModalDeleteMyNote";
import { MyNoteEditorPanel } from "./MyNoteEditorPanel";

/**
 * Props for the MyNoteMain component
 */
interface MyNoteMainProps {
    /** Whether the component is in task page mode */
    isInTaskPage: boolean;
    /** Team member profiles indexed by user ID */
    useTEM: TeamManagementState;
    /** Socket connection for real-time updates */
    socket: Socket | null;
    /** Current user information */
    myself: UserProps;
    /** Function to update current user */
    setMyself: (me: UserProps) => void;
    /** Function to set the opening service */
    useUISM: UIStateManagementState;
    /** Note management state and actions */
    useNM: NoteManagementState;
    /** Chat management state and actions */
    useCM: ChatManagementState;
}

export const MyNoteMain = (props: MyNoteMainProps) => {
    const { isInTaskPage, useTEM, socket, myself, setMyself, useUISM, useNM, useCM } = props;

    const { accessToken } = useAuth();
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);

    // In task-page mode MyNoteMain renders standalone — the editor pool
    // lives in `NoteContentRenderer`, which is only mounted on
    // notes-home. So we render a single inline editor panel for the
    // active my note here. Derived from `currentMyNote` so the body
    // still renders during the brief sync gap after a tab switch.
    const inlineMyTab = useMemo<(NoteTab & { kind: "my" }) | null>(() => {
        if (!isInTaskPage) return null;
        const n = useNM.currentMyNote;
        if (!n || !myself.teamId) return null;
        return {
            kind: "my",
            noteType: 1,
            noteId: n.noteId,
            id: `my-${n.noteId}`,
            title: n.title,
            teamId: myself.teamId,
        };
    }, [isInTaskPage, useNM.currentMyNote, myself.teamId]);

    // The notes-home tab strip mixes all kinds (my/task/chat) into a
    // single bar, so the close handler must derive the kind from the
    // tab being clicked rather than assuming "my". The strip passes
    // both the index and the noteId; we look up the tab by index in
    // `tabsApi.tabs` and use its own id, falling back to a noteId-based
    // search if the index drifted (e.g. another tab was closed in the
    // same render cycle).
    const handleCloseTab = useCallback(
        (tabIndex: number, closingNoteId: number) => {
            const all = useNM.tabsApi.tabs;
            const target = all[tabIndex] ?? all.find((t) => t.noteId === closingNoteId) ?? null;
            if (target) useNM.tabsApi.closeTab(target.id);
        },
        [useNM.tabsApi]
    );

    const handleTabChange = useCallback(
        (newValue: number) => {
            const next = useNM.tabsApi.tabs[newValue];
            if (next) useNM.tabsApi.switchTab(next.id);
        },
        [useNM.tabsApi]
    );

    // Event handlers
    const handleCreateNewNote = () => {
        useNM.handleCreateNewMyNote(null);
    };

    const handleCreateChildNote = () => {
        if (useNM.currentMyNote) {
            useNM.handleCreateNewMyNote(useNM.currentMyNote.noteId);
        } else {
            console.error("Can't parent note ID to create a child note.");
        }
    };

    const handleDeleteNote = () => {
        setOpenDeleteNote(true);
    };

    const handleCopyNoteLink = async () => {
        if (useNM.currentMyNote) {
            // Recipients of a shared note are in the "Shared Notes"
            // bucket; emit a /shared/ link so when they click it the
            // sidebar opens the right section.
            const isShared = useNM.currentNoteType === 4;
            const segment = isShared ? "shared" : "my";
            const noteUrl = `${window.location.origin}/workspace/notes/${segment}/${useNM.currentMyNote.noteId}`;
            try {
                await navigator.clipboard.writeText(noteUrl);
            } catch (err) {
                console.error("Failed to copy link:", err);
            }
        }
    };

    // If no tabs at all, show empty state with create button
    if (useNM.tabItems.length === 0) {
        return <EmptyState onCreateNewNote={handleCreateNewNote} />;
    }

    // If tabs exist but currentMyNote is not loaded yet, return null
    if (useNM.currentMyNote === null) {
        return null;
    }

    // This component renders the header + tab strip ONLY. The actual
    // BlockNote editor body lives in the editor pool below it (rendered
    // by NoteContentRenderer), so that switching tabs across kinds
    // doesn't unmount mounted editors.
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            {useNM.currentNoteType !== 0 && (
                <Stack direction={"column"} sx={{ width: "100%" }}>
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        sx={{
                            width: "100%",
                            height: "30px",
                            // Task-page panel wraps this Main with its
                            // own header zone, so we pull up by 15px to
                            // sit flush with that surround. Notes-home
                            // uses the standard 10px top gap.
                            mt: isInTaskPage ? "-15px" : "10px",
                            mb: "5px",
                        }}
                    >
                        <MyNoteHeader
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
                            useUISM={useUISM}
                        />

                        <NoteHeaderActions
                            currentTask={undefined}
                            isInTaskPage={isInTaskPage}
                            myself={myself}
                            noteType={1}
                            pmChat={undefined}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            onCopyNoteLink={handleCopyNoteLink}
                            onCreateChildNote={handleCreateChildNote}
                            onCreateNewNote={handleCreateNewNote}
                            onDeleteNote={handleDeleteNote}
                            onOpenTask={() => {}}
                            onCloseNotes={() => {
                                useNM.setIsTaskNoteVisible(false);
                            }}
                        />

                        {useNM.currentMyNote && (
                            <ModalDeleteMyNote
                                currentMyNote={useNM.currentMyNote}
                                currentTabIndex={useNM.selectedTabIndex}
                                handleCloseTab={handleCloseTab}
                                myNoteMeta={useNM.myNoteMeta}
                                myself={myself}
                                openDeleteNote={openDeleteNote}
                                setMyNoteMeta={useNM.setMyNoteMeta}
                                setOpenDeleteNote={setOpenDeleteNote}
                            />
                        )}
                    </Stack>

                    <Tabs
                        sx={{ width: "100%" }}
                        value={useNM.selectedTabIndex}
                        onChange={(_, val) => {
                            handleTabChange(Number(val));
                        }}
                    >
                        <NoteTabList useNM={useNM} onCloseTab={handleCloseTab} />
                    </Tabs>

                    {/* Task-page inline editor — task-page panel is
                        single-note, so this is one panel, always
                        active. Notes-home renders editors via the LRU
                        pool in NoteContentRenderer instead. */}
                    {isInTaskPage && inlineMyTab && (
                        <MyNoteEditorPanel
                            accessToken={accessToken}
                            isActive
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            tab={inlineMyTab}
                            useCM={useCM}
                            useNM={useNM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    )}
                </Stack>
            )}
        </Stack>
    );
};
