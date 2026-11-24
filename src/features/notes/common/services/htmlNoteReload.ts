/**
 * "Reload page" in a note's actions menu reaches the viewer without threading state through
 * `useNoteManagement`: the menu fires a window event naming the note, and the `HtmlNoteView` of that
 * note (there is at most one live frame) listens for it.
 */

const EVENT = "genos:html-note-reload";

type ReloadDetail = { noteType: number; noteId: number };

export const requestHtmlNoteReload = (noteType: number, noteId: number): void => {
    window.dispatchEvent(new CustomEvent<ReloadDetail>(EVENT, { detail: { noteType, noteId } }));
};

/** Calls `onReload` whenever a reload of this note is requested; returns the unsubscribe. */
export const onHtmlNoteReload = (
    noteType: number,
    noteId: number,
    onReload: () => void
): (() => void) => {
    const handler = (event: Event) => {
        const detail = (event as CustomEvent<ReloadDetail>).detail;
        if (detail?.noteType === noteType && detail?.noteId === noteId) onReload();
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
};
