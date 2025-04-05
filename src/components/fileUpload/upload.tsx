import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent, IconButton, Button } from "@mui/joy";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { TaskProps, UploadingFileProps } from '../../types';

type FileUploadProps = {
    setUploadedFiles: (value: UploadingFileProps[]) => void,
}

export default function FileUpload(props: FileUploadProps) {
    const {
        setUploadedFiles
    } = props
    const [images, setImages] = useState<{ url: string; name: string, width: number; height: number }[]>([]);
    const [textFiles, setTextFiles] = useState<{ name: string; url: string }[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFileProps[]>([])
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
        setUploadedFiles(uploadingFiles)
    }, [uploadingFiles])

    return (
        <div>
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
