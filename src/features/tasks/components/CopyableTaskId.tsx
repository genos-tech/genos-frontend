import { Chip, ChipProps, Typography, TypographyProps } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation } from "../../../i18n";
import { formatTaskDisplayId } from "../utils/taskDisplayId";
import { useCopyState } from "./useCopyState";

// Shared by both variants — any object that the formatter can resolve
// a display ID from (TaskProps, TaskTableProps, ActivityMessageProps,
// ThreadProps, etc.).
type TaskLike = {
    displayId?: string | null;
    id?: number | string | null;
    taskId?: number | string | null;
};

// ─────────────────────────────────────────────────────────────────────
// Chip variant: used where the task ID is rendered as a Joy <Chip>.
// Drop-in replacement for `<Chip ...>{formatTaskDisplayId(task)}</Chip>`.
// ─────────────────────────────────────────────────────────────────────

type CopyableTaskIdChipProps = Omit<ChipProps, "onClick" | "children"> & {
    task: TaskLike | null | undefined;
    /** Rendered when the task has no resolvable ID (e.g. "N/A"). */
    fallback?: string;
};

export const CopyableTaskIdChip = ({
    task,
    fallback = "",
    sx,
    ...rest
}: CopyableTaskIdChipProps) => {
    const text = formatTaskDisplayId(task) || fallback;
    const { copied, onClick } = useCopyState();
    const { t } = useTranslation();
    return (
        <AppTooltip title={copied ? t.common.ui.copy.copied : t.common.ui.copy.clickToCopy}>
            <Chip
                {...rest}
                sx={[{ cursor: "pointer" }, ...(Array.isArray(sx) ? sx : [sx])]}
                onClick={onClick(text)}
            >
                {text}
            </Chip>
        </AppTooltip>
    );
};

// ─────────────────────────────────────────────────────────────────────
// Text variant: used where the task ID is rendered as inline <Typography>
// inside a clickable row/card (table rows, sprint board cards, dashboard
// lists). Keeps the original Typography styling but adds a hover cursor
// and click-to-copy.
// ─────────────────────────────────────────────────────────────────────

type CopyableTaskIdTextProps = Omit<TypographyProps, "onClick" | "children"> & {
    task: TaskLike | null | undefined;
    fallback?: string;
    /** Optional text rendered before the ID, kept outside the copied
     *  value. e.g. ThreadChatPaneHeader shows "Task GEN-42" — the prefix
     *  "Task " is visual only, the clipboard gets "GEN-42". */
    prefix?: string;
};

export const CopyableTaskIdText = ({
    task,
    fallback = "",
    prefix,
    sx,
    ...rest
}: CopyableTaskIdTextProps) => {
    const text = formatTaskDisplayId(task) || fallback;
    const { copied, onClick } = useCopyState();
    const { t } = useTranslation();
    return (
        <AppTooltip title={copied ? t.common.ui.copy.copied : t.common.ui.copy.clickToCopy}>
            <Typography
                {...rest}
                component="span"
                sx={[{ cursor: "pointer" }, ...(Array.isArray(sx) ? sx : [sx])]}
                onClick={onClick(text)}
            >
                {prefix}
                {text}
            </Typography>
        </AppTooltip>
    );
};
