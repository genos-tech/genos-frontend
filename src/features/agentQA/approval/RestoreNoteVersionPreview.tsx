// Structured preview for a `restore_note_version` proposal: "Restore note
// <title> to version 3", and the sentence that says it can be undone. A
// restore puts an earlier version's title and body back, but the server keeps
// what the note says now as a version first, so the restore is itself
// undoable (which is why the tool is not one of the destructive ones on MCP).
//
// The backend adds `note_title` (the note's title) when the caller may read
// the note; `version_no` is the number from the note's history. A note with
// no title is named by its id, and a missing version reads as "an earlier
// version".

import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString } from "./previewHelpers";

export const RestoreNoteVersionPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const title = asString(args.note_title);
    const noteId = asString(args.note_id);
    const versionNo = asString(args.version_no);

    const version = versionNo
        ? fmt(t.agentApproval.versionNumber, { n: versionNo })
        : t.agentApproval.anEarlierVersion;
    const heading = title
        ? fmt(t.agentApproval.restoreNote, { note: title, version })
        : fmt(t.agentApproval.restoreNoteUnnamed, {
              note: noteId
                  ? fmt(t.agentApproval.thisNoteWithId, { id: noteId })
                  : t.agentApproval.thisNote,
              version,
          });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <RestoreRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {heading}
                </Typography>
            </Box>
            <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                {t.agentApproval.restoreNoteKeepsCurrent}
            </Typography>
        </Box>
    );
};
