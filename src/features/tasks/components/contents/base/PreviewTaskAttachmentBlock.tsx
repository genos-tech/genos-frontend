import React, { useEffect, useState, useRef } from "react";
import { Box, Typography, Card, CardContent, IconButton, Button, Stack } from "@mui/joy";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import { AttachmentFileProps } from "../../../../../types/tasks";
import { TaskProps, FileProps, ImageSizeProps } from "../../../../../types/tasks";
import { deleteTaskAttachment } from "../../../services/deleteTaskAttachment";
import { useAuth } from "../../../../../context/AuthContext";

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

type PreviewTaskAttachmentBlockProps = {
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    currentPreviewTaskId: number;
    uploadedFiles: any[];
    setUploadedFiles: (value: any[]) => void;
    setTaskUpdated: (value: boolean) => void;
    setIsAttachmentDeleted: (value: boolean) => void;
    setDeletedAttachmentId: (value: number) => void;
};

export const PreviewTaskAttachmentBlock = (props: PreviewTaskAttachmentBlockProps) => {
    const { accessToken } = useAuth();
    const {
        uploadedFiles,
        setUploadedFiles,
        currentPreviewTaskId,
        setTaskUpdated,
        taskContents,
        setTaskContents,
        setIsAttachmentDeleted,
        setDeletedAttachmentId,
    } = props;

    const [images, setImages] = useState<FileProps[]>([]);
    const [textFiles, setTextFiles] = useState<FileProps[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<AttachmentFileProps[]>([]);
    const [isUploadingFilesUpdated, setIsUploadingFilesUpdated] = useState<boolean>(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [numOfUploadingFiles, setNumOfUploadingFiles] = useState<number>(0);

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

    return (
        <Box>
            <Stack direction="row" alignItems="center" sx={{ width: "100%" }}>
                <Typography level="h4" sx={{ mt: 2, mb: 2 }}>
                    Attachments
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <input
                    type="file"
                    accept="*"
                    multiple={true}
                    ref={inputRef}
                    onChange={handleSelectedFiles}
                    style={{ display: "none" }}
                />
                <Button
                    component="p"
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    onClick={handleButtonClick}
                >
                    Select Files
                </Button>
            </Stack>

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
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                <InsertDriveFileIcon sx={{ fontSize: 40, cursor: "pointer" }} />
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
                            style={{ position: "relative", display: "inline-block" }}
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
        </Box>
    );
};
