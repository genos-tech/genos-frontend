import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
    Box,
    Divider,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { useNavigate } from "react-router-dom";

import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { NoteHeaderActionsStyles } from "../../../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";
import { isMac } from "../../../../utils/platform";

interface NoteHeaderActionsProps {
    noteType: number;
    isInTaskPage: boolean;
    currentTask: TaskProps | undefined;
    pmChat: AllChatProps | undefined;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useTEM: TeamManagementState;
    useNM: NoteManagementState;
    socket: any;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    onCreateNewNote: () => void;
    onCreateChildNote: () => void;
    onOpenTask: () => void;
    onDeleteNote: () => void;
    onCloseNotes: () => void;
    onCopyNoteLink?: () => void;
}

export const NoteHeaderActions = ({
    noteType,
    isInTaskPage,
    currentTask,
    pmChat,
    myself,
    setMyself,
    socket,
    useCM,
    useUISM,
    useTEM,
    onCreateNewNote,
    onCreateChildNote,
    onOpenTask,
    onDeleteNote,
    onCloseNotes,
    onCopyNoteLink,
    useNM,
}: NoteHeaderActionsProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? NoteHeaderActionsStyles.dark : NoteHeaderActionsStyles.light;
    const navigate = useNavigate();

    // Common action button style
    const actionButtonStyle = {
        background: styles.buttonBg,
        border: `1px solid ${styles.buttonBorder}`,
        borderRadius: "10px",
        color: styles.textColor,
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            background: styles.buttonHover,
            transform: "translateY(-1px)",
            boxShadow: `0 4px 12px ${styles.glowColor}`,
        },
    };

    // Primary action button (New Note)
    const primaryButtonStyle = {
        background: styles.primaryButtonBg,
        color: "#fff",
        fontWeight: 600,
        fontSize: "13px",
        borderRadius: "10px",
        border: "none",
        px: 1.5,
        py: 0.75,
        gap: 0.5,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: `0 2px 8px ${styles.glowColor}, inset 0 1px 0 rgba(255,255,255,0.15)`,
        "&:hover": {
            background: styles.primaryButtonHover,
            transform: "translateY(-2px)",
            boxShadow: `0 6px 16px ${styles.glowColor}, inset 0 1px 0 rgba(255,255,255,0.2)`,
        },
    };

    // Danger button style
    const dangerButtonStyle = {
        background: styles.dangerBg,
        border: `1px solid ${styles.dangerBorder}`,
        borderRadius: "10px",
        color: "#ef4444",
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            background: styles.dangerHover,
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px rgba(239,68,68,0.2)",
        },
    };

    return (
        <Stack alignItems="center" direction="row" spacing={1}>
            {/* My Notes: New Note Button */}
            {noteType === 1 && (
                <Tooltip
                    size="sm"
                    title={
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontFamily: "monospace",
                                    opacity: 0.7,
                                    color: "inherit",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {isMac() ? "⌘ + Ctrl + N" : "Alt + Ctrl + N"}
                            </Typography>
                        </Box>
                    }
                    variant="soft"
                    sx={{
                        background: styles.menuBg,
                        border: `1px solid ${styles.menuBorder}`,
                        borderRadius: "8px",
                        backdropFilter: "blur(8px)",
                    }}
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={primaryButtonStyle}
                        onClick={onCreateNewNote}
                    >
                        <NoteAddRoundedIcon sx={{ fontSize: 18 }} />
                        <Typography level="body-xs" sx={{ fontWeight: 600, color: "inherit" }}>
                            New Note
                        </Typography>
                    </IconButton>
                </Tooltip>
            )}

            {/* Task Notes: Project Avatar + Task Info Chips */}
            {noteType === 2 && !isInTaskPage && currentTask && currentTask.id && pmChat && (
                <Stack alignItems="center" direction="row" spacing={1}>
                    {/* Project Avatar with container */}
                    <Box
                        sx={{
                            p: 0.5,
                            borderRadius: "10px",
                            background: isDark ? "rgba(99,102,241,0.1)" : "rgba(79,70,229,0.06)",
                            border: `1px solid ${isDark ? "rgba(99,102,241,0.2)" : "rgba(79,70,229,0.12)"}`,
                            transition: "all 0.2s ease",
                            "&:hover": {
                                background: isDark
                                    ? "rgba(99,102,241,0.15)"
                                    : "rgba(79,70,229,0.1)",
                            },
                        }}
                    >
                        <ProjectAvatar
                            useCM={useCM}
                            myself={myself}
                            pmChat={pmChat}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>

                    {/*
                        Unified Task pill — replaces the previously-isolated
                        Task ID chip, Task Title chip, and Task Status chip
                        which sat side-by-side and read as three independent
                        controls (two clickable, one not). They are all
                        descriptions of the same task, so they now share one
                        rounded shape, one border, and one click target. The
                        whole pill is the "open task" affordance, mirroring
                        the unified pill used in ThreadChatPaneHeader.
                          - Left:    Task #<id> (icon + accent label)
                          - Middle:  Title (truncated, the prominent piece)
                          - Right:   Status badge (colored dot + label),
                                     suppressed when status info is missing.
                    */}
                    {(() => {
                        const status = currentTask.status;
                        const hasStatus = !!status?.status;
                        const statusBg = status?.color
                            ? alpha(status.color, isDark ? 0.4 : 0.6)
                            : "transparent";
                        const dotColor = status?.color || styles.accentColor;
                        return (
                            <Tooltip
                                size="sm"
                                title={`Open Task #${currentTask.id}${
                                    currentTask.title ? ` — ${currentTask.title}` : ""
                                }`}
                                variant="soft"
                                sx={{ borderRadius: "8px" }}
                            >
                                <Box
                                    component="button"
                                    type="button"
                                    aria-label={`Open Task #${currentTask.id}${
                                        currentTask.title ? `: ${currentTask.title}` : ""
                                    }`}
                                    onClick={onOpenTask}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.75,
                                        height: 32,
                                        px: 1.25,
                                        borderRadius: "10px",
                                        border: `1px solid ${styles.chipBorder}`,
                                        background: styles.chipBg,
                                        cursor: "pointer",
                                        font: "inherit",
                                        color: styles.textColor,
                                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                        "&:hover": {
                                            background: styles.buttonHover,
                                            transform: "translateY(-1px)",
                                            boxShadow: `0 4px 12px ${styles.glowColor}`,
                                        },
                                        "&:focus-visible": {
                                            outline: `2px solid ${styles.accentColor}`,
                                            outlineOffset: 2,
                                        },
                                    }}
                                >
                                    {/* ID section */}
                                    <AssignmentRoundedIcon
                                        sx={{ fontSize: 16, color: styles.accentColor }}
                                    />
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            fontWeight: 700,
                                            color: styles.accentColor,
                                            letterSpacing: "-0.01em",
                                        }}
                                    >
                                        Task #{currentTask.id}
                                    </Typography>

                                    {/* Title section */}
                                    <Box
                                        sx={{
                                            width: "1px",
                                            height: 14,
                                            bgcolor: styles.chipBorder,
                                            mx: 0.25,
                                        }}
                                    />
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            fontWeight: 600,
                                            color: styles.textColor,
                                            maxWidth: 180,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            letterSpacing: "-0.01em",
                                        }}
                                    >
                                        {(currentTask.title.slice(0, 18) ?? "") + "..."}
                                    </Typography>

                                    {/* Status section */}
                                    {hasStatus && (
                                        <>
                                            <Box
                                                sx={{
                                                    width: "1px",
                                                    height: 14,
                                                    bgcolor: styles.chipBorder,
                                                    mx: 0.25,
                                                }}
                                            />
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    px: 0.75,
                                                    py: 0.125,
                                                    borderRadius: "6px",
                                                    background: statusBg,
                                                    color: status?.textColor || "#fff",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        background: dotColor,
                                                        boxShadow: `0 0 0 2px ${alpha(
                                                            dotColor,
                                                            isDark ? 0.25 : 0.18
                                                        )}`,
                                                    }}
                                                />
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: "inherit",
                                                        fontSize: "11px",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.04em",
                                                    }}
                                                >
                                                    {status?.status}
                                                </Typography>
                                            </Box>
                                        </>
                                    )}
                                </Box>
                            </Tooltip>
                        );
                    })()}
                </Stack>
            )}

            {/* More Actions Dropdown */}
            <Dropdown>
                <MenuButton
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: "plain",
                            sx: actionButtonStyle,
                        },
                    }}
                >
                    <MoreHorizRoundedIcon sx={{ fontSize: 20, color: styles.accentColor }} />
                </MenuButton>
                <Menu
                    size="sm"
                    sx={{
                        background: styles.menuBg,
                        backdropFilter: "blur(12px)",
                        border: `1px solid ${styles.menuBorder}`,
                        borderRadius: "12px",
                        boxShadow: isDark
                            ? `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${styles.glowColor}`
                            : `0 12px 40px rgba(0,0,0,0.12), 0 0 15px ${styles.glowColor}`,
                        p: 0.75,
                        minWidth: 200,
                        "& .MuiMenuItem-root": {
                            borderRadius: "8px",
                            transition: "all 0.15s ease-out",
                        },
                    }}
                >
                    {/* Copy Note Link */}
                    {onCopyNoteLink && (
                        <MenuItem
                            onClick={onCopyNoteLink}
                            sx={{
                                gap: 1.25,
                                py: 0.875,
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(52,211,153,0.18)"
                                        : "rgba(5,150,105,0.12)",
                                    "& .copy-icon-box": {
                                        background: isDark
                                            ? "rgba(52,211,153,0.25)"
                                            : "rgba(5,150,105,0.18)",
                                        borderColor: isDark
                                            ? "rgba(52,211,153,0.4)"
                                            : "rgba(5,150,105,0.3)",
                                    },
                                    "& .copy-text": {
                                        color: isDark ? "#34d399" : "#059669",
                                    },
                                },
                            }}
                        >
                            <Box
                                className="copy-icon-box"
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: "7px",
                                    background: isDark
                                        ? "rgba(52,211,153,0.12)"
                                        : "rgba(5,150,105,0.08)",
                                    border: `1px solid ${isDark ? "rgba(52,211,153,0.25)" : "rgba(5,150,105,0.2)"}`,
                                    transition: "all 0.15s ease",
                                }}
                            >
                                <ContentCopyRoundedIcon
                                    sx={{
                                        fontSize: 16,
                                        color: isDark ? "#34d399" : "#059669",
                                    }}
                                />
                            </Box>
                            <Typography
                                className="copy-text"
                                level="body-sm"
                                sx={{
                                    fontWeight: 500,
                                    color: styles.textColor,
                                    transition: "color 0.15s ease",
                                }}
                            >
                                Copy note link
                            </Typography>
                        </MenuItem>
                    )}

                    {/* Open Task (for task notes) */}
                    {noteType === 2 && currentTask && currentTask.id && (
                        <MenuItem
                            onClick={onOpenTask}
                            sx={{
                                gap: 1.25,
                                py: 0.875,
                                "&:hover": {
                                    background: styles.buttonHover,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: "7px",
                                    background: styles.buttonBg,
                                    border: `1px solid ${styles.buttonBorder}`,
                                }}
                            >
                                <AssignmentRoundedIcon
                                    sx={{ fontSize: 16, color: styles.accentColor }}
                                />
                            </Box>
                            <Typography
                                level="body-sm"
                                sx={{ fontWeight: 500, color: styles.textColor }}
                            >
                                Open Task
                            </Typography>
                        </MenuItem>
                    )}

                    {/* Open in Notes (for task notes in task page) */}
                    {noteType === 2 &&
                        isInTaskPage &&
                        currentTask &&
                        currentTask.id &&
                        currentTask.project &&
                        currentTask.project?.projectId && (
                            <MenuItem
                                onClick={() => {
                                    const note = useNM.currentTaskNote;
                                    navigate(
                                        `/home/notes/task/project/${currentTask.project?.projectId}/task/${currentTask.id}/note/${note?.noteId}`
                                    );
                                }}
                                sx={{
                                    gap: 1.25,
                                    py: 0.875,
                                    "&:hover": {
                                        background: styles.buttonHover,
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 28,
                                        height: 28,
                                        borderRadius: "7px",
                                        background: styles.buttonBg,
                                        border: `1px solid ${styles.buttonBorder}`,
                                    }}
                                >
                                    <OpenInNewRoundedIcon
                                        sx={{ fontSize: 16, color: styles.accentColor }}
                                    />
                                </Box>
                                <Typography
                                    level="body-sm"
                                    sx={{ fontWeight: 500, color: styles.textColor }}
                                >
                                    Open in Notes
                                </Typography>
                            </MenuItem>
                        )}

                    {/* New Note (for my notes) */}
                    {noteType === 1 && (
                        <MenuItem
                            onClick={onCreateNewNote}
                            sx={{
                                gap: 1.25,
                                py: 0.875,
                                "&:hover": {
                                    background: styles.buttonHover,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: "7px",
                                    background: styles.primaryButtonBg,
                                }}
                            >
                                <NoteAddRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
                            </Box>
                            <Typography
                                level="body-sm"
                                sx={{ fontWeight: 500, color: styles.textColor }}
                            >
                                New Note
                            </Typography>
                        </MenuItem>
                    )}

                    {/* Child Note */}
                    <MenuItem
                        onClick={onCreateChildNote}
                        sx={{
                            gap: 1.25,
                            py: 0.875,
                            "&:hover": {
                                background: styles.buttonHover,
                            },
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: "7px",
                                background: styles.buttonBg,
                                border: `1px solid ${styles.buttonBorder}`,
                            }}
                        >
                            <AddIcon sx={{ fontSize: 16, color: styles.accentColor }} />
                        </Box>
                        <Typography
                            level="body-sm"
                            sx={{ fontWeight: 500, color: styles.textColor }}
                        >
                            Child Note
                        </Typography>
                    </MenuItem>

                    <Divider sx={{ my: 0.5, opacity: 0.3 }} />

                    {/* Delete Note */}
                    <MenuItem
                        onClick={onDeleteNote}
                        sx={{
                            gap: 1.25,
                            py: 0.875,
                            "&:hover": {
                                background: styles.dangerHover,
                            },
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: "7px",
                                background: styles.dangerBg,
                                border: `1px solid ${styles.dangerBorder}`,
                            }}
                        >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: "#ef4444" }} />
                        </Box>
                        <Typography level="body-sm" sx={{ fontWeight: 500, color: "#ef4444" }}>
                            Delete Note
                        </Typography>
                    </MenuItem>
                </Menu>
            </Dropdown>

            {/* Close Button (only in task page) */}
            {isInTaskPage && (
                <Tooltip
                    size="sm"
                    title="Close Notes"
                    variant="soft"
                    sx={{
                        background: styles.menuBg,
                        border: `1px solid ${styles.menuBorder}`,
                        borderRadius: "8px",
                        backdropFilter: "blur(8px)",
                    }}
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={dangerButtonStyle}
                        onClick={onCloseNotes}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
            )}
        </Stack>
    );
};
