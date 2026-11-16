import { createContext, useContext, useMemo } from "react";

import {
    notePathFor,
    withNoteTarget,
    type NoteKind,
} from "../../../features/notes/common/utils/noteTarget";
import { useTranslation } from "../../../i18n";
import { toast } from "../../ui/feedback/toastStore";

// Copy a link to ONE BLOCK or ONE COMMENT of the open note (MIP-146).
//
// The note editor provides this to the menus that offer the copy (the block's drag-handle menu
// and the comments sidebar). They live deep in BlockNote's own tree, so a context is how they
// learn which note they are in without a prop through BlockNote. An editor with no provider (a
// task preview, a chat composer) gets null from `useNoteLink()` and offers nothing: a link to a
// block is only meaningful where the note has a page of its own.

export type NoteLinkApi = {
    /** The full URL to one block, or null when this note has no page of its own to link to. */
    blockLink: (blockId: string) => string | null;
    /** The full URL to one comment thread, or null likewise. */
    commentLink: (threadId: string) => string | null;
    /** Put `url` on the clipboard and say so. Resolves false (after an error toast) on failure. */
    copy: (url: string) => Promise<boolean>;
};

/** Provided by the note editor; read by the menus that offer the copy. */
export const NoteLinkContext = createContext<NoteLinkApi | null>(null);

export const useNoteLink = (): NoteLinkApi | null => useContext(NoteLinkContext);

type NoteHost = Parameters<typeof notePathFor>[0];

const absolute = (path: string | null): string | null =>
    path === null ? null : `${window.location.origin}${path}`;

/** The link API for one note. The path is read when a link is built, not when the editor mounts:
 *  the page may have moved to another bucket or the note into a modal since. */
export const useNoteLinkApi = (note: {
    noteType: NoteKind;
    noteId: number;
    commentHost: NoteHost["commentHost"];
}): NoteLinkApi => {
    const { t } = useTranslation();
    const { noteType, noteId, commentHost } = note;
    const linked = t.common.editor.noteLink;
    return useMemo<NoteLinkApi>(() => {
        const base = () =>
            notePathFor({ noteType, noteId, commentHost }, window.location.pathname);
        return {
            blockLink: (blockId) => {
                const path = base();
                return path ? absolute(withNoteTarget(path, { blockId })) : null;
            },
            commentLink: (threadId) => {
                const path = base();
                return path ? absolute(withNoteTarget(path, { threadId })) : null;
            },
            copy: async (url) => {
                try {
                    await navigator.clipboard.writeText(url);
                } catch (err) {
                    console.error("Failed to copy link:", err);
                    toast.error(linked.copyFailed, { id: "note-link-copy" });
                    return false;
                }
                toast.success(linked.copied, { id: "note-link-copy", duration: 2500 });
                return true;
            },
        };
    }, [noteType, noteId, commentHost, linked]);
};
