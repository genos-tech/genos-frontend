import React, { useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import { Alert, Box, Button, IconButton, Input, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { InlineTitleEdit } from "../../../../components/ui/fields/InlineTitleEdit";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { usePersonalGMTags } from "../../../../hooks/common/usePersonalGMTags";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
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
    const { t } = useTranslation();
    const { tags, updateTag, deleteTag } = usePersonalGMTags();

    // Two-click delete: first click arms the row, second confirms.
    const [armedDeleteTagId, setArmedDeleteTagId] = useState<number | null>(null);

    // The inline rename is the shared InlineTitleEdit: it hands over trimmed, non-empty,
    // changed text; this only refuses a duplicate or an over-long name.
    const commitRename = async (tag: PersonalTag, next: string) => {
        const valid = validateName(next, tags, tag.tagId);
        if (!valid || valid === tag.name) return;
        await updateTag(tag.tagId, { name: valid });
    };

    return (
        <ModalFrame
            description={t.chat.gmTags.privateHint}
            icon={<LabelOutlinedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="sm"
            title={t.chat.gmTags.manageTitle}
            zIndex={10010}
            onClose={() => {
                setArmedDeleteTagId(null);
                setOpen(false);
            }}
        >
            <Box sx={{ maxHeight: 320, overflowY: "auto", my: 1 }}>
                {tags.length === 0 && (
                    <Typography
                        level="body-sm"
                        sx={{ color: g.text.secondary, py: 1.5, textAlign: "center" }}
                    >
                        {t.chat.gmTags.emptyList}
                    </Typography>
                )}
                {tags.map((tag) => {
                    const isArmed = armedDeleteTagId === tag.tagId;
                    return (
                        <Stack
                            key={tag.tagId}
                            alignItems="center"
                            direction="row"
                            spacing={0.75}
                            sx={{
                                "&:hover": { background: g.hover },
                                borderRadius: g.radius.md,
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
                            <InlineTitleEdit
                                ariaLabel={t.chat.gmTags.manageTitle}
                                level="body-sm"
                                maxLength={MAX_NAME_LENGTH}
                                sx={{ flex: 1, minWidth: 0 }}
                                value={tag.name}
                                onCommit={(next) => void commitRename(tag, next)}
                            />
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
                                        color: tag.isDefaultVisible ? g.accent.text : undefined,
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
        </ModalFrame>
    );
};
