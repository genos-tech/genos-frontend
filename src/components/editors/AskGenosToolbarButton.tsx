import "@blocknote/mantine/style.css";

import { useBlockNoteEditor, useComponentsContext } from "@blocknote/react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

import { makeAskSelection } from "../../features/agentQA/askSelection";
import type { AgentMentionRef } from "../../features/agentQA/mentions/types";
import { requestAskGenosAboutSelection } from "../../features/spotlight/askGenosAbout";
import { useTranslation } from "../../i18n";

/**
 * "Ask Genos about the selected text" on the formatting toolbar that floats over a selection in a
 * document (MIP-1058). The text is what is selected in THIS editor; `source` says what it was
 * selected from (the note), so the server can read the note around the passage with the asker's own
 * access. Nothing is sent from here: the passage is attached to a question the member types in
 * Spotlight.
 */
export const AskGenosToolbarButton = ({ source }: { source: AgentMentionRef | null }) => {
    const Components = useComponentsContext()!;
    const editor = useBlockNoteEditor<any, any, any>();
    const { t } = useTranslation();

    return (
        <Components.FormattingToolbar.Button
            label={t.common.editor.askGenosSelection}
            mainTooltip={t.common.editor.askGenosSelection}
            onClick={() => {
                const selection = makeAskSelection(editor.getSelectedText(), source);
                if (selection) requestAskGenosAboutSelection(selection);
            }}
        >
            <AutoAwesomeRoundedIcon sx={{ fontSize: "17px" }} />
        </Components.FormattingToolbar.Button>
    );
};
