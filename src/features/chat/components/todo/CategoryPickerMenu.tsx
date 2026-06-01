import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
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
            <AppTooltip title={triggerLabel ? `Tag: ${triggerLabel}` : "Add tag"}>
                <MenuButton
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: "plain",
                            // Tinted when a tag is set, muted when not — the
                            // tag name itself shows on the section header, so
                            // the trigger only needs to signal tagged/untagged.
                            color: triggerLabel ? "primary" : "neutral",
                            sx: { borderRadius: "6px", opacity: triggerLabel ? 1 : 0.6 },
                        },
                    }}
                >
                    <LocalOfferRoundedIcon sx={{ fontSize: 16 }} />
                </MenuButton>
            </AppTooltip>
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
