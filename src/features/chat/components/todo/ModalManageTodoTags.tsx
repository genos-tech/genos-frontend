import { useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
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

import { useTranslation } from "../../../../i18n";
import { TodoCategoryProps } from "../../../../types/chat";
import { TagColorOption } from "../../../../types/tasks";
import { ColorPickerMenu } from "../../../tasks/components/contents/base/sub/TagColorPickerMenu";
import { ProjectTagChip } from "../../../tasks/components/ProjectTagChip";
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

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    // Two-click delete: first click arms the row, second confirms.
    const [armedDeleteId, setArmedDeleteId] = useState<number | null>(null);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState<TagColorOption>(DEFAULT_NEW_COLOR);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const reset = () => {
        setEditingId(null);
        setArmedDeleteId(null);
        setError(null);
    };

    const commitRename = async (category: TodoCategoryProps) => {
        const valid = validateName(editingName, categories, category.categoryId);
        setEditingId(null);
        if (!valid) {
            if (editingName.trim() !== category.name) setError(t.chat.todoPane.tags.invalidName);
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

    return (
        <Modal
            open={open}
            sx={{ zIndex: 10010 }}
            onClose={() => {
                reset();
                onClose();
            }}
        >
            <ModalDialog sx={{ borderRadius: "16px", maxWidth: 420, p: 2.5, width: "92%" }}>
                <Stack alignItems="center" direction="row" justifyContent="space-between">
                    <Stack alignItems="center" direction="row" spacing={1}>
                        <LocalOfferRoundedIcon
                            sx={{
                                color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                                fontSize: 20,
                            }}
                        />
                        <Typography level="title-md" sx={{ fontWeight: 700 }}>
                            {t.chat.todoPane.tags.manageTitle}
                        </Typography>
                    </Stack>
                    <IconButton
                        aria-label={t.chat.todoPane.tags.close}
                        size="sm"
                        variant="plain"
                        onClick={() => {
                            reset();
                            onClose();
                        }}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>

                <Typography
                    level="body-xs"
                    sx={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                >
                    {t.chat.todoPane.tags.privateHint}
                </Typography>

                <Box
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{ maxHeight: 320, overflowY: "auto", my: 1 }}
                >
                    {categories.length === 0 && (
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                py: 1.5,
                                textAlign: "center",
                            }}
                        >
                            {t.chat.todoPane.tags.emptyList}
                        </Typography>
                    )}
                    {categories.map((category) => {
                        const isEditing = editingId === category.categoryId;
                        const isArmed = armedDeleteId === category.categoryId;
                        return (
                            <Stack
                                key={category.categoryId}
                                alignItems="center"
                                data-testid={`todo-tag-row-${category.categoryId}`}
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
                                <ColorPickerMenu
                                    onSelectColor={(c) => void handleRecolor(category, c)}
                                />
                                {isEditing ? (
                                    <Input
                                        size="sm"
                                        slotProps={{ input: { maxLength: MAX_NAME_LENGTH } }}
                                        sx={{ flex: 1 }}
                                        value={editingName}
                                        autoFocus
                                        onBlur={() => void commitRename(category)}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                void commitRename(category);
                                            }
                                            if (e.key === "Escape") setEditingId(null);
                                        }}
                                    />
                                ) : (
                                    <Box
                                        role="button"
                                        sx={{ cursor: "text", flex: 1, minWidth: 0 }}
                                        tabIndex={0}
                                        onClick={() => {
                                            setEditingId(category.categoryId);
                                            setEditingName(category.name);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                setEditingId(category.categoryId);
                                                setEditingName(category.name);
                                            }
                                        }}
                                    >
                                        <ProjectTagChip
                                            isDark={isDark}
                                            label={category.name}
                                            tagColor={todoTagColor(category)}
                                        />
                                    </Box>
                                )}
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
            </ModalDialog>
        </Modal>
    );
};
