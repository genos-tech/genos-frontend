import type { Messages } from "../../../i18n/types";
import type { RuleMoveNotice } from "../../../types/chat";

type RuleMoveCopy = Messages["chat"]["ruleMoveNotice"];

/**
 * The chat list's one-line form of a project rule's move (MIP-2535), in the viewer's language.
 *
 * It names neither the task nor the project, for anybody: the new project may have fewer readers
 * than the old chat, and the preview asks the server nothing. The chat's own line
 * (`RuleMoveNoticeRow`) names them to who may open them. The rule's name is the old project's.
 */
export const ruleMovePreviewText = (notice: RuleMoveNotice, copy: RuleMoveCopy): string => {
    // The template is filled BEFORE the rule's name goes in, so a name cannot add a placeholder.
    const line = copy.line
        .replace("{task}", notice.milestone ? copy.aMilestone : copy.aTask)
        .replace("{project}", copy.anotherProject);
    // First-strong isolate: a name written in the other direction stays one run.
    return line.split("{rule}").join(`⁨${notice.ruleName}⁩`);
};
