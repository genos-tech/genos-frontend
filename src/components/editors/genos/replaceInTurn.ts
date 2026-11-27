// Editors of one note in one browser tab replace its document in turn (MIP-2475).
//
// A note can be mounted twice in one tab (a notes-home tab and a link popup, or the task page's
// panel). Each editor has its own Y.Doc, and the two hear of each other only through the collab
// server. Both replacing the document on one resync signal were two concurrent edits, which Yjs
// merges into doubled text. So an editor first takes the document of the one that replaced before
// it: its own replacement then comes after that one, not beside it.

import * as Y from "yjs";

const lastReplaced = new Map<string, Y.Doc>();

export const replaceInTurn = (
    documentName: string,
    doc: Y.Doc | undefined,
    replace: () => void
): void => {
    const before = lastReplaced.get(documentName);
    if (doc && before && before !== doc) Y.applyUpdate(doc, Y.encodeStateAsUpdate(before));
    replace();
    if (!doc || before === doc) return;
    lastReplaced.set(documentName, doc);
    // An editor that is gone has nothing to hand on.
    doc.on("destroy", () => {
        if (lastReplaced.get(documentName) === doc) lastReplaced.delete(documentName);
    });
};
