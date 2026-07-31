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
import { TaskInfoPill } from "../../../tasks/components/TaskInfoPill";
import { ModalMoveToFolder } from "../../my-notes/modals/ModalMoveToFolder";
import { exportNoteMarkdown } from "../services/exportNoteMarkdown";
import { getMyNoteRoleId, NOTE_ROLE_OWNER } from "../utils/noteRoles";
import { isPersonalNoteBucket, toBackendNoteType } from "../utils/noteTypeAlias";
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
    // modal targets the note shown in this header. noteType 4 (shared)
    // and 8 (team) reuse the currentMyNote slot since the backend serves
    // all three from the same endpoint.
    const activeNote = isPersonalNoteBucket(noteType)
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
    // A chat-note import is anchored to the same channel (or thread) as
    // the open note. All three surfaces then let the user retarget the
    // import from the dialog — to another folder on my-notes, to another
    // task / chat elsewhere.
    const importContext: ImportMarkdownContext | null = isPersonalNoteBucket(noteType)
        ? { kind: "my" }
        : noteType === 2 && useNM.currentTaskNote
          ? {
                kind: "task",
                projectId: useNM.currentTaskNote.projectId,
                taskId: useNM.currentTaskNote.taskId,
            }
          : noteType === 3 && useNM.currentChatNote
            ? {
                  kind: "chat",
                  chatType: useNM.currentChatNote.chatType,
                  chatId: useNM.currentChatNote.chatId,
                  isThread: useNM.currentChatNote.isThread,
                  threadId: useNM.currentChatNote.threadId,
              }
            : null;

    // Shared with the sidebar row menu — see `exportNoteMarkdown` for why
    // the note is re-fetched first.
    const handleExportMarkdown = async () => {
        if (activeNoteId == null || normalizedNoteType === null) return;
        await exportNoteMarkdown({
            myself,
            noteType: normalizedNoteType,
            noteId: activeNoteId,
            accessToken,
            fallbackTitle: activeNoteTitle,
            fallbackBody: activeNote?.body,
        });
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
    // Every backend-facing action (Ask, Export, version history) goes
    // through this. It must recognise EVERY sidebar alias — a bucket it
    // doesn't know falls to `null` and silently disables Ask/Export
    // while handing version history a code the backend rejects.
    const normalizedNoteType: 1 | 2 | 3 | null = isPersonalNoteBucket(noteType)
        ? 1
        : noteType === 2 || noteType === 3
          ? noteType
          : // Pseudo buckets (Home / Favorites / Recents / Unread) have
            // no note behind them — null disables the actions.
            null;
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
        <Stack
            alignItems="center"
            direction="row"
            spacing={1}
            sx={{
                // This row is the reason the whole note page could be
                // dragged sideways on a phone. Its buttons are 36px with
                // `minWidth: 36`, and a flex container's automatic minimum
                // size is its MIN-CONTENT width — so the row refused to
                // shrink below the sum of its buttons, overflowed the
                // header, and the note pane's `overflow: auto` turned that
                // into a page-wide horizontal scroll that dragged the
                // editor along with it.
                //
                // `minWidth: 0` lets the row shrink; `overflowX: auto`
                // keeps the buttons it can no longer fit reachable by
                // scrolling THIS STRIP instead of the page. Desktop is
                // unaffected: with room to spare there is nothing to
                // scroll and no scrollbar appears.
                minWidth: 0,
                maxWidth: "100%",
                overflowX: "auto",
                overflowY: "hidden",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
                // Buttons keep their tap-target size inside the strip
                // rather than being squeezed to slivers.
                "& > *": { flexShrink: 0 },
            }}
        >
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
                        the project profile. Shares `actionButtonStyle` with
                        the Ask-AI / member buttons so the hover lift + glow
                        matches the rest of the header row. */}
                    <AppTooltip title={t.notes.header.ownerProjectTooltip}>
                        <Box
                            sx={{
                                ...actionButtonStyle,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                p: 0.5,
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

                    {/* Unified Task pill (Task #<id> │ Title │ Status),
                        shared with the chat thread header so both surfaces
                        render the identical control. */}
                    <TaskInfoPill
                        isDark={isDark}
                        styles={styles}
                        task={currentTask}
                        onOpen={onOpenTask}
                    />
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
                                        showPulseDot={false}
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
                        // Version history — replaces the header chip that
                        // used to sit in each note header (my / task).
                        // Hidden until the note has at least one saved
                        // version (matches the chip's own guard).
                        id: "versionHistory",
                        label: t.notes.history.viewVersions,
                        icon: <HistoryRoundedIcon sx={{ fontSize: 18 }} />,
                        visible: activeNoteId != null && useNM.currentNoteVersions.length > 0,
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
                    allowDestinationChange
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
                                color: isDark
                                    ? "var(--gp-tint-danger)"
                                    : "var(--gp-tint-danger-alt)",
                            }}
                        />
                    </IconButton>
                </Tooltip>
            )}

            {/* Version-history modal — opened from the ⋮ menu (the chip
                that used to open it was removed from the my / task note
                headers). */}
            {activeNoteId != null && (
                <ModalNoteHistory
                    myself={myself}
                    noteId={activeNoteId}
                    noteType={normalizedNoteType ?? noteType}
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
                    noteType={toBackendNoteType(noteType)}
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
