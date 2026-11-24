import { useEffect, useRef } from "react";

import { ChatNoteMetaProps, ChatNoteMetaTreeNode, ChatNoteProps } from "../../types/notes";
import { mergeNoteIdChain } from "./mergeNoteIdChain";

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
    setAllNoteIdChains: (
        value:
            | Record<string, number[]>
            | ((prev: Record<string, number[]>) => Record<string, number[]>)
    ) => void;
    tabItems: { noteId: number; noteType: number; title: string }[];
    selectedTabIndex: number;
};
export const updataChatNoteChain = (props: updataChatNoteChainProps) => {
    const {
        currentChatNote,
        chatNoteMetaTree,
        currentChatNoteChain,
        setCurrentChatNoteChain,
        setAllNoteIdChains,
        tabItems,
        selectedTabIndex,
    } = props;

    // The effect below must keep running only for the dependencies listed at its end, but it
    // has to read the latest chain and setters, so they are read through a ref.
    const latest = useRef({
        currentChatNoteChain,
        setCurrentChatNoteChain,
        setAllNoteIdChains,
    });
    latest.current = { currentChatNoteChain, setCurrentChatNoteChain, setAllNoteIdChains };

    useEffect(() => {
        const {
            currentChatNoteChain: currentChain,
            setCurrentChatNoteChain: setCurrentChain,
            setAllNoteIdChains: setAllChains,
        } = latest.current;
        // Will update the Chain when `currentChatNote`, `tabItems`, or `selectedTabIndex` is changed.
        // When `tabItems` is changed, `currentChatNote` is also changed at the same time.
        // But `currentChatNote` can be changed alone only if `tabItems` includes `currentChatNote`.
        if (tabItems && tabItems[selectedTabIndex]) {
            const chain = findChatNoteChain(chatNoteMetaTree, tabItems[selectedTabIndex].noteId);
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

                setAllChains((prev) =>
                    mergeNoteIdChain(
                        prev,
                        `${tabItems[selectedTabIndex].noteType}-${tabItems[selectedTabIndex].noteId}`,
                        chain.map((item) => item.noteId)
                    )
                );
            }
        } else {
            setCurrentChain([]);
        }
    }, [currentChatNote, tabItems, selectedTabIndex, chatNoteMetaTree]);
};

type initCurrentChatNoteChainProps = {
    chatNoteMeta: ChatNoteMetaProps[];
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    setCurrentChatNoteChain: (value: ChatNoteMetaTreeNode[]) => void;
};
export const initCurrentChatNoteChain = (props: initCurrentChatNoteChainProps) => {
    const { chatNoteMeta, currentChatNoteChain, setCurrentChatNoteChain } = props;
    const latest = useRef({ currentChatNoteChain, setCurrentChatNoteChain });
    latest.current = { currentChatNoteChain, setCurrentChatNoteChain };
    useEffect(() => {
        const { currentChatNoteChain: currentChain, setCurrentChatNoteChain: setCurrentChain } =
            latest.current;
        if (currentChain === undefined && chatNoteMeta.length === 0) {
            setCurrentChain([]);
        }
    }, [chatNoteMeta]);
};
