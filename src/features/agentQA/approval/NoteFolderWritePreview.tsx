// Structured previews for the two note-folder writes:
//
//   manage_note_folder  one tool, an `action`: create a folder (its name, the
//                       space it goes in and the folder it sits inside) or
//                       rename one. It cannot move or delete a folder.
//   favorite_note       star or unstar a note, or a note folder, in the
//                       person's own sidebar. Nothing else changes.
//
// The backend labels `folder_id` and `parent_folder_id` (the folder's name)
// and, on favorite_note, adds `note_title` (the note's title). A label is
// printed only for what the caller may read, so a folder can still arrive as a
// raw id, and the card cannot tell the two apart: it prints whatever came. A
// rename's `folder_id` is the folder's CURRENT name and `name` is the new one.
// The event carries no snapshot of anything else.

import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, MetaChip } from "./previewHelpers";

// The API stars unless `favorite` says otherwise, so a missing value reads as
// star. Only a false boolean or the string "false" is an unstar.
const isUnstar = (v: unknown): boolean =>
    v === false || (typeof v === "string" && v.trim().toLowerCase() === "false");

export const ManageNoteFolderPreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const isRename = asString(args.action) === "rename";
    const name = asString(args.name) ?? "";

    if (isRename) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                    <EditRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                    <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                        {fmt(t.agentApproval.renameNoteFolder, {
                            folder: asString(args.folder_id) || t.agentApproval.thisFolder,
                            name,
                        })}
                    </Typography>
                </Box>
            </Box>
        );
    }

    // Where a new folder goes. The API makes it in My Notes unless `space`
    // says "team", but a folder inside another folder lands in that folder's
    // space, and the card cannot tell which that is: with a parent and no
    // `space` it names the parent alone. A space it doesn't know is printed
    // as it arrived and never read as My Notes.
    const parent = asString(args.parent_folder_id);
    const space = asString(args.space)?.trim().toLowerCase();
    const chips: string[] = [];
    if (space === "team") chips.push(t.agentApproval.noteSpaceTeam);
    else if (space === "personal" || (!space && !parent)) {
        chips.push(t.agentApproval.noteSpaceMine);
    } else if (space) chips.push(space);
    if (parent) chips.push(fmt(t.agentApproval.insideNoteFolder, { folder: parent }));

    // A top-level Team Notes folder is created private to its creator, and the
    // tool has no way to share it.
    const teamPrivate = space === "team" && !parent;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <CreateNewFolderRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {fmt(t.agentApproval.newNoteFolder, { name })}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>
            {teamPrivate ? (
                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                    {t.agentApproval.noteFolderTeamPrivate}
                </Typography>
            ) : null}
        </Box>
    );
};

export const FavoriteNotePreview = ({ args }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const unstar = isUnstar(args.favorite);

    // The note's title when the caller may read the note, else the folder
    // (its name, or its raw id), else the raw id of a note the caller can't
    // read. With none of them the card still says which kind it is.
    const noteId = asString(args.note_id);
    const item =
        asString(args.note_title) ||
        asString(args.folder_id) ||
        (noteId ? fmt(t.agentApproval.thisNoteWithId, { id: noteId }) : null) ||
        (asString(args.note_type) ? t.agentApproval.thisNote : t.agentApproval.thisFolder);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                {unstar ? (
                    <StarOutlineRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                ) : (
                    <StarRoundedIcon sx={{ fontSize: 16, color: g.warning.text }} />
                )}
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {fmt(unstar ? t.agentApproval.removeFavorite : t.agentApproval.addFavorite, {
                        item,
                    })}
                </Typography>
            </Box>
        </Box>
    );
};
