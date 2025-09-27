import { Socket } from "socket.io-client";
import React, { useEffect, useState, useRef } from "react";
import {
    Box,
    Typography,
    Card,
    CardContent,
    IconButton,
    Tabs,
    TabList,
    TabPanel,
    ListItemDecorator,
    Stack,
    List,
    ListItem,
    ListItemButton,
} from "@mui/joy";
import Tab, { tabClasses } from "@mui/joy/Tab";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AddIcon from "@mui/icons-material/Add";
import FolderIcon from "@mui/icons-material/Folder";
import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import HistoryIcon from "@mui/icons-material/History";
import CommentIcon from "@mui/icons-material/Comment";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { AttachmentFileProps, TaskCommentProps } from "../../../../../types/tasks";
import { TaskProps, FileProps, ImageSizeProps } from "../../../../../types/tasks";
import { deleteTaskAttachment } from "../../../services/deleteTaskAttachment";
import { useAuth } from "../../../../../context/AuthContext";
import { useScrollToBottomOnNewTaskComment } from "../../../hooks/taskCommentHooks";
import { TaskCommentBubble } from "./sub/TaskCommentBubble";
import { UserProps } from "../../../../../types/admin";
import { ChatProps } from "../../../../../types/chat";
import { TaskNoteProps } from "../../../../../types/notes";

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
        taskId: number
    ) => Promise<void>;
    taskNotes: TaskNoteProps[];
    setTaskNotes: (value: TaskNoteProps[]) => void;
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
        setTaskNotes,
        setCurrentTaskNote,
    } = props;

    const [images, setImages] = useState<FileProps[]>([]);
    const [textFiles, setTextFiles] = useState<FileProps[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<AttachmentFileProps[]>([]);
    const [isUploadingFilesUpdated, setIsUploadingFilesUpdated] = useState<boolean>(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
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
            const res = await deleteTaskAttachment(
                taskId,
                deletingImage.attachmentId,
                accessToken
            );

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
            const res = await deleteTaskAttachment(
                taskId,
                deletingTextFile.attachmentId,
                accessToken
            );

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

    const handleCloseModal = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (event.target === event.currentTarget) {
            setSelectedImage(null);
        }
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
                        justifyContent: "left",
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
                    <Tab indicatorInset>
                        <ListItemDecorator>
                            <HistoryIcon />
                        </ListItemDecorator>
                        History
                    </Tab>

                    {tabIndex === 1 && (
                        <>
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton
                                sx={{ mr: "15px", mb: "3px", px: "3px" }}
                                component="p"
                                variant="soft"
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
                                            currentPreviewTaskId
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
                        <>
                            <Box sx={{ flexGrow: 1 }} />
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
                                variant="soft"
                                color="neutral"
                                size="sm"
                                onClick={handleButtonClick}
                            >
                                <FolderIcon /> Select Files
                            </IconButton>
                        </>
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
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                background: "transparent",
                                            }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                        <a
                                            href={file.url}
                                            download={file.name}
                                            style={{
                                                textDecoration: "none",
                                                color: "inherit",
                                            }}
                                        >
                                            <InsertDriveFileIcon
                                                sx={{ fontSize: 40, cursor: "pointer" }}
                                            />
                                        </a>
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
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                background: "white",
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
                                            onClick={() => setSelectedImage(image.url)}
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                        {selectedImage && (
                            <Box
                                onClick={handleCloseModal}
                                style={{
                                    position: "fixed",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    background: "rgba(0,0,0,0.5)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 10000,
                                }}
                            >
                                <Card
                                    sx={{
                                        position: "relative",
                                        padding: "20px",
                                        background: "white",
                                        boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
                                    }}
                                >
                                    <CardContent>
                                        <img
                                            src={selectedImage}
                                            alt="Full View"
                                            style={{ maxWidth: "100%", maxHeight: "80vh" }}
                                        />
                                    </CardContent>
                                </Card>
                            </Box>
                        )}
                    </TabPanel>

                    <TabPanel value={3}>History-Content</TabPanel>
                </Box>
            </Tabs>
        </Box>
    );
};
