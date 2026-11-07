// Structured preview for `delete_project`, which exists in the app only (it is
// never published over MCP). It deletes a project for good and cascades: its
// tasks, milestones, sprints, members and tags go with it, and there is no
// undo. Only the project's owner may.
//
// The list of what is destroyed is the page's own delete dialog's
// (`ModalDeleteProject`), read from the same `tasks.modals.deleteProject`
// strings, so the two can never say different things about the same delete.
//
// The backend labels `project_id` with the project's name when the caller may
// read it, and leaves a raw id otherwise. `project_name` is the model's echo
// of the name; the tool refuses unless it matches the real name exactly. The
// card prints the echo as typed, under the heading, and says so in red when it
// differs from the name the id resolved to, so the person sees which project
// is meant and whether the model has the right one.

import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { ApprovalPreviewProps } from "./approvalRenderers";
import { asString } from "./previewHelpers";

export const DeleteProjectPreview = ({ args, undoKnown }: ApprovalPreviewProps) => {
    const { t } = useTranslation();
    const destroyed = t.tasks.modals.deleteProject;

    const byId = asString(args.project_id);
    const idText = byId?.trim();
    // Digits only is the raw id the backend left alone, not a name. A name is
    // kept exactly as the backend sent it, so it compares with the echo as is.
    const resolved = idText && !/^\d+$/.test(idText) ? byId : undefined;
    // Not trimmed or tidied: "shown as typed" is the point of the echo.
    const given = asString(args.project_name);

    // The heading names the project by what the id resolved to; failing that,
    // by the echoed name; failing that, by its id, or by a neutral phrase.
    const named = resolved ?? given;
    const heading = named
        ? fmt(t.agentApproval.deleteProject, { project: named })
        : fmt(t.agentApproval.deleteProjectUnnamed, {
              project: idText
                  ? fmt(t.agentApproval.thisProjectWithId, { id: idText })
                  : t.agentApproval.thisProject,
          });
    // The echo is its own line only when the heading did not already print it.
    const showGiven = resolved !== undefined && given !== undefined;
    const differs = showGiven && given !== resolved;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: g.danger.text }} />
                <Typography level="body-sm" sx={{ fontWeight: 700, color: g.text.primary }}>
                    {heading}
                </Typography>
            </Box>

            {showGiven ? (
                <Typography
                    level="body-xs"
                    sx={{ color: differs ? g.danger.text : g.text.secondary }}
                >
                    {fmt(t.agentApproval.projectNameGiven, { name: given })}
                </Typography>
            ) : null}
            {differs ? (
                <Typography level="body-xs" sx={{ color: g.danger.text, fontWeight: 600 }}>
                    {t.agentApproval.projectNameDiffers}
                </Typography>
            ) : null}

            <Box
                sx={{
                    p: 1,
                    borderRadius: "8px",
                    background: g.danger.subtle,
                    border: `1px solid ${g.danger.border}`,
                }}
            >
                <Typography
                    level="body-xs"
                    sx={{ color: g.danger.text, fontWeight: 700, mb: 0.5 }}
                >
                    {destroyed.destroyedTitle}
                </Typography>
                <Box
                    component="ul"
                    sx={{
                        listStyle: "disc",
                        pl: 2.5,
                        m: 0,
                        "& li": { color: g.text.primary, fontSize: "0.75rem", lineHeight: 1.6 },
                    }}
                >
                    <li>{destroyed.destroyedMilestones}</li>
                    <li>{destroyed.destroyedTasks}</li>
                    <li>{destroyed.destroyedSprints}</li>
                    <li>{destroyed.destroyedMembersTags}</li>
                </Box>
                <Typography level="body-xs" sx={{ color: g.text.secondary, mt: 0.75 }}>
                    {destroyed.chatNote}
                </Typography>
            </Box>
            {undoKnown ? null : (
                <Typography level="body-xs" sx={{ color: g.danger.text, fontWeight: 600 }}>
                    {t.agentApproval.cannotUndo}
                </Typography>
            )}
        </Box>
    );
};
