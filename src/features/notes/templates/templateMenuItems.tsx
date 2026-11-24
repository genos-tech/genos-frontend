import type { PartialBlock } from "@blocknote/core";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import type { MoreMenuItem } from "../../../components/ui/MoreMenu";
import {
    buildNoteTemplate,
    isoDay,
    type NoteTemplateCopy,
    type NoteTemplateId,
} from "./noteTemplates";
import type { TeamNoteTemplate } from "./teamNoteTemplates";

// MIP-1697, MIP-2337. One place that turns "pick a template" into ONE menu row and into a
// title + blocks. Every "New note" menu (My Notes "+", folder "New note here", task and chat
// notes) shows the same single "New note from template…" row; it opens the picker modal, which
// lists the templates with a preview. The templates themselves never sit in a row menu.

export type TemplatePick =
    | { kind: "builtin"; id: NoteTemplateId }
    // A team template or the caller's own personal one: the server resolves both by id.
    | { kind: "team"; templateId: number };
export type ResolvedTemplate = { title: string; blocks: PartialBlock[] };

type Args = {
    copy: NoteTemplateCopy;
    idPrefix: string;
    // Opens the picker for the surface this menu belongs to.
    onOpenPicker: () => void;
    // The row that follows the blank-note row gets a divider above it.
    divider?: boolean;
};

export const buildTemplateMenuItems = ({
    copy,
    idPrefix,
    onOpenPicker,
    divider = false,
}: Args): MoreMenuItem[] => [
    {
        id: `${idPrefix}-tpl-picker`,
        kind: "newNoteFromTemplate" as const,
        label: copy.team.fromTemplate,
        icon: <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />,
        divider,
        onClick: onOpenPicker,
    },
];

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

/** A template's note title with `{date}` filled in. */
export const fillTemplateTitle = (title: string): string =>
    title.replace("{date}", isoDay(new Date()));

export const resolveTemplate = async (
    pick: TemplatePick,
    copy: NoteTemplateCopy,
    loadTeam?: (templateId: number) => Promise<TeamNoteTemplate | null>
): Promise<ResolvedTemplate | null> => {
    if (pick.kind === "builtin") return buildNoteTemplate(pick.id, copy);
    const tpl = await loadTeam?.(pick.templateId);
    if (!tpl) return null;
    return {
        title: fillTemplateTitle(tpl.title),
        blocks: tpl.body ?? [],
    };
};
