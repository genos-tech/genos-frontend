import { useEffect, useRef } from "react";

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
    setAllNoteIdChains: (
        value:
            | Record<string, number[]>
            | ((prev: Record<string, number[]>) => Record<string, number[]>)
    ) => void;
    tabItems: { noteId: number; noteType: number; title: string }[];
    selectedTabIndex: number;
};
export const updataMyNoteChain = (props: updataMyNoteChainProps) => {
    const {
        currentMyNote,
        myNoteMetaTree,
        currentMyNoteChain,
        setCurrentMyNoteChain,
        setAllNoteIdChains,
        tabItems,
        selectedTabIndex,
    } = props;

    // The effect below must keep running only for the dependencies listed at its end, but it
    // has to read the latest chain and setters, so they are read through a ref.
    const latest = useRef({
        currentMyNoteChain,
        setCurrentMyNoteChain,
        setAllNoteIdChains,
    });
    latest.current = { currentMyNoteChain, setCurrentMyNoteChain, setAllNoteIdChains };

    useEffect(() => {
        const {
            currentMyNoteChain: currentChain,
            setCurrentMyNoteChain: setCurrentChain,
            setAllNoteIdChains: setAllChains,
        } = latest.current;
        // Will update the Chain when `currentMyNote`, `tabItems`, or `selectedTabIndex` is changed.
        // When `tabItems` is changed, `currentMyNote` is also changed at the same time.
        // But `currentMyNote` can be changed alone only if `tabItems` includes `currentMyNote`.
        if (tabItems && tabItems[selectedTabIndex]) {
            const chain = findMyNoteChain(myNoteMetaTree, tabItems[selectedTabIndex].noteId);
            if (chain) {
                // Update chain if it's different from current, or if current is undefined
                const isDifferent =
                    !currentChain ||
                    !areArraysEqualByJSON(
                        chain.map((item) => `${item.noteType}-${item.noteId}`),
                        currentChain.map((item) => `${item.noteType}-${item.noteId}`)
                    );

                if (isDifferent) {
                    setCurrentChain(chain);
                }

                setAllChains((prev) => ({
                    ...prev,
                    [`${tabItems[selectedTabIndex].noteType}-${tabItems[selectedTabIndex].noteId}`]:
                        chain.map((item) => item.noteId),
                }));
            }
        } else {
            setCurrentChain([]);
        }
    }, [currentMyNote, tabItems, selectedTabIndex, myNoteMetaTree]);
};

type initCurrentMyNoteChainProps = {
    myNoteMeta: MyNoteMetaProps[];
    currentMyNoteChain?: MyNoteMetaTreeNode[];
    setCurrentMyNoteChain: (value: MyNoteMetaTreeNode[]) => void;
};
export const initCurrentMyNoteChain = (props: initCurrentMyNoteChainProps) => {
    const { myNoteMeta, currentMyNoteChain, setCurrentMyNoteChain } = props;
    const latest = useRef({ currentMyNoteChain, setCurrentMyNoteChain });
    latest.current = { currentMyNoteChain, setCurrentMyNoteChain };
    useEffect(() => {
        const { currentMyNoteChain: currentChain, setCurrentMyNoteChain: setCurrentChain } =
            latest.current;
        if (currentChain === undefined && myNoteMeta.length === 0) {
            setCurrentChain([]);
        }
    }, [myNoteMeta]);
};
