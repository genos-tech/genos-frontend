import { Dropdown, MenuButton } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { menuTriggerSx } from "../../../../components/ui/menu/menuStyles";
import { MenuSurface } from "../../../../components/ui/MoreMenu";
import { useTranslation } from "../../../../i18n";
import { TodoCategoryProps } from "../../../../types/chat";
import { ProjectTagChip } from "../../../tasks/components/ProjectTagChip";
import { useTodoDialogLayer } from "./TodoHostLayer";
import { DEFAULT_TODO_TAG_COLOR, todoTagColor } from "./todoTagColor";
import { TodoTagMenuRows } from "./TodoTagMenuRows";

type TodoTagChipProps = {
    categories: readonly TodoCategoryProps[];
    currentCategoryId: number | null;
    onSelectCategory: (categoryId: number | null) => void;
    onCreateCategory: (name: string) => Promise<TodoCategoryProps | undefined>;
    onManageTags?: () => void;
};

/**
 * The tag a to-do carries, as a chip on its row that opens the tag picker (MIP-1652).
 *
 * A to-do's tag could only be changed from the ⋮ menu, behind "Tag", and the row itself said
 * nothing about it. The chip shows the tag in its colour, or "General" (a neutral dot) when it
 * has none, and a click on it opens the same picker the ⋮ menu has: pick another tag, pick
 * General to clear it, make a new one, or go to Manage tags.
 */
export const TodoTagChip = ({
    categories,
    currentCategoryId,
    onSelectCategory,
    onCreateCategory,
    onManageTags,
}: TodoTagChipProps) => {
    const { t } = useTranslation();
    // Inside the to-do modal the menu opens above it (MIP-1047).
    const layer = useTodoDialogLayer();
    const category =
        currentCategoryId === null
            ? undefined
            : categories.find((c) => c.categoryId === currentCategoryId);
    const label = category?.name ?? t.chat.todoPane.general;
    const color = category ? todoTagColor(category) : DEFAULT_TODO_TAG_COLOR;
    return (
        <Dropdown>
            <AppTooltip title={t.chat.todoPane.changeTag}>
                <MenuButton
                    aria-label={`${t.chat.todoPane.changeTag}: ${label}`}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: "plain",
                            sx: {
                                ...menuTriggerSx,
                                flexShrink: 0,
                                // The chip is 20px; this is the room around it, and the floor a
                                // finger needs on a touch screen.
                                minHeight: 0,
                                minWidth: 0,
                                maxWidth: 150,
                                p: "2px",
                                "@media (pointer: coarse)": { minHeight: 36, px: 0.5 },
                            },
                        },
                    }}
                >
                    <ProjectTagChip isDark={false} label={label} tagColor={color} />
                </MenuButton>
            </AppTooltip>
            <MenuSurface placement="bottom-end" sx={{ minWidth: 200 }} zIndex={layer}>
                <TodoTagMenuRows
                    categories={categories}
                    currentCategoryId={currentCategoryId}
                    onCreateCategory={onCreateCategory}
                    onManageTags={onManageTags}
                    onSelectCategory={onSelectCategory}
                />
            </MenuSurface>
        </Dropdown>
    );
};
