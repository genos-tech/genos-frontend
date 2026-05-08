import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import { Box, Button, Stack, Typography, useColorScheme } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskPreview } from "../../../tasks/components/contents/TaskPreview";
import { ChatNoteMain } from "../../chat-notes/components/ChatNoteMain";
import { MyNoteMain } from "../../my-notes/components/MyNoteMain";
import { TaskNoteMain } from "../../task-notes/components/TaskNoteMain";
import { NoteHomeContent } from "./NoteHomeContent";

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
};

export const NoteContentRenderer = (props: NoteContentRendererProps) => {
    const { myself, setMyself, useUISM, socket, useTEM, usePM, useNM, useCM, useTM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
                    direction="row"
                    alignItems="center"
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
                        Select from sidebar
                    </Typography>
                </Stack>
            </Stack>
        </Box>
    );

    // Note Home page - show dashboard when Home is selected
    if (useNM.currentNoteType === 0) {
        return <NoteHomeContent useNM={useNM} />;
    }

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
                            No Note Selected
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
                                ? "Choose a note from the sidebar, or create a new one"
                                : "Choose a note from the sidebar to start editing"}
                        </Typography>
                    </Stack>

                    {useNM.currentNoteType === 1 && (
                        <Button
                            variant="soft"
                            color="neutral"
                            startDecorator={<NoteAddRoundedIcon sx={{ fontSize: 18 }} />}
                            onClick={() => useNM.handleCreateNewMyNote(null)}
                            sx={{
                                mt: 0.5,
                                borderRadius: "10px",
                                fontWeight: 600,
                                px: 2.5,
                            }}
                        >
                            New My Note
                        </Button>
                    )}
                </Stack>
            </Box>
        );
    }

    // My Note (noteType === 1)
    if (activeNoteType === 1 && useNM.currentMyNote) {
        return (
            <MyNoteMain
                useCM={useCM}
                myself={myself}
                useNM={useNM}
                setMyself={setMyself}
                socket={socket}
                useTEM={useTEM}
                useUISM={useUISM}
            />
        );
    }

    // Task Note (noteType === 2)
    if (activeNoteType === 2 && useNM.currentTaskNote) {
        return (
            <>
                <TaskNoteMain
                    useCM={useCM}
                    isInTaskPage={false}
                    myself={myself}
                    useNM={useNM}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />

                {useNM.isTaskVisibleInNote && useTM.currentPreviewTask && (
                    <TaskPreview
                        useCM={useCM}
                        useNM={useNM}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        usePM={usePM}
                    />
                )}
            </>
        );
    }

    // Chat Note (noteType === 3)
    if (activeNoteType === 3 && useNM.currentChatNote) {
        return (
            <ChatNoteMain
                useCM={useCM}
                isInChatPage={false}
                myself={myself}
                useNM={useNM}
                usePM={usePM}
                setMyself={setMyself}
                socket={socket}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />
        );
    }

    // Shared Note placeholder
    if (useNM.currentNoteType === 4) {
        return renderPlaceholder("Shared Notes", "Coming soon - collaborate with your team");
    }

    // Fallback: tabs exist but the current note for the active type is
    // still loading (rare cache miss after a tab switch). Render a
    // transparent box that matches the page background so the pane
    // never appears as a black flash. The actual note will appear in
    // the very next render once `useNoteManagement`'s active-tab sync
    // effect resolves.
    if (useNM.tabItems.length > 0) {
        return (
            <Box
                sx={{
                    width: "100%",
                    height: "100%",
                    background: isDark
                        ? "radial-gradient(ellipse at center, rgba(251,191,36,0.03) 0%, transparent 70%)"
                        : "radial-gradient(ellipse at center, rgba(251,191,36,0.04) 0%, transparent 70%)",
                }}
            />
        );
    }

    return null;
};
