import { useCallback, useSyncExternalStore } from "react";
import type { ThreadStore } from "@blocknote/core/comments";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import { Badge, IconButton } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { AppTooltip } from "../../ui/AppTooltip";

// ─────────────────────────────────────────────────────────────────────────
// The "show comments" button that re-appears at the top-right of the note
// editors. It toggles the custom `CommentsSidebar`.
//
// Lives OUTSIDE `<BlockNoteView>` (in the editor's absolute-positioned
// affordance cluster), so it can't use the comment React hooks. It instead
// subscribes to the `ThreadStore` directly — the same store the sidebar reads —
// to show a live count badge of the open (unresolved) threads.
// ─────────────────────────────────────────────────────────────────────────

type CommentsSidebarToggleProps = {
    open: boolean;
    onToggle: () => void;
    threadStore: ThreadStore;
};

/** Count of non-deleted, unresolved threads — what the badge shows. Kept in
 *  sync with the store via `useSyncExternalStore` (the store's `subscribe`
 *  fires on every Yjs thread change). */
const useOpenThreadCount = (threadStore: ThreadStore): number => {
    // Memoized so React doesn't unsubscribe/resubscribe to the store on every
    // render (a bare inline arrow here is a fresh reference each commit).
    const subscribe = useCallback(
        (onChange: () => void) => threadStore.subscribe(() => onChange()),
        [threadStore]
    );
    const getSnapshot = useCallback(() => {
        let count = 0;
        for (const thread of threadStore.getThreads().values()) {
            if (!thread.deletedAt && !thread.resolved) {
                count++;
            }
        }
        return count;
    }, [threadStore]);
    return useSyncExternalStore(subscribe, getSnapshot);
};

export const CommentsSidebarToggle = ({
    open,
    onToggle,
    threadStore,
}: CommentsSidebarToggleProps) => {
    const { t } = useTranslation();
    const openCount = useOpenThreadCount(threadStore);
    const label = open ? t.common.editor.hideComments : t.common.editor.showComments;

    return (
        <AppTooltip placement="bottom-end" title={label}>
            <Badge
                badgeContent={open ? 0 : openCount}
                color="primary"
                max={99}
                size="sm"
                variant="solid"
            >
                <IconButton
                    aria-label={label}
                    aria-pressed={open}
                    size="sm"
                    variant={open ? "soft" : "plain"}
                    color={open ? "primary" : "neutral"}
                    onClick={onToggle}
                >
                    <ChatBubbleOutlineRoundedIcon />
                </IconButton>
            </Badge>
        </AppTooltip>
    );
};
