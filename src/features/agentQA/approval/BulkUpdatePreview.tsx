// Structured preview for an `update_tasks_bulk` proposal: one row per
// task showing its display id + title, an old→new diff for every field
// the model proposes to change (the backend enriched each row with a
// `current` snapshot at emission time), and the model's per-task
// rationale underneath.

import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";

const DIFF_FIELDS = ["priority", "effort_level", "status", "due_date"] as const;
type DiffField = (typeof DIFF_FIELDS)[number];

interface BulkUpdateRow {
    task_id?: number | string;
    display_id?: string;
    title?: string;
    rationale?: string;
    current?: Partial<Record<DiffField, string | null>>;
    priority?: string;
    effort_level?: string;
    status?: string;
    due_date?: string;
}

export const BulkUpdatePreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const updates = (Array.isArray(args.updates) ? args.updates : []) as BulkUpdateRow[];

    const renderValue = (v: string | null | undefined): string => {
        if (v === "" || v === null) return t.agentApproval.cleared;
        if (v === undefined) return t.agentApproval.unset;
        return v;
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 0.75 }}>
            <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                {fmt(t.agentApproval.updatesHeader, { count: updates.length })}
            </Typography>
            {updates.map((row, i) => {
                const changes = DIFF_FIELDS.filter((f) => row[f] !== undefined && row[f] !== null);
                return (
                    <Box
                        // Rows are identified by their target task.
                        key={row.task_id ?? i}
                        sx={{
                            pl: 1,
                            borderLeft: "2px solid",
                            borderColor: palette.borderMuted,
                        }}
                    >
                        <Typography level="body-sm" sx={{ fontWeight: 600, color: palette.text }}>
                            {row.display_id ? `${row.display_id} ` : ""}
                            {row.title || `#${row.task_id ?? "?"}`}
                        </Typography>
                        {changes.length > 0 ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    columnGap: 1.5,
                                    rowGap: 0.15,
                                }}
                            >
                                {changes.map((field) => (
                                    <Typography
                                        key={field}
                                        level="body-xs"
                                        sx={{ color: palette.text }}
                                    >
                                        {t.agentApproval.fieldLabels[field]}:{" "}
                                        <Box
                                            component="span"
                                            sx={{
                                                textDecoration: "line-through",
                                                color: palette.textMuted,
                                            }}
                                        >
                                            {renderValue(row.current?.[field])}
                                        </Box>
                                        {" → "}
                                        <Box component="span" sx={{ fontWeight: 600 }}>
                                            {renderValue(row[field])}
                                        </Box>
                                    </Typography>
                                ))}
                            </Box>
                        ) : (
                            <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                                {t.agentApproval.noChanges}
                            </Typography>
                        )}
                        {row.rationale ? (
                            <Typography
                                level="body-xs"
                                sx={{ color: palette.textMuted, fontStyle: "italic" }}
                            >
                                {row.rationale}
                            </Typography>
                        ) : null}
                    </Box>
                );
            })}
        </Box>
    );
};
