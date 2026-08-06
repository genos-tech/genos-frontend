import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import { Box, Button, Stack, Typography, useColorScheme } from "@mui/joy";
import { Socket } from "socket.io-client";

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const isMobile = useIsMobile();
    const { t } = useTranslation();
    const { accessToken } = useAuth();

    const renderPlaceholder = (message: string, subtitle?: string) => (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                background: isDark
                    ? "radial-gradient(ellipse at center, rgba(251,191,36,0.03) 0%, transparent 70%)"
                    : "radial-gradient(ellipse at center, rgba(251,191,36,0.04) 0%, transparent 70%)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Decorative background elements */}
            <Box
                sx={{
                    position: "absolute",
                    width: 300,
                    height: 300,
                    borderRadius: "50%",
                    background: isDark
                        ? "radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(251,191,36,0.05) 0%, transparent 70%)",
                    top: "20%",
                    right: "15%",
                    pointerEvents: "none",
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    width: 200,
                    height: 200,
                    borderRadius: "50%",
                    background: isDark
                        ? "radial-gradient(circle, rgba(245,158,11,0.03) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)",
                    bottom: "25%",
                    left: "20%",
                    pointerEvents: "none",
                }}
            />

            {/* Main content */}
            <Stack
                alignItems="center"
                spacing={2.5}
                sx={{
                    maxWidth: 280,
                    textAlign: "center",
                    zIndex: 1,
                }}
            >
                {/* Icon container */}
                <Box
                    sx={{
                        width: 80,
                        height: 80,
                        borderRadius: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isDark
                            ? "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.12) 100%)"
                            : "linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.08) 100%)",
                        border: isDark
                            ? "1px solid rgba(251,191,36,0.15)"
                            : "1px solid rgba(251,191,36,0.1)",
                        boxShadow: isDark
                            ? "0 8px 32px rgba(0,0,0,0.2)"
                            : "0 8px 32px rgba(251,191,36,0.08)",
                    }}
                >
                    <DescriptionOutlinedIcon
                        sx={{
                            fontSize: 36,
                            color: isDark ? "#fcd34d" : "#f59e0b",
                            opacity: 0.8,
                        }}
                    />
                </Box>

                {/* Text content */}
                <Stack spacing={1}>
                    <Typography
                        level="h4"
                        sx={{
                            fontWeight: 700,
                            fontSize: "1.25rem",
                            color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {message}
                    </Typography>
                    {subtitle && (
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                fontSize: "0.875rem",
                                lineHeight: 1.5,
                            }}
                        >
                            {subtitle}
                        </Typography>
                    )}
                </Stack>

                {/* Hint indicator */}
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={0.5}
                    sx={{
                        mt: 1,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: "8px",
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    }}
                >
                    <TouchAppOutlinedIcon
                        sx={{
                            fontSize: 18,
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
                        }}
                    />
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                            fontWeight: 500,
                            fontSize: "0.75rem",
                        }}
                    >
                        {t.notes.placeholder.selectFromSidebar}
                    </Typography>
                </Stack>
            </Stack>
        </Box>
    );

    // Note Home page - show dashboard when Home is selected
    // Get the currently selected tab's note type
    // This ensures we render the correct component based on the OPEN note,
    // not the sidebar category the user clicked on
    const selectedTab = useNM.tabItems[useNM.selectedTabIndex];
    const activeNoteType = selectedTab?.noteType ?? useNM.currentNoteType;

    // No notes open at all
    if (useNM.tabItems.length === 0) {
        return (
            <Box
                sx={{
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    background: isDark
                        ? "radial-gradient(ellipse at center, rgba(251,191,36,0.03) 0%, transparent 70%)"
                        : "radial-gradient(ellipse at center, rgba(251,191,36,0.04) 0%, transparent 70%)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <Stack
                    alignItems="center"
                    spacing={2.5}
                    sx={{ maxWidth: 320, textAlign: "center", zIndex: 1 }}
                >
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isDark
                                ? "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.12) 100%)"
                                : "linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.08) 100%)",
                            border: isDark
                                ? "1px solid rgba(251,191,36,0.15)"
                                : "1px solid rgba(251,191,36,0.1)",
                            boxShadow: isDark
                                ? "0 8px 32px rgba(0,0,0,0.2)"
                                : "0 8px 32px rgba(251,191,36,0.08)",
                        }}
                    >
                        <DescriptionOutlinedIcon
                            sx={{
                                fontSize: 36,
                                color: isDark ? "#fcd34d" : "#f59e0b",
                                opacity: 0.8,
                            }}
                        />
                    </Box>

                    <Stack spacing={1}>
                        <Typography
                            level="h4"
                            sx={{
                                fontWeight: 700,
                                fontSize: "1.25rem",
                                color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {t.notes.placeholder.noNoteSelectedTitle}
                        </Typography>
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                fontSize: "0.875rem",
                                lineHeight: 1.5,
                            }}
                        >
                            {useNM.currentNoteType === 1
                                ? t.notes.placeholder.chooseMyNoteOrCreate
                                : t.notes.placeholder.chooseNoteToEdit}
                        </Typography>
                    </Stack>

                    {useNM.currentNoteType === 1 && (
                        <Button
                            color="neutral"
                            startDecorator={<NoteAddRoundedIcon sx={{ fontSize: 18 }} />}
                            variant="soft"
                            sx={{
                                mt: 0.5,
                                borderRadius: "10px",
                                fontWeight: 600,
                                px: 2.5,
                            }}
                            onClick={() => useNM.handleCreateNewMyNote(null)}
                        >
                            {t.notes.placeholder.newMyNote}
                        </Button>
                    )}
                </Stack>
            </Box>
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
                    onMobileBack={onMobileBack}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        }
        if (activeNoteType === 2 && useNM.currentTaskNote) {
            return (
                <TaskNoteMain
                    isInTaskPage={false}
                    myself={myself}
                    onMobileBack={onMobileBack}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />
            );
        }
        if (activeNoteType === 3 && useNM.currentChatNote) {
            return (
                <ChatNoteMain
                    isInChatPage={false}
                    isInTaskPage={false}
                    myself={myself}
                    onMobileBack={onMobileBack}
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
                    }}
                >
                    {renderEditorPool()}
                </Box>
                {taskPreview}
            </Stack>
        );
    }

    return (
        <Stack direction="column" sx={{ width: "100%" }}>
            {renderActiveMain()}
            {renderEditorPool()}
            {taskPreview}
        </Stack>
    );
};
