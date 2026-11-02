// Structured previews for the two project writes:
//
//   manage_project          one tool, an `action`: create a project (name,
//                           private or public, the people added besides the
//                           creator) or change one (only the fields being
//                           changed: its name and its code)
//   manage_project_members  one tool, an `action`: add a teammate to a project,
//                           or change a member's role (editor or viewer)
//
// The backend labels `project_id` (project name) and `user_id` (the person's
// name). A label is printed only for what the caller may read, so either can
// still be a raw id. `member_ids` arrives as a list already mapped to names
// where the viewer may see the person and left as ids elsewhere, so it can mix
// both: the card shows a count and then whatever strings arrived, and never
// looks anything up. Only the fields the model sent are listed, so an update
// reads as exactly what it changes. The event carries no snapshot of the
// present values, so an update shows the new value alone.

import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString, MetaChip, placeValue } from "./previewHelpers";

const UPDATE_FIELDS = ["name", "code"] as const;

export const ManageProjectPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const isUpdate = asString(args.action) === "update";
    const labels = t.agentApproval.projectFieldLabels;

    const chips: string[] = [];
    let people: string[] = [];

    if (isUpdate) {
        for (const field of UPDATE_FIELDS) {
            const proposed = args[field];
            if (proposed === undefined || proposed === null) continue;
            chips.push(`${labels[field]}: ${placeValue(proposed, t.agentApproval.cleared)}`);
        }
    } else {
        // Only a boolean the model actually sent: with none, the card does not
        // guess what the project will be.
        if (args.is_private === true) chips.push(t.agentApproval.projectPrivate);
        else if (args.is_private === false) chips.push(t.agentApproval.projectPublic);
        if (Array.isArray(args.member_ids)) people = args.member_ids.map(String);
    }

    const name = asString(args.name);
    const heading = isUpdate
        ? fmt(t.agentApproval.updateProject, { project: asString(args.project_id) ?? "" })
        : t.agentApproval.newProject;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                {isUpdate ? (
                    <EditRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                ) : (
                    <CreateNewFolderRoundedIcon
                        sx={{ fontSize: 16, color: palette.warningTint }}
                    />
                )}
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {heading}
                </Typography>
                {chips.map((c) => (
                    <MetaChip key={c} label={c} />
                ))}
            </Box>

            {!isUpdate && name ? (
                <Typography level="body-sm" sx={{ fontWeight: 600, color: palette.text }}>
                    {name}
                </Typography>
            ) : null}

            {people.length > 0 ? (
                <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                    {fmt(t.agentApproval.projectPeopleAdded, {
                        count: people.length,
                        people: people.join(", "),
                    })}
                </Typography>
            ) : null}

            {isUpdate && args.code !== undefined && args.code !== null ? (
                <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                    {t.agentApproval.projectCodeHint}
                </Typography>
            ) : null}
        </Box>
    );
};

export const ManageProjectMembersPreview = ({ args, isDark }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const isSetRole = asString(args.action) === "set_role";
    const role = asString(args.role);
    const vars = {
        person: asString(args.user_id) ?? "",
        project: asString(args.project_id) ?? "",
    };

    // An unknown or missing role never reads as either of the two it can be.
    let heading: string;
    if (!isSetRole) heading = fmt(t.agentApproval.addProjectMember, vars);
    else if (role === "editor") heading = fmt(t.agentApproval.makeProjectEditor, vars);
    else if (role === "viewer") heading = fmt(t.agentApproval.makeProjectViewer, vars);
    else heading = fmt(t.agentApproval.changeProjectRole, vars);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                {isSetRole ? (
                    <ManageAccountsRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                ) : (
                    <PersonAddAltRoundedIcon sx={{ fontSize: 16, color: palette.warningTint }} />
                )}
                <Typography level="body-sm" sx={{ fontWeight: 700, color: palette.text }}>
                    {heading}
                </Typography>
                {isSetRole && role && role !== "editor" && role !== "viewer" ? (
                    <MetaChip label={role} />
                ) : null}
            </Box>
            {!isSetRole ? (
                <Typography level="body-xs" sx={{ color: palette.textMuted }}>
                    {t.agentApproval.projectMemberGetsChat}
                </Typography>
            ) : null}
        </Box>
    );
};
