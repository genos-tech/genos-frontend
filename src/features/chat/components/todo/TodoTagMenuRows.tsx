import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { Box, IconButton, Input, useColorScheme } from "@mui/joy";

import { MenuDivider, MenuRow } from "../../../../components/ui/MoreMenu";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { TodoCategoryProps } from "../../../../types/chat";
import { ProjectTagChip } from "../../../tasks/components/ProjectTagChip";
import { todoTagColor } from "./todoTagColor";

// The menu's rows are 44px on a touch screen (MenuSurface); the new-tag field and its add
// button are the two controls that are not rows, so they get the same floor.
const TOUCH_FLOOR = g.row.comfortable;
const TAG_FIELD_TOUCH_SX = {
    "@media (pointer: coarse)": { "--Input-minHeight": TOUCH_FLOOR, minHeight: TOUCH_FLOOR },
} as const;
const TAG_ADD_TOUCH_SX = {
    "@media (pointer: coarse)": { minHeight: TOUCH_FLOOR, minWidth: TOUCH_FLOOR },
} as const;

type TodoTagMenuRowsProps = {
    categories: readonly TodoCategoryProps[];
    currentCategoryId: number | null;
    onSelectCategory: (categoryId: number | null) => void;
    onCreateCategory: (name: string) => Promise<TodoCategoryProps | undefined>;
    /** Opens the manage-tags dialog. Absent where there is no dialog to open (the row menu has
     *  always been without one), and the row is left out. */
    onManageTags?: () => void;
};

/**
 * The rows of a to-do's tag picker: General (no tag), each tag as its coloured chip, a field to
 * make a new one, and, where the host can open it, "Manage tags…". Rows of a Joy menu: the host
 * puts them inside its `MenuSurface`. One body for the two ways to pick a tag (the ⋮ menu and the
 * tag chip on the row, MIP-1652), so they cannot drift apart.
 *
 * Choosing a row closes the menu (it is a menu item). Typing in the new-tag field does not (it is
 * not one); a created tag is chosen at once.
 */
export const TodoTagMenuRows = ({
    categories,
    currentCategoryId,
    onSelectCategory,
    onCreateCategory,
    onManageTags,
}: TodoTagMenuRowsProps) => {
    const isDark = useColorScheme().mode === "dark";
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
        <>
            <MenuRow selected={currentCategoryId === null} onClick={() => onSelectCategory(null)}>
                {t.chat.todoPane.general}
            </MenuRow>
            {categories.map((c) => (
                <MenuRow
                    key={c.categoryId}
                    selected={c.categoryId === currentCategoryId}
                    onClick={() => onSelectCategory(c.categoryId)}
                >
                    <ProjectTagChip isDark={isDark} label={c.name} tagColor={todoTagColor(c)} />
                </MenuRow>
            ))}
            <Box sx={{ display: "flex", gap: 0.5, p: 0.5 }}>
                <Input
                    placeholder={t.chat.todoPane.newTagPlaceholder}
                    size="sm"
                    sx={{ flex: 1, ...TAG_FIELD_TOUCH_SX }}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void handleCreate();
                        }
                    }}
                />
                <IconButton
                    aria-label={t.chat.todoPane.addTag}
                    disabled={!newName.trim() || creating}
                    size="sm"
                    sx={{ borderRadius: g.radius.sm, ...TAG_ADD_TOUCH_SX }}
                    variant="soft"
                    onClick={() => void handleCreate()}
                >
                    <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Box>
            {onManageTags && (
                <>
                    <MenuDivider />
                    <MenuRow icon={<SettingsRoundedIcon />} onClick={onManageTags}>
                        {t.chat.todoPane.tags.manageMenu}
                    </MenuRow>
                </>
            )}
        </>
    );
};
