import { useEffect, useState } from "react";

import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
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

    // Helper function to check if objects are equal
    const areObjectsEqual = (objA: object, objB: object): boolean => {
        return JSON.stringify(objA) === JSON.stringify(objB);
    };

    // Update current chain when it changes
    useEffect(() => {
        if (currentChain && currentChain.length > 0) {
            setTmpCurrentChain(currentChain);
        } else {
            setTmpCurrentChain([]);
        }
    }, [currentChain]);

    // Update meta tree when it changes with new contents
    useEffect(() => {
        if (areObjectsEqual(tmpMetaTree, metaTree) === false) {
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

    // Update meta tree when current note changes
    useEffect(() => {
        setTmpMetaTree(metaTree);
    }, [currentNote, metaTree]);

    return {
        tmpCurrentChain,
        tmpMetaTree,
        timestamp,
    };
}
