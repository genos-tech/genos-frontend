import { useEffect, useRef, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

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

// Full-screen overlay shell. Mirrors MobileOverlay in MobileChatHome /
// MobileTaskHome.
const MobileOverlay = ({
    children,
    onClose,
}: {
    children: React.ReactNode;
    onClose: () => void;
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 1300,
                background: isDark
                    ? "linear-gradient(180deg, rgba(var(--gp-dark-surface-b-rgb), 1) 0%, rgba(11,10,22,1) 100%)"
                    : "linear-gradient(180deg, rgba(252,250,255,1) 0%, rgba(248,245,255,1) 100%)",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "var(--mobile-bottom-inset, 60px)",
            }}
        >
            <IconButton
                aria-label="Close"
                size="sm"
                variant="plain"
                sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    borderRadius: "10px",
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    "&:hover": {
                        background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                    },
                }}
                onClick={onClose}
            >
                <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pt: 5 }}>{children}</Box>
        </Box>
    );
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
                <Box sx={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto" }}>
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
                    <MobileOverlay onClose={() => useNM.setIsTaskVisibleInNote(false)}>
                        <Box sx={{ p: 1, height: "100%", overflow: "auto" }}>
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
                        </Box>
                    </MobileOverlay>
                )}
        </Box>
    );
};
