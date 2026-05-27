import React, { useCallback, useMemo, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CommentRoundedIcon from "@mui/icons-material/CommentRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import {
    Box,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    Modal,
    ModalDialog,
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

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { FileSizeRejectionSnackbar } from "../../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import { UploadingTileBadge } from "../../../../../components/ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../../../../../components/ui/feedback/useFileSizeGuard";
import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
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
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { downloadFile } from "../../../../../utils/downloadUtils";
import { useAttachmentClientIds } from "../../../hooks/useAttachmentClientIds";
import { useAttachmentPreviews } from "../../../hooks/useAttachmentPreviews";
import { deleteTaskAttachment } from "../../../services/deleteTaskAttachment";
import { TaskActivityFeed } from "./sub/TaskActivityFeed";
import { TaskCommentEditorBlock } from "./sub/TaskCommentEditorBlock";
import { TaskCommentList } from "./sub/TaskCommentList";

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
    } = props;

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

    const handleDownload = async (
        url: string,
        filename = `task-attachment-image-${getLocalCurrentTimestamp()}.png`
    ) => {
        await downloadFile(url, filename);
    };

    // Tab configuration. Activity sits in the trailing slot so the
    // existing 0/1/2 indices that other components reference (e.g.
    // direct setTabIndex calls when opening notes from the sidebar)
    // keep their meaning.
    const tabs = [
        {
            label: t.tasks.tabs.comments,
            icon: <CommentRoundedIcon sx={{ fontSize: 16 }} />,
            count: taskComments.length,
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

    return (
        <Box sx={{ flexGrow: 1, overflowX: "hidden" }}>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
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
                                color: isDark ? "#a78bfa" : "#7c3aed",
                                fontWeight: 600,
                                bgcolor: isDark ? "rgba(139,92,246,0.1)" : "rgba(124,58,237,0.08)",
                                "&::after": {
                                    height: "2px",
                                    borderRadius: "2px 2px 0 0",
                                    bgcolor: isDark ? "#a78bfa" : "#7c3aed",
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
                                                    ? "rgba(139,92,246,0.2)"
                                                    : "rgba(124,58,237,0.15)"
                                                : isDark
                                                  ? "rgba(255,255,255,0.08)"
                                                  : "rgba(0,0,0,0.06)",
                                        color:
                                            tabIndex === index
                                                ? isDark
                                                    ? "#a78bfa"
                                                    : "#7c3aed"
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
                            The comment editors (`bnTaskCommentEditor` /
                            `bnUpdateTaskCommentEditor`) strip
                            image/file/audio/video from their schemas and
                            don't supply an `uploadFile`, so BlockNote
                            registers no drop handler of its own. Without
                            a handler here, anything the user drags onto
                            the comment editor escapes to the browser's
                            default behaviour (navigating to the file
                            URL in a new tab).
                            We forward drops through the same
                            `handleDroppedFiles` path the Attachments
                            tab uses, so dropped files are persisted as
                            task attachments — which is the closest
                            equivalent now that the comment payload
                            itself can't carry binary blocks. */}
                        <Box
                            sx={{ position: "relative" }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (e.dataTransfer?.types?.includes("Files")) {
                                    e.dataTransfer.dropEffect = "copy";
                                }
                            }}
                            onDrop={handleDroppedFiles}
                        >
                            <TaskCommentList
                                currentProjectId={taskContent.project?.projectId}
                                currentProjectName={taskContent.project?.projectName}
                                currentTaskDisplayId={taskContent.displayId}
                                focusedCommentId={focusedCommentId}
                                myself={myself}
                                setEditTargetComment={setEditTargetComment}
                                setIsInEdit={setIsInEdit}
                                setMyself={setMyself}
                                socket={socket}
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
                                editTargetComment={editTargetComment}
                                isInEdit={isInEdit}
                                myself={myself}
                                setIsInEdit={setIsInEdit}
                                setMyself={setMyself}
                                setTaskCommentLines={setTaskCommentLines}
                                setTaskComments={setTaskComments}
                                socket={socket}
                                task={tmpCurrentTaskContent}
                                taskCommentLines={taskCommentLines}
                                taskComments={taskComments}
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

                                {/* Add New Note Button */}
                                <ListItem sx={{ p: 0, mt: 0.5 }}>
                                    <ListItemButton
                                        sx={{
                                            borderRadius: "10px",
                                            px: 2,
                                            py: 1,
                                            justifyContent: "center",
                                            gap: 1,
                                            background: isDark
                                                ? "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(124,58,237,0.08) 100%)"
                                                : "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.06) 100%)",
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(139,92,246,0.2)"
                                                : "rgba(124,58,237,0.15)",
                                            color: isDark ? "#a78bfa" : "#7c3aed",
                                            fontWeight: 600,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                background: isDark
                                                    ? "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.12) 100%)"
                                                    : "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.1) 100%)",
                                                borderColor: isDark
                                                    ? "rgba(139,92,246,0.3)"
                                                    : "rgba(124,58,237,0.25)",
                                            },
                                        }}
                                        onClick={() => {
                                            if (
                                                useNM.setIsTaskNoteVisible &&
                                                taskContent.project
                                            ) {
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
                                        <AddRoundedIcon sx={{ fontSize: 18 }} />
                                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                            New Note
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
                                        ? "rgba(139,92,246,0.3)"
                                        : "rgba(124,58,237,0.2)",
                                    background: isDark
                                        ? "rgba(139,92,246,0.03)"
                                        : "rgba(124,58,237,0.02)",
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
                                                    ? "rgba(232,121,195,0.2)"
                                                    : "rgba(232,121,195,0.15)",
                                                borderRadius: "50%",
                                                width: 20,
                                                height: 20,
                                                minWidth: 20,
                                                minHeight: 20,
                                                zIndex: 6,
                                                "&:hover": {
                                                    background: "rgba(232,121,195,0.3)",
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
                                            <div
                                                style={{
                                                    cursor: isUploading ? "default" : "pointer",
                                                }}
                                                onClick={() => {
                                                    if (isUploading) return;
                                                    downloadFile(preview.url, name);
                                                }}
                                            >
                                                <InsertDriveFileRoundedIcon
                                                    sx={{
                                                        fontSize: 32,
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.5)"
                                                            : "rgba(0,0,0,0.4)",
                                                    }}
                                                />
                                            </div>
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
                                                    background: "rgba(232,121,195,0.7)",
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
                                        <img
                                            alt={name}
                                            src={preview.url}
                                            style={{
                                                maxWidth: 300,
                                                maxHeight: 300,
                                                width: "auto",
                                                height: "auto",
                                                display: "block",
                                                cursor: isUploading ? "default" : "pointer",
                                            }}
                                            onClick={() => {
                                                if (isUploading) return;
                                                handleImageClick(preview.url);
                                            }}
                                        />
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
                            <IconButton
                                size="sm"
                                sx={{
                                    borderRadius: "10px",
                                    px: 2,
                                    py: 0.8,
                                    gap: 1,
                                    background: isDark
                                        ? "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(124,58,237,0.1) 100%)"
                                        : "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(124,58,237,0.08) 100%)",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(139,92,246,0.2)"
                                        : "rgba(124,58,237,0.15)",
                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: isDark
                                            ? "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(124,58,237,0.15) 100%)"
                                            : "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.12) 100%)",
                                    },
                                }}
                                onClick={() => inputRef.current?.click()}
                            >
                                <FolderRoundedIcon sx={{ fontSize: 18 }} />
                                <Typography
                                    level="body-sm"
                                    sx={{ fontWeight: 600, color: "inherit" }}
                                >
                                    Select Files
                                </Typography>
                            </IconButton>
                        </Box>

                        {/* Image Preview Modal */}
                        <Modal
                            open={opened}
                            sx={{ zIndex: 10010 }}
                            onClose={() => setOpened(false)}
                        >
                            <ModalDialog
                                sx={{
                                    borderRadius: "16px",
                                    p: 0,
                                    overflow: "hidden",
                                    background: isDark
                                        ? "rgba(22,22,28,0.95)"
                                        : "rgba(255,255,255,0.98)",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.1)"
                                        : "rgba(0,0,0,0.1)",
                                    boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
                                }}
                            >
                                {selectedImage && (
                                    <Box sx={{ position: "relative" }}>
                                        <img
                                            alt="preview"
                                            src={selectedImage}
                                            style={{
                                                display: "block",
                                                maxWidth: "80vw",
                                                maxHeight: "80vh",
                                            }}
                                        />
                                        <AppTooltip
                                            placement="left"
                                            title={t.tasks.tabs.downloadTooltip}
                                        >
                                            <IconButton
                                                variant="solid"
                                                sx={{
                                                    position: "absolute",
                                                    top: 12,
                                                    right: 12,
                                                    borderRadius: "10px",
                                                    background: "rgba(0,0,0,0.6)",
                                                    backdropFilter: "blur(8px)",
                                                    "&:hover": {
                                                        background: "rgba(0,0,0,0.8)",
                                                    },
                                                }}
                                                onClick={() => handleDownload(selectedImage)}
                                            >
                                                <DownloadRoundedIcon sx={{ color: "white" }} />
                                            </IconButton>
                                        </AppTooltip>
                                    </Box>
                                )}
                            </ModalDialog>
                        </Modal>
                    </TabPanel>

                    {/* Activity Tab — structured audit log. The fetch
                        lives in `TaskPreview` (passed in via
                        `taskActivities` / `isLoadingTaskActivities`)
                        so switching into this tab does not refetch and
                        flash the feed every time. */}
                    <TabPanel sx={{ p: 0 }} value={3}>
                        <TaskActivityFeed
                            activities={taskActivities}
                            isLoading={isLoadingTaskActivities}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </TabPanel>
                </Box>
            </Tabs>
        </Box>
    );
};
