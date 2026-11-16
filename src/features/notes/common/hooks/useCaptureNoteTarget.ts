import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { captureNoteTarget } from "../utils/noteTarget";

/**
 * Remember a block or comment link when it arrives (MIP-146): a page load on
 * `/workspace/notes/my/12?block=<id>`, or a click on such a link in the app.
 *
 * Keyed on the location's `key`, not only its URL, so following the SAME link again takes you to
 * the block again. Captured here, not read later in the editor, because the notes page rewrites
 * the URL to the open note's canonical path as the note opens, which drops the query before the
 * editor has anything to show. Kept in `NoteHome`'s own file-set rather than in `useNoteRouting`
 * because the store reads `parseNoteRoute` from there (an import the other way would be a cycle).
 */
export const useCaptureNoteTarget = (isActiveRoute: boolean): void => {
    const location = useLocation();
    useEffect(() => {
        if (!isActiveRoute) return;
        captureNoteTarget(location.pathname, location.search);
    }, [isActiveRoute, location.key, location.pathname, location.search]);
};
