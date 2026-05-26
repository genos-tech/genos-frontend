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

    // Update timestamp when the selected tab changes. Used as part of
    // each tree row's React `key` so a real switch invalidates memo'd
    // subtrees.
    //
    // The earlier `timestamp.slice(1)` trick assumed selectedTabIndex
    // was always a single digit — it stripped exactly one leading char
    // and prepended the current index. Once the user opened the 11th
    // tab (selectedTabIndex >= 10) the prepended prefix was longer
    // than the stripped one, the result fed back through this effect's
    // `timestamp` dep, and the string grew by a digit every iteration
    // until React's max-update-depth tripped. Generating a fresh
    // timestamp avoids the splice math entirely and removes `timestamp`
    // from the dep list, so this effect is now strictly one-shot per
    // tab change.
    useEffect(() => {
        setTimestamp(String(selectedTabIndex) + getLocalCurrentTimestamp());
    }, [selectedTabIndex]);

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
