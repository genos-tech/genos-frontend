import { useState } from "react";
import { Box, Chip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { useIsMobile } from "../../../../../hooks/common/useIsMobile";
import { useTranslation } from "../../../../../i18n";
import { capRowTags, RowTag } from "./capRowTags";

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

type TaskRowTagsProps = { taskId?: number; tags: RowTag[] };

export const TaskRowTags = ({ taskId, tags }: TaskRowTagsProps) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isPhone = useIsMobile();
    // On a phone a tap opens the list (a touch has no hover); on a laptop the tooltip's own
    // hover and focus handling does.
    const [tapOpen, setTapOpen] = useState(false);

    if (tags.length === 0) return null;
    const { shown, hidden } = capRowTags(tags, isPhone);
    const hiddenNames = hidden.map((tag) => tag.tagName).join(", ");
    const maxChipWidth = isPhone ? "96px" : "140px";

    return (
        <Box
            sx={{
                display: "flex",
                marginLeft: "auto",
                alignItems: "center",
                // The chips are capped; on a narrow row they shrink (ellipsis) before the title
                // goes below its minimum width.
                flexShrink: 1,
                minWidth: 0,
            }}
        >
            {shown.map(({ tagName, tagColor }, index) => (
                <Chip
                    key={`${taskId}-${index}-${tagName}`}
                    size="md"
                    variant="outlined"
                    sx={{
                        marginX: "2px",
                        maxWidth: maxChipWidth,
                        // Shrinks (ellipsis) on a narrow row, but never below a readable stub.
                        minWidth: "7ch",
                        color: mode === "dark" ? "white" : "black",
                        fontWeight: 600,
                        borderRadius: "5px",
                        borderWidth: "3px",
                        borderColor: alpha(tagColor, mode === "dark" ? 0.5 : 0.75),
                    }}
                >
                    {tagName}
                </Chip>
            ))}
            {hidden.length > 0 && (
                // Remount on a breakpoint change so Joy's Tooltip never flips between
                // controlled and uncontrolled.
                <AppTooltip
                    key={isPhone ? "tap" : "hover"}
                    maxWidth={240}
                    open={isPhone ? tapOpen : undefined}
                    placement="top-end"
                    title={hiddenNames}
                >
                    <Chip
                        color="neutral"
                        size="md"
                        variant="soft"
                        sx={{ marginX: "2px", fontWeight: 600, flexShrink: 0 }}
                        // The row is a button that opens the task: the "+N" chip must not
                        // also open it (a click or Enter on the action bubbles to here).
                        slotProps={{
                            action: {
                                // Joy points the action at the "+N" label, which would
                                // hide this aria-label; drop it so the label names the tags.
                                "aria-labelledby": undefined,
                                "aria-label": t.tasks.subTasks.moreTagsAria
                                    .replace("{count}", String(hidden.length))
                                    .replace("{tags}", hiddenNames),
                            },
                        }}
                        onBlur={() => setTapOpen(false)}
                        onKeyDown={stop}
                        onClick={(e: React.MouseEvent) => {
                            stop(e);
                            if (isPhone) setTapOpen((open) => !open);
                        }}
                    >
                        {`+${hidden.length}`}
                    </Chip>
                </AppTooltip>
            )}
        </Box>
    );
};
