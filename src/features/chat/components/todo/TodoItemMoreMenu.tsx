import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
    Box,
    Dropdown,
    IconButton,
    Input,
    ListDivider,
    Menu,
    MenuButton,
    MenuItem,
    Typography,
} from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";
import { TodoCategoryProps } from "../../../../types/chat";

interface TodoItemMoreMenuProps {
    // Child rows get a Delete-only menu: subitems have no own deep link
    // and inherit the parent's tag (the view cascades tag changes).
    isChild: boolean;
    categories: TodoCategoryProps[];
    currentCategoryId: number | null;
    onSelectCategory: (categoryId: number | null) => void;
    onCreateCategory: (name: string) => Promise<TodoCategoryProps | undefined>;
    onCopyLink: () => void;
    linkCopied: boolean;
    onDelete: () => void;
}

// Consolidates the row's secondary actions (copy link, tag picker,
// delete) behind one ⋮ trigger — five inline icon buttons per row was
// too noisy. The tag picker (formerly the standalone CategoryPickerMenu
// trigger) lives inline in this menu as its own section: the tag list
// plus the create-new-tag input.
export const TodoItemMoreMenu = (props: TodoItemMoreMenuProps) => {
    const {
        isChild,
        categories,
        currentCategoryId,
        onSelectCategory,
        onCreateCategory,
        onCopyLink,
        linkCopied,
        onDelete,
    } = props;
    const { t } = useTranslation();
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed || creating) return;
        setCreating(true);
        const created = await onCreateCategory(trimmed);
        if (created) {
            onSelectCategory(created.categoryId);
        }
        setNewName("");
        setCreating(false);
    };

    return (
        <Dropdown>
            <AppTooltip title="More options">
                <MenuButton
                    aria-label="More options"
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: "plain",
                            sx: { borderRadius: "6px" },
                        },
                    }}
                >
                    <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
                </MenuButton>
            </AppTooltip>
            <Menu placement="bottom-end" size="sm" sx={{ minWidth: 200 }}>
                {!isChild && (
                    <MenuItem onClick={onCopyLink}>
                        <LinkRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography level="body-sm">
                            {linkCopied ? t.chat.todoPane.linkCopied : t.chat.todoPane.copyLink}
                        </Typography>
                    </MenuItem>
                )}
                {!isChild && (
                    <>
                        <ListDivider />
                        {/* Tag section — the old CategoryPickerMenu content,
                            inlined. Selecting closes the menu; typing in the
                            create input keeps it open (it's not a MenuItem). */}
                        <Typography
                            level="body-xs"
                            startDecorator={<LocalOfferRoundedIcon sx={{ fontSize: 12 }} />}
                            sx={{ opacity: 0.6, px: 1, py: 0.25 }}
                        >
                            Tag
                        </Typography>
                        <MenuItem onClick={() => onSelectCategory(null)}>
                            <Box sx={{ width: 18 }}>
                                {currentCategoryId === null ? (
                                    <CheckIcon sx={{ fontSize: 16 }} />
                                ) : null}
                            </Box>
                            <Typography level="body-sm">General</Typography>
                        </MenuItem>
                        {categories.map((c) => (
                            <MenuItem
                                key={c.categoryId}
                                onClick={() => onSelectCategory(c.categoryId)}
                            >
                                <Box sx={{ width: 18 }}>
                                    {c.categoryId === currentCategoryId ? (
                                        <CheckIcon sx={{ fontSize: 16 }} />
                                    ) : null}
                                </Box>
                                <Typography level="body-sm">{c.name}</Typography>
                            </MenuItem>
                        ))}
                        <Box sx={{ display: "flex", gap: 0.5, p: 0.5 }}>
                            <Input
                                placeholder="New tag"
                                size="sm"
                                sx={{ flex: 1, fontSize: "0.8rem" }}
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleCreate();
                                    }
                                }}
                            />
                            <IconButton
                                disabled={!newName.trim() || creating}
                                size="sm"
                                sx={{ borderRadius: "6px" }}
                                variant="soft"
                                onClick={handleCreate}
                            >
                                <AddIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Box>
                        <ListDivider />
                    </>
                )}
                <MenuItem color="danger" onClick={onDelete}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    <Typography color="danger" level="body-sm">
                        Delete
                    </Typography>
                </MenuItem>
            </Menu>
        </Dropdown>
    );
};
