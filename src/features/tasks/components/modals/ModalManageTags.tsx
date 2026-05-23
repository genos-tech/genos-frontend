import React, { useEffect, useState } from "react";
import { keyframes } from "@emotion/react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import {
    Alert,
    Box,
    Button,
    Chip,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TagListProps } from "../../../../types/tasks";
import { ColorPickerMenu } from "../contents/base/sub/TagColorPickerMenu";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    open: boolean;
    onClose: () => void;
    projectTags: TagListProps[];
    setProjectTags: (tags: TagListProps[]) => void;
};

export const ModalManageTags: React.FC<Props> = ({
    myself,
    usePM,
    useTM,
    open,
    onClose,
    projectTags,
    setProjectTags,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [editingTag, setEditingTag] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState({ chipColor: "", textColor: "" });
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setEditingTag(null);
            setConfirmDelete(null);
            setErrorMessage(null);
        }
    }, [open]);

    const startEdit = (tag: TagListProps) => {
        setEditingTag(tag.tagName);
        setEditName(tag.tagName);
        setEditColor({ chipColor: tag.tagColor, textColor: tag.tagTextColor });
        setConfirmDelete(null);
        setErrorMessage(null);
    };

    const cancelEdit = () => {
        setEditingTag(null);
        setErrorMessage(null);
    };

    const saveEdit = async (oldTagName: string) => {
        try {
            const response = await fetch(`${base_url}/project/tag/`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    project_id: usePM.currentProject?.projectId,
                    old_tag_name: oldTagName,
                    tag_name: editName,
                    tag_color: editColor.chipColor,
                    tag_text_color: editColor.textColor,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || t.tasks.modals.manageTags.updateFailed);
            }

            setProjectTags(
                projectTags.map((t) =>
                    t.tagName === oldTagName
                        ? {
                              tagName: editName,
                              tagColor: editColor.chipColor,
                              tagTextColor: editColor.textColor,
                          }
                        : t
                )
            );
            setEditingTag(null);
            useTM.setIsNewTagCreated(true);
        } catch (error) {
            setErrorMessage(`${error}`);
        }
    };

    const deleteTag = async (tagName: string) => {
        try {
            const response = await fetch(`${base_url}/project/tag/`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    project_id: usePM.currentProject?.projectId,
                    tag_name: tagName,
                }),
            });

            if (!response.ok && response.status !== 204) {
                const data = await response.json();
                throw new Error(data.error || t.tasks.modals.manageTags.deleteFailed);
            }

            setProjectTags(projectTags.filter((t) => t.tagName !== tagName));
            setConfirmDelete(null);
            useTM.setIsNewTagCreated(true);
        } catch (error) {
            setErrorMessage(`${error}`);
        }
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={onClose}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124,58,237,0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "400px" },
                    maxWidth: { xs: "100vw", md: "600px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "70vh" },
                    p: { xs: 2, md: 3 },
                    overflow: "auto",
                }}
            >
                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 40,
                            height: 40,
                            borderRadius: "10px",
                            background:
                                "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
                            border: "1px solid rgba(124,58,237,0.3)",
                        }}
                    >
                        <LocalOfferIcon sx={{ color: "rgba(139, 92, 246, 0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                            flex: 1,
                        }}
                    >
                        {t.tasks.modals.manageTags.heading}
                    </Typography>
                    <IconButton
                        size="sm"
                        variant="plain"
                        onClick={onClose}
                        sx={{
                            color: "rgba(255,255,255,0.5)",
                            "&:hover": { color: "rgba(255,255,255,0.9)" },
                        }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>

                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Tag List */}
                <Stack
                    spacing={0.5}
                    sx={{
                        overflowY: "auto",
                        maxHeight: "45vh",
                        pr: 0.5,
                    }}
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                >
                    {projectTags.length === 0 && (
                        <Typography
                            level="body-sm"
                            sx={{ color: "rgba(255,255,255,0.4)", textAlign: "center", py: 3 }}
                        >
                            {t.tasks.modals.manageTags.noTagsCreated}
                        </Typography>
                    )}

                    {projectTags.map((tag) => (
                        <Box
                            key={tag.tagName}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                p: 1,
                                borderRadius: "10px",
                                backgroundColor:
                                    editingTag === tag.tagName
                                        ? "rgba(124,58,237,0.08)"
                                        : "rgba(255,255,255,0.02)",
                                border: "1px solid",
                                borderColor:
                                    editingTag === tag.tagName
                                        ? "rgba(124,58,237,0.2)"
                                        : "rgba(255,255,255,0.05)",
                                transition: "all 0.15s ease",
                                "&:hover": {
                                    backgroundColor: "rgba(255,255,255,0.04)",
                                },
                            }}
                        >
                            {editingTag === tag.tagName ? (
                                <>
                                    <Input
                                        size="sm"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && editName.trim()) {
                                                saveEdit(tag.tagName);
                                            } else if (e.key === "Escape") {
                                                cancelEdit();
                                            }
                                        }}
                                        sx={{
                                            flex: 1,
                                            "--Input-focusedThickness": "1px",
                                            backgroundColor: "rgba(255,255,255,0.05)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: "8px",
                                            color: "#e0e0e0",
                                            "& input::placeholder": {
                                                color: "rgba(255,255,255,0.4)",
                                            },
                                        }}
                                    />
                                    <ColorPickerMenu
                                        onSelectColor={(color) =>
                                            setEditColor({
                                                chipColor: color.value,
                                                textColor: color.textColor,
                                            })
                                        }
                                    />
                                    <Chip
                                        size="sm"
                                        variant="outlined"
                                        sx={{
                                            borderWidth: "2px",
                                            borderColor: alpha(editColor.chipColor, 0.6),
                                            backgroundColor: alpha(editColor.chipColor, 0.1),
                                            color: "#fff",
                                            fontWeight: 600,
                                            fontSize: "0.7rem",
                                        }}
                                    >
                                        {editName || t.tasks.modals.manageTags.previewName}
                                    </Chip>
                                    <AppTooltip
                                        title={t.tasks.modals.manageTags.saveTooltip}
                                    >
                                        <IconButton
                                            size="sm"
                                            variant="plain"
                                            disabled={!editName.trim()}
                                            onClick={() => saveEdit(tag.tagName)}
                                            sx={{
                                                color: "rgba(124,58,237,0.8)",
                                                "&:hover": { color: "#7c3aed" },
                                            }}
                                        >
                                            <CheckRoundedIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </AppTooltip>
                                    <AppTooltip
                                        title={t.tasks.modals.manageTags.cancelTooltip}
                                    >
                                        <IconButton
                                            size="sm"
                                            variant="plain"
                                            onClick={cancelEdit}
                                            sx={{
                                                color: "rgba(255,255,255,0.4)",
                                                "&:hover": { color: "rgba(255,255,255,0.8)" },
                                            }}
                                        >
                                            <CloseRoundedIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </AppTooltip>
                                </>
                            ) : (
                                <>
                                    <Chip
                                        size="sm"
                                        variant="outlined"
                                        sx={{
                                            borderWidth: "2px",
                                            borderColor: alpha(tag.tagColor, isDark ? 0.6 : 0.75),
                                            backgroundColor: alpha(tag.tagColor, 0.1),
                                            color: "#fff",
                                            fontWeight: 600,
                                            fontSize: "0.7rem",
                                        }}
                                    >
                                        {tag.tagName}
                                    </Chip>
                                    <Box sx={{ flex: 1 }} />
                                    {confirmDelete === tag.tagName ? (
                                        <Stack
                                            direction="row"
                                            spacing={0.5}
                                            sx={{ alignItems: "center" }}
                                        >
                                            <Typography
                                                level="body-xs"
                                                sx={{ color: "rgba(232,121,195,0.8)", mr: 0.5 }}
                                            >
                                                {t.tasks.modals.manageTags.deletePrompt}
                                            </Typography>
                                            <Button
                                                size="sm"
                                                variant="soft"
                                                color="danger"
                                                onClick={() => deleteTag(tag.tagName)}
                                                sx={{
                                                    minHeight: 26,
                                                    fontSize: "0.7rem",
                                                    borderRadius: "6px",
                                                }}
                                            >
                                                {t.tasks.modals.manageTags.yes}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="plain"
                                                onClick={() => setConfirmDelete(null)}
                                                sx={{
                                                    minHeight: 26,
                                                    fontSize: "0.7rem",
                                                    borderRadius: "6px",
                                                    color: "rgba(255,255,255,0.5)",
                                                }}
                                            >
                                                {t.tasks.modals.manageTags.no}
                                            </Button>
                                        </Stack>
                                    ) : (
                                        <>
                                            <AppTooltip
                                                title={t.tasks.modals.manageTags.editTooltip}
                                            >
                                                <IconButton
                                                    size="sm"
                                                    variant="plain"
                                                    onClick={() => startEdit(tag)}
                                                    sx={{
                                                        color: "rgba(255,255,255,0.4)",
                                                        "&:hover": {
                                                            color: "rgba(124,58,237,0.9)",
                                                        },
                                                    }}
                                                >
                                                    <EditRoundedIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </AppTooltip>
                                            <AppTooltip
                                                title={t.tasks.modals.manageTags.deleteTooltip}
                                            >
                                                <IconButton
                                                    size="sm"
                                                    variant="plain"
                                                    onClick={() => {
                                                        setConfirmDelete(tag.tagName);
                                                        setEditingTag(null);
                                                    }}
                                                    sx={{
                                                        color: "rgba(255,255,255,0.4)",
                                                        "&:hover": {
                                                            color: "rgba(232,121,195,0.9)",
                                                        },
                                                    }}
                                                >
                                                    <DeleteOutlineRoundedIcon
                                                        sx={{ fontSize: 16 }}
                                                    />
                                                </IconButton>
                                            </AppTooltip>
                                        </>
                                    )}
                                </>
                            )}
                        </Box>
                    ))}
                </Stack>

                {/* Footer */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", mt: 2 }}>
                    <Button
                        variant="plain"
                        onClick={onClose}
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 2.5,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                    >
                        {t.tasks.modals.manageTags.closeButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
