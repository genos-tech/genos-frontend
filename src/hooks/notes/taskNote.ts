import { useEffect } from "react";

import { TaskNoteMetaProps, TaskNoteMetaTreeNode, TaskNoteProps } from "../../types/notes";

function areArraysEqualByJSON<T>(arr1: T[], arr2: T[]): boolean {
    return JSON.stringify(arr1) === JSON.stringify(arr2);
}

function dfsForTaskNote(
    node: TaskNoteMetaTreeNode,
    targetNoteId: number
): TaskNoteMetaTreeNode[] | null {
    if (node.noteId === targetNoteId) {
        return [node];
    }
    for (const child of node.children) {
        const path = dfsForTaskNote(child, targetNoteId);
        if (path) {
            return [node, ...path]; // prepend current node to the chain
        }
    }
    return null;
}

// Get Note chain used for the header
function findTaskNoteChain(
    roots: TaskNoteMetaTreeNode[],
    targetNoteId: number
): TaskNoteMetaTreeNode[] | null {
    for (const root of roots) {
        const path = dfsForTaskNote(root, targetNoteId);
        if (path) return path;
    }
    return null; // not found
}

type updataTaskNoteChainProps = {
    currentTaskNote: TaskNoteProps | null;
    taskNoteMetaTree: TaskNoteMetaTreeNode[];
    currentTaskNoteChain?: TaskNoteMetaTreeNode[];
    setCurrentTaskNoteChain: (value: TaskNoteMetaTreeNode[]) => void;
    allNoteIdChains: Record<string, number[]>;
    setAllNoteIdChains: (
        value:
            | Record<string, number[]>
            | ((prev: Record<string, number[]>) => Record<string, number[]>)
    ) => void;
    tabItems: any[];
    selectedTabIndex: number;
};
export const updataTaskNoteChain = (props: updataTaskNoteChainProps) => {
    const {
        currentTaskNote,
        taskNoteMetaTree,
        currentTaskNoteChain,
        setCurrentTaskNoteChain,
        allNoteIdChains,
        setAllNoteIdChains,
        tabItems,
        selectedTabIndex,
    } = props;

    useEffect(() => {
        // Will update the Chain when `currentTaskNote`, `tabItems`, or `selectedTabIndex` is changed.
        // When `tabItems` is changed, `currentTaskNote` is also changed at the same time.
        // But `currentTaskNote` can be changed alone only if `tabItems` includes `currentTaskNote`.
        if (tabItems && tabItems[selectedTabIndex]) {
            const chain = findTaskNoteChain(taskNoteMetaTree, tabItems[selectedTabIndex].noteId);
            if (chain) {
                // Update chain if it's different from current, or if current is undefined
                const isDifferent =
                    !currentTaskNoteChain ||
                    !areArraysEqualByJSON(
                        chain.map((item) => `${item.noteType}-${item.noteId}`),
                        currentTaskNoteChain.map((item) => `${item.noteType}-${item.noteId}`)
                    );

                if (isDifferent) {
                    setCurrentTaskNoteChain(chain);
                }

                setAllNoteIdChains((prev) => ({
                    ...prev,
                    [`${tabItems[selectedTabIndex].noteType}-${tabItems[selectedTabIndex].noteId}`]:
                        chain.map((item) => item.noteId),
                }));
            }
        } else {
            setCurrentTaskNoteChain([]);
        }
    }, [currentTaskNote, tabItems, selectedTabIndex, taskNoteMetaTree]);
};

type initCurrentTaskNoteChainProps = {
    taskNoteMeta: TaskNoteMetaProps[];
    currentTaskNoteChain?: TaskNoteMetaTreeNode[];
    setCurrentTaskNoteChain: (value: TaskNoteMetaTreeNode[]) => void;
};
export const initCurrentTaskNoteChain = (props: initCurrentTaskNoteChainProps) => {
    const { taskNoteMeta, currentTaskNoteChain, setCurrentTaskNoteChain } = props;
    useEffect(() => {
        if (currentTaskNoteChain === undefined && taskNoteMeta.length === 0) {
            setCurrentTaskNoteChain([]);
        }
    }, [taskNoteMeta]);
};
