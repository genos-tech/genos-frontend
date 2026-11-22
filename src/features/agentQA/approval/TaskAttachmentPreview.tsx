// Structured preview for `delete_task_attachment` (MIP-1563, AGENT_PARITY_TOOLS):
// "Delete file budget.xlsx from WRD-5" + the file's size and type + the card's
// own "can't be undone" chip.
//
// The model names a file by two numbers (`task_id`, `attachment_id`), which say
// nothing to the person approving. The backend adds `current: {name, size_bytes,
// type}` for a file that is on a task the approver can open, and nothing for any
// other: an id that is not one of that task's files, or a task the approver may
// not read, shows only the numbers. Everything is printed as TEXT: the card
// never links to the file (the server does not send a link, and the file's name
// is text a person typed).
//
// Deleting a file removes it from the task and from storage for good, so there
// is nothing to put back: the card's `UndoChip` says so before the person
// approves (`undo_reason: irreversible_delete`). This preview adds its own chip
// only for a backend that sent no prediction (`undoKnown` false).

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { formatBytes } from "../../../utils/uploadLimits";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { MetaChip } from "./previewHelpers";
import { asString } from "./previewValues";

type CurrentFile = { name?: unknown; size_bytes?: unknown; type?: unknown };

const currentOf = (args: Record<string, unknown>): CurrentFile | undefined => {
    const current = args.current;
    return current && typeof current === "object" ? (current as CurrentFile) : undefined;
};

const nonEmpty = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v : undefined;

export const DeleteTaskAttachmentPreview = ({ args, undoKnown }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const current = currentOf(args);
    const name = nonEmpty(current?.name);
    const task = asString(args.task_id) ?? "";

    const fileId = asString(args.attachment_id);
    // Never a heading that names nothing: with neither the file's name nor its number, the tool's own
    // progress label ("Deleting a file from a task") is what is left.
    const heading = name
        ? fmt(t.agentApproval.deleteTaskAttachment, { file: name, task })
        : fileId
          ? fmt(t.agentApproval.deleteTaskAttachmentUnnamed, { id: fileId, task })
          : t.agentApproval.toolNames.delete_task_attachment;

    const chips: string[] = [];
    const size = current?.size_bytes;
    if (typeof size === "number" && Number.isFinite(size) && size >= 0)
        chips.push(formatBytes(size));
    const type = nonEmpty(current?.type);
    if (type) chips.push(type);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />
                <Typography
                    level="body-sm"
                    sx={{ fontWeight: 600, color: g.text.primary, overflowWrap: "anywhere" }}
                >
                    {heading}
                </Typography>
                {chips.map((c, i) => (
                    <MetaChip key={`${i}-${c}`} label={c} />
                ))}
                {undoKnown ? null : <MetaChip label={t.agentApproval.cannotUndo} />}
            </Box>
        </Box>
    );
};
