import React, { useEffect, useState, useRef } from "react";
import { Box, Typography, Card, CardContent, IconButton, Button, Stack } from "@mui/joy";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import { AttachmentFileProps } from '../../../../types/tasks';
import { TaskProps } from '../../../../types/tasks';

type AttachmentBlockProps = {
    uploadedFiles: AttachmentFileProps[],
    setUploadedFiles: (value: AttachmentFileProps[]) => void,
    setTaskUpdated?: (value: boolean) => void,
    taskContents?: TaskProps,
    setTaskContents?: (value: TaskProps) => void,
}

export const AttachmentBlock = (props: AttachmentBlockProps) => {
    const {
        uploadedFiles,
        setUploadedFiles,
        setTaskUpdated,
        taskContents,
        setTaskContents
    } = props

    const [images, setImages] = useState<{ url: string; name: string, width: number; height: number }[]>([]);
    const [textFiles, setTextFiles] = useState<{ name: string; url: string }[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<AttachmentFileProps[]>([])
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isUploadedFileExists, setIsUploadedFileExists] = useState<boolean>(false);

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const droppedFiles = Array.from(event.dataTransfer.files);
        handleFiles(droppedFiles);
    }

    const handleFiles = (selectedFiles: File[]) => {
        selectedFiles.forEach((file) => {
            const fileType = file.type;

            setUploadingFiles(prev => ([
                ...prev, { file: file }
            ]));

            if (fileType === "image/jpeg" || fileType === "image/png") {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        const img = new Image();
                        img.src = e.target.result as string;
                        img.onload = () => {
                            setImages((prev) => [
                                ...prev,
                                {
                                    url: img.src,
                                    name: file.name,
                                    width: Math.max(img.width * 0.03, 80),
                                    height: Math.max(img.height * 0.03, 120)
                                },
                            ]);
                        };
                    }
                };
                reader.readAsDataURL(file);
            } else {
                const fileURL = URL.createObjectURL(file);
                setTextFiles((prev) => [...prev, { name: file.name, url: fileURL }]);
            }
        });
        setIsUploadedFileExists(true)
    };

    const handleDeleteImage = (url: string) => {
        setImages((prev) => prev.filter((image) => image.url !== url));
    };

    const handleDeleteTextFile = (name: string) => {
        setTextFiles((prev) => prev.filter((file) => file.name !== name));
    };

    const handleCloseModal = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (event.target === event.currentTarget) {
            setSelectedImage(null);
        }
    };

    useEffect(() => {
        if (images.length === 0 && textFiles.length === 0) {
            setIsUploadedFileExists(false)
        }
    }, [images, textFiles])

    useEffect(() => {
        if (uploadingFiles.length > 0 && uploadingFiles.length != uploadedFiles.length) {
            setUploadedFiles(uploadingFiles)
            if (setTaskUpdated) {
                setTaskUpdated(true)
            }
        }
    }, [uploadingFiles])

    useEffect(() => {
        if (uploadedFiles.length === 0) {
            setUploadingFiles([])
            setImages([])
            setTextFiles([])
        } else {
            setIsUploadedFileExists(true)
            uploadedFiles.map((attachmentFile, index) => {
                if (attachmentFile.file_base64) {
                    const byteCharacters = atob(attachmentFile.file_base64);
                    const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray]);
                    const file = new File([blob], attachmentFile?.name || "attached_file", { type: attachmentFile?.type });
                    setUploadingFiles((prev) => [...prev, { file: file }])

                    if (attachmentFile?.type === "image/jpeg" || attachmentFile?.type === "image/png") {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            if (e.target?.result) {
                                const img = new Image();
                                img.src = e.target.result as string;
                                img.onload = () => {
                                    setImages((prev) => [
                                        ...prev,
                                        {
                                            url: img.src,
                                            name: file.name,
                                            width: Math.max(img.width * 0.03, 80),
                                            height: Math.max(img.height * 0.03, 120)
                                        },
                                    ]);
                                };
                            }
                        };
                        reader.readAsDataURL(file);
                    } else {
                        const fileURL = URL.createObjectURL(file);
                        setTextFiles((prev) => [...prev, { name: file.name, url: fileURL }]);
                    }
                }
            })
        }
    }, [uploadedFiles])

    // File upload manager via button (not drag and drop)
    const inputRef = useRef<HTMLInputElement | null>(null);
    const handleButtonClick = () => { inputRef.current?.click(); };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files
        if (taskContents && setTaskContents) {
            if (files) {
                // TODO: Need to add files to setUploadedFiles
                console.log("Selected files:", Array.from(files));
                Array.from(files).map((file, index) => {
                    setTaskContents({
                        ...taskContents,
                        attachments: [{ file: file }]
                    });
                })
            }
        }
    };

    return (
        <div>
            <Stack direction="row" alignItems="center" sx={{ width: '100%' }}>
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
                    style={{ display: 'none' }}
                />
                <Button
                    component='p'
                    variant="outlined"
                    color="neutral"
                    size="sm"
                    onClick={handleButtonClick}
                >
                    Select File
                </Button>
            </Stack>

            <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                    width: "100%",
                    height: "150px",
                    border: "2px dashed #ccc",
                    display: "flex",
                    alignItems: "center",
                }}
            >
                {!isUploadedFileExists && (
                    <div
                        style={{
                            flex: 1,
                            textAlign: 'center',
                        }}
                    >
                        Drag & Drop your files here
                    </div>
                )}

                <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    marginLeft: '10px',
                    marginTop: "10px",
                    gap: "10px"
                }}>
                    {textFiles.map((file) => (
                        <div key={file.name} style={{ position: "relative", display: "inline-block", textAlign: "center" }}>
                            <IconButton
                                onClick={() => handleDeleteTextFile(file.name)}
                                size="sm"
                                sx={{ position: "absolute", top: 0, right: 0, background: "white" }}
                            >
                                <CloseIcon />
                            </IconButton>
                            <a href={file.url} download={file.name} style={{ textDecoration: "none", color: "inherit" }}>
                                <InsertDriveFileIcon sx={{ fontSize: 40, cursor: "pointer" }} />
                            </a>
                            <div>{file.name}</div>
                        </div>
                    ))}
                </div>
                <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    marginLeft: '10px',
                    marginTop: "10px",
                    gap: "10px"
                }}>
                    {images.map((image) => (
                        <div key={image.url} style={{ position: "relative", display: "inline-block" }}>
                            <IconButton
                                onClick={() => handleDeleteImage(image.url)}
                                size="sm"
                                sx={{ position: "absolute", top: 0, right: 0, background: "white" }}
                            >
                                <CloseIcon />
                            </IconButton>
                            <img
                                src={image.url}
                                alt="Uploaded"
                                style={{ width: `${image.width}px`, height: `${image.height}px`, cursor: "pointer" }}
                                onClick={() => setSelectedImage(image.url)}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {selectedImage && (
                <div onClick={handleCloseModal} style={{
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
                }}>
                    <Card sx={{ position: "relative", padding: "20px", background: "white", boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)" }}>
                        <CardContent>
                            <img src={selectedImage} alt="Full View" style={{ maxWidth: "100%", maxHeight: "80vh" }} />
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
