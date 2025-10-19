import React, { useEffect, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CommentIcon from "@mui/icons-material/Comment";
import DownloadIcon from "@mui/icons-material/Download";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import {
    Box,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemDecorator,
    Modal,
    ModalDialog,
    Stack,
    TabList,
    TabPanel,
    Tabs,
    Tooltip,
    Typography,
} from "@mui/joy";
import Tab, { tabClasses } from "@mui/joy/Tab";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../../context/AuthContext";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { TaskNoteProps } from "../../../../../types/notes";
import {
    AttachmentFileProps,
    FileProps,
    ImageSizeProps,
    TaskCommentProps,
    TaskProps,
} from "../../../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { downloadFile } from "../../../../../utils/downloadUtils";
import { useScrollToBottomOnNewTaskComment } from "../../../hooks/taskCommentHooks";
import { deleteTaskAttachment } from "../../../services/deleteTaskAttachment";
import { TaskCommentBubble } from "./sub/TaskCommentBubble";
import { TaskCommentEditorBlock } from "./sub/TaskCommentEditorBlock";

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
    teamMemberProfiles: Record<string, UserProps>;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    currentPreviewTaskId: number;
    uploadedFiles: any[];
    setUploadedFiles: (value: any[]) => void;
    setTaskUpdated: (value: boolean) => void;
    setIsAttachmentDeleted: (value: boolean) => void;
    setDeletedAttachmentId: (value: number) => void;
    taskComments: TaskCommentProps[];
    isCommentUpdated: { isUpdate: boolean; scrollToBottom: boolean };
    setIsInEdit: (value: boolean) => void;
    setEditTargetComment: (value: TaskCommentProps) => void;
    setIsTaskHomeVisible?: (value: boolean) => void;
    setIsTaskNoteVisible?: (value: boolean) => void;
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string
    ) => Promise<void>;
    taskNotes: TaskNoteProps[];
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    editTargetComment: TaskCommentProps | undefined;
    isInEdit: boolean;
    setCurrentMainChat: (chat: ChatProps) => void;
    setTaskCommentLines: (value: number) => void;
    setTaskComments: (value: TaskCommentProps[]) => void;
    tmpCurrentTaskContent: TaskProps;
    taskCommentLines: number;
    teamMembers: UserProps[];
    TM: TaskManagementState;
};
export const TaskTabBlock = (props: TaskTabBlockProps) => {
    const { accessToken } = useAuth();
    const {
        socket,
        myself,
        setMyself,
        teamMemberProfiles,
        setCurrentChat,
        setOpeningService,
        uploadedFiles,
        setUploadedFiles,
        currentPreviewTaskId,
        setTaskUpdated,
        taskContents,
        setTaskContents,
        setIsAttachmentDeleted,
        setDeletedAttachmentId,
        taskComments,
        isCommentUpdated,
        setIsInEdit,
        setEditTargetComment,
        setIsTaskHomeVisible,
        setIsTaskNoteVisible,
        handleCreateNewTaskNote,
        taskNotes,
        setCurrentTaskNote,
        editTargetComment,
        isInEdit,
        setCurrentMainChat,
        setTaskCommentLines,
        setTaskComments,
        tmpCurrentTaskContent,
        taskCommentLines,
        teamMembers,
        TM,
    } = props;

    const [images, setImages] = useState<FileProps[]>([]);
    const [textFiles, setTextFiles] = useState<FileProps[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<AttachmentFileProps[]>([]);
    const [isUploadingFilesUpdated, setIsUploadingFilesUpdated] = useState<boolean>(false);
    const [numOfUploadingFiles, setNumOfUploadingFiles] = useState<number>(0);
    const [tabIndex, setTabIndex] = React.useState(0);

    const updateDisplayingFiles = (file: File, attachmentId: number) => {
        if (attachmentId > 0) {
            // To display the dropped files in the task attachment block,
            // those files are appended into the `images` or `textFiles`.
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
                setTextFiles((prev) => prev.filter((file) => file.attachmentId !== attachmentId));
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

    // File upload manager via "Select File" button on the top right side (not drag and drop)
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
    };

    const handleDroppedFiles = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        const droppedFiles = Array.from(
            new Map(Array.from(event.dataTransfer.files).map((file) => [file.name, file])).values()
        );

        droppedFiles.map((file, index) => {
            const attachmentId: number = -numOfUploadingFiles - index - 1;

            // Append dropped files into the `uploadingFiles`
            // Files in the `uploadingFiles` will be uploaded after clicking "Create".
            setUploadingFiles((prev) => [...prev, { attachment_id: attachmentId, file: file }]);

            // To display the dropped files in the task attachment block,
            // those files are appended into the `images` or `textFiles`.
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

        // No need this in preview mode
        // setIsUploadingFilesUpdated(true);
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

        // No need this in preview mode
        // setIsUploadingFilesUpdated(true);
    };

    useEffect(() => {
        setImages([]);
        setTextFiles([]);
        setTabIndex(0);
    }, [currentPreviewTaskId]);

    useEffect(() => {
        if (isUploadingFilesUpdated === true) {
            setTaskContents({
                ...taskContents,
                attachments: uploadingFiles,
            });
            setIsUploadingFilesUpdated(false);

            // For preview
            setTaskUpdated(true);
            // Reset `uploadingFiles` once the files uploaded.
            setUploadingFiles([]);
        }
    }, [isUploadingFilesUpdated]);

    // For preview
    useEffect(() => {
        uploadedFiles.map((attachmentFile, index) => {
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
                setUploadingFiles((prev) => [
                    ...prev,
                    { attachment_id: attachmentFile.attachment_id, file: file },
                ]);
            } else if (attachmentFile.file) {
                setUploadingFiles((prev) => [
                    ...prev,
                    {
                        attachment_id: attachmentFile.attachment_id,
                        file: attachmentFile.file,
                    },
                ]);
            }
        });
    }, [uploadedFiles]);

    const countLines = (nodes: any[]): number => {
        let count = 0;
        for (const node of nodes) {
            count += 1; // count the current node itself
            if (node.children?.length) {
                count += countLines(node.children); // recursive call
            }
            if (node.content[0]) {
                if (node.content[0].text) {
                    count += node.content[0].text.split("\n").length;
                }
            }
        }
        return count;
    };

    const totalCommentLines = taskComments.reduce(
        (sum, taskComment) => sum + (countLines(taskComment.commentBody) ?? 0),
        0
    );

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    useScrollToBottomOnNewTaskComment(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        taskComments,
        isCommentUpdated.scrollToBottom
    );

    // State for modal
    const [opened, setOpened] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Custom click handler
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

    return (
        <Box sx={{ flexGrow: 1, m: -2, overflowX: "hidden" }}>
            <Tabs
                aria-label="Pipeline"
                value={tabIndex}
                onChange={(event, value) => setTabIndex(value as number)}
            >
                <TabList
                    sx={{
                        pt: 1,
                        justifyContent: "space-between",
                        [`&& .${tabClasses.root}`]: {
                            flex: "initial",
                            bgcolor: "transparent",
                            "&:hover": {
                                bgcolor: "transparent",
                            },
                            [`&.${tabClasses.selected}`]: {
                                color: "primary.plainColor",
                                "&::after": {
                                    height: 2,
                                    borderTopLeftRadius: 3,
                                    borderTopRightRadius: 3,
                                    bgcolor: "primary.500",
                                },
                            },
                        },
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Tab indicatorInset>
                            <ListItemDecorator>
                                <CommentIcon />
                            </ListItemDecorator>
                            Comments
                        </Tab>
                        <Tab indicatorInset>
                            <ListItemDecorator>
                                <NoteAltIcon />
                            </ListItemDecorator>
                            Notes
                        </Tab>
                        <Tab indicatorInset>
                            <ListItemDecorator>
                                <InsertPhotoIcon />
                            </ListItemDecorator>
                            Attachments
                        </Tab>
                    </Box>
                    {/* <Tab indicatorInset>
                        <ListItemDecorator>
                            <HistoryIcon />
                        </ListItemDecorator>
                        History
                    </Tab> */}

                    {tabIndex === 2 && (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                                alignItems: "center",
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
                                color="neutral"
                                component="p"
                                size="sm"
                                sx={{ mr: "15px", mb: "3px", px: "3px" }}
                                variant="plain"
                                onClick={handleButtonClick}
                            >
                                <FolderIcon sx={{ pr: "5px", fontSize: "25px" }} /> Select Files
                            </IconButton>
                        </Box>
                    )}
                </TabList>

                <Box
                    sx={(theme) => ({
                        "--bg": theme.vars.palette.background.surface,
                        background: "var(--bg)",
                        boxShadow: "0 0 0 100vmax var(--bg)",
                        clipPath: "inset(0 -100vmax)",
                    })}
                >
                    <TabPanel value={0}>
                        <>
                            {taskComments.length === 0 && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        flex: 1,
                                        textAlign: "center",
                                    }}
                                >
                                    <Typography level="title-md">No comments yet</Typography>
                                </Box>
                            )}

                            {taskComments.length > 0 && (
                                <Box sx={{ mb: 1 }}>
                                    <Virtuoso
                                        ref={virtuosoRef}
                                        atBottomThreshold={128}
                                        atTopThreshold={64}
                                        className="custom-scrollbar"
                                        initialTopMostItemIndex={taskComments.length - 1}
                                        totalCount={taskComments.length}
                                        itemContent={(index) => {
                                            const comment = taskComments[index];
                                            return (
                                                <TaskCommentBubble
                                                    key={`task-comment-${comment.commentId}-${comment.tsUpdated}`}
                                                    comment={comment}
                                                    myself={myself}
                                                    setCurrentChat={setCurrentChat}
                                                    setEditTargetComment={setEditTargetComment}
                                                    setIsInEdit={setIsInEdit}
                                                    setMyself={setMyself}
                                                    setOpeningService={setOpeningService}
                                                    socket={socket}
                                                    teamMemberProfiles={teamMemberProfiles}
                                                    currentProjectId={
                                                        taskContents.project?.projectId
                                                    }
                                                    currentProjectName={
                                                        taskContents.project?.projectName
                                                    }
                                                />
                                            );
                                        }}
                                        style={{
                                            height: Math.min(
                                                taskComments.length * 60 + totalCommentLines * 18,
                                                800
                                            ),
                                        }}
                                    />
                                </Box>
                            )}
                            <TaskCommentEditorBlock
                                editTargetComment={editTargetComment}
                                isCommentUpdated={TM.isTaskCommentUpdated}
                                isInEdit={isInEdit}
                                myself={myself}
                                setCurrentChat={setCurrentMainChat}
                                setIsCommentUpdated={TM.setIsTaskCommentUpdated}
                                setIsInEdit={setIsInEdit}
                                setMyself={setMyself}
                                setOpeningService={setOpeningService}
                                setTaskCommentLines={setTaskCommentLines}
                                setTaskComments={setTaskComments}
                                socket={socket}
                                task={tmpCurrentTaskContent}
                                taskCommentLines={taskCommentLines}
                                taskComments={taskComments}
                                teamMemberProfiles={teamMemberProfiles}
                                teamMembers={teamMembers}
                            />
                        </>
                    </TabPanel>

                    <TabPanel value={1}>
                        <>
                            <Stack
                                className="custom-scrollbar"
                                direction="row"
                                sx={{
                                    width: "100%",
                                    minHeight: "40px",
                                    maxHeight: "200px",
                                    overflowY: "scroll",
                                }}
                            >
                                <ListItem sx={{ width: "100%" }} nested>
                                    <List sx={{ gap: 0.5 }}>
                                        {taskNotes.map((taskNote, index) => {
                                            return (
                                                <ListItem
                                                    key={`listitem-${taskNote.noteType}-${taskNote.noteId}-${index}`}
                                                >
                                                    <ListItemButton
                                                        variant="soft"
                                                        sx={{
                                                            justifyContent: "flex-start",
                                                            alignItems: "center",
                                                            borderRadius: "5px",
                                                        }}
                                                        onClick={() => {
                                                            if (
                                                                setIsTaskHomeVisible &&
                                                                setIsTaskNoteVisible
                                                            ) {
                                                                setIsTaskHomeVisible(false);
                                                                setIsTaskNoteVisible(true);
                                                                setCurrentTaskNote(taskNote);
                                                            }
                                                        }}
                                                    >
                                                        <Typography
                                                            level="title-md"
                                                            sx={{
                                                                px: "10px",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                                width: "100%",
                                                                height: "30px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                            }}
                                                            noWrap
                                                        >
                                                            {`${taskNote.title}`}
                                                        </Typography>
                                                    </ListItemButton>
                                                </ListItem>
                                            );
                                        })}
                                        <ListItem>
                                            <ListItemButton
                                                variant="soft"
                                                color="primary"
                                                sx={{
                                                    justifyContent: "flex-start",
                                                    alignItems: "center",
                                                    height: "30px",
                                                    borderRadius: "5px",
                                                }}
                                                onClick={() => {
                                                    if (
                                                        setIsTaskHomeVisible &&
                                                        setIsTaskNoteVisible &&
                                                        taskContents.project
                                                    ) {
                                                        setIsTaskHomeVisible(false);
                                                        setIsTaskNoteVisible(true);
                                                        handleCreateNewTaskNote(
                                                            null,
                                                            taskContents.project.projectId,
                                                            currentPreviewTaskId,
                                                            taskContents.title
                                                        );
                                                    } else {
                                                        console.error(
                                                            "Can't parent note ID to create a child note. Project ID is not defined."
                                                        );
                                                    }
                                                }}
                                            >
                                                <AddIcon />
                                                New Note
                                            </ListItemButton>
                                        </ListItem>
                                    </List>
                                </ListItem>
                            </Stack>
                        </>
                    </TabPanel>

                    <TabPanel value={2}>
                        <Box
                            className="custom-scrollbar"
                            sx={{
                                width: "100%",
                                minHeight: "150px",
                                height: "100%",
                                border: "2px dashed #ccc",
                                display: "flex",
                                alignItems: "center",
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDroppedFiles}
                        >
                            {uploadedFiles.length === 0 && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        flex: 1,
                                        textAlign: "center",
                                    }}
                                >
                                    <Typography>Drag & Drop your files here</Typography>
                                </Box>
                            )}

                            <Box
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    marginLeft: "10px",
                                    marginTop: "10px",
                                    gap: "10px",
                                }}
                            >
                                {textFiles.map((file, index) => (
                                    <Box
                                        key={`testfile-${file.name}-${file.attachmentId}-${index}`}
                                        style={{ position: "relative", textAlign: "center" }}
                                    >
                                        <IconButton
                                            color="neutral"
                                            size="sm"
                                            variant="plain"
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                background: "transparent",
                                            }}
                                            onClick={() => {
                                                handleDeleteTextFile(taskContents.id, file);
                                            }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                        <Tooltip
                                            component="div"
                                            placement="top"
                                            sx={{ zIndex: 10010 }}
                                            title={`Download \`${file.name}\``}
                                        >
                                            <div
                                                style={{
                                                    textDecoration: "none",
                                                    color: "inherit",
                                                    cursor: "pointer",
                                                }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    downloadFile(file.url, file.name);
                                                }}
                                            >
                                                <InsertDriveFileIcon
                                                    sx={{ fontSize: 40, cursor: "pointer" }}
                                                />
                                            </div>
                                        </Tooltip>
                                        <Typography
                                            fontSize={"10px"}
                                            sx={{
                                                maxWidth: "80px", // Set the maximum width
                                                textOverflow: "ellipsis", // Add "..." if the text overflows
                                                overflow: "hidden", // Hide the overflowing text
                                                whiteSpace: "nowrap", // Prevent text from wrapping to the next line
                                            }}
                                        >
                                            {file.name}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                            <Box
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    marginLeft: "10px",
                                    marginTop: "10px",
                                    gap: "10px",
                                }}
                            >
                                {images.map((image, index) => (
                                    <Box
                                        key={`image-${image.name}-${image.attachmentId}-${index}`}
                                        style={{
                                            position: "relative",
                                            display: "inline-block",
                                        }}
                                    >
                                        <IconButton
                                            color="neutral"
                                            size="sm"
                                            variant="plain"
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                background: "transparent",
                                            }}
                                            onClick={() => {
                                                handleDeleteImage(taskContents.id, image);
                                            }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                        <img
                                            alt="Uploaded"
                                            src={image.url}
                                            style={{
                                                width: `${image.width}px`,
                                                height: `${image.height}px`,
                                                cursor: "pointer",
                                            }}
                                            onClick={(e) => {
                                                const target = e.target as HTMLElement;
                                                if (target.tagName === "IMG") {
                                                    handleImageClick(
                                                        (target as HTMLImageElement).src
                                                    );
                                                }
                                            }}
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Box>

                        <Modal
                            open={opened}
                            sx={{ zIndex: 10010 }}
                            onClose={() => setOpened(false)}
                        >
                            <ModalDialog>
                                {selectedImage ? (
                                    <Box>
                                        <img alt="preview" src={selectedImage} />
                                        <Tooltip
                                            component="div"
                                            placement="top"
                                            sx={{ zIndex: 10010 }}
                                            title="Download"
                                        >
                                            <IconButton
                                                color="neutral"
                                                variant="solid"
                                                sx={{
                                                    position: "absolute",
                                                    top: "10px",
                                                    right: "10px",
                                                }}
                                                onClick={() => handleDownload(selectedImage)}
                                            >
                                                <DownloadIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                ) : null}
                            </ModalDialog>
                        </Modal>
                    </TabPanel>

                    {/* <TabPanel value={3}>History-Content</TabPanel> */}
                </Box>
            </Tabs>
        </Box>
    );
};
