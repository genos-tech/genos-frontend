import { useMemo } from "react";
import { useColorScheme } from "@mui/joy/styles";

import { useUrlLinkModal } from "../../../../hooks/common/UrlLinkModalContext";
import { resolveTitleMentions, useTodoMentionPool } from "./titleMentionsHelpers";
import { renderTitleWithLinks } from "./titleRenderLinks";

/**
 * A saved to-do title as it reads: links clickable, `@` / `#` tokens as chips.
 * What a to-do row prints, now shared so a scheduled to-do's row prints its
 * title the same way (MIP-1047). Needs the to-do mention pool above it.
 */
export const TodoTitleText = ({ text, myselfUserId }: { text: string; myselfUserId?: string }) => {
    const urlLinkModal = useUrlLinkModal();
    const pool = useTodoMentionPool();
    const { mode } = useColorScheme();
    const mentions = useMemo(() => resolveTitleMentions(text, pool), [text, pool]);
    return (
        <>{renderTitleWithLinks(text, urlLinkModal, mentions, myselfUserId, mode === "dark")}</>
    );
};
