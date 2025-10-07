import { Socket } from "socket.io-client";
import React, { useEffect, useState, useRef } from "react";
import {
    Box,
    Typography,
    IconButton,
    Tabs,
    TabList,
    TabPanel,
    ListItemDecorator,
    Stack,
    List,
    ListItem,
    ListItemButton,
    Tooltip,
    ModalDialog,
    Modal,
} from "@mui/joy";
import Tab, { tabClasses } from "@mui/joy/Tab";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AddIcon from "@mui/icons-material/Add";
import FolderIcon from "@mui/icons-material/Folder";
import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import CommentIcon from "@mui/icons-material/Comment";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { AttachmentFileProps, TaskCommentProps } from "../../../../../types/tasks";
import { TaskProps, FileProps, ImageSizeProps } from "../../../../../types/tasks";
import { deleteTaskAttachment } from "../../../services/deleteTaskAttachment";
import { downloadFile } from "../../../../../utils/downloadUtils";
import { useAuth } from "../../../../../context/AuthContext";
import { useScrollToBottomOnNewTaskComment } from "../../../hooks/taskCommentHooks";
import { TaskCommentBubble } from "./sub/TaskCommentBubble";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { TaskNoteProps } from "../../../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";

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
                    { attachment_id: attachmentFile.attachment_id, file: attachmentFile.file },
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

                    {tabIndex === 1 && (
                        <>
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton
                                sx={{ mr: "23px", mb: "3px", px: "5px" }}
                                component="p"
                                variant="plain"
                                color="neutral"
                                size="sm"
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
                            </IconButton>
                        </>
                    )}

                    {tabIndex === 2 && (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                                alignItems: "center",
                            }}
                        >
                            <input
                                type="file"
                                accept="*"
                                multiple={true}
                                ref={inputRef}
                                onChange={handleSelectedFiles}
                                style={{ display: "none" }}
                            />
                            <IconButton
                                sx={{ mr: "15px", mb: "3px", px: "3px" }}
                                component="p"
                                variant="plain"
                                color="neutral"
                                size="sm"
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
                            {taskComments.length > 0 && (
                                <Box sx={{ mb: 1 }}>
                                    <Virtuoso
                                        ref={virtuosoRef}
                                        className="custom-scrollbar"
                                        style={{
                                            height: Math.min(
                                                taskComments.length * 60 + totalCommentLines * 18,
                                                800
                                            ),
                                        }}
                                        totalCount={taskComments.length}
                                        initialTopMostItemIndex={taskComments.length - 1}
                                        atTopThreshold={64}
                                        atBottomThreshold={128}
                                        itemContent={(index) => {
                                            const comment = taskComments[index];
                                            return (
                                                <TaskCommentBubble
                                                    key={`task-comment-${comment.commentId}-${comment.tsUpdated}`}
                                                    teamMemberProfiles={teamMemberProfiles}
                                                    socket={socket}
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    comment={comment}
                                                    currentProjectId={
                                                        taskContents.project?.projectId
                                                    }
                                                    currentProjectName={
                                                        taskContents.project?.projectName
                                                    }
                                                    setIsInEdit={setIsInEdit}
                                                    setEditTargetComment={setEditTargetComment}
                                                    setCurrentChat={setCurrentChat}
                                                    setOpeningService={setOpeningService}
                                                />
                                            );
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    </TabPanel>

                    <TabPanel value={1}>
                        <>
                            {taskNotes.length > 0 && (
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
                                    <ListItem nested sx={{ width: "100%" }}>
                                        <List sx={{ gap: 0.5 }}>
                                            {taskNotes.map((taskNote, index) => {
                                                return (
                                                    <ListItem
                                                        key={`listitem-${taskNote.noteType}-${taskNote.noteId}-${index}`}
                                                    >
                                                        <ListItemButton
                                                            variant="soft"
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
                                                            sx={{
                                                                justifyContent: "flex-start",
                                                                alignItems: "center",
                                                                borderRadius: "5px",
                                                            }}
                                                        >
                                                            <Typography
                                                                noWrap
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
                                                            >
                                                                {`${taskNote.title}`}
                                                            </Typography>
                                                        </ListItemButton>
                                                    </ListItem>
                                                );
                                            })}
                                        </List>
                                    </ListItem>
                                </Stack>
                            )}
                        </>
                    </TabPanel>

                    <TabPanel value={2}>
                        <Box
                            className="custom-scrollbar"
                            onDrop={handleDroppedFiles}
                            onDragOver={(e) => e.preventDefault()}
                            sx={{
                                width: "100%",
                                minHeight: "150px",
                                height: "100%",
                                border: "2px dashed #ccc",
                                display: "flex",
                                alignItems: "center",
                            }}
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
                                            onClick={() => {
                                                handleDeleteTextFile(taskContents.id, file);
                                            }}
                                            size="sm"
                                            variant="plain"
                                            color="neutral"
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                background: "transparent",
                                            }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                        <Tooltip
                                            placement="top"
                                            title={`Download \`${file.name}\``}
                                            sx={{ zIndex: 10010 }}
                                            component="div"
                                        >
                                            <div
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    downloadFile(file.url, file.name);
                                                }}
                                                style={{
                                                    textDecoration: "none",
                                                    color: "inherit",
                                                    cursor: "pointer",
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
                                            onClick={() => {
                                                handleDeleteImage(taskContents.id, image);
                                            }}
                                            size="sm"
                                            variant="plain"
                                            color="neutral"
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                background: "transparent",
                                            }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                        <img
                                            src={image.url}
                                            alt="Uploaded"
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
                            sx={{ zIndex: 10010 }}
                            open={opened}
                            onClose={() => setOpened(false)}
                        >
                            <ModalDialog>
                                {selectedImage ? (
                                    <Box>
                                        <img src={selectedImage} alt="preview" />
                                        <Tooltip
                                            placement="top"
                                            title="Download"
                                            sx={{ zIndex: 10010 }}
                                            component="div"
                                        >
                                            <IconButton
                                                onClick={() => handleDownload(selectedImage)}
                                                color="neutral"
                                                variant="solid"
                                                sx={{
                                                    position: "absolute",
                                                    top: "10px",
                                                    right: "10px",
                                                }}
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
