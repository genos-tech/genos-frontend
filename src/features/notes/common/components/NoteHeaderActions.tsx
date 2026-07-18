import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import NotificationsOffRoundedIcon from "@mui/icons-material/NotificationsOffRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { useNavigate } from "react-router-dom";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NoteHeaderActionsStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { useNotificationsContext } from "../../../../services/notifications/NotificationsContext";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";
import { isMac } from "../../../../utils/platform";
import { NoteAskModal, useNoteAsk } from "../../../noteAsk";
import { SpotlightResult } from "../../../spotlight/types";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { ModalMoveToFolder } from "../../my-notes/modals/ModalMoveToFolder";
import { loadSpecificNote } from "../services/loadSpecificNote";
import { downloadMarkdown, noteBlocksToMarkdown } from "../services/noteMarkdown";
import { getMyNoteRoleId, NOTE_ROLE_OWNER } from "../utils/noteRoles";
import { ImportMarkdownContext, ModalImportMarkdown } from "./ModalImportMarkdown";
import { ModalNoteHistory } from "./ModalNoteHistory";
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
    /** Set when this header is rendered inside the UrlLinkModal (see
     *  ModalNoteView). The ⋮ MoreMenu portals to document.body at its
     *  default z (9999) which sits BEHIND the modal (≥10020) — pass the
     *  host's z so the dropdown lifts above it. Mirrors the task header's
     *  fix (TaskPreview.tsx). Undefined on page surfaces → default z. */
    hostZIndex?: number;
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
    hostZIndex,
}: NoteHeaderActionsProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? NoteHeaderActionsStyles.dark : NoteHeaderActionsStyles.light;
    const navigate = useNavigate();
    const { t } = useTranslation();
    // Per-note notification mute (in the ⋮ menu, not a header icon).
    const notifCtx = useNotificationsContext();

    // Resolve the active note from useNM based on noteType so the share
    // modal targets the note shown in this header. noteType=4 (shared
    // personal notes) reuses the currentMyNote slot since the backend
    // serves them from the same endpoint.
    const activeNote =
        noteType === 1 || noteType === 4
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
    const myRoleId = getMyNoteRoleId(members, myself.userId);
    const isOwner = myRoleId === NOTE_ROLE_OWNER;
    const ownerMember = members.find((m) => m.roleId === NOTE_ROLE_OWNER);
    const otherMembers = members.filter((m) => String(m.userId) !== String(myself.userId));

    // Cap the inline avatar count so the strip stays compact next to
    // the other 36px header buttons. The remainder collapses into a
    // `+N` pill at the end.
    const MAX_AVATARS_INLINE = 3;
    const visibleMembers = members.slice(0, MAX_AVATARS_INLINE);
    const overflowCount = Math.max(members.length - MAX_AVATARS_INLINE, 0);

    const [shareOpen, setShareOpen] = useState(false);
    // Version-history modal. Used to live in a header chip
    // (NoteHistoryChip in TaskNoteHeader); now opened from the ⋮ menu for
    // task notes so the header stays uncluttered.
    const [historyOpen, setHistoryOpen] = useState(false);
    // "Move to folder…" picker for personal notes (keyboard/mobile path
    // — the sidebar row menu is the pointer path).
    const [moveToFolderOpen, setMoveToFolderOpen] = useState(false);
    const openShareModal = () => {
        if (activeNoteId != null) setShareOpen(true);
    };

    // ---- Markdown import / export (⋮ menu) ----
    const [importMdOpen, setImportMdOpen] = useState(false);
    // Where an import lands: the surface this header is on. My-notes
    // (incl. the shared-personal view, which is still "your" notes
    // sidebar) get a folder picker in the dialog; a task-note import is
    // anchored to the same project/task as the open note.
    const importContext: ImportMarkdownContext | null =
        noteType === 1 || noteType === 4
            ? { kind: "my" }
            : noteType === 2 && useNM.currentTaskNote
              ? {
                    kind: "task",
                    projectId: useNM.currentTaskNote.projectId,
                    taskId: useNM.currentTaskNote.taskId,
                }
              : null;

    // Export re-fetches the note so the file reflects the latest SAVED
    // body (the in-memory note object can lag live edits; the editors
    // autosave on a short debounce, so "saved" is at most ~a second
    // behind typing). Custom blocks (mentions, alerts, #refs) are
    // degraded to plain text by the serializer — see noteMarkdown.ts.
    const handleExportMarkdown = async () => {
        if (activeNoteId == null || normalizedNoteType === null) return;
        try {
            const fresh = await loadSpecificNote(
                myself,
                normalizedNoteType,
                activeNoteId,
                accessToken
            );
            const body = fresh && !fresh.error ? fresh.body : activeNote?.body;
            const md = await noteBlocksToMarkdown(Array.isArray(body) ? body : []);
            downloadMarkdown(fresh?.title || activeNoteTitle, md);
        } catch (err) {
            console.error("Markdown export failed:", err);
        }
    };

    // ---- "Ask about this note" wiring ----
    // The hook is mounted here (once per NoteHeaderActions instance —
    // i.e. once per active note pane). Switching the active note
    // doesn't unmount the actions component, so the hook's open()
    // detects context changes and clears the prior conversation on
    // its own. noteType=4 (Shared Personal) maps back to 1 — same
    // backend table as MyNote.
    const { accessToken } = useAuth();
    const noteAsk = useNoteAsk({ accessToken, teamId: myself.teamId });
    const askButtonAvailable = activeNoteId != null;
    const normalizedNoteType: 1 | 2 | 3 | null =
        noteType === 4
            ? 1
            : noteType === 1 || noteType === 2 || noteType === 3
              ? (noteType as 1 | 2 | 3)
              : null;
    const openNoteAsk = () => {
        if (!askButtonAvailable || normalizedNoteType === null || activeNoteId == null) return;
        noteAsk.open({ noteType: normalizedNoteType, noteId: activeNoteId });
    };
    // Citation click handler. The note Q&A agent can cite tasks /
    // chats / notes / projects — same SpotlightResult shape as the
    // global Spotlight surface. We navigate by URL for every entity
    // type rather than calling useCM.moveToSpecificChat etc., because
    // the routes pick up the necessary state on mount. Inline rather
    // than extracted to a shared helper for v1 — there are only two
    // call sites (this and ThreadChatPaneHeader) and the URL shapes
    // are short and rarely change.
    const onCitationSelect = (r: SpotlightResult) => {
        if (r.entity_type === "task" && r.task_id && r.project_id) {
            navigate(`/workspace/tasks/project/${r.project_id}/task/${r.task_id}`);
            return;
        }
        if (r.entity_type === "project" && r.project_id) {
            navigate(`/workspace/tasks/project/${r.project_id}`);
            return;
        }
        if (r.entity_type === "chat" && r.chat_type && r.chat_id) {
            const base = `/workspace/chat/${r.chat_type}/${r.chat_id}`;
            if (r.thread_id) {
                const url = `${base}/thread/${r.thread_id}`;
                navigate(r.message_id ? `${url}/message/${r.message_id}` : url);
            } else {
                navigate(r.message_id ? `${base}/message/${r.message_id}` : base);
            }
            return;
        }
        if (r.entity_type === "note" && r.note_id) {
            if (r.note_type === "personal") {
                navigate(`/workspace/notes/my/${r.note_id}`);
                return;
            }
            if (r.note_type === "task" && r.project_id && r.task_id) {
                navigate(
                    `/workspace/notes/task/project/${r.project_id}` +
                        `/task/${r.task_id}/note/${r.note_id}`
                );
                return;
            }
            if (r.note_type === "chat" && r.chat_type && r.chat_id && r.thread_id) {
                navigate(
                    `/workspace/notes/chat/${r.chat_type}` +
                        `/${r.chat_id}/thread/${r.thread_id}/note/${r.note_id}`
                );
                return;
            }
            navigate("/workspace/notes");
        }
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
                            {t.notes.header.newNote}
                        </Typography>
                    </IconButton>
                </Tooltip>
            )}

            {/* Task Notes: Project Avatar + Task Info Chips */}
            {noteType === 2 && !isInTaskPage && currentTask && currentTask.id && pmChat && (
                <Stack alignItems="center" direction="row" spacing={1}>
                    {/* Project Avatar with container. Tooltip names it as
                        the note's owning project; opening it (click) shows
                        the project profile. */}
                    <AppTooltip title={t.notes.header.ownerProjectTooltip}>
                        <Box
                            sx={{
                                p: 0.5,
                                borderRadius: "10px",
                                background: isDark
                                    ? "rgba(124,58,237,0.1)"
                                    : "rgba(124,58,237,0.06)",
                                border: `1px solid ${isDark ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.12)"}`,
                                transition: "all 0.2s ease",
                                display: "inline-flex",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(124,58,237,0.15)"
                                        : "rgba(124,58,237,0.1)",
                                },
                            }}
                        >
                            <ProjectAvatar
                                avatarSize={28}
                                myself={myself}
                                pmChat={pmChat}
                                setMyself={setMyself}
                                socket={socket}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                            />
                        </Box>
                    </AppTooltip>

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
                                title={
                                    currentTask.title
                                        ? fmt(t.notes.header.openTaskTooltipWithTitle, {
                                              id: formatTaskDisplayId(currentTask),
                                              title: currentTask.title,
                                          })
                                        : fmt(t.notes.header.openTaskTooltip, {
                                              id: formatTaskDisplayId(currentTask),
                                          })
                                }
                            >
                                <Box
                                    component="button"
                                    type="button"
                                    aria-label={
                                        currentTask.title
                                            ? fmt(t.notes.header.openTaskAriaWithTitle, {
                                                  id: formatTaskDisplayId(currentTask),
                                                  title: currentTask.title,
                                              })
                                            : fmt(t.notes.header.openTaskAria, {
                                                  id: formatTaskDisplayId(currentTask),
                                              })
                                    }
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
                                        {fmt(t.notes.header.taskIdLabel, {
                                            id: formatTaskDisplayId(currentTask),
                                        })}
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

            {/* Member avatar strip + Share button.
                The strip is a 36px-tall pill that visually matches the
                surrounding action buttons (New Note, More, Close). Each
                avatar uses `AvatarWithStatus` so presence dots and the
                click-to-open profile flow stay consistent with the rest
                of the app. The Share button is only interactive for the
                note owner — non-owners see the avatars alone with a
                tooltip naming the owner. */}
            {activeNoteId != null && members.length > 0 && (
                <Stack alignItems="center" direction="row" spacing={0.75}>
                    <Tooltip
                        size="sm"
                        variant="outlined"
                        title={
                            ownerMember
                                ? otherMembers.length > 0
                                    ? fmt(t.notes.header.ownerLabelWithMore, {
                                          name: ownerMember.userName,
                                          count: otherMembers.length,
                                      })
                                    : fmt(t.notes.header.ownerLabel, {
                                          name: ownerMember.userName,
                                      })
                                : t.notes.header.membersLabel
                        }
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: 36,
                                pl: 0.75,
                                pr: overflowCount > 0 ? 1 : 0.75,
                                borderRadius: "10px",
                                background: styles.buttonBg,
                                border: `1px solid ${styles.buttonBorder}`,
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    background: styles.buttonHover,
                                },
                            }}
                        >
                            {visibleMembers.map((m, idx) => (
                                <Box
                                    key={m.userId}
                                    sx={{
                                        ml: idx === 0 ? 0 : "-8px",
                                        // Leftmost avatar paints on top
                                        // (matches the MDMAvatar reference
                                        // pattern). `position: relative`
                                        // is required for `z-index` to
                                        // take effect inside a flex row.
                                        position: "relative",
                                        zIndex: visibleMembers.length - idx,
                                        // Crisp ring so overlapping
                                        // avatars stay readable against
                                        // the pill background.
                                        borderRadius: "50%",
                                        boxShadow: `0 0 0 2px ${isDark ? "#1a1623" : "#ffffff"}`,
                                        lineHeight: 0,
                                    }}
                                >
                                    <AvatarWithStatus
                                        avatarSize={26}
                                        isYou={String(m.userId) === String(myself.userId)}
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useCM={useCM}
                                        useUISM={useUISM}
                                        avatarUser={
                                            {
                                                userId: m.userId,
                                                userName: m.userName,
                                                avatarImgPath: m.avatarUrl ?? "",
                                            } as UserProps
                                        }
                                    />
                                </Box>
                            ))}
                            {overflowCount > 0 && (
                                <Box
                                    sx={{
                                        ml: "-8px",
                                        // Sits visually behind the last
                                        // avatar so its left edge gets
                                        // overlapped, consistent with the
                                        // rest of the stack.
                                        position: "relative",
                                        zIndex: 0,
                                        height: 26,
                                        minWidth: 26,
                                        px: 0.75,
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: isDark
                                            ? "rgba(255,255,255,0.12)"
                                            : "rgba(0,0,0,0.08)",
                                        boxShadow: `0 0 0 2px ${isDark ? "#1a1623" : "#ffffff"}`,
                                    }}
                                >
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: styles.textColor,
                                            lineHeight: 1,
                                        }}
                                    >
                                        +{overflowCount}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Tooltip>

                    {/* {isOwner && (
                        <Tooltip size="sm" title={t.notes.header.share} variant="outlined">
                            <Box
                                component="button"
                                type="button"
                                aria-label={t.notes.header.shareNoteAria}
                                onClick={openShareModal}
                                sx={{
                                    ...actionButtonStyle,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    px: 1.25,
                                    cursor: "pointer",
                                    font: "inherit",
                                    "&:focus-visible": {
                                        outline: `2px solid ${styles.accentColor}`,
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                <PersonAddRoundedIcon sx={{ fontSize: 16 }} />
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        fontWeight: 600,
                                        color: "inherit",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    {t.notes.header.share}
                                </Typography>
                            </Box>
                        </Tooltip>
                    )} */}
                </Stack>
            )}

            {/* "Ask about this note" — opens the AI Q&A modal. Hidden
                until an active note has been resolved; the modal's hook
                requires (noteType, noteId) to fetch the summary. */}
            {askButtonAvailable && normalizedNoteType !== null && (
                <AppTooltip title={t.noteAsk.headerButton.tooltip}>
                    <IconButton
                        aria-label={t.noteAsk.headerButton.tooltip}
                        size="sm"
                        sx={actionButtonStyle}
                        variant="plain"
                        onClick={openNoteAsk}
                    >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                    </IconButton>
                </AppTooltip>
            )}

            {/* More Actions Dropdown */}
            {(() => {
                const items: MoreMenuItem[] = [
                    {
                        id: "shareNote",
                        label: t.notes.header.shareEllipsis,
                        icon: <PersonAddRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: isOwner && activeNoteId != null,
                        onClick: openShareModal,
                    },
                    {
                        id: "copyNoteLink",
                        label: t.notes.header.copyNoteLink,
                        icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: !!onCopyNoteLink,
                        onClick: () => {
                            if (onCopyNoteLink) onCopyNoteLink();
                        },
                    },
                    {
                        id: "openTask",
                        label: t.notes.header.openTask,
                        icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: noteType === 2 && !!currentTask && !!currentTask.id,
                        onClick: onOpenTask,
                    },
                    {
                        id: "openInNotes",
                        label: t.notes.header.openInNotes,
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
                        // Version history — the old header chip lived in
                        // TaskNoteHeader, which only rendered in notes-home
                        // mode (!isInTaskPage), so mirror that gate here.
                        // Hidden until the note has at least one saved
                        // version (matches the chip's own guard).
                        id: "versionHistory",
                        label: t.notes.history.chipTooltip,
                        icon: <HistoryRoundedIcon sx={{ fontSize: 18 }} />,
                        visible:
                            noteType === 2 &&
                            !isInTaskPage &&
                            activeNoteId != null &&
                            useNM.currentNoteVersions.length > 0,
                        onClick: () => setHistoryOpen(true),
                    },
                    {
                        id: "newNote",
                        label: t.notes.header.newNote,
                        icon: <NoteAddRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: noteType === 1,
                        onClick: onCreateNewNote,
                    },
                    {
                        id: "moveToFolder",
                        label: t.notes.folders.moveToFolder,
                        icon: <DriveFileMoveRoundedIcon sx={{ fontSize: 18 }} />,
                        // Owner-only: the backend rejects folder moves
                        // by share-recipient editors, so don't offer it.
                        visible: noteType === 1 && isOwner && activeNoteId != null,
                        onClick: () => setMoveToFolderOpen(true),
                    },
                    {
                        id: "childNote",
                        label: t.notes.header.childNote,
                        icon: <AddIcon sx={{ fontSize: 18 }} />,
                        onClick: onCreateChildNote,
                    },
                    {
                        id: "importMarkdown",
                        label: t.notes.header.importMarkdown,
                        icon: <FileUploadRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: importContext != null,
                        onClick: () => setImportMdOpen(true),
                    },
                    {
                        id: "exportMarkdown",
                        label: t.notes.header.exportMarkdown,
                        icon: <FileDownloadRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: activeNoteId != null,
                        onClick: () => {
                            void handleExportMarkdown();
                        },
                    },
                    {
                        id: "muteNote",
                        label:
                            notifCtx &&
                            activeNoteId != null &&
                            notifCtx.isTargetMutedByKey("note", activeNoteId)
                                ? t.services.notifications.muteButton.unmute
                                : t.services.notifications.muteButton.mute,
                        icon:
                            notifCtx &&
                            activeNoteId != null &&
                            notifCtx.isTargetMutedByKey("note", activeNoteId) ? (
                                <NotificationsOffRoundedIcon sx={{ fontSize: 18 }} />
                            ) : (
                                <NotificationsActiveRoundedIcon sx={{ fontSize: 18 }} />
                            ),
                        visible: !!notifCtx && activeNoteId != null,
                        onClick: () => {
                            if (!notifCtx || activeNoteId == null) return;
                            const id = String(activeNoteId);
                            if (notifCtx.isTargetMutedByKey("note", id)) {
                                notifCtx.unmuteTarget("note", id);
                            } else {
                                notifCtx.muteTarget({
                                    targetType: "note",
                                    targetId: id,
                                    label: activeNoteTitle,
                                });
                            }
                        },
                    },
                    {
                        id: "deleteNote",
                        label: t.notes.header.deleteNote,
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
                        // Modal-hosted note preview: lift the dropdown above
                        // the UrlLinkModal (default 9999 renders behind it).
                        zIndex={hostZIndex != null ? hostZIndex + 1 : undefined}
                    />
                );
            })()}

            {/* Markdown import — creates a NEW note on this surface from a
                local .md file (title defaults to the file name; my-notes
                pick a destination folder). */}
            {importContext != null && (
                <ModalImportMarkdown
                    context={importContext}
                    hostZIndex={hostZIndex}
                    open={importMdOpen}
                    useNM={useNM}
                    onClose={() => setImportMdOpen(false)}
                />
            )}

            {/* Personal-note folder picker (header path). */}
            {noteType === 1 && (
                <ModalMoveToFolder
                    currentFolderId={useNM.currentMyNote?.folderId ?? null}
                    folders={useNM.myNoteFolders}
                    open={moveToFolderOpen}
                    showDetachHint={useNM.currentMyNote?.parentNoteId != null}
                    onClose={() => setMoveToFolderOpen(false)}
                    onSelect={(folderId) => {
                        if (activeNoteId != null) {
                            void useNM.moveMyNoteToFolder(activeNoteId, folderId);
                        }
                    }}
                />
            )}

            {/* Close Button (only in task page) */}
            {isInTaskPage && (
                <Tooltip
                    size="sm"
                    title={t.notes.header.close}
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

            {/* Version-history modal — opened from the ⋮ menu for task
                notes (the chip that used to open it was removed from
                TaskNoteHeader). */}
            {noteType === 2 && activeNoteId != null && (
                <ModalNoteHistory
                    myself={myself}
                    noteId={activeNoteId}
                    noteType={2}
                    open={historyOpen}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNM}
                    useUISM={useUISM}
                    onClose={() => setHistoryOpen(false)}
                />
            )}

            {/* Share modal */}
            {activeNoteId != null && (
                <ModalNoteSharing
                    myself={myself}
                    noteId={activeNoteId}
                    noteTitle={activeNoteTitle}
                    noteType={noteType === 4 ? 1 : noteType}
                    open={shareOpen}
                    setMyself={setMyself}
                    socket={socket}
                    teamMembers={useTEM.teamMembers}
                    useCM={useCM}
                    useNM={useNM}
                    useUISM={useUISM}
                    onClose={() => setShareOpen(false)}
                />
            )}

            {/* "Ask about this note" modal — mounted once per
                NoteHeaderActions instance so state lives for the
                lifetime of this note view. Switching the active note
                rebinds the hook via open(). */}
            <NoteAskModal state={noteAsk} onSelectSource={onCitationSelect} />
        </Stack>
    );
};
