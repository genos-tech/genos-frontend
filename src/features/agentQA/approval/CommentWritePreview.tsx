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
//
// MIP-1562 (AGENT_PARITY_TOOLS): `update_comment` also reacts to or flags ANY
// comment, with `reaction` (+ `remove_reaction`) or `flag` instead of `body_text`.
// Those calls read "React 👍 to comment #3 on WRD-5" and so on, and quote whose
// comment it is: the backend adds `comment: {author, excerpt}` for a task the
// approver can read, as TEXT (the card never makes the excerpt a link).

import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, MetaChip } from "./previewHelpers";

type QuotedComment = { author?: string | null; excerpt?: string };

const quotedOf = (args: Record<string, unknown>): QuotedComment | undefined => {
    const quoted = args.comment;
    return quoted && typeof quoted === "object" ? (quoted as QuotedComment) : undefined;
};

/** The comment a reaction or a flag lands on: its author, then its first line. */
const CommentQuote = ({ quoted }: { quoted: QuotedComment }) => {
    if (!quoted.author && !quoted.excerpt) return null;
    return (
        <Box
            sx={{
                pl: 1.25,
                borderLeft: "2px solid",
                borderColor: g.border.subtle,
                fontSize: "0.8125rem",
                color: g.text.secondary,
                overflowWrap: "anywhere",
            }}
        >
            {quoted.author ? (
                <Typography level="body-xs" sx={{ color: g.text.secondary, fontWeight: 700 }}>
                    {quoted.author}
                </Typography>
            ) : null}
            {quoted.excerpt ? <Box sx={{ whiteSpace: "pre-wrap" }}>{quoted.excerpt}</Box> : null}
        </Box>
    );
};

const FLAG_HEADINGS = {
    done: "doneFlagComment",
    flag: "flagComment",
    unflag: "unflagComment",
} as const;

export const UpdateCommentPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const body = asString(args.body_text);
    const names = { comment: asString(args.comment_id) ?? "", task: asString(args.task_id) ?? "" };

    // A reaction or a flag, not an edit: not the caller's own comment, so no "your comment".
    const reaction = asString(args.reaction);
    const flag = asString(args.flag);
    const flagKey =
        flag && flag in FLAG_HEADINGS
            ? FLAG_HEADINGS[flag as keyof typeof FLAG_HEADINGS]
            : undefined;
    if (reaction || flagKey) {
        const heading = reaction
            ? fmt(
                  args.remove_reaction === true
                      ? t.agentApproval.removeReaction
                      : t.agentApproval.reactToComment,
                  {
                      ...names,
                      emoji: reaction,
                  }
              )
            : fmt(t.agentApproval[flagKey!], names);
        const Icon = reaction
            ? AddReactionOutlinedIcon
            : flag === "done"
              ? CheckCircleOutlineRoundedIcon
              : FlagRoundedIcon;
        const quoted = quotedOf(args);
        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                    <Icon sx={{ fontSize: 16, color: g.warning.text }} />
                    <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                        {heading}
                    </Typography>
                </Box>
                {quoted ? <CommentQuote quoted={quoted} /> : null}
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <EditRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {fmt(t.agentApproval.updateComment, names)}
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

export const DeleteCommentPreview = ({ args, undoKnown }: ApprovalPreviewProps) => {
    const { t } = useTranslation();

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
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
