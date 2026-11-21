import type { PartialBlock } from "@blocknote/core";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import type { MoreMenuItem } from "../../../components/ui/MoreMenu";
import {
    buildNoteTemplate,
    isoDay,
    NOTE_TEMPLATE_IDS,
    type NoteTemplateCopy,
    type NoteTemplateId,
} from "./noteTemplates";
import type { TeamNoteTemplate } from "./teamNoteTemplates";

// MIP-1697. One place that turns "the templates a person can pick" into menu rows and into a
// title + blocks, so every "New note" menu (My Notes "+", folder "New note here", task and chat
// notes) offers the same list and creates the same way.

export type TemplatePick =
    | { kind: "builtin"; id: NoteTemplateId }
    | { kind: "team"; templateId: number };
export type ResolvedTemplate = { title: string; blocks: PartialBlock[] };

type Args = {
    copy: NoteTemplateCopy;
    idPrefix: string;
    onPick: (pick: TemplatePick) => void;
    // The team's own templates, listed after the built-ins.
    teamTemplates?: TeamNoteTemplate[];
    // Adds a last "Manage templates…" row.
    onManage?: () => void;
    // The row that follows the blank-note row gets a divider above it.
    divider?: boolean;
};

export const buildTemplateMenuItems = ({
    copy,
    idPrefix,
    onPick,
    divider = false,
    teamTemplates = [],
    onManage,
}: Args): MoreMenuItem[] => {
    const builtin: MoreMenuItem[] = NOTE_TEMPLATE_IDS.map((id, i) => ({
        id: `${idPrefix}-tpl-${id}`,
        kind: "newNoteFromTemplate" as const,
        label: copy[id].label,
        icon: <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />,
        divider: divider && i === 0,
        onClick: () => onPick({ kind: "builtin", id }),
    }));
    const team: MoreMenuItem[] = teamTemplates.map((tpl) => ({
        id: `${idPrefix}-tpl-team-${tpl.templateId}`,
        kind: "newNoteFromTemplate" as const,
        label: tpl.name,
        icon: <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />,
        onClick: () => onPick({ kind: "team", templateId: tpl.templateId }),
    }));
    const manage: MoreMenuItem[] = onManage
        ? [
              {
                  id: `${idPrefix}-tpl-manage`,
                  kind: "manageTemplates" as const,
                  label: copy.team.manage,
                  icon: <TuneRoundedIcon sx={{ fontSize: 16 }} />,
                  onClick: onManage,
              },
          ]
        : [];
    return [...builtin, ...team, ...manage];
};

/** The template a new note in a team folder starts from, if the folder has a default and that
 *  template still exists in the team's list (a stale id from a cached folder row is ignored). */
export const defaultTemplatePick = (
    folder: { defaultTemplateId?: number | null },
    teamTemplates: TeamNoteTemplate[]
): TemplatePick | null =>
    folder.defaultTemplateId != null &&
    teamTemplates.some((tpl) => tpl.templateId === folder.defaultTemplateId)
        ? { kind: "team", templateId: folder.defaultTemplateId }
        : null;

export const resolveTemplate = async (
    pick: TemplatePick,
    copy: NoteTemplateCopy,
    loadTeam?: (templateId: number) => Promise<TeamNoteTemplate | null>
): Promise<ResolvedTemplate | null> => {
    if (pick.kind === "builtin") return buildNoteTemplate(pick.id, copy);
    const tpl = await loadTeam?.(pick.templateId);
    if (!tpl) return null;
    return {
        title: tpl.title.replace("{date}", isoDay(new Date())),
        blocks: tpl.body ?? [],
    };
};
