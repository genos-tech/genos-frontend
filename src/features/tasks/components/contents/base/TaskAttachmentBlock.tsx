import React, { useEffect, useState, useRef } from "react";
import { Box, Typography, Card, CardContent, IconButton, Button, Stack } from "@mui/joy";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import { AttachmentFileProps } from "../../../../../types/tasks";
import { TaskProps } from "../../../../../types/tasks";
import { deleteTaskAttachment } from "../../../services/deleteTaskAttachment";
import { useAuth } from "../../../../../context/AuthContext";
import { getCurrentTimestamp } from "../../../../../utils/dateUtils";

type Size = {
    width: number;
    height: number;
};

const resizeImageToFitBox = (imageSize: Size): Size => {
    const scaleFactor = 100 / imageSize.height;

    return {
        width: Math.round(imageSize.width * scaleFactor),
        height: Math.round(imageSize.height * scaleFactor),
    };
};

type TaskAttachmentBlockProps = {
    uploadedFiles: AttachmentFileProps[];
    setTaskUpdated?: (value: boolean) => void;
    taskContents?: TaskProps;
    setTaskContents?: (value: TaskProps) => void;
    setIsAttachmentDeleted: (value: boolean) => void;
    setDeletedAttachmentId: (value: number) => void;
};

export const TaskAttachmentBlock = (props: TaskAttachmentBlockProps) => {
    const { accessToken } = useAuth();
    const {
        uploadedFiles,
        setTaskUpdated,
        taskContents,
        setTaskContents,
        setIsAttachmentDeleted,
        setDeletedAttachmentId,
    } = props;

    const [images, setImages] = useState<
        { attachmentId: number; url: string; name: string; width: number; height: number }[]
    >([]);
    const [textFiles, setTextFiles] = useState<
        { attachmentId: number; name: string; url: string }[]
    >([]);
    const [uploadingFiles, setUploadingFiles] = useState<AttachmentFileProps[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isAddedNewFile, setIsAddedNewFile] = useState<boolean>(false);

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const droppedFiles = Array.from(event.dataTransfer.files);
        handleFiles(droppedFiles);
    };

    const handleFiles = async (selectedFiles: File[]) => {
        selectedFiles.forEach(async (file) => {
            setUploadingFiles((prev) => [...prev, { attachment_id: -1, file: file }]);
        });
        setIsAddedNewFile(true);
    };

    const handleDeleteImage = async (
        taskId: string | undefined,
        attachmentId: number,
        url: string
    ) => {
        setImages((prev) => prev.filter((image) => image.url !== url));
        if (taskId && attachmentId) {
            const res = await deleteTaskAttachment(taskId, attachmentId, accessToken);
            console.log("Image deleted:", res);
            setIsAttachmentDeleted(true);
            setDeletedAttachmentId(attachmentId);
        }
    };

    const handleDeleteTextFile = async (
        taskId: string | undefined,
        attachmentId: number,
        url: string
    ) => {
        setTextFiles((prev) => prev.filter((file) => file.url !== url));
        if (taskId && attachmentId) {
            const res = await deleteTaskAttachment(taskId, attachmentId, accessToken);
            console.log("File deleted:", res);
            setIsAttachmentDeleted(true);
            setDeletedAttachmentId(attachmentId);
        }
    };

    const handleCloseModal = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (event.target === event.currentTarget) {
            setSelectedImage(null);
        }
    };

    useEffect(() => {
        if (
            isAddedNewFile &&
            uploadingFiles.length > 0 &&
            uploadingFiles.length != uploadedFiles.length
        ) {
            if (taskContents && setTaskContents) {
                if (uploadingFiles) {
                    Array.from(uploadingFiles).map((file, index) => {
                        setTaskContents({
                            ...taskContents,
                            attachments: [{ attachment_id: -1, file: file.file }],
                        });
                    });
                }
            }
            if (setTaskUpdated) {
                setTaskUpdated(true);
            }
            setIsAddedNewFile(false);
        }
    }, [uploadingFiles]);

    useEffect(() => {
        setUploadingFiles([]);
        setImages([]);
        setTextFiles([]);

        if (uploadedFiles.length > 0) {
            uploadedFiles.map((attachmentFile, index) => {
                if (attachmentFile.file_base64) {
                    const byteCharacters = atob(attachmentFile.file_base64);
                    const byteNumbers = new Array(byteCharacters.length)
                        .fill(0)
                        .map((_, i) => byteCharacters.charCodeAt(i));
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray]);
                    const file = new File([blob], attachmentFile?.name || "attached_file", {
                        type: attachmentFile?.type,
                    });
                    setUploadingFiles((prev) => [
                        ...prev,
                        { attachment_id: attachmentFile.attachment_id, file: file },
                    ]);

                    if (
                        attachmentFile?.type === "image/jpeg" ||
                        attachmentFile?.type === "image/png"
                    ) {
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
                                    setImages((prev) => [
                                        ...prev,
                                        {
                                            attachmentId: attachmentFile.attachment_id,
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
                        setTextFiles((prev) => [
                            ...prev,
                            {
                                attachmentId: attachmentFile.attachment_id,
                                name: file.name,
                                url: fileURL,
                            },
                        ]);
                    }
                }
            });
        }
    }, [uploadedFiles]);

    // File upload manager via button (not drag and drop)
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => {
        inputRef.current?.click();
    };
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (taskContents && setTaskContents) {
            if (files) {
                Array.from(files).map((file, index) => {
                    setTaskContents({
                        ...taskContents,
                        attachments: [{ attachment_id: -1, file: file }],
                    });
                });
                setIsAddedNewFile(true);
            }
        }
    };

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
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                />
                <Button
                    component="p"
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    onClick={handleButtonClick}
                >
                    Select File
                </Button>
            </Stack>

            <Box
                className="custom-scrollbar"
                onDrop={handleDrop}
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
                {uploadedFiles.length === 0 && uploadingFiles.length === 0 && (
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
                    {textFiles.map((file) => (
                        <Box
                            key={`${file.name}-${file.attachmentId}`}
                            style={{ position: "relative", textAlign: "center" }}
                        >
                            <IconButton
                                onClick={() => {
                                    handleDeleteTextFile(
                                        taskContents?.id,
                                        file.attachmentId,
                                        file.url
                                    );
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
                    {images.map((image) => (
                        <Box
                            key={`${image.name}-${image.attachmentId}`}
                            style={{ position: "relative", display: "inline-block" }}
                        >
                            <IconButton
                                onClick={() => {
                                    handleDeleteImage(
                                        taskContents?.id,
                                        image.attachmentId,
                                        image.url
                                    );
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
