import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CommentRoundedIcon from "@mui/icons-material/CommentRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
    Box,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    Stack,
    TabList,
    TabPanel,
    Tabs,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import Tab, { tabClasses } from "@mui/joy/Tab";
import { useLocation } from "react-router-dom";
import { Socket } from "socket.io-client";

import { ImageZoomModal } from "../../../../../components/messageBody/ImageZoomModal";
import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { FileSizeRejectionSnackbar } from "../../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import { UploadingTileBadge } from "../../../../../components/ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../../../../../components/ui/feedback/useFileSizeGuard";
import { PlainButton } from "../../../../../components/ui/PlainButton";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../../../hooks/common/UrlLinkModalContext";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { useUndoHidden } from "../../../../../hooks/common/useUndoableAction";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../../types/chat";
import { TaskNoteProps } from "../../../../../types/notes";
import {
    AttachmentFileProps,
    TaskActivityProps,
    TaskCommentProps,
    TaskProps,
} from "../../../../../types/tasks";
import { downloadFile } from "../../../../../utils/downloadUtils";
import { AttachmentActionsMenu } from "../../../../notes/common/components/AttachmentActionsMenu";
import { ModalImportMarkdown } from "../../../../notes/common/components/ModalImportMarkdown";
import { isImportableTextFile } from "../../../../notes/common/services/importableAttachment";
import { useAttachmentClientIds } from "../../../hooks/useAttachmentClientIds";
import { useAttachmentPreviews } from "../../../hooks/useAttachmentPreviews";
import { deleteTaskAttachment } from "../../../services/deleteTaskAttachment";
import { taskCommentKey } from "../../../services/deleteTaskComment";
import { TaskActivityFeed } from "./sub/TaskActivityFeed";
import { TaskCommentEditorBlock } from "./sub/TaskCommentEditorBlock";
import { TaskCommentList } from "./sub/TaskCommentList";
import { TaskProgressFeed } from "./sub/TaskProgressFeed";

type TaskTabBlockProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated: (value: boolean) => void;
    /** Removes the attachment from both the persisted `uploadedFiles`
     *  list and the working `tmpCurrentTaskContent.attachments` in a
     *  single parent-side update. Replaces the older two-flag pattern
     *  (`setIsAttachmentDeleted` + `setDeletedAttachmentId`) which was
     *  prone to wedging on rapid double-deletes. */
    onAttachmentDeleted: (attachmentId: number) => void;
    taskComments: TaskCommentProps[];
    setIsInEdit: (value: boolean) => void;
    setEditTargetComment: (value: TaskCommentProps) => void;
    taskNotes: TaskNoteProps[];
    /** Pre-loaded activity rows. Hoisted out of TaskActivityFeed so the
     *  Activity tab does not refetch on every visit (which used to make
     *  the preview look like it was "refreshing" on every Notes →
     *  Activity hop). */
    taskActivities: TaskActivityProps[];
    /** True while the parent is fetching `taskActivities`. */
    isLoadingTaskActivities: boolean;
    /** The last `taskActivities` load failed: the feed shows Retry, not "No activity". */
    taskActivitiesFailed: boolean;
    onRetryTaskActivities: () => void;
    editTargetComment: TaskCommentProps | undefined;
    isInEdit: boolean;
    setTaskCommentLines: (value: number) => void;
    setTaskComments: (value: TaskCommentProps[]) => void;
    tmpCurrentTaskContent: TaskProps;
    taskCommentLines: number;
    useTEM: TeamManagementState;
    tabIndex: number;
    setTabIndex: (value: number) => void;
    useTM: TaskManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
    setTodoFromMessageBubble?: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
    /** Present when this block renders inside the UrlLinkModal (see
     *  TaskPreviewProps.hostZIndex). Notes-tab clicks then open the note
     *  IN the modal (re-targeting it) instead of driving the notes-page
     *  state behind the dialog, which looked like a dead click. */
    hostZIndex?: number;
};

export const TaskTabBlock = (props: TaskTabBlockProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const {
        socket,
        myself,
        setMyself,
        useCM,
        useUISM,
        setTaskUpdated,
        taskContent,
        setTaskContent,
        onAttachmentDeleted,
        taskComments,
        setIsInEdit,
        setEditTargetComment,
        taskNotes,
        taskActivities,
        isLoadingTaskActivities,
        taskActivitiesFailed,
        onRetryTaskActivities,
        editTargetComment,
        isInEdit,
        setTaskCommentLines,
        setTaskComments,
        tmpCurrentTaskContent,
        taskCommentLines,
        tabIndex,
        setTabIndex,
        useTM,
        useTEM,
        useNM,
        setTodoFromMessageBubble,
        hostZIndex,
    } = props;
    const urlLinkModal = useUrlLinkModal();
    const isModalHosted = hostZIndex != null;

    // Activity tab, two views (MIP-1351): the item's OWN changes, and what changed
    // UNDER it (its sub-tasks, and a milestone's tasks). The second is offered only
    // when it has something under it: for a task with no sub-tasks it would repeat
    // the first. A milestone is shown through its backing task, so one test covers both.
    const itemId = taskContent.id ?? null;
    const hasChildren = useMemo(
        () =>
            itemId != null &&
            useTM.allTasks.some(
                (row) => row.parentTaskId != null && String(row.parentTaskId) === String(itemId)
            ),
        [useTM.allTasks, itemId]
    );
    const progressVersion = useMemo(
        () =>
            useTM.allTasks.find((row) => itemId != null && String(row.id) === String(itemId))
                ?.lastProgressAt ?? "",
        [useTM.allTasks, itemId]
    );
    const [activityScope, setActivityScope] = useState<"own" | "under">("own");
    useEffect(() => {
        setActivityScope("own");
    }, [itemId]);
    const showUnder = hasChildren && activityScope === "under";

    const attachments = taskContent.attachments ?? [];
    const previews = useAttachmentPreviews(attachments);
    const nextClientId = useAttachmentClientIds();
    // Per-file size cap. `filterFiles` accepts only files within the
    // limit and stashes the rest for the snackbar; the corresponding
    // `<FileSizeRejectionSnackbar />` is rendered below.
    const { rejection, dismissRejection, filterFiles } = useFileSizeGuard();

    // Deep-link plumbing for the task-panel mount of `TaskCommentList`.
    //
    // Task panel URL shape is
    //   `/workspace/tasks/project/:projectId/task/:taskId/comment/:commentId`
    // We only honour the URL's `commentId` when the path is in this
    // exact shape AND its `:taskId` matches the currently displayed
    // task — without that guard, navigating between tasks would briefly
    // light up an unrelated comment in the new task.
    const location = useLocation();
    const projectId = taskContent?.project?.projectId;
    const currentTaskId = taskContent?.id;
    const focusedCommentId = useMemo<number | undefined>(() => {
        const parts = location.pathname.split("/").filter(Boolean);
        if (parts[0] !== "workspace" || parts[1] !== "tasks") return undefined;
        const taskIdx = parts.indexOf("task");
        const commentIdx = parts.indexOf("comment");
        if (taskIdx === -1 || commentIdx === -1) return undefined;
        const urlTaskId = Number(parts[taskIdx + 1]);
        if (!Number.isFinite(urlTaskId) || urlTaskId !== Number(currentTaskId)) return undefined;
        const parsed = Number(parts[commentIdx + 1]);
        return Number.isFinite(parsed) ? parsed : undefined;
    }, [location.pathname, currentTaskId]);

    // If this is called from chat thread panel, return the current path
    const commentLinkBuilder = useCallback(
        (commentId: number) => {
            const currentPath = window.location.pathname;
            if (currentPath.includes("/workspace/chat/pm/")) {
                return currentPath;
            }
            return `/workspace/tasks/project/${projectId}/task/${currentTaskId}/comment/${commentId}`;
        },
        [projectId, currentTaskId]
    );

    const inputRef = useRef<HTMLInputElement | null>(null);

    const appendFiles = useCallback(
        (files: Iterable<File>, dedupeByName = false) => {
            // Drop oversize files before they take up an attachment slot
            // — they'd otherwise sit in the panel forever since the
            // backend would 413 the actual upload.
            const incoming = dedupeByName
                ? Array.from(new Map(Array.from(files).map((f) => [f.name, f])).values())
                : Array.from(files);
            const accepted = filterFiles(incoming);
            if (accepted.length === 0) return;
            const newItems: AttachmentFileProps[] = accepted.map((file) => ({
                attachment_id: nextClientId(),
                file,
                name: file.name,
                type: file.type,
            }));
            setTaskContent({
                ...taskContent,
                attachments: [...attachments, ...newItems],
            });
            setTaskUpdated(true);
        },
        [attachments, filterFiles, nextClientId, setTaskContent, setTaskUpdated, taskContent]
    );

    const handleSelectedFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) appendFiles(event.target.files);
        event.target.value = "";
    };

    const handleDroppedFiles = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        // Existing-task tab dedupes by filename to match the prior
        // behaviour (drag-and-drop can deliver the same file twice on
        // some OSes).
        appendFiles(event.dataTransfer.files, true);
    };

    // ---- Comments-tab drop → comment editor -------------------------
    //
    // Files dropped on the Comments tab are uploaded and inserted into
    // the comment editor as image/file blocks (the user then sends them
    // as part of a comment), matching the chat editor's drop UX.
    // Uploads are v3 channel-scoped, so this needs the task's project PM
    // channel; `chat.project.projectId` is the v3 join key, with the
    // legacy `chatId === String(projectId)` compare kept as a fallback
    // for pre-migration rows (same lookup as TaskNoteMain's pmChat).
    const pmChannel = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            projectId != null &&
            (chat.project?.projectId === projectId || chat.chatId === String(projectId))
    );
    const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([]);
    const clearPendingCommentFiles = useCallback(() => setPendingCommentFiles([]), []);

    const handleDelete = async (attachmentId: number) => {
        // Negative ids haven't reached the server yet — just drop them
        // locally. We rely on the parent's tmp/upload reconciliation in
        // `useSendUpdatedTask` to skip already-removed in-flight rows
        // when its POST round-trip returns.
        if (attachmentId < 0) {
            setTaskContent({
                ...taskContent,
                attachments: attachments.filter((a) => a.attachment_id !== attachmentId),
            });
            return;
        }
        if (taskContent.id) {
            await deleteTaskAttachment(taskContent.id, attachmentId, accessToken);
        }
        onAttachmentDeleted(attachmentId);
    };

    const imageItems = useMemo(
        () => attachments.filter((a) => previews.get(a.attachment_id)?.kind === "image"),
        [attachments, previews]
    );
    const fileItems = useMemo(
        () => attachments.filter((a) => previews.get(a.attachment_id)?.kind === "file"),
        [attachments, previews]
    );

    // State for image preview modal
    const [opened, setOpened] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const handleImageClick = (src: string) => {
        setSelectedImage(src);
        setOpened(true);
    };

    // Tab configuration. Activity sits in the trailing slot so the
    // existing 0/1/2 indices that other components reference (e.g.
    // direct setTabIndex calls when opening notes from the sidebar)
    // keep their meaning.
    // A comment in its Undo window is already out of the list; the count follows.
    const hiddenKeys = useUndoHidden();
    const commentCount = taskComments.filter(
        (c) => !hiddenKeys.has(taskCommentKey(c.taskId, c.commentId))
    ).length;
    const tabs = [
        {
            label: t.tasks.tabs.comments,
            icon: <CommentRoundedIcon sx={{ fontSize: 16 }} />,
            count: commentCount,
        },
        {
            label: t.tasks.tabs.notes,
            icon: <NoteAltRoundedIcon sx={{ fontSize: 16 }} />,
            count: taskNotes.length,
        },
        {
            label: t.tasks.tabs.attachments,
            icon: <AttachFileRoundedIcon sx={{ fontSize: 16 }} />,
            count: attachments.length,
        },
        {
            label: t.tasks.tabs.activity,
            icon: <HistoryRoundedIcon sx={{ fontSize: 16 }} />,
            // Count is intentionally omitted — activity rows can grow
            // unboundedly so a number badge would be more noisy than
            // useful. The feed itself shows the count when open.
            count: undefined,
        },
    ];

    // Shared look of the two buttons under the task's notes list.
    const addNoteButtonSx = {
        // Equal share of the row whatever the label: `flex: 1` alone keeps the
        // content as the basis, so a longer label made one button wider and
        // taller and they ran into each other. `minWidth: 0` lets a button
        // shrink below its label (which ellipsises, see the labels below).
        flex: "1 1 0",
        minWidth: 0,
        // Joy gives a ListItemButton inside a ListItem negative margins (12px
        // each side, and -4px on top of the first) so it can bleed into the
        // item's padding. With two side by side that is what made them
        // overlap and the first one taller.
        m: 0,
        justifyContent: "center",
        gap: 1,
    } as const;

    const [importNoteOpen, setImportNoteOpen] = useState(false);
    // A markdown/text attachment being imported as a note (its menu on the
    // attachment tile). Shares the dialog with the header-style import.
    const [importAttachment, setImportAttachment] = useState<{ url: string; name: string } | null>(
        null
    );
    // The imported note is already created and (outside a modal-hosted
    // preview) open in a notes-page tab. Bring the notes page up like the
    // New Note button does, or re-target the hosting modal at the note.
    const handleImportedNote = (note: TaskNoteProps) => {
        if (isModalHosted && urlLinkModal) {
            urlLinkModal.openModalByHref(
                `/workspace/notes/task/project/${note.projectId}/task/${note.taskId}/note/${note.noteId}`
            );
            return;
        }
        if (useNM.setIsTaskNoteVisible) {
            useTM.setIsTaskTableVisible(false);
            useNM.setIsTaskNoteVisible(true);
        }
    };

    return (
        <Box sx={{ flexGrow: 1, overflowX: "hidden" }}>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            {taskContent.project && (
                <ModalImportMarkdown
                    hostZIndex={hostZIndex}
                    myself={myself}
                    open={importNoteOpen || importAttachment != null}
                    skipOpenTab={isModalHosted}
                    useNM={useNM}
                    context={{
                        kind: "task",
                        projectId: taskContent.project.projectId,
                        taskId: Number(taskContent.id),
                    }}
                    initialFile={
                        importAttachment
                            ? {
                                  ...importAttachment,
                                  defaultDestination: {
                                      kind: "task",
                                      projectId: taskContent.project.projectId,
                                      taskId: Number(taskContent.id),
                                  },
                              }
                            : null
                    }
                    onTaskNoteCreated={handleImportedNote}
                    onClose={() => {
                        setImportNoteOpen(false);
                        setImportAttachment(null);
                    }}
                />
            )}
            <Tabs
                aria-label={t.tasks.tabs.ariaLabel}
                value={tabIndex}
                onChange={(_, value) => setTabIndex(value as number)}
            >
                <TabList
                    sx={{
                        px: 2,
                        pt: 1.5,
                        pb: 0,
                        gap: 0.5,
                        borderBottom: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        [`&& .${tabClasses.root}`]: {
                            flex: "initial",
                            bgcolor: "transparent",
                            borderRadius: "10px 10px 0 0",
                            px: 2,
                            py: 1,
                            fontWeight: 500,
                            fontSize: "0.8rem",
                            gap: 1,
                            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
                            },
                            [`&.${tabClasses.selected}`]: {
                                color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                                fontWeight: 600,
                                bgcolor: isDark
                                    ? "rgba(var(--gp-brandalt-500-rgb), 0.1)"
                                    : "rgba(var(--gp-brand-700-rgb), 0.08)",
                                "&::after": {
                                    height: "2px",
                                    borderRadius: "2px 2px 0 0",
                                    bgcolor: isDark
                                        ? "var(--gp-brandalt-400)"
                                        : "var(--gp-brand-700)",
                                },
                            },
                        },
                    }}
                >
                    {tabs.map((tab, index) => (
                        <Tab key={tab.label} indicatorInset>
                            {tab.icon}
                            {tab.label}
                            {tab.count != null && tab.count > 0 && (
                                <Box
                                    component="span"
                                    sx={{
                                        ml: 0.5,
                                        px: 0.8,
                                        py: 0.2,
                                        fontSize: "0.65rem",
                                        fontWeight: 700,
                                        borderRadius: "6px",
                                        background:
                                            tabIndex === index
                                                ? isDark
                                                    ? "rgba(var(--gp-brandalt-500-rgb), 0.2)"
                                                    : "rgba(var(--gp-brand-700-rgb), 0.15)"
                                                : isDark
                                                  ? "rgba(255,255,255,0.08)"
                                                  : "rgba(0,0,0,0.06)",
                                        color:
                                            tabIndex === index
                                                ? isDark
                                                    ? "var(--gp-brandalt-400)"
                                                    : "var(--gp-brand-700)"
                                                : isDark
                                                  ? "rgba(255,255,255,0.5)"
                                                  : "rgba(0,0,0,0.5)",
                                    }}
                                >
                                    {tab.count}
                                </Box>
                            )}
                        </Tab>
                    ))}
                </TabList>

                <Box
                    sx={{
                        background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                        p: 2,
                    }}
                >
                    {/* Comments Tab */}
                    <TabPanel sx={{ p: 0 }} value={0}>
                        {/* Drop-zone wrapper.
                            Files dropped anywhere on the Comments tab go
                            INTO the comment editor: they're uploaded to
                            the task's project PM channel and inserted as
                            image/file blocks, so the user sends them as
                            part of a comment — same UX as dropping a
                            file on the chat pane. (The previous spec
                            forwarded drops to the Attachments tab, which
                            surprised users who dropped a screenshot to
                            talk about it.)
                            Fallback: when no PM channel is resolvable
                            (task without a project / channels not
                            loaded), drops keep the old attach-to-
                            Attachments behaviour rather than vanishing. */}
                        <Box
                            sx={{ position: "relative" }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (e.dataTransfer?.types?.includes("Files")) {
                                    e.dataTransfer.dropEffect = "copy";
                                }
                            }}
                            onDrop={(e) => {
                                if (!pmChannel) {
                                    handleDroppedFiles(e);
                                    return;
                                }
                                // Drops landing INSIDE the compose editor's
                                // editable are handled by BlockNote itself
                                // (it has `uploadFile`, so ProseMirror's own
                                // drop handler uploads + inserts, same as
                                // the chat editor). Handling them here TOO
                                // inserted the file twice. Read-only
                                // comment previews are contenteditable
                                // ="false", so they don't match and still
                                // route through the queue below.
                                const target = e.target as HTMLElement | null;
                                if (target?.closest('[contenteditable="true"]')) {
                                    return;
                                }
                                e.preventDefault();
                                // Dedupe by name — macOS can deliver the
                                // same file twice in one drop's
                                // `dataTransfer.files` (same quirk
                                // `appendFiles` dedupes for).
                                const files = Array.from(
                                    new Map(
                                        Array.from(e.dataTransfer.files).map((f) => [f.name, f])
                                    ).values()
                                );
                                if (files.length > 0) setPendingCommentFiles(files);
                            }}
                        >
                            <TaskCommentList
                                currentProjectId={taskContent.project?.projectId}
                                currentProjectName={taskContent.project?.projectName}
                                currentTaskDisplayId={taskContent.displayId}
                                focusedCommentId={focusedCommentId}
                                hostZIndex={hostZIndex}
                                myself={myself}
                                setEditTargetComment={setEditTargetComment}
                                setIsInEdit={setIsInEdit}
                                setMyself={setMyself}
                                socket={socket}
                                taskActivities={taskActivities}
                                taskComments={taskComments}
                                useCM={useCM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                                commentLinkBuilder={
                                    projectId !== undefined && currentTaskId !== undefined
                                        ? commentLinkBuilder
                                        : undefined
                                }
                            />
                            <TaskCommentEditorBlock
                                clearPendingFiles={clearPendingCommentFiles}
                                editTargetComment={editTargetComment}
                                isInEdit={isInEdit}
                                myself={myself}
                                pendingFiles={pendingCommentFiles}
                                setIsInEdit={setIsInEdit}
                                setMyself={setMyself}
                                setTaskCommentLines={setTaskCommentLines}
                                setTaskComments={setTaskComments}
                                socket={socket}
                                task={tmpCurrentTaskContent}
                                taskCommentLines={taskCommentLines}
                                taskComments={taskComments}
                                uploadChannelId={pmChannel ? String(pmChannel.chatId) : undefined}
                                useCM={useCM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                            />
                        </Box>
                    </TabPanel>

                    {/* Notes Tab */}
                    <TabPanel sx={{ p: 0 }} value={1}>
                        <Stack
                            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                            direction="column"
                            sx={{
                                width: "100%",
                                minHeight: "80px",
                                maxHeight: "250px",
                                overflowY: "auto",
                            }}
                        >
                            <List sx={{ gap: 0.5, px: 3 }}>
                                {taskNotes.map((taskNote, index) => (
                                    <ListItem
                                        key={`listitem-${taskNote.noteType}-${taskNote.noteId}-${index}`}
                                        sx={{ py: 0.5 }}
                                    >
                                        <ListItemButton
                                            sx={{
                                                borderRadius: "10px",
                                                px: 2,
                                                py: 1,
                                                background: isDark
                                                    ? "rgba(255,255,255,0.02)"
                                                    : "rgba(0,0,0,0.02)",
                                                border: "1px solid",
                                                borderColor: isDark
                                                    ? "rgba(255,255,255,0.04)"
                                                    : "rgba(0,0,0,0.04)",
                                                transition: "all 0.2s ease",
                                                "&:hover": {
                                                    background: isDark
                                                        ? "rgba(255,255,255,0.05)"
                                                        : "rgba(0,0,0,0.04)",
                                                    borderColor: isDark
                                                        ? "rgba(255,255,255,0.08)"
                                                        : "rgba(0,0,0,0.08)",
                                                },
                                            }}
                                            onClick={() => {
                                                // Modal-hosted preview: driving the
                                                // notes-page state below would change
                                                // a surface the user can't see (the
                                                // dialog stays on top) — a dead click.
                                                // Re-target the hosting modal to the
                                                // note view instead.
                                                if (isModalHosted && urlLinkModal) {
                                                    urlLinkModal.openModalByHref(
                                                        `/workspace/notes/task/project/${taskNote.projectId}/task/${taskNote.taskId}/note/${taskNote.noteId}`
                                                    );
                                                    return;
                                                }
                                                if (useNM.setIsTaskNoteVisible) {
                                                    useTM.setIsTaskTableVisible(false);
                                                    useNM.setIsTaskNoteVisible(true);
                                                    useNM.tabsApi.openTab({
                                                        kind: "task",
                                                        noteType: 2,
                                                        noteId: taskNote.noteId,
                                                        projectId: taskNote.projectId,
                                                        taskId: taskNote.taskId,
                                                        id: `task-${taskNote.noteId}`,
                                                        title: taskNote.title,
                                                        teamId: myself.teamId,
                                                    });
                                                }
                                            }}
                                        >
                                            <NoteAltRoundedIcon
                                                sx={{
                                                    fontSize: 18,
                                                    mr: 1.5,
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.4)"
                                                        : "rgba(0,0,0,0.35)",
                                                }}
                                            />
                                            <Typography
                                                level="body-sm"
                                                sx={{
                                                    fontWeight: 500,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                                noWrap
                                            >
                                                {taskNote.title}
                                            </Typography>
                                        </ListItemButton>
                                    </ListItem>
                                ))}

                                {/* Add New Note Button. In the modal-hosted
                                    preview, creation re-targets the hosting
                                    modal to the new note (same pattern as
                                    clicking an existing note above) instead
                                    of driving the notes-page state behind
                                    the dialog, which looked like a dead
                                    click — the reason this button used to
                                    be hidden there entirely. */}
                                <ListItem sx={{ p: 0, mt: 0.5, gap: 1, alignItems: "stretch" }}>
                                    <ListItemButton
                                        color="primary"
                                        sx={addNoteButtonSx}
                                        variant="soft"
                                        onClick={async () => {
                                            if (!taskContent.project) return;
                                            if (isModalHosted && urlLinkModal) {
                                                // Create without opening a
                                                // notes-page tab, then show
                                                // the note by re-targeting
                                                // the hosting modal.
                                                const created =
                                                    await useNM.handleCreateNewTaskNote(
                                                        null,
                                                        taskContent.project.projectId,
                                                        Number(taskContent.id),
                                                        taskContent.title,
                                                        { skipOpenTab: true }
                                                    );
                                                if (created) {
                                                    urlLinkModal.openModalByHref(
                                                        `/workspace/notes/task/project/${created.projectId}/task/${created.taskId}/note/${created.noteId}`
                                                    );
                                                }
                                                return;
                                            }
                                            if (useNM.setIsTaskNoteVisible) {
                                                useTM.setIsTaskTableVisible(false);
                                                useNM.setIsTaskNoteVisible(true);
                                                useNM.handleCreateNewTaskNote(
                                                    null,
                                                    taskContent.project.projectId,
                                                    Number(taskContent.id),
                                                    taskContent.title
                                                );
                                            }
                                        }}
                                    >
                                        <AddRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
                                        <Typography
                                            level="body-sm"
                                            sx={{ fontWeight: 600 }}
                                            noWrap
                                        >
                                            New Note
                                        </Typography>
                                    </ListItemButton>
                                    {/* Import a markdown file as a new note on this
                                        task (MIP-850). Same dialog as the notes
                                        header's "Import Markdown…". */}
                                    <ListItemButton
                                        color="primary"
                                        sx={addNoteButtonSx}
                                        variant="soft"
                                        onClick={() => {
                                            if (taskContent.project) setImportNoteOpen(true);
                                        }}
                                    >
                                        <UploadFileRoundedIcon
                                            sx={{ fontSize: 18, flexShrink: 0 }}
                                        />
                                        <Typography
                                            level="body-sm"
                                            sx={{ fontWeight: 600 }}
                                            noWrap
                                        >
                                            {t.notes.importMd.importNote}
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                            </List>
                        </Stack>
                    </TabPanel>

                    {/* Attachments Tab */}
                    <TabPanel sx={{ p: 0 }} value={2}>
                        <Box
                            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                            sx={{
                                width: "100%",
                                minHeight: "150px",
                                borderRadius: "12px",
                                border: "2px dashed",
                                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                                background: isDark
                                    ? "rgba(255,255,255,0.02)"
                                    : "rgba(0,0,0,0.015)",
                                display: "flex",
                                alignItems: "center",
                                flexWrap: "wrap",
                                p: 2,
                                gap: 2,
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    borderColor: isDark
                                        ? "rgba(var(--gp-brandalt-500-rgb), 0.3)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.2)",
                                    background: isDark
                                        ? "rgba(var(--gp-brandalt-500-rgb), 0.03)"
                                        : "rgba(var(--gp-brand-700-rgb), 0.02)",
                                },
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDroppedFiles}
                        >
                            {attachments.length === 0 && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        flex: 1,
                                        textAlign: "center",
                                        py: 2,
                                        gap: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: "12px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            background: isDark
                                                ? "rgba(255,255,255,0.04)"
                                                : "rgba(0,0,0,0.03)",
                                        }}
                                    >
                                        <AttachFileRoundedIcon
                                            sx={{
                                                fontSize: 24,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.3)"
                                                    : "rgba(0,0,0,0.25)",
                                            }}
                                        />
                                    </Box>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.5)"
                                                : "rgba(0,0,0,0.45)",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Drag & Drop files here
                                    </Typography>
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.3)"
                                                : "rgba(0,0,0,0.35)",
                                        }}
                                    >
                                        or use the button below to browse
                                    </Typography>
                                </Box>
                            )}

                            {/* Non-image files */}
                            {fileItems.map((item) => {
                                const preview = previews.get(item.attachment_id);
                                if (!preview) return null;
                                // Negative client-side ids mark attachments
                                // that haven't been persisted yet. Once
                                // `useSendUpdatedTask` swaps them for the
                                // server-issued positive ids the spinner
                                // disappears automatically.
                                const isUploading = item.attachment_id < 0;
                                const name =
                                    item.name ?? (item.file instanceof File ? item.file.name : "");
                                return (
                                    <Box
                                        key={`file-${item.attachment_id}`}
                                        sx={{
                                            position: "relative",
                                            textAlign: "center",
                                            p: 1.5,
                                            borderRadius: "10px",
                                            background: isDark
                                                ? "rgba(255,255,255,0.04)"
                                                : "rgba(0,0,0,0.03)",
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(255,255,255,0.06)"
                                                : "rgba(0,0,0,0.05)",
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(255,255,255,0.06)"
                                                    : "rgba(0,0,0,0.05)",
                                            },
                                        }}
                                    >
                                        <IconButton
                                            disabled={isUploading}
                                            size="sm"
                                            variant="plain"
                                            sx={{
                                                position: "absolute",
                                                top: -8,
                                                right: -8,
                                                background: isDark
                                                    ? "rgba(var(--gp-tint-danger-rgb), 0.2)"
                                                    : "rgba(var(--gp-tint-danger-rgb), 0.15)",
                                                borderRadius: "50%",
                                                width: 20,
                                                height: 20,
                                                minWidth: 20,
                                                minHeight: 20,
                                                zIndex: 6,
                                                "&:hover": {
                                                    background:
                                                        "rgba(var(--gp-tint-danger-rgb), 0.3)",
                                                },
                                                "&.Mui-disabled": {
                                                    opacity: 0.4,
                                                },
                                            }}
                                            onClick={() => handleDelete(item.attachment_id)}
                                        >
                                            <CloseRoundedIcon
                                                sx={{ fontSize: 12, color: "#ef4444" }}
                                            />
                                        </IconButton>
                                        <AppTooltip
                                            title={fmt(t.tasks.tabs.downloadFileTooltip, {
                                                name,
                                            })}
                                        >
                                            <PlainButton
                                                disabled={isUploading}
                                                sx={{ display: "block" }}
                                                aria-label={fmt(t.tasks.tabs.downloadFileTooltip, {
                                                    name,
                                                })}
                                                onClick={() => downloadFile(preview.url, name)}
                                            >
                                                <InsertDriveFileRoundedIcon
                                                    sx={{
                                                        fontSize: 32,
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.5)"
                                                            : "rgba(0,0,0,0.4)",
                                                    }}
                                                />
                                            </PlainButton>
                                        </AppTooltip>
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                maxWidth: "80px",
                                                textOverflow: "ellipsis",
                                                overflow: "hidden",
                                                whiteSpace: "nowrap",
                                                mt: 0.5,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.6)"
                                                    : "rgba(0,0,0,0.55)",
                                            }}
                                        >
                                            {name}
                                        </Typography>
                                        {isImportableTextFile(name) && taskContent.project && (
                                            // Beside the tile, not on it: clicking
                                            // the tile still downloads.
                                            <Box sx={{ position: "absolute", top: 2, left: 2 }}>
                                                <AttachmentActionsMenu
                                                    disabled={isUploading}
                                                    name={name}
                                                    onDownload={() => {
                                                        void downloadFile(preview.url, name);
                                                    }}
                                                    onImportAsNote={() =>
                                                        setImportAttachment({
                                                            url: preview.url,
                                                            name,
                                                        })
                                                    }
                                                />
                                            </Box>
                                        )}
                                        <UploadingTileBadge open={isUploading} />
                                    </Box>
                                );
                            })}

                            {/* Images */}
                            {imageItems.map((item) => {
                                const preview = previews.get(item.attachment_id);
                                if (!preview) return null;
                                const isUploading = item.attachment_id < 0;
                                const name =
                                    item.name ?? (item.file instanceof File ? item.file.name : "");
                                return (
                                    <Box
                                        key={`image-${item.attachment_id}`}
                                        sx={{
                                            position: "relative",
                                            display: "inline-block",
                                            borderRadius: "10px",
                                            overflow: "hidden",
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(255,255,255,0.08)"
                                                : "rgba(0,0,0,0.06)",
                                        }}
                                    >
                                        <IconButton
                                            disabled={isUploading}
                                            size="sm"
                                            variant="plain"
                                            sx={{
                                                position: "absolute",
                                                top: 4,
                                                right: 4,
                                                background: "rgba(0,0,0,0.5)",
                                                backdropFilter: "blur(4px)",
                                                borderRadius: "50%",
                                                width: 24,
                                                height: 24,
                                                minWidth: 24,
                                                minHeight: 24,
                                                zIndex: 6,
                                                "&:hover": {
                                                    background:
                                                        "rgba(var(--gp-tint-danger-rgb), 0.7)",
                                                },
                                                "&.Mui-disabled": {
                                                    opacity: 0.4,
                                                },
                                            }}
                                            onClick={() => handleDelete(item.attachment_id)}
                                        >
                                            <CloseRoundedIcon
                                                sx={{ fontSize: 14, color: "white" }}
                                            />
                                        </IconButton>
                                        <PlainButton
                                            aria-label={name}
                                            disabled={isUploading}
                                            sx={{ display: "block" }}
                                            onClick={() => handleImageClick(preview.url)}
                                        >
                                            <img
                                                alt=""
                                                src={preview.url}
                                                style={{
                                                    maxWidth: 300,
                                                    maxHeight: 300,
                                                    width: "auto",
                                                    height: "auto",
                                                    display: "block",
                                                }}
                                            />
                                        </PlainButton>
                                        <UploadingTileBadge open={isUploading} />
                                    </Box>
                                );
                            })}
                        </Box>

                        {/* Select Files Button */}
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                                alignItems: "center",
                                mt: 1.5,
                            }}
                        >
                            <input
                                ref={inputRef}
                                accept="*"
                                multiple={true}
                                style={{ display: "none" }}
                                type="file"
                                onChange={handleSelectedFiles}
                            />
                            <Button
                                color="primary"
                                size="sm"
                                startDecorator={<FolderRoundedIcon />}
                                variant="soft"
                                onClick={() => inputRef.current?.click()}
                            >
                                {t.tasks.createForm.selectFiles}
                            </Button>
                        </Box>

                        {/* Image Preview Modal */}
                        <ImageZoomModal
                            filenameStem="task-attachment-image"
                            src={opened ? selectedImage : null}
                            onClose={() => setOpened(false)}
                        />
                    </TabPanel>

                    {/* Activity Tab — structured audit log. The fetch
                        lives in `TaskPreview` (passed in via
                        `taskActivities` / `isLoadingTaskActivities`)
                        so switching into this tab does not refetch and
                        flash the feed every time. */}
                    <TabPanel sx={{ p: 0 }} value={3}>
                        {hasChildren && (
                            <Box
                                aria-label={t.tasks.activity.progress.scopeLabel}
                                role="group"
                                sx={{ display: "flex", gap: 0.5, px: 1, pt: 1 }}
                            >
                                {(["own", "under"] as const).map((scope) => (
                                    <Button
                                        key={scope}
                                        aria-pressed={activityScope === scope}
                                        data-testid={`activity-scope-${scope}`}
                                        size="sm"
                                        variant={activityScope === scope ? "soft" : "plain"}
                                        onClick={() => setActivityScope(scope)}
                                    >
                                        {scope === "own"
                                            ? t.tasks.activity.progress.scopeOwn
                                            : t.tasks.activity.progress.scopeUnder}
                                    </Button>
                                ))}
                            </Box>
                        )}
                        {showUnder && itemId != null ? (
                            <TaskProgressFeed
                                allTasks={useTM.allTasks}
                                myself={myself}
                                projectId={projectId ?? null}
                                setMyself={setMyself}
                                socket={socket}
                                taskId={Number(itemId)}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                version={progressVersion}
                            />
                        ) : (
                            <TaskActivityFeed
                                activities={taskActivities}
                                allTasks={useTM.allTasks}
                                isLoading={isLoadingTaskActivities}
                                loadFailed={taskActivitiesFailed}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                taskId={taskContent.id ?? null}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                onRetry={onRetryTaskActivities}
                            />
                        )}
                    </TabPanel>
                </Box>
            </Tabs>
        </Box>
    );
};
