import { useEffect, useState } from "react";

import { BaseNoteTreeNode, NoteTreeState, UseNoteTreeStateProps } from "../types/noteTypes";

export function useNoteTreeState<T extends BaseNoteTreeNode>({
    metaTree,
    currentChain,
}: UseNoteTreeStateProps<T>): NoteTreeState<T> {
    const [tmpCurrentChain, setTmpCurrentChain] = useState<T[]>();
    const [tmpMetaTree, setTmpMetaTree] = useState<T[]>(metaTree);

    // Update current chain when it changes
    useEffect(() => {
        if (currentChain && currentChain.length > 0) {
            setTmpCurrentChain(currentChain);
        } else {
            setTmpCurrentChain([]);
        }
    }, [currentChain]);

    // Sync tmpMetaTree → metaTree when the tree changes (`metaTree` is a useMemo-derived
    // reference, so referential equality is enough). It used to also bump a `timestamp` here, on
    // every tab change and once after 1 s, to force the memo'd rows to re-render; each bump was
    // a commit of the whole Notes page. Rows now get the open tab as a prop instead (MIP-1678).
    useEffect(() => {
        if (tmpMetaTree !== metaTree) {
            setTmpMetaTree(metaTree);
        }
    }, [metaTree, tmpMetaTree]);

    return {
        tmpCurrentChain,
        tmpMetaTree,
    };
}
