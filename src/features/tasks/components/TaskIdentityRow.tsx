import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { TaskStatusProps } from "../../../types/tasks";
import { CopyableTaskIdChip } from "./CopyableTaskId";

/**
 * How a task identifies itself in a dropdown: a milestone flag, its
 * copyable display ID, its status, then the title.
 *
 * Extracted from the sidebar's task search so every task picker presents
 * the same row. The dependency picker used to draw its own variant, and
 * two dropdowns onto the same objects that look different read as two
 * different products — the same reason `ProjectIdentityRow` next door
 * exists.
 *
 * Presentational only. The caller supplies the option container (a Joy
 * `AutocompleteOption` wrapping a `ListItemContent`), which is what
 * brings the padding, hover and selected states.
 */

// Sources disagree on the ID field — search results carry `taskId`,
// table rows carry `id` — so accept whatever `formatTaskDisplayId` can
// resolve rather than making callers normalize first.
type TaskLike = {
    displayId?: string | null;
    id?: number | string | null;
    taskId?: number | string | null;
};

type TaskIdentityRowProps = {
    task: TaskLike;
    title: string | null;
    /** Resolved status meta. Callers whose row carries a bare status
     *  string resolve it against `taskMeta.statuses` first. */
    status: TaskStatusProps;
    isMilestone?: boolean | null;
};

// Statuses the backend hasn't colored still need a chip that reads as a
// chip rather than a transparent gap.
const FALLBACK_STATUS_COLOR = "#0044c2";

export const TaskIdentityRow = ({ task, title, status, isMilestone }: TaskIdentityRowProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const statusColor = status.color || FALLBACK_STATUS_COLOR;

    return (
        <Stack alignItems="center" direction="row" spacing={1}>
            {/* Milestone rows get the flag glyph on the far left — same
                orange as the header's "New Milestone" menu item. */}
            {isMilestone === true && (
                <FlagRoundedIcon sx={{ color: "#f97316", flexShrink: 0, fontSize: 16 }} />
            )}
            <CopyableTaskIdChip
                size="sm"
                task={task}
                variant="soft"
                sx={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    height: 20,
                    minHeight: 20,
                    borderRadius: "6px",
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                }}
            />
            <Chip
                size="sm"
                variant="soft"
                sx={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    height: 20,
                    minHeight: 20,
                    borderRadius: "6px",
                    backgroundColor: alpha(statusColor, isDark ? 0.35 : 0.6),
                    color: status.textColor || "#ffffff",
                    border: "1px solid",
                    borderColor: alpha(statusColor, isDark ? 0.4 : 0.25),
                }}
            >
                {status.status}
            </Chip>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 500,
                        color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                    }}
                    noWrap
                >
                    {title}
                </Typography>
            </Box>
        </Stack>
    );
};
