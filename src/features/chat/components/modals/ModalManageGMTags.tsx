import React, { useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import {
    Alert,
    Box,
    Button,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { usePersonalGMTags } from "../../../../hooks/common/usePersonalGMTags";
import { useTranslation } from "../../../../i18n";
import { PersonalTag } from "../../../../types/personalTags";
import { TagColorOption } from "../../../../types/tasks";
import { ColorPickerMenu } from "../../../tasks/components/contents/base/sub/TagColorPickerMenu";

/**
 * Global CRUD for the user's personal GM tags (rename / recolor /
 * pin-to-default / delete / create). Personal data — every mutation
 * goes through `usePersonalGMTags`, which updates optimistically and
 * never touches the channel payload.
 */

const MAX_NAME_LENGTH = 30;

const validateName = (
    name: string,
    tags: readonly PersonalTag[],
    excludeTagId?: number
): string | null => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return null;
    const dupe = tags.some(
        (t) => t.tagId !== excludeTagId && t.name.toLowerCase() === trimmed.toLowerCase()
    );
    return dupe ? null : trimmed;
};

/**
 * Inline "new tag" row (name input + color picker + add button). Shared
 * by this modal and `ModalAssignGMTags` so a tag can be created right
 * where it's first needed. `onCreated` fires with the server tag.
 */
export const GMTagCreateRow = ({ onCreated }: { onCreated?: (tag: PersonalTag) => void }) => {
    const { t } = useTranslation();
    const { tags, createTag } = usePersonalGMTags();
    const [name, setName] = useState("");
    const [color, setColor] = useState<TagColorOption>({
        name: "Purple",
        textColor: "white",
        value: "#8e23ff",
    });
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const handleCreate = async () => {
        const valid = validateName(name, tags);
        if (!valid) {
            setError(t.chat.gmTags.invalidName);
            return;
        }
        setBusy(true);
        setError(null);
        const created = await createTag({
            color: color.value,
            name: valid,
            textColor: color.textColor,
        });
        setBusy(false);
        if (!created) {
            setError(t.chat.gmTags.createFailed);
            return;
        }
        setName("");
        onCreated?.(created);
    };

    return (
        <Box>
            <Stack alignItems="center" direction="row" spacing={0.5}>
                <Box
                    sx={{
                        background: color.value,
                        borderRadius: "50%",
                        flexShrink: 0,
                        height: 14,
                        width: 14,
                    }}
                />
                <ColorPickerMenu onSelectColor={setColor} />
                <Input
                    placeholder={t.chat.gmTags.createPlaceholder}
                    size="sm"
                    slotProps={{ input: { maxLength: MAX_NAME_LENGTH } }}
                    sx={{ flex: 1 }}
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void handleCreate();
                        }
                    }}
                />
                <Button
                    disabled={busy || name.trim().length === 0}
                    size="sm"
                    variant="soft"
                    onClick={() => void handleCreate()}
                >
                    {t.chat.gmTags.createButton}
                </Button>
            </Stack>
            {error && (
                <Alert color="warning" size="sm" sx={{ mt: 0.75 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );
};

type ModalManageGMTagsProps = {
    open: boolean;
    setOpen: (value: boolean) => void;
};

export const ModalManageGMTags = ({ open, setOpen }: ModalManageGMTagsProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const { tags, updateTag, deleteTag } = usePersonalGMTags();

    // Inline rename: one row at a time.
    const [editingTagId, setEditingTagId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    // Two-click delete: first click arms the row, second confirms.
    const [armedDeleteTagId, setArmedDeleteTagId] = useState<number | null>(null);

    const commitRename = async (tag: PersonalTag) => {
        const valid = validateName(editingName, tags, tag.tagId);
        setEditingTagId(null);
        if (!valid || valid === tag.name) return;
        await updateTag(tag.tagId, { name: valid });
    };

    return (
        <Modal
            open={open}
            sx={{ zIndex: 10010 }}
            onClose={() => {
                setArmedDeleteTagId(null);
                setEditingTagId(null);
                setOpen(false);
            }}
        >
            <ModalDialog
                sx={{
                    borderRadius: "16px",
                    maxWidth: 420,
                    p: 2.5,
                    width: "92%",
                }}
            >
                <Stack alignItems="center" direction="row" justifyContent="space-between">
                    <Stack alignItems="center" direction="row" spacing={1}>
                        <LabelOutlinedIcon
                            sx={{
                                color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                                fontSize: 20,
                            }}
                        />
                        <Typography level="title-md" sx={{ fontWeight: 700 }}>
                            {t.chat.gmTags.manageTitle}
                        </Typography>
                    </Stack>
                    <IconButton size="sm" variant="plain" onClick={() => setOpen(false)}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>

                <Typography
                    level="body-xs"
                    sx={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                >
                    {t.chat.gmTags.privateHint}
                </Typography>

                <Box
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{ maxHeight: 320, overflowY: "auto", my: 1 }}
                >
                    {tags.length === 0 && (
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                py: 1.5,
                                textAlign: "center",
                            }}
                        >
                            {t.chat.gmTags.emptyList}
                        </Typography>
                    )}
                    {tags.map((tag) => {
                        const isEditing = editingTagId === tag.tagId;
                        const isArmed = armedDeleteTagId === tag.tagId;
                        return (
                            <Stack
                                key={tag.tagId}
                                alignItems="center"
                                direction="row"
                                spacing={0.75}
                                sx={{
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                    },
                                    borderRadius: "8px",
                                    px: 0.75,
                                    py: 0.5,
                                }}
                            >
                                <Box
                                    sx={{
                                        background: tag.color,
                                        borderRadius: "50%",
                                        flexShrink: 0,
                                        height: 12,
                                        width: 12,
                                    }}
                                />
                                <ColorPickerMenu
                                    onSelectColor={(c) =>
                                        void updateTag(tag.tagId, {
                                            color: c.value,
                                            textColor: c.textColor,
                                        })
                                    }
                                />
                                {isEditing ? (
                                    <Input
                                        size="sm"
                                        slotProps={{ input: { maxLength: MAX_NAME_LENGTH } }}
                                        sx={{ flex: 1 }}
                                        value={editingName}
                                        autoFocus
                                        onBlur={() => void commitRename(tag)}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                void commitRename(tag);
                                            }
                                            if (e.key === "Escape") setEditingTagId(null);
                                        }}
                                    />
                                ) : (
                                    <Typography
                                        level="body-sm"
                                        sx={{ cursor: "text", flex: 1 }}
                                        noWrap
                                        onClick={() => {
                                            setEditingTagId(tag.tagId);
                                            setEditingName(tag.name);
                                        }}
                                    >
                                        {tag.name}
                                    </Typography>
                                )}
                                <AppTooltip
                                    size="sm"
                                    title={
                                        tag.isDefaultVisible
                                            ? t.chat.sidebar.gmTagUnpinDefault
                                            : t.chat.sidebar.gmTagPinDefault
                                    }
                                >
                                    <IconButton
                                        size="sm"
                                        variant="plain"
                                        sx={{
                                            color: tag.isDefaultVisible
                                                ? isDark
                                                    ? "var(--gp-brandalt-400)"
                                                    : "var(--gp-brand-700)"
                                                : undefined,
                                        }}
                                        onClick={() =>
                                            void updateTag(tag.tagId, {
                                                isDefaultVisible: !tag.isDefaultVisible,
                                            })
                                        }
                                    >
                                        {tag.isDefaultVisible ? (
                                            <PushPinRoundedIcon sx={{ fontSize: 16 }} />
                                        ) : (
                                            <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
                                        )}
                                    </IconButton>
                                </AppTooltip>
                                {isArmed ? (
                                    <Button
                                        color="danger"
                                        size="sm"
                                        variant="solid"
                                        onClick={() => {
                                            setArmedDeleteTagId(null);
                                            void deleteTag(tag.tagId);
                                        }}
                                    >
                                        {t.chat.gmTags.deleteConfirm}
                                    </Button>
                                ) : (
                                    <IconButton
                                        color="danger"
                                        size="sm"
                                        variant="plain"
                                        onClick={() => setArmedDeleteTagId(tag.tagId)}
                                    >
                                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                )}
                            </Stack>
                        );
                    })}
                </Box>

                <GMTagCreateRow />
            </ModalDialog>
        </Modal>
    );
};
