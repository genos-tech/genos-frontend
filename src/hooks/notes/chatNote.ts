import { useEffect } from "react";

import { ChatNoteMetaProps, ChatNoteMetaTreeNode, ChatNoteProps } from "../../types/notes";

function areArraysEqualByJSON<T>(arr1: T[], arr2: T[]): boolean {
    return JSON.stringify(arr1) === JSON.stringify(arr2);
}

function dfsForChatNote(
    node: ChatNoteMetaTreeNode,
    targetNoteId: number
): ChatNoteMetaTreeNode[] | null {
    if (node.noteId === targetNoteId) {
        return [node];
    }
    for (const child of node.children) {
        const path = dfsForChatNote(child, targetNoteId);
        if (path) {
            return [node, ...path]; // prepend current node to the chain
        }
    }
    return null;
}

// Get Note chain used for the header
function findChatNoteChain(
    roots: ChatNoteMetaTreeNode[],
    targetNoteId: number
): ChatNoteMetaTreeNode[] | null {
    for (const root of roots) {
        const path = dfsForChatNote(root, targetNoteId);
        if (path) return path;
    }
    return null; // not found
}

type updataChatNoteChainProps = {
    currentChatNote: ChatNoteProps | null;
    chatNoteMetaTree: ChatNoteMetaTreeNode[];
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    setCurrentChatNoteChain: (value: ChatNoteMetaTreeNode[]) => void;
    allNoteIdChains: Record<string, number[]>;
    setAllNoteIdChains: (value: Record<string, number[]>) => void;
    tabItems: any[];
    selectedTabIndex: number;
};
export const updataChatNoteChain = (props: updataChatNoteChainProps) => {
    const {
        currentChatNote,
        chatNoteMetaTree,
        currentChatNoteChain,
        setCurrentChatNoteChain,
        allNoteIdChains,
        setAllNoteIdChains,
        tabItems,
        selectedTabIndex,
    } = props;

    useEffect(() => {
        // Will update the Chain when `currentChatNote` and/or `tabItems` is changed.
        // When `tabItems` is changed, `currentChatNote` is also changed at the same time.
        // But `currentChatNote` can be changed alone only if `tabItems` includes `currentChatNote`.
        if (tabItems && tabItems[selectedTabIndex]) {
            const chain = findChatNoteChain(chatNoteMetaTree, tabItems[selectedTabIndex].noteId);
            if (chain) {
                if (
                    currentChatNoteChain &&
                    areArraysEqualByJSON(
                        chain.map((item) => `${item.noteType}-${item.noteId}`),
                        currentChatNoteChain.map((item) => `${item.noteType}-${item.noteId}`)
                    ) === false
                ) {
                    setCurrentChatNoteChain(chain || []);
                }

                setAllNoteIdChains({
                    ...allNoteIdChains,
                    [`${tabItems[selectedTabIndex].noteType}-${tabItems[selectedTabIndex].noteId}`]:
                        chain.map((item) => item.noteId),
                });
            }
        } else {
            setCurrentChatNoteChain([]);
        }
    }, [currentChatNote, tabItems]);
};

type initCurrentChatNoteChainProps = {
    chatNoteMeta: ChatNoteMetaProps[];
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    setCurrentChatNoteChain: (value: ChatNoteMetaTreeNode[]) => void;
};
export const initCurrentChatNoteChain = (props: initCurrentChatNoteChainProps) => {
    const { chatNoteMeta, currentChatNoteChain, setCurrentChatNoteChain } = props;
    useEffect(() => {
        if (currentChatNoteChain === undefined && chatNoteMeta.length === 0) {
            setCurrentChatNoteChain([]);
        }
    }, [chatNoteMeta]);
};
