import { useEffect } from "react";

import { MyNoteMetaProps, MyNoteMetaTreeNode, MyNoteProps } from "../../types/notes";

function areArraysEqualByJSON<T>(arr1: T[], arr2: T[]): boolean {
    return JSON.stringify(arr1) === JSON.stringify(arr2);
}

function dfsForMyNote(
    node: MyNoteMetaTreeNode,
    targetNoteId: number
): MyNoteMetaTreeNode[] | null {
    if (node.noteId === targetNoteId) {
        return [node];
    }
    for (const child of node.children) {
        const path = dfsForMyNote(child, targetNoteId);
        if (path) {
            return [node, ...path]; // prepend current node to the chain
        }
    }
    return null;
}

// Get Note chain used for the header
function findMyNoteChain(
    roots: MyNoteMetaTreeNode[],
    targetNoteId: number
): MyNoteMetaTreeNode[] | null {
    for (const root of roots) {
        const path = dfsForMyNote(root, targetNoteId);
        if (path) return path;
    }
    return null; // not found
}

type updataMyNoteChainProps = {
    currentMyNote: MyNoteProps | null;
    myNoteMetaTree: MyNoteMetaTreeNode[];
    currentMyNoteChain?: MyNoteMetaTreeNode[];
    setCurrentMyNoteChain: (value: MyNoteMetaTreeNode[]) => void;
    allNoteIdChains: Record<string, number[]>;
    setAllNoteIdChains: (value: Record<string, number[]>) => void;
    tabItems: any[];
    selectedTabIndex: number;
};
export const updataMyNoteChain = (props: updataMyNoteChainProps) => {
    const {
        currentMyNote,
        myNoteMetaTree,
        currentMyNoteChain,
        setCurrentMyNoteChain,
        allNoteIdChains,
        setAllNoteIdChains,
        tabItems,
        selectedTabIndex,
    } = props;

    useEffect(() => {
        // Will update the Chain when `currentMyNote` and/or `tabItems` is changed.
        // When `tabItems` is changed, `currentMyNote` is also changed at the same time.
        // But `currentMyNote` can be changed alone only if `tabItems` includes `currentMyNote`.
        if (tabItems && tabItems[selectedTabIndex]) {
            const chain = findMyNoteChain(myNoteMetaTree, tabItems[selectedTabIndex].noteId);
            if (chain) {
                if (
                    currentMyNoteChain &&
                    areArraysEqualByJSON(
                        chain.map((item) => `${item.noteType}-${item.noteId}`),
                        currentMyNoteChain.map((item) => `${item.noteType}-${item.noteId}`)
                    ) === false
                ) {
                    setCurrentMyNoteChain(chain || []);
                }

                setAllNoteIdChains({
                    ...allNoteIdChains,
                    [`${tabItems[selectedTabIndex].noteType}-${tabItems[selectedTabIndex].noteId}`]:
                        chain.map((item) => item.noteId),
                });
            }
        } else {
            setCurrentMyNoteChain([]);
        }
    }, [currentMyNote, tabItems]);
};

type initCurrentMyNoteChainProps = {
    myNoteMeta: MyNoteMetaProps[];
    currentMyNoteChain?: MyNoteMetaTreeNode[];
    setCurrentMyNoteChain: (value: MyNoteMetaTreeNode[]) => void;
};
export const initCurrentMyNoteChain = (props: initCurrentMyNoteChainProps) => {
    const { myNoteMeta, currentMyNoteChain, setCurrentMyNoteChain } = props;
    useEffect(() => {
        if (currentMyNoteChain === undefined && myNoteMeta.length === 0) {
            setCurrentMyNoteChain([]);
        }
    }, [myNoteMeta]);
};
