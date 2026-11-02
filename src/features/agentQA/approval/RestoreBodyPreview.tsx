// Structured preview for a `restore_task_body` proposal (MIP-880): "Restore
// the previous description of WRD-5", the history entry it goes back to, and
// the sentence the in-app Restore button's confirm shows. A restore replaces
// the description as it is now, but the server keeps that text, so it can
// itself be undone.
//
// `task_id` arrives friendly-ized to the task's display id or name;
// `activity_id` is the history entry that kept the body it replaced.

import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, MetaChip } from "./previewHelpers";

export const RestoreTaskBodyPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const entry = asString(args.activity_id);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <RestoreRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {fmt(t.agentApproval.restoreTaskBody, { task: asString(args.task_id) ?? "" })}
                </Typography>
                {entry ? <MetaChip label={fmt(t.agentApproval.historyEntry, { entry })} /> : null}
            </Box>
            <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                {t.agentApproval.restoreKeepsCurrent}
            </Typography>
        </Box>
    );
};
