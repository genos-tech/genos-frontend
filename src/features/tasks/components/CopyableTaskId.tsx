import { useState } from "react";
import { Chip, ChipProps, Typography, TypographyProps } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation } from "../../../i18n";
import { formatTaskDisplayId } from "../utils/taskDisplayId";

// Shared by both variants — any object that the formatter can resolve
// a display ID from (TaskProps, TaskTableProps, ActivityMessageProps,
// ThreadProps, etc.).
type TaskLike = {
    displayId?: string | null;
    id?: number | string | null;
    taskId?: number | string | null;
};

const COPIED_FEEDBACK_MS = 1200;

const useCopyState = () => {
    const [copied, setCopied] = useState(false);
    const onClick = (text: string) => (event: React.MouseEvent) => {
        // Task ID chips are routinely nested inside row click handlers
        // (open task, navigate to thread, etc.). Without stopPropagation
        // a click would both copy AND navigate, which is surprising.
        event.stopPropagation();
        if (!text) return;
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
            })
            .catch(() => {
                // Clipboard API rejected (insecure context, permissions
                // denied). Swallow — the chip is non-essential.
            });
    };
    return { copied, onClick };
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
                onClick={onClick(text)}
                sx={[{ cursor: "pointer" }, ...(Array.isArray(sx) ? sx : [sx])]}
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
                onClick={onClick(text)}
                sx={[{ cursor: "pointer" }, ...(Array.isArray(sx) ? sx : [sx])]}
            >
                {prefix}
                {text}
            </Typography>
        </AppTooltip>
    );
};
