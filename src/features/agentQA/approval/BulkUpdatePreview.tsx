// Structured preview for an `update_tasks_bulk` proposal: one row per
// task showing its display id + title, an old→new diff for every field
// the model proposes to change (the backend enriched each row with a
// `current` snapshot at emission time), and the model's per-task
// rationale underneath. A milestone move diffs like any other field: the
// backend labels both `current.milestone_id` and the proposed
// `milestone_id` with milestone titles (`''` = taken out of its milestone,
// shown as cleared; a null current = it was in none).

import type { ReactNode } from "react";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { placeValue } from "./previewHelpers";

const DIFF_FIELDS = [
    "priority",
    "effort_level",
    "status",
    "due_date",
    "milestone_id",
    "start_date",
    "tags",
] as const;
type DiffField = (typeof DIFF_FIELDS)[number];

interface BulkUpdateRow {
    task_id?: number | string;
    display_id?: string;
    title?: string;
    rationale?: string;
    current?: Partial<Record<DiffField, string | string[] | null>>;
    priority?: string;
    effort_level?: string;
    status?: string;
    due_date?: string;
    // A title, or the raw id when it didn't resolve.
    milestone_id?: string | number;
    // '' clears the start date.
    start_date?: string;
    // Tag names that replace the task's tags; [] clears them.
    tags?: string[];
}

interface BulkUpdatePreviewProps extends ApprovalPreviewProps {
    // Edit before approve: for a field this says is editable, `render` puts the
    // editor where the row's "old → new" line would be. A field it does not
    // claim keeps its line. Absent, the card is exactly the read-only preview.
    editor?: {
        has: (row: number, field: string) => boolean;
        render: (row: number, field: string) => ReactNode;
    };
}

export const BulkUpdatePreview = ({ args, editor }: BulkUpdatePreviewProps) => {
    const { t } = useTranslation();
    const updates = (Array.isArray(args.updates) ? args.updates : []) as BulkUpdateRow[];

    const renderValue = (v: string | number | string[] | null | undefined): string => {
        if (v === undefined) return t.agentApproval.unset;
        return placeValue(v, t.agentApproval.cleared);
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 0.75 }}>
            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
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
                            borderColor: g.border.subtle,
                        }}
                    >
                        <Typography
                            level="body-sm"
                            sx={{ fontWeight: 600, color: g.text.primary }}
                        >
                            {row.display_id ? `${row.display_id} ` : ""}
                            {row.title || `#${row.task_id ?? "?"}`}
                        </Typography>
                        {changes.length > 0 ? (
                            <Box
                                sx={
                                    editor
                                        ? {
                                              display: "grid",
                                              gridTemplateColumns: {
                                                  xs: "minmax(0, 1fr)",
                                                  sm: "repeat(2, minmax(0, 1fr))",
                                              },
                                              columnGap: 1.25,
                                              rowGap: 0.5,
                                              my: 0.5,
                                          }
                                        : {
                                              display: "flex",
                                              flexWrap: "wrap",
                                              columnGap: 1.5,
                                              rowGap: 0.15,
                                          }
                                }
                            >
                                {changes.map((field) =>
                                    editor?.has(i, field) ? (
                                        <Box key={field} sx={{ minWidth: 0 }}>
                                            {editor.render(i, field)}
                                        </Box>
                                    ) : (
                                        <Typography
                                            key={field}
                                            level="body-xs"
                                            sx={{ color: g.text.primary }}
                                        >
                                            {t.agentApproval.fieldLabels[field]}:{" "}
                                            <Box
                                                component="span"
                                                sx={{
                                                    textDecoration: "line-through",
                                                    color: g.text.secondary,
                                                }}
                                            >
                                                {renderValue(row.current?.[field])}
                                            </Box>
                                            {" → "}
                                            <Box component="span" sx={{ fontWeight: 600 }}>
                                                {renderValue(row[field])}
                                            </Box>
                                        </Typography>
                                    )
                                )}
                            </Box>
                        ) : (
                            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                {t.agentApproval.noChanges}
                            </Typography>
                        )}
                        {row.rationale ? (
                            <Typography
                                level="body-xs"
                                sx={{ color: g.text.secondary, fontStyle: "italic" }}
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
