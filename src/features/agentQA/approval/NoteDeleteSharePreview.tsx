// Structured previews for the three note writes that cannot be taken back or
// that change who has access:
//
//   delete_note          a note, its version history and its search entries,
//                        for good. Only its author or owner, never a note that
//                        has sub-notes.
//   delete_note_folder   a folder. Refused when it holds notes or folders
//                        unless `include_contents` is true, which deletes
//                        everything inside it for good.
//   manage_note_sharing  one tool, an `action`: share a note with a teammate
//                        as an editor or a viewer, or stop sharing it. The
//                        person is not told.
//
// The backend adds `note_title` (the note's title) on the note tools, labels
// `folder_id` with the folder's name and `user_id` with the person's name.
// A label is printed only for what the caller may read, so a folder or a
// person can still arrive as a raw id, and the card cannot tell the two apart:
// it prints whatever came. A note the caller may not read has no `note_title`,
// so it is named by its id.

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, MetaChip } from "./previewHelpers";

// Anything but a true boolean or the string "true" is false, the tool's default.
const isTrue = (v: unknown): boolean =>
    v === true || (typeof v === "string" && v.trim().toLowerCase() === "true");

export const DeleteNotePreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const title = asString(args.note_title);
    const noteId = asString(args.note_id);

    // A title reads "Delete note <title>"; without one the note is named by its
    // id, or "this note" when even that is missing.
    const heading = title
        ? fmt(t.agentApproval.deleteNote, { note: title })
        : fmt(t.agentApproval.deleteNoteUnnamed, {
              note: noteId
                  ? fmt(t.agentApproval.thisNoteWithId, { id: noteId })
                  : t.agentApproval.thisNote,
          });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {heading}
                </Typography>
            </Box>
            <Typography level="body-xs" sx={{ color: g.danger.text }}>
                {t.agentApproval.deleteNoteWarning}
            </Typography>
        </Box>
    );
};

export const DeleteNoteFolderPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const folder = asString(args.folder_id);
    const includeContents = isTrue(args.include_contents);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {folder
                        ? fmt(t.agentApproval.deleteNoteFolder, { folder })
                        : t.agentApproval.deleteThisNoteFolder}
                </Typography>
            </Box>
            {includeContents ? (
                <Typography level="body-xs" sx={{ color: g.danger.text }}>
                    {t.agentApproval.deleteNoteFolderContents}
                </Typography>
            ) : (
                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                    {t.agentApproval.deleteNoteFolderOnlyEmpty}
                </Typography>
            )}
        </Box>
    );
};

export const ManageNoteSharingPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const isUnshare = asString(args.action) === "unshare";
    const role = asString(args.role);
    const noteId = asString(args.note_id);
    const vars = {
        note:
            asString(args.note_title) ||
            (noteId
                ? fmt(t.agentApproval.thisNoteWithId, { id: noteId })
                : t.agentApproval.thisNote),
        person: asString(args.user_id) || t.agentApproval.thisPerson,
    };

    // An unknown or missing role never reads as either of the two it can be.
    let heading: string;
    if (isUnshare) heading = fmt(t.agentApproval.unshareNote, vars);
    else if (role === "editor") heading = fmt(t.agentApproval.shareNoteAsEditor, vars);
    else if (role === "viewer") heading = fmt(t.agentApproval.shareNoteAsViewer, vars);
    else heading = fmt(t.agentApproval.shareNote, vars);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                {isUnshare ? (
                    <PersonRemoveRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                ) : (
                    <PersonAddAltRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                )}
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {heading}
                </Typography>
                {!isUnshare && role && role !== "editor" && role !== "viewer" ? (
                    <MetaChip label={role} />
                ) : null}
            </Box>
            {!isUnshare ? (
                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                    {t.agentApproval.noteShareNotNotified}
                </Typography>
            ) : null}
        </Box>
    );
};
