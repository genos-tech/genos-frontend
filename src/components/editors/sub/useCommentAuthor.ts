import { useEffect } from "react";
import { CommentsExtension } from "@blocknote/core/comments";
import { useExtension, useStore } from "@blocknote/react";

/**
 * The user behind a comment, or `undefined` until the user store has them.
 *
 * BlockNote's own `useUser` was a public export up to 0.49. From 0.57 the hook
 * (`useCommentUser`) is internal to its comments UI, so the sidebar reads the
 * same thing through what is public: the comments extension's `userStore`.
 * Like the old hook it asks the store to load the user when it mounts, never
 * throws (a user that cannot be loaded stays `undefined`, and the sidebar shows
 * its "unknown author" copy), and re-renders when the store learns the user.
 *
 * `CommentsUserPreloader` (`CommentEditorWithMentions.tsx`) already loads every
 * author in the open threads, so in practice this finds them cached; the load
 * here covers a row that mounts before the preloader's effect has run.
 */
export const useCommentAuthor = (userId: string) => {
    const { userStore } = useExtension(CommentsExtension);

    useEffect(() => {
        if (!userId) return;
        // The resolver falls back to an "unknown user" and does not reject; guard
        // anyway so a store-level failure cannot become an unhandled rejection.
        void userStore.loadUsers([userId]).catch(() => {});
    }, [userStore, userId]);

    return useStore(userStore.store, (users) => users.get(userId));
};
