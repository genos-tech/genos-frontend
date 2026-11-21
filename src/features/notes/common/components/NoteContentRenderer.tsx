import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import { Box, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskPreview } from "../../../tasks/components/contents/TaskPreview";
import { ChatNoteEditorPanel } from "../../chat-notes/components/ChatNoteEditorPanel";
import { ChatNoteMain } from "../../chat-notes/components/ChatNoteMain";
import { MyNoteEditorPanel } from "../../my-notes/components/MyNoteEditorPanel";
import { MyNoteMain } from "../../my-notes/components/MyNoteMain";
import { TaskNoteEditorPanel } from "../../task-notes/components/TaskNoteEditorPanel";
import { TaskNoteMain } from "../../task-notes/components/TaskNoteMain";
import { NoteOpenFailure } from "./NoteOpenFailure";
import { NoteOpeningState } from "./NoteOpeningState";

type NoteContentRendererProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    /** Mobile notes-home: back to the sidebar list. Forwarded into
     *  each Main so the header can own the back button on one row. */
    onMobileBack?: () => void;
};

export const NoteContentRenderer = (props: NoteContentRendererProps) => {
    const {
        myself,
        setMyself,
        useUISM,
        socket,
        useTEM,
        usePM,
        useNM,
        useCM,
        useTM,
        onMobileBack,
    } = props;
    const isMobile = useIsMobile();
    const { t } = useTranslation();
    const { accessToken } = useAuth();

    // Note Home page - show dashboard when Home is selected
    // Get the currently selected tab's note type
    // This ensures we render the correct component based on the OPEN note,
    // not the sidebar category the user clicked on
    const selectedTab = useNM.tabItems[useNM.selectedTabIndex];
    const activeNoteType = selectedTab?.noteType ?? useNM.currentNoteType;

    // No notes open at all
    if (useNM.tabItems.length === 0) {
        // The route named a note and it would not open: say so (MIP-1307).
        if (useNM.noteOpenFailure) {
            return <NoteOpenFailure socket={socket} useNM={useNM} onMobileBack={onMobileBack} />;
        }
        // A note is being fetched and has no tab yet: "No Note Selected" would be untrue (MIP-1675).
        if (useNM.openingNote) return <NoteOpeningState />;
        return (
            <EmptyState
                data-empty="notes"
                icon={<DescriptionOutlinedIcon />}
                title={t.notes.placeholder.noNoteSelectedTitle}
                action={
                    useNM.currentNoteType === 1
                        ? {
                              label: t.notes.placeholder.newMyNote,
                              onClick: () => useNM.handleCreateNewMyNote(null),
                              icon: <NoteAddRoundedIcon />,
                          }
                        : undefined
                }
                body={
                    useNM.currentNoteType === 1
                        ? t.notes.placeholder.chooseMyNoteOrCreate
                        : t.notes.placeholder.chooseNoteToEdit
                }
                fill
            />
        );
    }

    // Shared Notes deliberately has NO placeholder pane. Clicking a
    // sidebar section header is a navigation gesture — it expands that
    // section's tree — and shouldn't tear down whatever the user was
    // reading. Shared notes render through the normal My-Notes path
    // below (they're personal notes), so the open note simply stays.
    //
    // Team Notes never had one, which is the behaviour to match.

    // The active Main renders the header + tab strip for the active
    // kind. The editor body for *every* live tab is rendered as a
    // sibling below (the LRU editor pool) — that's what makes tab
    // switching feel instant: a hidden panel is already mounted with
    // its BlockNote + collab provider warm, so the visible→hidden flip
    // is just CSS.
    //
    // Falling back to the active-Main render when its `current*Note`
    // is null: we still render the pool below, so a brief mid-switch
    // render (between activeTabId flipping and useNoteManagement's
    // sync effect setting `current*Note`) only briefly drops the
    // header, not the editor itself.
    const renderActiveMain = () => {
        if (activeNoteType === 1 && useNM.currentMyNote) {
            return (
                <MyNoteMain
                    isInTaskPage={false}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                    onMobileBack={onMobileBack}
                />
            );
        }
        if (activeNoteType === 2 && useNM.currentTaskNote) {
            return (
                <TaskNoteMain
                    isInTaskPage={false}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    onMobileBack={onMobileBack}
                />
            );
        }
        if (activeNoteType === 3 && useNM.currentChatNote) {
            return (
                <ChatNoteMain
                    isInChatPage={false}
                    isInTaskPage={false}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNM}
                    usePM={usePM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    onMobileBack={onMobileBack}
                />
            );
        }
        // No matching Main yet (sync effect still settling). Don't
        // render anything for the header zone — the pool below still
        // shows the active editor, so the screen isn't blank.
        return null;
    };

    const renderEditorPool = () => {
        if (useNM.tabsApi.liveTabIds.length === 0) return null;
        const tabsById = new Map(useNM.tabsApi.tabs.map((t) => [t.id, t]));
        return useNM.tabsApi.liveTabIds.map((tabId) => {
            const tab = tabsById.get(tabId);
            if (!tab) return null;
            const isActive = tab.id === useNM.tabsApi.activeTabId;
            if (tab.kind === "my") {
                return (
                    <MyNoteEditorPanel
                        key={tab.id}
                        accessToken={accessToken}
                        fillHeight={isMobile}
                        isActive={isActive}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        tab={tab}
                        useCM={useCM}
                        useNM={useNM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                );
            }
            if (tab.kind === "task") {
                return (
                    <TaskNoteEditorPanel
                        key={tab.id}
                        accessToken={accessToken}
                        fillHeight={isMobile}
                        isActive={isActive}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        tab={tab}
                        useCM={useCM}
                        useNM={useNM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                );
            }
            return (
                <ChatNoteEditorPanel
                    key={tab.id}
                    accessToken={accessToken}
                    fillHeight={isMobile}
                    isActive={isActive}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    tab={tab}
                    useCM={useCM}
                    useNM={useNM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        });
    };

    /* Task preview sidebar — stays a singleton bound to the active task
       tab, unaffected by the keepalive pool. */
    const taskPreview = activeNoteType === 2 &&
        useNM.currentTaskNote &&
        useNM.isTaskVisibleInNote &&
        useTM.currentPreviewTask && (
            <TaskPreview
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useNM={useNM}
                usePM={usePM}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />
        );

    if (isMobile) {
        // Split into a pinned header zone and a filling editor zone.
        // There's no room on a phone to let the page itself scroll — it
        // carries the header and tab strip off screen. So the pool takes
        // the leftover height and the active editor scrolls inside it
        // (`.note-editor-pool-fill` in App.css sizes the BlockNote
        // chain, which is otherwise pinned to a viewport fraction).
        return (
            <Stack direction="column" sx={{ width: "100%", height: "100%", minHeight: 0 }}>
                <Box sx={{ flexShrink: 0 }}>{renderActiveMain()}</Box>
                <Box
                    className="note-editor-pool-fill"
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                    }}
                >
                    {renderEditorPool()}
                    {useNM.openingNote && <NoteOpeningState overlay />}
                </Box>
                {taskPreview}
            </Stack>
        );
    }

    return (
        <Stack direction="column" sx={{ width: "100%" }}>
            {renderActiveMain()}
            {/* The editor area only: the overlay of a note being fetched stays off the header and tabs. */}
            <Box sx={{ position: "relative", width: "100%" }}>
                {renderEditorPool()}
                {useNM.openingNote && <NoteOpeningState overlay />}
            </Box>
            {taskPreview}
        </Stack>
    );
};
