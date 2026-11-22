import type { PartialBlock } from "@blocknote/core";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import type { MoreMenuItem } from "../../../components/ui/MoreMenu";
import {
    buildNoteTemplate,
    NOTE_TEMPLATE_IDS,
    type NoteTemplateCopy,
    type NoteTemplateId,
} from "./noteTemplates";

// MIP-1697. One place that turns "the templates a person can pick" into menu rows and into a
// title + blocks, so every "New note" menu (My Notes "+", folder "New note here", task and chat
// notes) offers the same list and creates the same way.

export type TemplatePick = { kind: "builtin"; id: NoteTemplateId };
export type ResolvedTemplate = { title: string; blocks: PartialBlock[] };

type Args = {
    copy: NoteTemplateCopy;
    idPrefix: string;
    onPick: (pick: TemplatePick) => void;
    // The row that follows the blank-note row gets a divider above it.
    divider?: boolean;
};

export const buildTemplateMenuItems = ({
    copy,
    idPrefix,
    onPick,
    divider = false,
}: Args): MoreMenuItem[] =>
    NOTE_TEMPLATE_IDS.map((id, i) => ({
        id: `${idPrefix}-tpl-${id}`,
        kind: "newNoteFromTemplate" as const,
        label: copy[id].label,
        icon: <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />,
        divider: divider && i === 0,
        onClick: () => onPick({ kind: "builtin", id }),
    }));

export const resolveTemplate = async (
    pick: TemplatePick,
    copy: NoteTemplateCopy
): Promise<ResolvedTemplate | null> => buildNoteTemplate(pick.id, copy);
