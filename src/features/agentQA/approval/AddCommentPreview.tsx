// Structured preview for an `add_comment` proposal: a "Comment on WRD-5"
// header (task_id arrives friendly-ized to the task's display id) above the
// proposed comment body. The body is plain text (the tool takes no markdown
// and no mentions), so it renders verbatim rather than parsed.

import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";

const asString = (v: unknown): string | undefined =>
    typeof v === "string" || typeof v === "number" ? String(v) : undefined;

export const AddCommentPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();

    const taskLabel = asString(args.task_id);
    const body = asString(args.body_text);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {fmt(t.agentApproval.commentOn, { task: taskLabel ?? "" })}
                </Typography>
            </Box>

            {body ? (
                <Box
                    sx={{
                        maxHeight: 260,
                        overflowY: "auto",
                        pl: 1.25,
                        borderLeft: "2px solid",
                        borderColor: g.border.subtle,
                        fontSize: "0.8125rem",
                        color: g.text.secondary,
                        // Plain text (not markdown) — preserve line breaks.
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
