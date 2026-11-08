import { Typography, TypographyProps } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation } from "../../../i18n";
import { focusRing } from "../../../theme/tokens";
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
                role="button"
                tabIndex={0}
                sx={[
                    { cursor: "pointer", "&:focus-visible": focusRing },
                    ...(Array.isArray(sx) ? sx : [sx]),
                ]}
                onClick={onClick(text)}
                onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
                    // The task id sits inside clickable rows and cards: Enter / Space
                    // copy it and stay here.
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onClick(text)(event);
                    }
                }}
            >
                {prefix}
                {text}
            </Typography>
        </AppTooltip>
    );
};
