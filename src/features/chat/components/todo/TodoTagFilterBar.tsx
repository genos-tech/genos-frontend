import { Box, Button, Stack, Typography } from "@mui/joy";

import { COMPACT_ROW, TOUCH_TARGET } from "../../../../components/ui/touchTargets";
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
    /** A phone header that has to be short: rows are `COMPACT_ROW` tall, the tap target stays 44px
     *  (an invisible hit area, not layout). */
    compact?: boolean;
};

/**
 * A row of the user's tags to filter the To-do pane by (MIP-584). Same chip
 * as the tag headers in the list; a picked one gets a ring in its colour, and
 * the others dim. Several can be picked (any of them), and "No tag" picks the
 * items without one.
 */
export const TodoTagFilterBar = ({
    categories,
    selected,
    onToggle,
    onClear,
    isDark,
    compact = false,
}: Props) => {
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
                    // A bare button: the chip inside carries the look. It is the tap
                    // target, so on a touch screen it is 44px tall around the chip
                    // (MIP-1319); the ring and the dimming stay on the chip.
                    all: "unset",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    "@media (pointer: coarse)": compact
                        ? {
                              justifyContent: "center",
                              minHeight: COMPACT_ROW,
                              position: "relative",
                              // The 44px band is a hit area, not layout.
                              "&::after": {
                                  content: '""',
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  width: `max(100%, ${TOUCH_TARGET}px)`,
                                  height: TOUCH_TARGET,
                                  transform: "translate(-50%, -50%)",
                              },
                          }
                        : {
                              justifyContent: "center",
                              minHeight: TOUCH_TARGET,
                              minWidth: TOUCH_TARGET,
                          },
                    "&:hover > [data-tag-chip]": { opacity: 1 },
                    "&:focus-visible": { outline: "2px solid currentColor", outlineOffset: 2 },
                }}
                onClick={() => onToggle(key)}
            >
                <Box
                    component="span"
                    data-tag-chip=""
                    sx={{
                        borderRadius: "8px",
                        display: "inline-flex",
                        opacity: selected.size === 0 || on ? 1 : 0.55,
                        boxShadow: on ? `0 0 0 2px ${color}` : "none",
                        transition: "opacity 0.15s ease, box-shadow 0.15s ease",
                    }}
                >
                    <ProjectTagChip
                        fontSize="0.75rem"
                        isDark={isDark}
                        label={label}
                        tagColor={color}
                    />
                </Box>
            </Box>
        );
    };

    return (
        <Stack
            alignItems="center"
            aria-label={t.chat.todoPane.tagFilterLabel}
            direction="row"
            role="group"
            sx={{ flexWrap: "wrap", gap: compact ? 0.5 : 0.75, mt: compact ? 0.25 : 1 }}
        >
            {categories.map((c) => pick(c.categoryId, c.name, todoTagColor(c)))}
            {pick(NO_TAG, t.chat.todoPane.tagFilterNone, "#808080")}
            {selected.size > 0 && (
                <Button
                    size="sm"
                    variant="plain"
                    sx={{
                        minHeight: 0,
                        py: 0,
                        "@media (pointer: coarse)": {
                            minHeight: compact ? COMPACT_ROW : TOUCH_TARGET,
                            minWidth: TOUCH_TARGET,
                        },
                    }}
                    onClick={onClear}
                >
                    <Typography level="body-xs">{t.chat.todoPane.tagFilterClear}</Typography>
                </Button>
            )}
        </Stack>
    );
};
