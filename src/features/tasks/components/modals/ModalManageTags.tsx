import React, { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { Alert, Box, Button, IconButton, Input, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { TagListProps } from "../../../../types/tasks";
import { ColorPickerMenu } from "../contents/base/sub/TagColorPickerMenu";
import { ProjectTagChip } from "../ProjectTagChip";

const base_url = import.meta.env.VITE_API_BASE_URL;

// `editingTag` while a NEW tag is being typed (no real tag can have this name).
const NEW_TAG = "\u0000new";
const NEW_TAG_COLOR = { chipColor: "#ff2323", textColor: "white" };

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

    const startCreate = () => {
        setEditingTag(NEW_TAG);
        setEditName("");
        setEditColor(NEW_TAG_COLOR);
        setConfirmDelete(null);
        setErrorMessage(null);
    };

    // Create a tag here, in the same row editor used to rename one (it used to be a
    // separate "New Tag" modal and an icon button in the task preview; MIP-1174).
    const saveCreate = async () => {
        const trimmed = editName.trim();
        if (!trimmed) {
            setErrorMessage(t.tasks.modals.createTag.nameEmpty);
            return;
        }
        if (/\s/.test(trimmed)) {
            setErrorMessage(t.tasks.modals.createTag.nameNoSpaces);
            return;
        }
        try {
            const response = await fetch(`${base_url}/project/tag/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_id: myself.teamId,
                    project_id: usePM.currentProject?.projectId ?? -1,
                    tag_name: trimmed,
                    tag_color: editColor.chipColor,
                    tag_text_color: editColor.textColor,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                console.error(data);
                throw new Error(data.hint || t.tasks.modals.createTag.creationFailed);
            }
            setProjectTags([
                ...projectTags,
                {
                    tagName: trimmed,
                    tagColor: editColor.chipColor,
                    tagTextColor: editColor.textColor,
                },
            ]);
            setEditingTag(null);
            setErrorMessage(null);
            useTM.setIsNewTagCreated(true);
            // Republish the project's tag list so the filter bar's Tags dropdown and every
            // tag autocomplete see the new tag without a reload.
            useTM.bumpTagsRevision();
        } catch (error) {
            setErrorMessage(`${error}`);
        }
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
            // The local patch above only reaches this modal's own copy of the
            // list. Bump so the shared `currentProject.projectTags` is refetched
            // too — a rename is worse than a stale create in the filter bar,
            // since tag filtering matches by NAME (`concatTags`), so filtering
            // on the old name silently matches nothing.
            useTM.bumpTagsRevision();
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
            // Same reason as the rename above — otherwise the deleted tag stays
            // in the filter bar as an option that can never match a task again.
            useTM.bumpTagsRevision();
        } catch (error) {
            setErrorMessage(`${error}`);
        }
    };

    // The name + color editor of one tag row, shared by "edit" and "new".
    const editFields = (onSave: () => void) => (
        <>
            <Input
                size="sm"
                sx={{ flex: 1, "--Input-focusedThickness": "1px" }}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && editName.trim()) {
                        onSave();
                    } else if (e.key === "Escape") {
                        // The dialog's own Escape must not also close it.
                        e.stopPropagation();
                        cancelEdit();
                    }
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
            <ProjectTagChip
                label={editName || t.tasks.modals.manageTags.previewName}
                tagColor={editColor.chipColor}
            />
            <AppTooltip title={t.tasks.modals.manageTags.saveTooltip}>
                <IconButton
                    aria-label={t.tasks.modals.manageTags.saveTooltip}
                    color="primary"
                    disabled={!editName.trim()}
                    size="sm"
                    variant="plain"
                    onClick={() => onSave()}
                >
                    <CheckRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </AppTooltip>
            <AppTooltip title={t.tasks.modals.manageTags.cancelTooltip}>
                <IconButton
                    aria-label={t.tasks.modals.manageTags.cancelTooltip}
                    color="neutral"
                    size="sm"
                    variant="plain"
                    onClick={cancelEdit}
                >
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </AppTooltip>
        </>
    );

    const rowSx = (active: boolean) => ({
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1,
        borderRadius: g.radius.md,
        background: active ? g.accent.subtle : "transparent",
        border: "1px solid",
        borderColor: active ? g.accent.border : g.border.subtle,
        "&:hover": { background: active ? g.accent.subtle : g.hover },
    });

    return (
        <ModalFrame
            icon={<LocalOfferIcon sx={{ fontSize: 20, color: g.accent.text }} />}
            open={open}
            size="md"
            title={t.tasks.modals.manageTags.heading}
            zIndex={10010}
            actions={
                <Button color="neutral" variant="plain" onClick={onClose}>
                    {t.tasks.modals.manageTags.closeButton}
                </Button>
            }
            headerAccessory={
                <Button
                    disabled={editingTag === NEW_TAG}
                    size="sm"
                    startDecorator={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                    variant="soft"
                    onClick={startCreate}
                >
                    {t.tasks.modals.manageTags.newTag}
                </Button>
            }
            onClose={onClose}
        >
            {errorMessage && (
                <Alert color="danger" sx={{ mb: 2 }}>
                    {errorMessage}
                </Alert>
            )}

            {/* Tag List */}
            <Stack spacing={0.5}>
                {editingTag === NEW_TAG && <Box sx={rowSx(true)}>{editFields(saveCreate)}</Box>}

                {projectTags.length === 0 && editingTag !== NEW_TAG && (
                    <Typography
                        level="body-sm"
                        sx={{ color: g.text.tertiary, textAlign: "center", py: 3 }}
                    >
                        {t.tasks.modals.manageTags.noTagsCreated}
                    </Typography>
                )}

                {projectTags.map((tag) => (
                    <Box key={tag.tagName} sx={rowSx(editingTag === tag.tagName)}>
                        {editingTag === tag.tagName ? (
                            editFields(() => saveEdit(tag.tagName))
                        ) : (
                            <>
                                <ProjectTagChip label={tag.tagName} tagColor={tag.tagColor} />
                                <Box sx={{ flex: 1 }} />
                                {confirmDelete === tag.tagName ? (
                                    <Stack
                                        direction="row"
                                        spacing={0.5}
                                        sx={{ alignItems: "center" }}
                                    >
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: g.danger.text, mr: 0.5 }}
                                        >
                                            {t.tasks.modals.manageTags.deletePrompt}
                                        </Typography>
                                        <Button
                                            color="danger"
                                            size="sm"
                                            variant="soft"
                                            onClick={() => deleteTag(tag.tagName)}
                                        >
                                            {t.tasks.modals.manageTags.yes}
                                        </Button>
                                        <Button
                                            color="neutral"
                                            size="sm"
                                            variant="plain"
                                            onClick={() => setConfirmDelete(null)}
                                        >
                                            {t.tasks.modals.manageTags.no}
                                        </Button>
                                    </Stack>
                                ) : (
                                    <>
                                        <AppTooltip title={t.tasks.modals.manageTags.editTooltip}>
                                            <IconButton
                                                aria-label={t.tasks.modals.manageTags.editTooltip}
                                                color="neutral"
                                                size="sm"
                                                variant="plain"
                                                onClick={() => startEdit(tag)}
                                            >
                                                <EditRoundedIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </AppTooltip>
                                        <AppTooltip
                                            title={t.tasks.modals.manageTags.deleteTooltip}
                                        >
                                            <IconButton
                                                color="danger"
                                                size="sm"
                                                variant="plain"
                                                aria-label={
                                                    t.tasks.modals.manageTags.deleteTooltip
                                                }
                                                onClick={() => {
                                                    setConfirmDelete(tag.tagName);
                                                    setEditingTag(null);
                                                }}
                                            >
                                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </AppTooltip>
                                    </>
                                )}
                            </>
                        )}
                    </Box>
                ))}
            </Stack>
        </ModalFrame>
    );
};
