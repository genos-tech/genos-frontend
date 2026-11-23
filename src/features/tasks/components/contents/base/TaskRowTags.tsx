import { useEffect, useRef, useState } from "react";
import { Box, Chip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { useIsMobile } from "../../../../../hooks/common/useIsMobile";
import { useIsTouch } from "../../../../../hooks/common/useIsTouch";
import { useTranslation } from "../../../../../i18n";
import { capRowTags, RowTag } from "./capRowTags";

type TaskRowTagsProps = { taskId?: number; tags: RowTag[] };

/**
 * The capped tag chips of a task row (MIP-2176). Sits inside the row's button; the "+N" chip for
 * the rest is `TaskRowMoreTags`, a SIBLING of that button (a button inside a button is not
 * valid for assistive tech).
 */
export const TaskRowTags = ({ taskId, tags }: TaskRowTagsProps) => {
    const { mode } = useColorScheme();
    const isPhone = useIsMobile();
    if (tags.length === 0) return null;
    const { shown } = capRowTags(tags, isPhone);
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
                        // Shrinks (ellipsis) on a narrow row, but never below a readable stub
                        // (and never wider than a short tag's own text).
                        minWidth: "min(7ch, max-content)",
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
        </Box>
    );
};

/** The "+N" chip: the tags that did not fit, listed on hover/focus, or on a tap on a touch screen. */
export const TaskRowMoreTags = ({ tags }: { tags: RowTag[] }) => {
    const { t } = useTranslation();
    const isPhone = useIsMobile();
    // A touch screen has no hover: a tap opens the list. Keyed on the input device, not the
    // width, so a narrow desktop window keeps hover and focus.
    const isTouch = useIsTouch();
    const [tapOpen, setTapOpen] = useState(false);
    useEffect(() => setTapOpen(false), [isTouch]);
    // A tap anywhere else closes the list (a touch has no mouse-leave to do it).
    const wrapRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!tapOpen) return;
        const onOutside = (e: Event) => {
            if (!wrapRef.current?.contains(e.target as Node)) setTapOpen(false);
        };
        document.addEventListener("click", onOutside);
        return () => document.removeEventListener("click", onOutside);
    }, [tapOpen]);

    const { hidden } = capRowTags(tags, isPhone);
    if (hidden.length === 0) return null;
    const hiddenNames = hidden.map((tag) => tag.tagName).join(", ");

    return (
        <Box
            ref={wrapRef}
            sx={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: "4px" }}
        >
            {/* Remount when the input device changes so Joy's Tooltip never flips between
                    controlled and uncontrolled. */}
            <AppTooltip
                key={isTouch ? "tap" : "hover"}
                maxWidth={240}
                open={isTouch ? tapOpen : undefined}
                placement="top-end"
                title={hiddenNames}
            >
                <Chip
                    color="neutral"
                    size="md"
                    sx={{ marginX: "2px", fontWeight: 600 }}
                    variant="soft"
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
                    onClick={() => {
                        if (isTouch) setTapOpen((open) => !open);
                    }}
                >
                    {`+${hidden.length}`}
                </Chip>
            </AppTooltip>
        </Box>
    );
};
