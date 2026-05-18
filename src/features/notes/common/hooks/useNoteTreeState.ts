import { useEffect, useState } from "react";

import { getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { BaseNoteTreeNode, NoteTreeState, UseNoteTreeStateProps } from "../types/noteTypes";

export function useNoteTreeState<T extends BaseNoteTreeNode>({
    metaTree,
    currentChain,
    selectedTabIndex,
    currentNote,
}: UseNoteTreeStateProps<T>): NoteTreeState<T> {
    const [tmpCurrentChain, setTmpCurrentChain] = useState<T[]>();
    const [tmpMetaTree, setTmpMetaTree] = useState<T[]>(metaTree);
    const [timestamp, setTimestamp] = useState<string>(getLocalCurrentTimestamp());

    // Update current chain when it changes
    useEffect(() => {
        if (currentChain && currentChain.length > 0) {
            setTmpCurrentChain(currentChain);
        } else {
            setTmpCurrentChain([]);
        }
    }, [currentChain]);

    // Sync tmpMetaTree → metaTree and bump the timestamp when the tree
    // changes content.
    //
    // The pre-Phase-2.1 implementation used `JSON.stringify(a) === JSON.stringify(b)`
    // to compare trees — an O(N) serialization on every related state change.
    // After Phase 2.1 made `metaTree` a useMemo-derived reference, plain
    // referential equality is now both safe and dramatically cheaper. The
    // duplicate effect that previously also re-synced on `currentNote`
    // changes has been removed — `metaTree` is already in this effect's
    // dependency list, so any real tree content change re-runs it.
    useEffect(() => {
        if (tmpMetaTree !== metaTree) {
            setTmpMetaTree(metaTree);
            setTimestamp(String(selectedTabIndex) + getLocalCurrentTimestamp());
        }
    }, [metaTree, selectedTabIndex, tmpMetaTree]);

    // Update timestamp when selected tab changes
    useEffect(() => {
        setTimestamp(String(selectedTabIndex) + timestamp.slice(1));
    }, [selectedTabIndex, timestamp]);

    // Initialize timestamp after 1 second
    useEffect(() => {
        const timer = setTimeout(() => {
            setTimestamp(String(selectedTabIndex) + getLocalCurrentTimestamp());
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    return {
        tmpCurrentChain,
        tmpMetaTree,
        timestamp,
    };
}
