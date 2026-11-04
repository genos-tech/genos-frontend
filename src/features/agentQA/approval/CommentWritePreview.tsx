// Structured previews for the two writes that change a comment the caller
// already made (MIP-880):
//
//   update_comment  "Replace your comment #3 on WRD-5" + the full new text
//   delete_comment  "Delete your comment #3 on WRD-5" + a can't-be-undone chip
//
// `task_id` arrives friendly-ized to the task's display id or name;
// `comment_id` is the comment's number on that task. Both tools act only on the
// caller's OWN comments, which is why the heading says "your comment". The new
// text is shown verbatim: it is the whole replacement, and an old → new diff
// would need the old text, which the pending event does not carry.

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, MetaChip } from "./previewHelpers";

export const UpdateCommentPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const body = asString(args.body_text);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <EditRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {fmt(t.agentApproval.updateComment, {
                        comment: asString(args.comment_id) ?? "",
                        task: asString(args.task_id) ?? "",
                    })}
                </Typography>
            </Box>

            {body ? (
                <Box
                    sx={{
                        maxHeight: 260,
                        overflowY: "auto",
                        pl: 1.25,
                        borderLeft: "2px solid",
                        borderColor: palette.borderMuted,
                        fontSize: "0.8125rem",
                        color: palette.textMuted,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                    }}
                >
                    {body}
                </Box>
            ) : null}
        </Box>
    );
};

export const DeleteCommentPreview = ({ args, isDark, undoKnown }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: palette.dangerTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {fmt(t.agentApproval.deleteComment, {
                        comment: asString(args.comment_id) ?? "",
                        task: asString(args.task_id) ?? "",
                    })}
                </Typography>
                {undoKnown ? null : <MetaChip label={t.agentApproval.cannotUndo} />}
            </Box>
        </Box>
    );
};
