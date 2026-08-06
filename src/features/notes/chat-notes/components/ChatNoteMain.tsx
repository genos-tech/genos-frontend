import { useCallback, useEffect, useMemo, useState } from "react";
import { Stack, TabPanel, Tabs } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useChatNoteEditor } from "../../../../hooks/notes/useChatNoteEditor";
import { upsertNoteCache } from "../../../../hooks/notes/useNoteData";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import type { NoteTab } from "../../../../hooks/notes/useNoteTabs";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";
import { ChatNoteEditor } from "./ChatNoteEditor";
import { ChatNoteEditorPanel } from "./ChatNoteEditorPanel";
import { ChatNoteHeader } from "./ChatNoteHeader";
import { ChatNoteTabList } from "./ChatNoteTabList";

/**
 * Props for the ChatNoteMain component
 */
interface ChatNoteMainProps {
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
    /** Whether the component is in chat page mode */
    isInChatPage: boolean;
    /** Whether the component is in task page mode */
    isInTaskPage: boolean;
    /** Function to set the current preview task ID */
    useTM: TaskManagementState;
    /** Function to set the current project */
    usePM: ProjectManagementState;
    /** Note management state and actions */
    useNM: NoteManagementState;
    /** Chat management state and actions */
    useCM: ChatManagementState;
    /** Host modal's z-index when rendered inside the UrlLinkModal, so the
     *  header's ⋮ menu lifts above it. Undefined on page surfaces. */
    hostZIndex?: number;
    /** Mobile notes-home: back to the sidebar list. */
    onMobileBack?: () => void;
}

export const ChatNoteMain = (props: ChatNoteMainProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        useUISM,
        isInChatPage,
        isInTaskPage,
        useTM,
        usePM,
        useNM,
        useCM,
        hostZIndex,
        onMobileBack,
    } = props;

    const { accessToken } = useAuth();

    // Local state
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);
    const [openSearchBox, setOpenSearchBox] = useState(false);

    // The chat-page panel uses isolated state (`chatPanelApi`) so the
    // notes-home tab strip is never touched by chat-page activity. The
    // notes-home rendering continues to read from `useNM.currentChatNote`
    // (which is now driven by `tabsApi.activeTab` via an effect in
    // `useNoteManagement`).
    const activeChatNote = isInChatPage ? useNM.chatPanelApi.note : useNM.currentChatNote;

    // In notes-home mode, the editor body lives in the LRU editor pool
    // (rendered by NoteContentRenderer), so this hook would just be
    // wasted work — we pass `null` to neutralize it. In chat-page mode,
    // the chat panel renders its single editor inline below, so the
    // hook still drives that.
    const chatNoteEditor = useChatNoteEditor({
        currentChatNote: isInChatPage ? activeChatNote : null,
        myself,
        accessToken,
        socket,
        resyncSignal: useNM.noteResyncNonce,
        onNoteUpdate: (updatedNote: ChatNoteProps) => {
            // Only fires from the chat-page editor — notes-home update
            // logic lives in `ChatNoteEditorPanel.onNoteUpdate`.
            upsertNoteCache(updatedNote);
            useNM.chatPanelApi.setNote(updatedNote);
            // MERGE into the existing meta row — never rebuild it, so
            // stale structural fields from this panel's note snapshot
            // (parentNoteId / chat anchoring) can't clobber a sidebar
            // move. See ChatNoteEditorPanel for the full rationale.
            useNM.setChatNoteMeta(
                useNM.chatNoteMeta.map((item) =>
                    item.noteType === updatedNote.noteType && item.noteId === updatedNote.noteId
                        ? {
                              ...item,
                              title: updatedNote.title,
                              tsUpdated: updatedNote.tsUpdated,
                          }
                        : item
                )
            );
            useNM.bumpNoteVersionsHead(updatedNote.noteType, updatedNote.noteId);
        },
    });

    // The notes-home tab strip mixes all kinds (my/task/chat); resolve
    // the tab by index first, then fall back to noteId, so the close
    // button works on any tab regardless of which Main is hosting the
    // strip right now.
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
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

    // Chat-page mode tab strip — driven by `chatPanelApi.tabs`, not by
    // the notes-home `tabsApi`. Each click sets the active panel note.
    const handleChatPanelTabChange = useCallback(
        (newValue: number) => {
            const next = useNM.chatPanelApi.tabs[newValue];
            if (next) useNM.chatPanelApi.setNote(next);
        },
        [useNM.chatPanelApi]
    );
    const handleChatPanelCloseTab = useCallback(
        async (_tabIndex: number, closingNoteId: number) => {
            useNM.chatPanelApi.closeTab(closingNoteId);
        },
        [useNM.chatPanelApi]
    );
    const chatPanelActiveTabIndex = useNM.chatPanelApi.tabs.findIndex(
        (t) => t.noteId === useNM.chatPanelApi.note?.noteId
    );

    // Reset note body saved status when the selected tab index changes
    useEffect(() => {
        chatNoteEditor.setNoteBodySaved(false);
    }, [useNM.selectedTabIndex]);

    // In chat-page mode, mirror the chat panel's note into the legacy
    // `useNM.currentChatNote` so child components (`ChatNoteHeader`,
    // search) that still read it work without modification. Notes-home
    // mode is driven by `tabsApi.activeTab` via the effect in
    // `useNoteManagement`.
    useEffect(() => {
        if (!isInChatPage) return;
        const next = useNM.chatPanelApi.note;
        if (next) {
            useNM.setCurrentChatNote(next);
        }
    }, [isInChatPage, useNM.chatPanelApi.note]);

    // Find the current chat.
    // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is `string`
    // post-flip; `activeChatNote.chatId` is still `number` (legacy note
    // schema). Stringify at the comparison.
    const chat = useCM.allChats.find(
        (c) =>
            c.chatType === activeChatNote?.chatType &&
            activeChatNote &&
            c.chatId === String(activeChatNote.chatId)
    );

    // In task-page mode ChatNoteMain renders standalone (the panel
    // hosting it isn't the notes-home view, so the editor pool in
    // `NoteContentRenderer` isn't mounted). Render a single inline
    // editor panel for the active chat note. Chat-page mode keeps its
    // own inline editor below (driven by `chatPanelApi`, not by
    // tabsApi), so this branch is gated on isInTaskPage.
    const inlineChatTab = useMemo<(NoteTab & { kind: "chat" }) | null>(() => {
        if (!isInTaskPage) return null;
        const n = useNM.currentChatNote;
        if (!n || !myself.teamId) return null;
        return {
            kind: "chat",
            noteType: 3,
            noteId: n.noteId,
            chatType: n.chatType,
            chatId: n.chatId,
            isThread: n.isThread,
            threadId: n.threadId,
            id: `chat-${n.noteId}`,
            title: n.title,
            teamId: myself.teamId,
        };
    }, [isInTaskPage, useNM.currentChatNote, myself.teamId]);

    // Event handlers
    const handleCreateChildNote = async () => {
        if (!activeChatNote) {
            console.error("Can't parent note ID to create a child note.");
            return;
        }
        const newNote = await useNM.handleCreateNewChatNote(
            activeChatNote.noteId,
            activeChatNote.chatType,
            activeChatNote.chatId,
            activeChatNote.isThread,
            activeChatNote.threadId
        );
        // Chat-page mode mirrors an isolated `chatPanelApi.note` rather
        // than the global `currentChatNote` — `handleCreateNewChatNote`
        // only touches the latter, so without this the chat panel keeps
        // showing the parent note even though the child was created.
        if (isInChatPage && newNote) {
            useNM.chatPanelApi.setNote(newNote);
        }
    };

    const handleDeleteNote = () => {
        setOpenDeleteNote(true);
    };

    // If the active note is not loaded yet, return null
    if (activeChatNote === null) {
        return null;
    }

    // If no chat note metadata, return null
    if (useNM.chatNoteMeta.length === 0) {
        return null;
    }

    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Stack direction={"column"} sx={{ width: "100%" }}>
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    sx={{
                        width: "100%",
                        // Keep back + title + actions on one row on
                        // mobile (see ChatNoteHeader).
                        minHeight: { xs: 48, md: 30 },
                        height: { xs: "auto", md: "30px" },
                        // Task-page panel wraps this Main with its
                        // own header zone, so we pull up by 15px to
                        // sit flush with that surround. Notes-home
                        // and chat-page use the standard 10px top
                        // gap.
                        mt: isInTaskPage ? "-15px" : { xs: "4px", md: "10px" },
                        mb: "5px",
                        px: { xs: 0.5, md: 0 },
                        minWidth: 0,
                    }}
                >
                    <ChatNoteHeader
                        chat={chat}
                        handleCloseTab={handleCloseTab}
                        hostZIndex={hostZIndex}
                        isInChatPage={isInChatPage}
                        isInTaskPage={isInTaskPage}
                        myself={myself}
                        onMobileBack={onMobileBack}
                        openDeleteNote={openDeleteNote}
                        openSearchBox={openSearchBox}
                        setMyself={setMyself}
                        setOpenDeleteNote={setOpenDeleteNote}
                        setOpenSearchBox={setOpenSearchBox}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        usePM={usePM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onCreateChildNote={handleCreateChildNote}
                        onDeleteNote={handleDeleteNote}
                    />
                </Stack>

                <Tabs
                    sx={{ width: "100%" }}
                    value={
                        isInChatPage
                            ? Math.max(0, chatPanelActiveTabIndex)
                            : useNM.selectedTabIndex
                    }
                    onChange={(_, val) => {
                        if (isInChatPage) {
                            handleChatPanelTabChange(Number(val));
                        } else {
                            handleTabChange(Number(val));
                        }
                    }}
                >
                    {/* Chat-page panel keeps its own isolated tab
                     * list (driven by `chatPanelApi.tabs`) so users
                     * can flip between a parent note and the child
                     * they just created from the header. Notes-home
                     * uses the cross-kind `useNM.tabItems` instead.
                     * The strip is hidden when there are 0–1 tabs
                     * (no value to add). */}
                    {!isInChatPage && (
                        <ChatNoteTabList
                            selectedTabIndex={useNM.selectedTabIndex}
                            tabItems={useNM.tabItems}
                            onCloseTab={handleCloseTab}
                        />
                    )}
                    {isInChatPage && useNM.chatPanelApi.tabs.length > 1 && (
                        <ChatNoteTabList
                            selectedTabIndex={Math.max(0, chatPanelActiveTabIndex)}
                            tabItems={useNM.chatPanelApi.tabs}
                            onCloseTab={handleChatPanelCloseTab}
                        />
                    )}

                    {/* Chat-page mode renders its own editor inline
                     * (no LRU pool here — chatPanelApi drives the
                     * active note). Notes-home mode's editors live
                     * in the pool rendered by NoteContentRenderer
                     * for cross-tab keepalive. The `chatNoteEditor`
                     * hook is fed `null` in notes-home mode, so
                     * `body` is undefined and this branch is naturally
                     * skipped. */}
                    {isInChatPage && activeChatNote && chatNoteEditor.body && (
                        <TabPanel
                            key={`tab-note-body-${activeChatNote.noteType}-${activeChatNote.noteId}`}
                            value={Math.max(0, chatPanelActiveTabIndex)}
                            sx={{
                                paddingX: "5px",
                                paddingTop: "0px",
                                paddingBottom: "5px",
                            }}
                        >
                            <ChatNoteEditor
                                body={chatNoteEditor.body}
                                currentChatNote={activeChatNote}
                                currentChatNoteTitle={chatNoteEditor.currentChatNoteTitle}
                                currentNoteMembers={useNM.currentNoteMembers}
                                myself={myself}
                                noteBodySaved={chatNoteEditor.noteBodySaved}
                                resyncSignal={useNM.noteResyncNonce}
                                setMyself={setMyself}
                                setNoteBodyEdited={chatNoteEditor.setNoteBodyEdited}
                                setNoteBodySaved={chatNoteEditor.setNoteBodySaved}
                                socket={socket}
                                titleInputRef={chatNoteEditor.titleInputRef}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                onBodyChange={chatNoteEditor.handleBodyChange}
                                onTitleBlur={chatNoteEditor.handleTitleBlur}
                                onTitleChange={chatNoteEditor.handleTitleChange}
                            />
                        </TabPanel>
                    )}
                </Tabs>

                {/* Task-page inline editor — task-page panel
                        renders a single chat note, so this is one
                        panel, always active. Notes-home renders editors
                        via the LRU pool in NoteContentRenderer
                        instead. The `key` forces remount on note id
                        change (parent → child) — BlockNote uses `body`
                        as an initial value and wouldn't pick up the
                        new doc otherwise. */}
                {isInTaskPage && inlineChatTab && (
                    <ChatNoteEditorPanel
                        key={inlineChatTab.id}
                        accessToken={accessToken}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        tab={inlineChatTab}
                        useCM={useCM}
                        useNM={useNM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        isActive
                    />
                )}
            </Stack>
        </Stack>
    );
};
