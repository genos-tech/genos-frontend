import React, { useRef, useState } from "react";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import { Box, IconButton, Modal, ModalDialog, Typography, useColorScheme } from "@mui/joy";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { FileSizeRejectionSnackbar } from "../../../../../components/ui/feedback/FileSizeRejectionSnackbar";
import {
    FileUploadOverlay,
    UploadingTileBadge,
} from "../../../../../components/ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../../../../../components/ui/feedback/useFileSizeGuard";
import { fmt, useTranslation } from "../../../../../i18n";
import { AttachmentFileProps, TaskProps } from "../../../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { downloadFile } from "../../../../../utils/downloadUtils";
import { useAttachmentClientIds } from "../../../hooks/useAttachmentClientIds";
import { useAttachmentPreviews } from "../../../hooks/useAttachmentPreviews";

type TaskCreateAttachmentBlockProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    /** True while the parent's create-task submission is uploading staged
     *  attachments. Drives the full-area overlay + per-tile spinner so
     *  the user sees the in-flight work instead of a frozen button. */
    isUploading?: boolean;
};

export const TaskCreateAttachmentBlock = (props: TaskCreateAttachmentBlockProps) => {
    const { taskContent, setTaskContent, isUploading = false } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const attachments = taskContent.attachments ?? [];
    const previews = useAttachmentPreviews(attachments);
    const nextClientId = useAttachmentClientIds();
    const { rejection, dismissRejection, filterFiles } = useFileSizeGuard();

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const appendFiles = (files: Iterable<File>) => {
        const accepted = filterFiles(files);
        if (accepted.length === 0) return;
        const newItems: AttachmentFileProps[] = accepted.map((file) => ({
            attachment_id: nextClientId(),
            file,
            name: file.name,
            type: file.type,
        }));
        setTaskContent({
            ...taskContent,
            attachments: [...attachments, ...newItems],
        });
    };

    const handleSelectedFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) appendFiles(event.target.files);
        event.target.value = "";
    };

    const handleDroppedFiles = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (isUploading) return;
        appendFiles(event.dataTransfer.files);
    };

    const handleDelete = (attachmentId: number) => {
        setTaskContent({
            ...taskContent,
            attachments: attachments.filter((a) => a.attachment_id !== attachmentId),
        });
    };

    const handleDownload = (imageUrl: string) => {
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `image-${getLocalCurrentTimestamp()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const imageItems = attachments.filter((a) => previews.get(a.attachment_id)?.kind === "image");
    const fileItems = attachments.filter((a) => previews.get(a.attachment_id)?.kind === "file");

    return (
        <Box sx={{ position: "relative" }}>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
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
                    position: "relative",
                    transition: "all 0.2s ease",
                    "&:hover": {
                        borderColor: isDark
                            ? "rgba(var(--gp-brandalt-500-rgb), 0.3)"
                            : "rgba(var(--gp-brand-700-rgb), 0.2)",
                        background: isDark
                            ? "rgba(var(--gp-brandalt-500-rgb), 0.03)"
                            : "rgba(var(--gp-brand-700-rgb), 0.02)",
                    },
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDroppedFiles}
            >
                <FileUploadOverlay
                    label={t.tasks.attachmentUpload.uploading}
                    open={isUploading}
                    detail={
                        attachments.length > 0
                            ? fmt(t.tasks.attachmentUpload.fileCount, {
                                  count: attachments.length,
                              })
                            : undefined
                    }
                />

                {attachments.length === 0 && (
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

                {fileItems.map((item) => {
                    const preview = previews.get(item.attachment_id);
                    if (!preview) return null;
                    const name = item.name ?? (item.file instanceof File ? item.file.name : "");
                    return (
                        <Box
                            key={`file-${item.attachment_id}`}
                            sx={{
                                position: "relative",
                                textAlign: "center",
                                p: 1.5,
                                borderRadius: "10px",
                                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
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
                                disabled={isUploading}
                                size="sm"
                                variant="plain"
                                sx={{
                                    position: "absolute",
                                    top: -8,
                                    right: -8,
                                    background: isDark
                                        ? "rgba(var(--gp-tint-danger-rgb), 0.2)"
                                        : "rgba(var(--gp-tint-danger-rgb), 0.15)",
                                    borderRadius: "50%",
                                    width: 20,
                                    height: 20,
                                    minWidth: 20,
                                    minHeight: 20,
                                    zIndex: 6,
                                    "&:hover": {
                                        background: "rgba(var(--gp-tint-danger-rgb), 0.3)",
                                    },
                                    "&.Mui-disabled": { opacity: 0.4 },
                                }}
                                onClick={() => handleDelete(item.attachment_id)}
                            >
                                <CloseRoundedIcon sx={{ fontSize: 12, color: "#ef4444" }} />
                            </IconButton>
                            <AppTooltip title={fmt(t.tasks.tabs.downloadFileTooltip, { name })}>
                                <div
                                    style={{ cursor: isUploading ? "default" : "pointer" }}
                                    onClick={() => {
                                        if (isUploading) return;
                                        downloadFile(preview.url, name);
                                    }}
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
                            </AppTooltip>
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
                                {name}
                            </Typography>
                            <UploadingTileBadge open={isUploading} />
                        </Box>
                    );
                })}

                {imageItems.map((item) => {
                    const preview = previews.get(item.attachment_id);
                    if (!preview) return null;
                    const name = item.name ?? (item.file instanceof File ? item.file.name : "");
                    return (
                        <Box
                            key={`image-${item.attachment_id}`}
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
                                disabled={isUploading}
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
                                    zIndex: 6,
                                    "&:hover": {
                                        background: "rgba(var(--gp-tint-danger-rgb), 0.7)",
                                    },
                                    "&.Mui-disabled": { opacity: 0.4 },
                                }}
                                onClick={() => handleDelete(item.attachment_id)}
                            >
                                <CloseRoundedIcon sx={{ fontSize: 14, color: "white" }} />
                            </IconButton>
                            <img
                                alt={name}
                                src={preview.url}
                                style={{
                                    maxWidth: 300,
                                    maxHeight: 300,
                                    width: "auto",
                                    height: "auto",
                                    display: "block",
                                    cursor: isUploading ? "default" : "pointer",
                                }}
                                onClick={() => {
                                    if (isUploading) return;
                                    setSelectedImage(preview.url);
                                }}
                            />
                            <UploadingTileBadge open={isUploading} />
                        </Box>
                    );
                })}
            </Box>

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
                    disabled={isUploading}
                    size="sm"
                    sx={{
                        borderRadius: "10px",
                        px: 2,
                        py: 0.8,
                        gap: 1,
                        background: isDark
                            ? "linear-gradient(135deg, rgba(var(--gp-brandalt-500-rgb), 0.12) 0%, rgba(var(--gp-brand-700-rgb), 0.1) 100%)"
                            : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.1) 0%, rgba(var(--gp-brand-700-rgb), 0.08) 100%)",
                        border: "1px solid",
                        borderColor: isDark
                            ? "rgba(var(--gp-brandalt-500-rgb), 0.2)"
                            : "rgba(var(--gp-brand-700-rgb), 0.15)",
                        color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            background: isDark
                                ? "linear-gradient(135deg, rgba(var(--gp-brandalt-500-rgb), 0.18) 0%, rgba(var(--gp-brand-700-rgb), 0.15) 100%)"
                                : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.15) 0%, rgba(var(--gp-brand-700-rgb), 0.12) 100%)",
                        },
                        "&.Mui-disabled": { opacity: 0.5 },
                    }}
                    onClick={() => inputRef.current?.click()}
                >
                    <FolderRoundedIcon sx={{ fontSize: 18 }} />
                    <Typography level="body-sm" sx={{ fontWeight: 600, color: "inherit" }}>
                        Select Files
                    </Typography>
                </IconButton>
            </Box>

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
                            <AppTooltip placement="left" title={t.tasks.tooltips.download}>
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
                            </AppTooltip>
                        </Box>
                    )}
                </ModalDialog>
            </Modal>
        </Box>
    );
};
