import { Box, Button, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { TodoCategoryProps } from "../../../../types/chat";
import { ProjectTagChip } from "../../../tasks/components/ProjectTagChip";
import { NO_TAG, TagFilterKey } from "../../utils/todoTagFilter";
import { todoTagColor } from "./todoTagColor";

type Props = {
    categories: TodoCategoryProps[];
    selected: ReadonlySet<TagFilterKey>;
    onToggle: (key: TagFilterKey) => void;
    onClear: () => void;
    isDark: boolean;
};

/**
 * A row of the user's tags to filter the To-do pane by (MIP-584). Same chip
 * as the tag headers in the list; a picked one gets a ring in its colour, and
 * the others dim. Several can be picked (any of them), and "No tag" picks the
 * items without one.
 */
export const TodoTagFilterBar = ({ categories, selected, onToggle, onClear, isDark }: Props) => {
    const { t } = useTranslation();
    if (categories.length === 0) return null;

    const pick = (key: TagFilterKey, label: string, color: string) => {
        const on = selected.has(key);
        return (
            <Box
                key={String(key)}
                aria-pressed={on}
                component="button"
                type="button"
                sx={{
                    // A bare button: the chip inside carries the look.
                    all: "unset",
                    cursor: "pointer",
                    borderRadius: "8px",
                    opacity: selected.size === 0 || on ? 1 : 0.55,
                    boxShadow: on ? `0 0 0 2px ${color}` : "none",
                    transition: "opacity 0.15s ease, box-shadow 0.15s ease",
                    "&:hover": { opacity: 1 },
                    "&:focus-visible": { outline: "2px solid currentColor", outlineOffset: 2 },
                }}
                onClick={() => onToggle(key)}
            >
                <ProjectTagChip
                    fontSize="0.75rem"
                    isDark={isDark}
                    label={label}
                    tagColor={color}
                />
            </Box>
        );
    };

    return (
        <Stack
            alignItems="center"
            aria-label={t.chat.todoPane.tagFilterLabel}
            direction="row"
            role="group"
            sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}
        >
            {categories.map((c) => pick(c.categoryId, c.name, todoTagColor(c)))}
            {pick(NO_TAG, t.chat.todoPane.tagFilterNone, "#808080")}
            {selected.size > 0 && (
                <Button size="sm" sx={{ minHeight: 0, py: 0 }} variant="plain" onClick={onClear}>
                    <Typography level="body-xs">{t.chat.todoPane.tagFilterClear}</Typography>
                </Button>
            )}
        </Stack>
    );
};
