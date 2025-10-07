import React, { useEffect, useState, useRef } from "react";
import { Box, Typography, Card, CardContent, IconButton, Button, Stack } from "@mui/joy";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import { AttachmentFileProps } from "../../../../../types/tasks";
import { TaskProps, FileProps, ImageSizeProps } from "../../../../../types/tasks";
import { downloadFile } from "../../../../../utils/downloadUtils";
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

type TaskCreateAttachmentBlockProps = {
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
};
export const TaskCreateAttachmentBlock = (props: TaskCreateAttachmentBlockProps) => {
    const { taskContents, setTaskContents } = props;

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
            setTaskContents({
                ...taskContents,
                attachments: uploadingFiles,
            });
            setIsUploadingFilesUpdated(false);
        }
    }, [isUploadingFilesUpdated]);

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
                    Select File
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
                {uploadingFiles.length === 0 && (
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
                                    handleDeleteTextFile(file);
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
                            <div
                                onClick={(e) => {
                                    e.preventDefault();
                                    downloadFile(
                                        file.url,
                                        `file.name-${getLocalCurrentTimestamp()}`
                                    );
                                }}
                                style={{
                                    textDecoration: "none",
                                    color: "inherit",
                                    cursor: "pointer",
                                }}
                            >
                                <InsertDriveFileIcon sx={{ fontSize: 40, cursor: "pointer" }} />
                            </div>
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
                                    handleDeleteImage(image);
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
