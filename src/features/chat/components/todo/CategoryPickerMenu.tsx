import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
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

import { TodoCategoryProps } from "../../../../types/chat";

interface CategoryPickerMenuProps {
    categories: TodoCategoryProps[];
    currentCategoryId: number | null;
    onSelect: (categoryId: number | null) => void;
    onCreate: (name: string) => Promise<TodoCategoryProps | undefined>;
    triggerLabel?: string | null;
}

export const CategoryPickerMenu = (props: CategoryPickerMenuProps) => {
    const { categories, currentCategoryId, onSelect, onCreate, triggerLabel } = props;
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed || creating) return;
        setCreating(true);
        const created = await onCreate(trimmed);
        if (created) {
            onSelect(created.categoryId);
        }
        setNewName("");
        setCreating(false);
    };

    return (
        <Dropdown>
            <MenuButton
                size="sm"
                variant="plain"
                sx={{
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    borderRadius: "6px",
                    px: 1,
                    py: 0.25,
                    minHeight: 0,
                    opacity: triggerLabel ? 0.95 : 0.55,
                }}
            >
                {triggerLabel ?? "Add tag"}
            </MenuButton>
            <Menu placement="bottom-end" size="sm" sx={{ minWidth: 200 }}>
                <MenuItem onClick={() => onSelect(null)}>
                    <Box sx={{ width: 18 }}>
                        {currentCategoryId === null ? <CheckIcon sx={{ fontSize: 16 }} /> : null}
                    </Box>
                    <Typography level="body-sm">General</Typography>
                </MenuItem>
                {categories.map((c) => (
                    <MenuItem key={c.categoryId} onClick={() => onSelect(c.categoryId)}>
                        <Box sx={{ width: 18 }}>
                            {c.categoryId === currentCategoryId ? (
                                <CheckIcon sx={{ fontSize: 16 }} />
                            ) : null}
                        </Box>
                        <Typography level="body-sm">{c.name}</Typography>
                    </MenuItem>
                ))}
                <ListDivider />
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
            </Menu>
        </Dropdown>
    );
};
