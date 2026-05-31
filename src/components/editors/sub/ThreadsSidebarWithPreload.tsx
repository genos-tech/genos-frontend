import { useEffect, useRef, useState } from "react";
import { CommentsExtension } from "@blocknote/core/comments";
import { ThreadsSidebar, useExtension, useThreads } from "@blocknote/react";

import { useTranslation } from "../../../i18n";
import { ThreadsSidebarErrorBoundary } from "./ThreadsSidebarErrorBoundary";

type ThreadsSidebarWithPreloadProps = {
    filter?: "open" | "resolved" | "all";
    sort?: "position" | "recent-activity" | "oldest";
};

/**
 * Pre-loads all user data from threads into the UserStore cache before
 * rendering ThreadsSidebar, preventing the race condition where
 * Comments.tsx throws because user data hasn't been resolved yet.
 * Also wraps in an Error Boundary to handle edge cases (editor recreation,
 * late-arriving Yjs updates) where user data isn't cached in time.
 */
export const ThreadsSidebarWithPreload = ({
    filter = "all",
    sort = "position",
}: ThreadsSidebarWithPreloadProps) => {
    const comments = useExtension(CommentsExtension);
    const threads = useThreads();
    const { t } = useTranslation();
    const [ready, setReady] = useState(false);
    const prevUserStoreRef = useRef(comments.userStore);

    // Reset ready state when userStore changes (editor recreation)
    useEffect(() => {
        if (prevUserStoreRef.current !== comments.userStore) {
            prevUserStoreRef.current = comments.userStore;
            setReady(false);
        }
    }, [comments.userStore]);

    useEffect(() => {
        const userIds = new Set<string>();

        threads.forEach((thread) => {
            if (thread.resolvedBy) userIds.add(thread.resolvedBy);
            thread.comments.forEach((comment) => {
                userIds.add(comment.userId);
            });
        });

        if (userIds.size === 0) {
            setReady(true);
            return;
        }

        comments.userStore.loadUsers(Array.from(userIds)).then(() => {
            setReady(true);
        });
    }, [threads, comments.userStore]);

    if (!ready) {
        return <div style={{ padding: 12, color: "#888" }}>{t.common.editor.loadingComments}</div>;
    }

    return (
        <ThreadsSidebarErrorBoundary>
            <ThreadsSidebar filter={filter} sort={sort} />
        </ThreadsSidebarErrorBoundary>
    );
};
