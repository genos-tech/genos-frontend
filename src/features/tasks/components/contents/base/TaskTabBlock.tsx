import React, { useEffect, useRef, useState } from "react";
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
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import Tab, { tabClasses } from "@mui/joy/Tab";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../types/admin";
import { TaskNoteProps } from "../../../../../types/notes";
import {
    AttachmentFileProps,
    FileProps,
    ImageSizeProps,
    TaskActivityProps,
    TaskCommentProps,
    TaskProps,
} from "../../../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { downloadFile } from "../../../../../utils/downloadUtils";
import { deleteTaskAttachment } from "../../../services/deleteTaskAttachment";
import { TaskActivityFeed } from "./sub/TaskActivityFeed";
import { TaskCommentEditorBlock } from "./sub/TaskCommentEditorBlock";
import { TaskCommentList } from "./sub/TaskCommentList";

const resizeImageToFitBox = (imageSize: ImageSizeProps): ImageSizeProps => {
    const maxWidth = 300;
    const maxHeight = 300;

    const widthRatio = maxWidth / imageSize.width;
    const heightRatio = maxHeight / imageSize.height;
    const scaleFactor = Math.min(widthRatio, heightRatio);

    return {
        width: Math.round(imageSize.width * scaleFactor),
        height: Math.round(imageSize.height * scaleFactor),
    };
};

type TaskTabBlockProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    uploadedFiles: any[];
    setUploadedFiles: (value: any[]) => void;
    setTaskUpdated: (value: boolean) => void;
    setIsAttachmentDeleted: (value: boolean) => void;
    setDeletedAttachmentId: (value: number) => void;
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
};

export const TaskTabBlock = (props: TaskTabBlockProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const {
        socket,
        myself,
        setMyself,
        useCM,
        useUISM,
        uploadedFiles,
        setUploadedFiles,
        setTaskUpdated,
        taskContent,
        setTaskContent,
        setIsAttachmentDeleted,
        setDeletedAttachmentId,
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
    } = props;

    const [images, setImages] = useState<FileProps[]>([]);
    const [textFiles, setTextFiles] = useState<FileProps[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<AttachmentFileProps[]>([]);
    const [isUploadingFilesUpdated, setIsUploadingFilesUpdated] = useState<boolean>(false);
    const [numOfUploadingFiles, setNumOfUploadingFiles] = useState<number>(0);

    const updateDisplayingFiles = (file: File, attachmentId: number) => {
        if (attachmentId > 0) {
            if (file.type === "image/jpeg" || file.type === "image/png") {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        const img = new Image();
                        img.src = e.target.result as string;
                        img.onload = () => {
                            const size = resizeImageToFitBox({
                                height: img.height,
                                width: img.width,
                            });
                            setImages((prev) =>
                                prev.filter((image) => image.attachmentId !== attachmentId)
                            );
                            setImages((prev) => [
                                ...prev,
                                {
                                    attachmentId: attachmentId,
                                    url: img.src,
                                    name: file.name,
                                    width: size.width,
                                    height: size.height,
                                },
                            ]);
                        };
                    }
                };
                reader.readAsDataURL(file);
            } else {
                const fileURL = URL.createObjectURL(file);
                setTextFiles((prev) => prev.filter((f) => f.attachmentId !== attachmentId));
                setTextFiles((prev) => [
                    ...prev,
                    {
                        attachmentId: attachmentId,
                        name: file.name,
                        url: fileURL,
                        height: -1,
                        width: -1,
                    },
                ]);
            }
        }
    };

    // File upload manager via "Select File" button
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };

    const handleSelectedFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (selectedFiles) {
            Array.from(selectedFiles).map((file, index) => {
                const attachmentId: number = -numOfUploadingFiles - index - 1;
                setUploadingFiles((prev) => [
                    ...prev,
                    { attachment_id: attachmentId, file: file },
                ]);
                updateDisplayingFiles(file, attachmentId);
            });

            setIsUploadingFilesUpdated(true);
            setNumOfUploadingFiles(numOfUploadingFiles + selectedFiles.length);
        }
        event.target.value = "";
    };

    const handleDroppedFiles = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        const droppedFiles = Array.from(
            new Map(Array.from(event.dataTransfer.files).map((f) => [f.name, f])).values()
        );

        droppedFiles.map((file, index) => {
            const attachmentId: number = -numOfUploadingFiles - index - 1;
            setUploadingFiles((prev) => [...prev, { attachment_id: attachmentId, file: file }]);
            updateDisplayingFiles(file, attachmentId);
        });

        setIsUploadingFilesUpdated(true);
        setNumOfUploadingFiles(numOfUploadingFiles + droppedFiles.length);
    };

    const handleDeleteImage = async (taskId: number | undefined, deletingImage: FileProps) => {
        setImages((prev) => prev.filter((image) => image !== deletingImage));
        if (taskId) {
            await deleteTaskAttachment(taskId, deletingImage.attachmentId, accessToken);

            if (setIsAttachmentDeleted) {
                setIsAttachmentDeleted(true);
            }
            if (setDeletedAttachmentId) {
                setDeletedAttachmentId(deletingImage.attachmentId);
            }
            setUploadedFiles(
                uploadedFiles.filter((file) => file.attachment_id !== deletingImage.attachmentId)
            );
        }
    };

    const handleDeleteTextFile = async (
        taskId: number | undefined,
        deletingTextFile: FileProps
    ) => {
        setTextFiles((prev) => prev.filter((file) => file !== deletingTextFile));
        if (taskId) {
            await deleteTaskAttachment(taskId, deletingTextFile.attachmentId, accessToken);

            if (setIsAttachmentDeleted) {
                setIsAttachmentDeleted(true);
            }
            if (setDeletedAttachmentId) {
                setDeletedAttachmentId(deletingTextFile.attachmentId);
            }
            setUploadedFiles(
                uploadedFiles.filter(
                    (file) => file.attachment_id !== deletingTextFile.attachmentId
                )
            );
        }
    };

    // We watch the *currently rendered* task id rather than
    // `useTM.currentPreviewTaskId` so this block can also drive the
    // milestone preview, which feeds in the milestone's backing task
    // through `taskContent.id` (the milestone-id and task-id channels
    // are kept distinct on `useTM`).
    useEffect(() => {
        setImages([]);
        setTextFiles([]);
        setUploadingFiles([]);
        setNumOfUploadingFiles(0);
        setTabIndex(0);
    }, [taskContent?.id]);

    useEffect(() => {
        if (isUploadingFilesUpdated === true) {
            setTaskContent({
                ...taskContent,
                attachments: uploadingFiles,
            });
            setIsUploadingFilesUpdated(false);
            setTaskUpdated(true);
            setUploadingFiles([]);
        }
    }, [isUploadingFilesUpdated]);

    useEffect(() => {
        setImages([]);
        setTextFiles([]);
        const backendFiles: AttachmentFileProps[] = [];
        uploadedFiles.forEach((attachmentFile) => {
            if (attachmentFile.attachment_id < 0) return;
            if (attachmentFile.file_base64) {
                const byteCharacters = atob(attachmentFile.file_base64);
                const byteNumbers = new Array(byteCharacters.length)
                    .fill(0)
                    .map((_, i) => byteCharacters.charCodeAt(i));
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray]);
                const file = new File([blob], attachmentFile.name || "attached_file", {
                    type: attachmentFile.type,
                });

                updateDisplayingFiles(file, attachmentFile.attachment_id);
                backendFiles.push({ attachment_id: attachmentFile.attachment_id, file: file });
            } else if (attachmentFile.file) {
                backendFiles.push({
                    attachment_id: attachmentFile.attachment_id,
                    file: attachmentFile.file,
                });
            }
        });
        setUploadingFiles((prev) => {
            const pendingUploads = prev.filter((f) => f.attachment_id < 0);
            return [...backendFiles, ...pendingUploads];
        });
    }, [uploadedFiles]);

    // Comment list rendering (Virtuoso, scroll-to-bottom, line counts)
    // moved into `TaskCommentList` so the chat-thread Comments tab can
    // mount the same UI directly.

    // State for modal
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
            label: "Comments",
            icon: <CommentRoundedIcon sx={{ fontSize: 16 }} />,
            count: taskComments.length,
        },
        {
            label: "Notes",
            icon: <NoteAltRoundedIcon sx={{ fontSize: 16 }} />,
            count: taskNotes.length,
        },
        {
            label: "Attachments",
            icon: <AttachFileRoundedIcon sx={{ fontSize: 16 }} />,
            count: uploadedFiles.length,
        },
        {
            label: "Activity",
            icon: <HistoryRoundedIcon sx={{ fontSize: 16 }} />,
            // Count is intentionally omitted — activity rows can grow
            // unboundedly so a number badge would be more noisy than
            // useful. The feed itself shows the count when open.
            count: undefined,
        },
    ];

    return (
        <Box sx={{ flexGrow: 1, overflowX: "hidden" }}>
            <Tabs
                aria-label="Task Tabs"
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
                    <TabPanel value={0} sx={{ p: 0 }}>
                        <TaskCommentList
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            taskComments={taskComments}
                            setIsInEdit={setIsInEdit}
                            setEditTargetComment={setEditTargetComment}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useCM={useCM}
                            useTM={useTM}
                            currentProjectId={taskContent.project?.projectId}
                            currentProjectName={taskContent.project?.projectName}
                        />
                        <TaskCommentEditorBlock
                            useCM={useCM}
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
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                        />
                    </TabPanel>

                    {/* Notes Tab */}
                    <TabPanel value={1} sx={{ p: 0 }}>
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
                                                    useTM.setIsTaskHomeVisible(false);
                                                    useNM.setIsTaskNoteVisible(true);
                                                    useNM.setCurrentTaskNote(taskNote);
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
                                                ? "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.08) 100%)"
                                                : "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(79,70,229,0.06) 100%)",
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(139,92,246,0.2)"
                                                : "rgba(124,58,237,0.15)",
                                            color: isDark ? "#a78bfa" : "#7c3aed",
                                            fontWeight: 600,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                background: isDark
                                                    ? "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.12) 100%)"
                                                    : "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(79,70,229,0.1) 100%)",
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
                                                useTM.setIsTaskHomeVisible(false);
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
                    <TabPanel value={2} sx={{ p: 0 }}>
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
                            {uploadedFiles.length === 0 && (
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

                            {/* Text Files */}
                            {textFiles.map((file, index) => (
                                <Box
                                    key={`textfile-${file.name}-${file.attachmentId}-${index}`}
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
                                        size="sm"
                                        variant="plain"
                                        sx={{
                                            position: "absolute",
                                            top: -8,
                                            right: -8,
                                            background: isDark
                                                ? "rgba(239,68,68,0.2)"
                                                : "rgba(239,68,68,0.15)",
                                            borderRadius: "50%",
                                            width: 20,
                                            height: 20,
                                            minWidth: 20,
                                            minHeight: 20,
                                            "&:hover": {
                                                background: "rgba(239,68,68,0.3)",
                                            },
                                        }}
                                        onClick={() => handleDeleteTextFile(taskContent.id, file)}
                                    >
                                        <CloseRoundedIcon
                                            sx={{ fontSize: 12, color: "#ef4444" }}
                                        />
                                    </IconButton>
                                    <Tooltip
                                        placement="top"
                                        size="sm"
                                        title={`Download "${file.name}"`}
                                        variant="outlined"
                                    >
                                        <div
                                            style={{ cursor: "pointer" }}
                                            onClick={() => downloadFile(file.url, file.name)}
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
                                    </Tooltip>
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
                                        {file.name}
                                    </Typography>
                                </Box>
                            ))}

                            {/* Images */}
                            {images.map((image, index) => (
                                <Box
                                    key={`image-${image.name}-${image.attachmentId}-${index}`}
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
                                            "&:hover": {
                                                background: "rgba(239,68,68,0.7)",
                                            },
                                        }}
                                        onClick={() => handleDeleteImage(taskContent.id, image)}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 14, color: "white" }} />
                                    </IconButton>
                                    <img
                                        alt={image.name}
                                        src={image.url}
                                        style={{
                                            width: `${image.width}px`,
                                            height: `${image.height}px`,
                                            cursor: "pointer",
                                            display: "block",
                                        }}
                                        onClick={(e) => {
                                            const target = e.target as HTMLElement;
                                            if (target.tagName === "IMG") {
                                                handleImageClick((target as HTMLImageElement).src);
                                            }
                                        }}
                                    />
                                </Box>
                            ))}
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
                                        ? "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.1) 100%)"
                                        : "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(79,70,229,0.08) 100%)",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(139,92,246,0.2)"
                                        : "rgba(124,58,237,0.15)",
                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: isDark
                                            ? "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.15) 100%)"
                                            : "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(79,70,229,0.12) 100%)",
                                    },
                                }}
                                onClick={handleButtonClick}
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
                                        <Tooltip
                                            placement="left"
                                            size="sm"
                                            title="Download"
                                            variant="outlined"
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
                                        </Tooltip>
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
                    <TabPanel value={3} sx={{ p: 0 }}>
                        <TaskActivityFeed
                            activities={taskActivities}
                            isLoading={isLoadingTaskActivities}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useCM={useCM}
                            useUISM={useUISM}
                        />
                    </TabPanel>
                </Box>
            </Tabs>
        </Box>
    );
};
