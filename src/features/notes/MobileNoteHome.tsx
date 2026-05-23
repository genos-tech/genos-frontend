import { useEffect, useRef, useState } from "react";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, IconButton, Stack, Typography } from "@mui/joy";
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
                    ? "linear-gradient(180deg, rgba(20,14,34,1) 0%, rgba(11,10,22,1) 100%)"
                    : "linear-gradient(180deg, rgba(252,250,255,1) 0%, rgba(248,245,255,1) 100%)",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "var(--BottomTabBar-height, 60px)",
            }}
        >
            <IconButton
                onClick={onClose}
                size="sm"
                variant="plain"
                aria-label="Close"
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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Mobile pane selection. Sidebar is the default landing surface;
    // tapping a note (or "Home" / a type root in the sidebar) flips to
    // content view. Back button returns to sidebar without closing the
    // tab so reopening the same surface stays cheap.
    const [mobileViewMode, setMobileViewMode] = useState<"sidebar" | "content">(
        useNM.tabsApi.activeTabId !== null || useNM.currentNoteType === 0 ? "content" : "sidebar"
    );

    // Detect "user opened a note from the sidebar" by watching for
    // activeTabId changes. Even tapping a previously-open tab counts —
    // the user clearly wants to view that note, so we flip to content.
    const lastActiveTabIdRef = useRef(useNM.tabsApi.activeTabId);
    useEffect(() => {
        if (useNM.tabsApi.activeTabId !== lastActiveTabIdRef.current) {
            lastActiveTabIdRef.current = useNM.tabsApi.activeTabId;
            if (useNM.tabsApi.activeTabId !== null) {
                setMobileViewMode("content");
            }
        }
    }, [useNM.tabsApi.activeTabId]);

    // Same detection for "user tapped Home in the sidebar". Home isn't
    // a tab (currentNoteType=0 has no tab item) so it needs its own
    // signal.
    const lastNoteTypeRef = useRef(useNM.currentNoteType);
    useEffect(() => {
        const prev = lastNoteTypeRef.current;
        lastNoteTypeRef.current = useNM.currentNoteType;
        if (useNM.currentNoteType === 0 && prev !== 0) {
            setMobileViewMode("content");
        }
    }, [useNM.currentNoteType]);

    const showSidebar = mobileViewMode === "sidebar";
    const showContent = mobileViewMode === "content";

    const handleBack = () => setMobileViewMode("sidebar");

    // Title for the mobile content header. Falls back to "Notes" so
    // the chrome stays consistent across loading states.
    const headerTitle = (() => {
        if (useNM.currentNoteType === 0) return "Home";
        const activeTab = useNM.tabsApi.activeTab;
        if (activeTab?.title) return activeTab.title;
        if (useNM.currentNoteType === 1) return useNM.currentMyNote?.title || "My Note";
        if (useNM.currentNoteType === 2) return useNM.currentTaskNote?.title || "Task Note";
        if (useNM.currentNoteType === 3) return useNM.currentChatNote?.title || "Chat Note";
        if (useNM.currentNoteType === 4) return useNM.currentMyNote?.title || "Shared Note";
        return "Notes";
    })();

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
                    <NoteSidebar useNM={useNM} allChats={useCM.allChats} />
                </Box>
            )}

            {showContent && (
                <>
                    {/* Compact mobile header with back button + note
                        title. The desktop NoteSidebar/tab strip is the
                        primary navigation surface; on mobile that's
                        replaced by this single-row header. */}
                    <Stack
                        direction="row"
                        sx={{
                            alignItems: "center",
                            gap: 0.5,
                            px: 1,
                            py: 0.75,
                            borderBottom: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                            background: isDark ? "rgba(20,14,34,0.85)" : "rgba(252,250,255,0.85)",
                            backdropFilter: "blur(8px)",
                            minHeight: "56px",
                            flexShrink: 0,
                        }}
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            onClick={handleBack}
                            aria-label="Back to notes list"
                            sx={{ flexShrink: 0 }}
                        >
                            <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <Typography
                            level="title-sm"
                            sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}
                            noWrap
                        >
                            {headerTitle}
                        </Typography>
                    </Stack>

                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                        <NoteContentRenderer
                            useCM={useCM}
                            myself={myself}
                            useNM={useNM}
                            usePM={usePM}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    </Box>
                </>
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
                                useCM={useCM}
                                useNM={useNM}
                                myself={myself}
                                usePM={usePM}
                                setMyself={setMyself}
                                socket={socket}
                                useTEM={useTEM}
                                useTM={useTM}
                                useSM={useSM}
                                useUISM={useUISM}
                            />
                        </Box>
                    </MobileOverlay>
                )}
        </Box>
    );
};
