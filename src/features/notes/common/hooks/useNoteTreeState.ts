import { useEffect, useState } from "react";

import { BaseNoteTreeNode, NoteTreeState, UseNoteTreeStateProps } from "../types/noteTypes";

const RESOLVED_CHAIN: never[] = [];

export function useNoteTreeState<T extends BaseNoteTreeNode>({
    metaTree,
}: UseNoteTreeStateProps<T>): NoteTreeState<T> {
    // The rows only ask whether the chain has been resolved (`undefined` until the first effect has
    // run); nothing reads its contents. So it is a flag, held as one stable value, and a switch
    // no longer commits the sidebar once more just to swap the array (MIP-2379).
    const [chainReady, setChainReady] = useState(false);
    const [tmpMetaTree, setTmpMetaTree] = useState<T[]>(metaTree);

    useEffect(() => {
        setChainReady(true);
    }, []);

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
        tmpCurrentChain: chainReady ? (RESOLVED_CHAIN as T[]) : undefined,
        tmpMetaTree,
    };
}
