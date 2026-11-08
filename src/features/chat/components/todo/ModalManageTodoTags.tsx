import { useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import { Alert, Box, Button, IconButton, Input, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { InlineTitleEdit } from "../../../../components/ui/fields/InlineTitleEdit";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { TodoCategoryProps } from "../../../../types/chat";
import { TagColorOption } from "../../../../types/tasks";
import { ColorPickerMenu } from "../../../tasks/components/contents/base/sub/TagColorPickerMenu";
import { ProjectTagChip } from "../../../tasks/components/ProjectTagChip";
import { useTodoDialogLayer } from "./TodoHostLayer";
import { todoTagColor } from "./todoTagColor";

// Matches `ToDoCategory.name` (max_length=64) on the server.
const MAX_NAME_LENGTH = 64;

const DEFAULT_NEW_COLOR: TagColorOption = {
    name: "Purple",
    textColor: "white",
    value: "#8e23ff",
};

// Case-sensitive on purpose: the server's unique constraint is, and a
// stricter client check would hide a rename the server accepts.
const validateName = (
    name: string,
    categories: readonly TodoCategoryProps[],
    excludeCategoryId?: number
): string | null => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return null;
    const dupe = categories.some((c) => c.categoryId !== excludeCategoryId && c.name === trimmed);
    return dupe ? null : trimmed;
};

type ModalManageTodoTagsProps = {
    open: boolean;
    onClose: () => void;
    categories: TodoCategoryProps[];
    onCreate: (
        name: string,
        color: { color: string; textColor: string }
    ) => Promise<TodoCategoryProps | undefined>;
    onUpdate: (
        categoryId: number,
        patch: { name?: string; color?: string; textColor?: string }
    ) => Promise<TodoCategoryProps | undefined>;
    onDelete: (categoryId: number) => Promise<void>;
};

/**
 * Manage the user's To Do tags: rename, recolour, create, delete. Tags are
 * personal (per user and team), so there is nothing to share or permission
 * here. Modelled on `ModalManageGMTags`; each tag renders as the canonical
 * `ProjectTagChip` so it looks the same here, in a section header and in the
 * tag picker.
 */
export const ModalManageTodoTags = ({
    open,
    onClose,
    categories,
    onCreate,
    onUpdate,
    onDelete,
}: ModalManageTodoTagsProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    // Two-click delete: first click arms the row, second confirms.
    const [armedDeleteId, setArmedDeleteId] = useState<number | null>(null);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState<TagColorOption>(DEFAULT_NEW_COLOR);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const reset = () => {
        setArmedDeleteId(null);
        setError(null);
    };

    // The inline rename is the shared InlineTitleEdit: it hands over trimmed, non-empty,
    // changed text; this refuses a duplicate or an over-long name with the message.
    const commitRename = async (category: TodoCategoryProps, next: string) => {
        const valid = validateName(next, categories, category.categoryId);
        if (!valid) {
            setError(t.chat.todoPane.tags.invalidName);
            return;
        }
        if (valid === category.name) return;
        setError(null);
        const saved = await onUpdate(category.categoryId, { name: valid });
        if (!saved) setError(t.chat.todoPane.tags.updateFailed);
    };

    const handleRecolor = async (category: TodoCategoryProps, c: TagColorOption) => {
        setError(null);
        const saved = await onUpdate(category.categoryId, {
            color: c.value,
            textColor: c.textColor,
        });
        if (!saved) setError(t.chat.todoPane.tags.updateFailed);
    };

    const handleCreate = async () => {
        const valid = validateName(newName, categories);
        if (!valid) {
            setError(t.chat.todoPane.tags.invalidName);
            return;
        }
        setBusy(true);
        setError(null);
        const created = await onCreate(valid, {
            color: newColor.value,
            textColor: newColor.textColor,
        });
        setBusy(false);
        if (!created) {
            setError(t.chat.todoPane.tags.createFailed);
            return;
        }
        setNewName("");
    };

    // Inside the to-do modal this opens above it (MIP-1047).
    const layer = useTodoDialogLayer(10010);

    return (
        <ModalFrame
            closeLabel={t.chat.todoPane.tags.close}
            description={t.chat.todoPane.tags.privateHint}
            icon={<LocalOfferRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="sm"
            title={t.chat.todoPane.tags.manageTitle}
            zIndex={layer}
            onClose={() => {
                reset();
                onClose();
            }}
        >
            <Box sx={{ maxHeight: 320, overflowY: "auto", my: 1 }}>
                {categories.length === 0 && (
                    <Typography
                        level="body-sm"
                        sx={{ color: g.text.secondary, py: 1.5, textAlign: "center" }}
                    >
                        {t.chat.todoPane.tags.emptyList}
                    </Typography>
                )}
                {categories.map((category) => {
                    const isArmed = armedDeleteId === category.categoryId;
                    return (
                        <Stack
                            key={category.categoryId}
                            alignItems="center"
                            data-testid={`todo-tag-row-${category.categoryId}`}
                            direction="row"
                            spacing={0.75}
                            sx={{
                                "&:hover": { background: g.hover },
                                borderRadius: g.radius.md,
                                px: 0.75,
                                py: 0.5,
                            }}
                        >
                            <ColorPickerMenu
                                onSelectColor={(c) => void handleRecolor(category, c)}
                            />
                            <InlineTitleEdit
                                ariaLabel={t.chat.todoPane.tags.manageTitle}
                                maxLength={MAX_NAME_LENGTH}
                                sx={{ flex: 1, minWidth: 0 }}
                                value={category.name}
                                renderValue={(name) => (
                                    <ProjectTagChip
                                        isDark={isDark}
                                        label={name}
                                        tagColor={todoTagColor(category)}
                                    />
                                )}
                                onCommit={(next) => void commitRename(category, next)}
                            />
                            {isArmed ? (
                                <Button
                                    color="danger"
                                    size="sm"
                                    variant="solid"
                                    onClick={() => {
                                        setArmedDeleteId(null);
                                        void onDelete(category.categoryId);
                                    }}
                                >
                                    {t.chat.todoPane.tags.deleteConfirm}
                                </Button>
                            ) : (
                                <IconButton
                                    aria-label={t.chat.todoPane.delete}
                                    color="danger"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => setArmedDeleteId(category.categoryId)}
                                >
                                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            )}
                        </Stack>
                    );
                })}
            </Box>

            <Stack alignItems="center" direction="row" spacing={0.5}>
                <Box
                    sx={{
                        background: newColor.value,
                        borderRadius: "50%",
                        flexShrink: 0,
                        height: 14,
                        width: 14,
                    }}
                />
                <ColorPickerMenu onSelectColor={setNewColor} />
                <Input
                    placeholder={t.chat.todoPane.newTagPlaceholder}
                    size="sm"
                    slotProps={{ input: { maxLength: MAX_NAME_LENGTH } }}
                    sx={{ flex: 1 }}
                    value={newName}
                    onChange={(e) => {
                        setNewName(e.target.value);
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
                    disabled={busy || newName.trim().length === 0}
                    size="sm"
                    variant="soft"
                    onClick={() => void handleCreate()}
                >
                    {t.chat.todoPane.tags.createButton}
                </Button>
            </Stack>
            {error && (
                <Alert color="warning" size="sm" sx={{ mt: 0.75 }}>
                    {error}
                </Alert>
            )}
        </ModalFrame>
    );
};
