import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { MobileOverlay } from "../../components/layout/MobileOverlay";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
import { NoteContentRenderer } from "./common/components/NoteContentRenderer";
import { NoteSidebar } from "./common/components/NoteSidebar";

type MobileNoteHomeProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
};

export const MobileNoteHome = (props: MobileNoteHomeProps) => {
    const { useTEM, socket, myself, setMyself, useUISM, useNM, useCM, usePM, useTM, useSM } =
        props;

    // Mobile pane selection. Sidebar is the default landing surface;
    // tapping a note flips to content view. Back button returns to
    // sidebar without closing the tab so reopening the same surface
    // stays cheap.
    const [mobileViewMode, setMobileViewMode] = useState<"sidebar" | "content">(
        useNM.tabsApi.activeTabId !== null ? "content" : "sidebar"
    );

    // Detect "user opened a note from the sidebar" by watching
    // `openTick`, a counter that `useNoteTabs.openTab` bumps on every
    // call — even when the requested tab is already active (where
    // `activeTabId` wouldn't change and a plain state-diff effect
    // would silently miss the repeat click). Skip the very first run
    // so a rehydrated openTick doesn't auto-flip on mount.
    const lastOpenTickRef = useRef(useNM.tabsApi.openTick);
    useEffect(() => {
        if (useNM.tabsApi.openTick === lastOpenTickRef.current) return;
        lastOpenTickRef.current = useNM.tabsApi.openTick;
        setMobileViewMode("content");
    }, [useNM.tabsApi.openTick]);

    // Closing the last tab leaves `mobileViewMode` stuck on "content",
    // which shows the empty "No Note Selected" pane with no way back to
    // the list (the back button only lives on an open note's header).
    // Drop back to the sidebar whenever nothing is open.
    useEffect(() => {
        if (useNM.tabsApi.tabs.length === 0) {
            setMobileViewMode("sidebar");
        }
    }, [useNM.tabsApi.tabs.length]);

    // A deep link whose note would not open leaves no tab, so the sidebar
    // default would hide the reason; show the pane that says it (MIP-1307).
    // Keyed on the object, not a boolean: a second failure after Back replaces it.
    useEffect(() => {
        if (useNM.noteOpenFailure) setMobileViewMode("content");
    }, [useNM.noteOpenFailure]);

    // (The Home dashboard used to need its own flip-to-content signal
    // here, since it wasn't a tab. With Home gone, `openTick` above is
    // the only trigger.)

    const showSidebar = mobileViewMode === "sidebar";
    const showContent = mobileViewMode === "content";

    const handleBack = () => setMobileViewMode("sidebar");

    return (
        <Box
            sx={{
                flex: 1,
                height: "100%",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {showSidebar && (
                <Box sx={{ flex: 1, minHeight: 0, width: "100%" }}>
                    <NoteSidebar
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                </Box>
            )}

            {showContent && (
                // No separate mobile title bar — back + title + actions
                // live in the note Main header as a single row (see
                // MyNoteMain / TaskNoteMain / ChatNoteHeader).
                //
                // Deliberately not scrollable: the note header and tab
                // strip have to stay put, so the only vertical scroller
                // is the BlockNote editor further down. See the
                // `.note-editor-pool-fill` rules in App.css.
                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    <NoteContentRenderer
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        usePM={usePM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onMobileBack={handleBack}
                    />
                </Box>
            )}

            {/* Task preview overlay — surfaced from a task note when
                the user clicks a referenced task. Renders above the
                content. The desktop equivalent (TaskPreviewPanel)
                slides in as a side panel; mobile replaces with
                full-screen overlay. */}
            {useNM.isTaskVisibleInNote &&
                useTM.currentPreviewTask &&
                useNM.currentTaskNoteChain && (
                    // The shared shell, as on the task page: Close in a header row
                    // (the old local shell floated it over the pane and needed a 40px
                    // spacer), no padding around the preview, no dead strip below.
                    <MobileOverlay onClose={() => useNM.setIsTaskVisibleInNote(false)}>
                        <TaskPreview
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
                            usePM={usePM}
                            useSM={useSM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    </MobileOverlay>
                )}
        </Box>
    );
};
