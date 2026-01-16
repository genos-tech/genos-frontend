import React, { useEffect, useRef, useState } from "react";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import {
    Box,
    IconButton,
    Modal,
    ModalDialog,
    Tooltip,
    Typography,
    useColorScheme,
} from "@mui/joy";

import {
    AttachmentFileProps,
    FileProps,
    ImageSizeProps,
    TaskProps,
} from "../../../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { downloadFile } from "../../../../../utils/downloadUtils";

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

type TaskCreateAttachmentBlockProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
};
export const TaskCreateAttachmentBlock = (props: TaskCreateAttachmentBlockProps) => {
    const { taskContent, setTaskContent } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [images, setImages] = useState<FileProps[]>([]);
    const [textFiles, setTextFiles] = useState<FileProps[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<AttachmentFileProps[]>([]);
    const [isUploadingFilesUpdated, setIsUploadingFilesUpdated] = useState<boolean>(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [numOfUploadingFiles, setNumOfUploadingFiles] = useState<number>(0);

    const updateDisplayingFiles = (file: File, attachmentId: number) => {
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

        const droppedFiles = Array.from(event.dataTransfer.files);
        console.log("droppedFiles:", droppedFiles);
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

    const handleDeleteImage = async (deletingImage: FileProps) => {
        setImages((prev) => prev.filter((image) => image !== deletingImage));
        setUploadingFiles((prev) =>
            prev.filter((file) => file.attachment_id !== deletingImage.attachmentId)
        );
        setIsUploadingFilesUpdated(true);
    };

    const handleDeleteTextFile = async (deletingTextFile: FileProps) => {
        setTextFiles((prev) => prev.filter((file) => file !== deletingTextFile));
        setUploadingFiles((prev) =>
            prev.filter((file) => file.attachment_id !== deletingTextFile.attachmentId)
        );
        setIsUploadingFilesUpdated(true);
    };

    const handleCloseModal = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (event.target === event.currentTarget) {
            setSelectedImage(null);
        }
    };

    useEffect(() => {
        if (isUploadingFilesUpdated === true) {
            setTaskContent({
                ...taskContent,
                attachments: uploadingFiles,
            });
            setIsUploadingFilesUpdated(false);
        }
    }, [isUploadingFilesUpdated]);

    const handleDownload = (imageUrl: string) => {
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `image-${getLocalCurrentTimestamp()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Box>
            {/* Drag & Drop Area */}
            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    width: "100%",
                    minHeight: "150px",
                    borderRadius: "12px",
                    border: "2px dashed",
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                    background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    p: 2,
                    gap: 2,
                    transition: "all 0.2s ease",
                    "&:hover": {
                        borderColor: isDark ? "rgba(139,92,246,0.3)" : "rgba(124,58,237,0.2)",
                        background: isDark ? "rgba(139,92,246,0.03)" : "rgba(124,58,237,0.02)",
                    },
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDroppedFiles}
            >
                {/* Empty State */}
                {uploadingFiles.length === 0 && (
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
                                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                            }}
                        >
                            <AttachFileRoundedIcon
                                sx={{
                                    fontSize: 24,
                                    color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
                                }}
                            />
                        </Box>
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
                                fontWeight: 500,
                            }}
                        >
                            Drag & Drop files here
                        </Typography>
                        <Typography
                            level="body-xs"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)",
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
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
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
                            onClick={() => handleDeleteTextFile(file)}
                        >
                            <CloseRoundedIcon sx={{ fontSize: 12, color: "#ef4444" }} />
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
                                color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
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
                            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
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
                            onClick={() => handleDeleteImage(image)}
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
                            onClick={() => setSelectedImage(image.url)}
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
                        borderColor: isDark ? "rgba(139,92,246,0.2)" : "rgba(124,58,237,0.15)",
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
                    <Typography level="body-sm" sx={{ fontWeight: 600, color: "inherit" }}>
                        Select Files
                    </Typography>
                </IconButton>
            </Box>

            {/* Image Preview Modal */}
            <Modal
                open={!!selectedImage}
                sx={{ zIndex: 10010 }}
                onClose={() => setSelectedImage(null)}
            >
                <ModalDialog
                    sx={{
                        borderRadius: "16px",
                        p: 0,
                        overflow: "hidden",
                        background: isDark ? "rgba(22,22,28,0.95)" : "rgba(255,255,255,0.98)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
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
        </Box>
    );
};
