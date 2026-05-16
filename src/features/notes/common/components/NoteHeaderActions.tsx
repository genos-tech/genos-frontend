import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import {
    Avatar,
    AvatarGroup,
    Box,
    Button,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { useNavigate } from "react-router-dom";

import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NoteHeaderActionsStyles } from "../../../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";
import { isMac } from "../../../../utils/platform";
import { ModalNoteSharing } from "./ModalNoteSharing";

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

    // Resolve the active note from useNM based on noteType so the share
    // modal targets the note shown in this header.
    const activeNote =
        noteType === 1
            ? useNM.currentMyNote
            : noteType === 2
              ? useNM.currentTaskNote
              : noteType === 3
                ? useNM.currentChatNote
                : null;
    const activeNoteId = activeNote?.noteId ?? null;
    const activeNoteTitle = activeNote?.title ?? "";

    // Members + my role on the currently-opened note.
    const members = useNM.currentNoteMembers;
    const myMembership = members.find((m) => String(m.userId) === String(myself.userId));
    const myRoleId = myMembership?.roleId ?? null;
    const isOwner = myRoleId === 1;
    const ownerMember = members.find((m) => m.roleId === 1);
    const otherMembers = members.filter((m) => String(m.userId) !== String(myself.userId));

    const [shareOpen, setShareOpen] = useState(false);
    const openShareModal = () => {
        if (activeNoteId != null) setShareOpen(true);
    };

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
        width: "36px",
        height: "36px",
        transition: "all 0.2s ease",
        "&:hover": {
            background: styles.dangerHover,
            transform: "translateY(-1px)",
        },
    };

    return (
        <Stack alignItems="center" direction="row" spacing={1}>
            {/* My Notes: New Note Button */}
            {noteType === 1 && (
                <Tooltip
                    size="sm"
                    variant="outlined"
                    sx={{
                        background: styles.menuBg,
                        border: `1px solid ${styles.menuBorder}`,
                        borderRadius: "8px",
                        backdropFilter: "blur(8px)",
                    }}
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
                >
                    <IconButton
                        size="sm"
                        sx={primaryButtonStyle}
                        variant="plain"
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
                            background: isDark ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.06)",
                            border: `1px solid ${isDark ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.12)"}`,
                            transition: "all 0.2s ease",
                            "&:hover": {
                                background: isDark
                                    ? "rgba(124,58,237,0.15)"
                                    : "rgba(124,58,237,0.1)",
                            },
                        }}
                    >
                        <ProjectAvatar
                            myself={myself}
                            pmChat={pmChat}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
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
                                sx={{ borderRadius: "8px" }}
                                variant="outlined"
                                title={`Open Task #${currentTask.id}${
                                    currentTask.title ? ` — ${currentTask.title}` : ""
                                }`}
                            >
                                <Box
                                    component="button"
                                    type="button"
                                    aria-label={`Open Task #${currentTask.id}${
                                        currentTask.title ? `: ${currentTask.title}` : ""
                                    }`}
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
                                    onClick={onOpenTask}
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

            {/* Member avatar strip + Share button. Rendered for any note
                type once the role members have loaded. The Share button is
                only interactive for owners — non-owners see the avatars in
                read-only form with a tooltip identifying the owner. */}
            {activeNoteId != null && members.length > 0 && (
                <Stack alignItems="center" direction="row" spacing={0.75}>
                    <Tooltip
                        size="sm"
                        title={
                            ownerMember
                                ? `Owner: ${ownerMember.userName}${
                                      otherMembers.length > 0
                                          ? ` · ${otherMembers.length} more`
                                          : ""
                                  }`
                                : "Members"
                        }
                        variant="outlined"
                    >
                        <AvatarGroup size="sm" sx={{ "--Avatar-size": "26px" }}>
                            {members.slice(0, 3).map((m) => (
                                <Avatar
                                    key={m.userId}
                                    src={m.avatarUrl || undefined}
                                    sx={{ border: "none" }}
                                >
                                    {m.userName?.[0]?.toUpperCase() || "?"}
                                </Avatar>
                            ))}
                            {members.length > 3 && (
                                <Avatar sx={{ border: "none" }}>+{members.length - 3}</Avatar>
                            )}
                        </AvatarGroup>
                    </Tooltip>
                    {isOwner && (
                        <Tooltip size="sm" title="Share" variant="outlined">
                            <Button
                                size="sm"
                                variant="plain"
                                startDecorator={<PersonAddRoundedIcon sx={{ fontSize: 16 }} />}
                                onClick={openShareModal}
                                sx={{
                                    ...actionButtonStyle,
                                    px: 1.25,
                                    fontSize: "12px",
                                    fontWeight: 600,
                                }}
                            >
                                Share
                            </Button>
                        </Tooltip>
                    )}
                </Stack>
            )}

            {/* More Actions Dropdown */}
            {(() => {
                const items: MoreMenuItem[] = [
                    {
                        id: "shareNote",
                        label: "Share…",
                        icon: <PersonAddRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: isOwner && activeNoteId != null,
                        onClick: openShareModal,
                    },
                    {
                        id: "copyNoteLink",
                        label: "Copy note link",
                        icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: !!onCopyNoteLink,
                        onClick: () => {
                            if (onCopyNoteLink) onCopyNoteLink();
                        },
                    },
                    {
                        id: "openTask",
                        label: "Open Task",
                        icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: noteType === 2 && !!currentTask && !!currentTask.id,
                        onClick: onOpenTask,
                    },
                    {
                        id: "openInNotes",
                        label: "Open in Notes",
                        icon: <OpenInNewRoundedIcon sx={{ fontSize: 18 }} />,
                        visible:
                            noteType === 2 &&
                            isInTaskPage &&
                            !!currentTask &&
                            !!currentTask.id &&
                            !!currentTask.project &&
                            !!currentTask.project?.projectId,
                        onClick: () => {
                            const note = useNM.currentTaskNote;
                            navigate(
                                `/workspace/notes/task/project/${currentTask?.project?.projectId}/task/${currentTask?.id}/note/${note?.noteId}`
                            );
                        },
                    },
                    {
                        id: "newNote",
                        label: "New Note",
                        icon: <NoteAddRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: noteType === 1,
                        onClick: onCreateNewNote,
                    },
                    {
                        id: "childNote",
                        label: "Child Note",
                        icon: <AddIcon sx={{ fontSize: 18 }} />,
                        onClick: onCreateChildNote,
                    },
                    {
                        id: "deleteNote",
                        label: "Delete Note",
                        icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />,
                        danger: true,
                        onClick: onDeleteNote,
                    },
                ];
                return (
                    <MoreMenu
                        iconFontSize={20}
                        items={items}
                        placement="bottom-end"
                        triggerSize={36}
                        triggerSx={actionButtonStyle}
                    />
                );
            })()}

            {/* Close Button (only in task page) */}
            {isInTaskPage && (
                <Tooltip
                    size="sm"
                    title="Close"
                    variant="outlined"
                    sx={{
                        background: styles.menuBg,
                        border: `1px solid ${styles.menuBorder}`,
                        borderRadius: "8px",
                        backdropFilter: "blur(8px)",
                    }}
                >
                    <IconButton
                        size="sm"
                        sx={dangerButtonStyle}
                        variant="plain"
                        onClick={onCloseNotes}
                    >
                        <CancelIcon
                            sx={{
                                fontSize: "20px",
                                color: isDark ? "#e879c3" : "#c026a8",
                            }}
                        />
                    </IconButton>
                </Tooltip>
            )}

            {/* Share modal */}
            {activeNoteId != null && (
                <ModalNoteSharing
                    open={shareOpen}
                    onClose={() => setShareOpen(false)}
                    noteType={noteType === 4 ? 1 : noteType}
                    noteId={activeNoteId}
                    noteTitle={activeNoteTitle}
                    myself={myself}
                    teamMembers={useTEM.teamMembers}
                    useNM={useNM}
                />
            )}
        </Stack>
    );
};
