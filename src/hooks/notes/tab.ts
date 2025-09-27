import { useEffect } from "react";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";

type updateTabFromMyNoteUpdateProps = {
    currentMyNote: MyNoteProps | null;
    setSelectedTabIndex: (value: number) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
};
export const updateTabFromMyNoteUpdate = (props: updateTabFromMyNoteUpdateProps) => {
    const { currentMyNote, setSelectedTabIndex, tabItems, setTabItems } = props;

    useEffect(() => {
        if (currentMyNote) {
            localStorage.setItem("lastOpenMyNoteId", String(currentMyNote.noteId));
            if (tabItems.length === 0 || tabItems[0] === undefined) {
                setSelectedTabIndex(0);
                setTabItems([currentMyNote]);
            } else if (
                tabItems.some(
                    (item) =>
                        `${item.noteType}-${item.noteId}` ===
                        `${currentMyNote.noteType}-${currentMyNote.noteId}`
                ) === false
            ) {
                setSelectedTabIndex(tabItems.length);
                setTabItems([...tabItems, currentMyNote]);
            }
        }
    }, [currentMyNote]);
};

type updateTabFromTaskNoteUpdateProps = {
    currentTaskNote: TaskNoteProps | null;
    setSelectedTabIndex: (value: number) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
};
export const updateTabFromTaskNoteUpdate = (props: updateTabFromTaskNoteUpdateProps) => {
    const { currentTaskNote, setSelectedTabIndex, tabItems, setTabItems } = props;

    useEffect(() => {
        if (currentTaskNote) {
            localStorage.setItem("lastOpenTaskNoteId", String(currentTaskNote.noteId));
            if (tabItems.length === 0 || tabItems[0] === undefined) {
                setSelectedTabIndex(0);
                setTabItems([currentTaskNote]);
            } else if (
                tabItems.some(
                    (item) =>
                        `${item.noteType}-${item.noteId}` ===
                        `${currentTaskNote.noteType}-${currentTaskNote.noteId}`
                ) === false
            ) {
                setSelectedTabIndex(tabItems.length);
                setTabItems([...tabItems, currentTaskNote]);
            }
        }
    }, [currentTaskNote]);
};

type updateTabFromChatNoteUpdateProps = {
    currentChatNote: ChatNoteProps | null;
    setSelectedTabIndex: (value: number) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
};
export const updateTabFromChatNoteUpdate = (props: updateTabFromChatNoteUpdateProps) => {
    const { currentChatNote, setSelectedTabIndex, tabItems, setTabItems } = props;

    useEffect(() => {
        if (currentChatNote) {
            localStorage.setItem("lastOpenChatNoteId", String(currentChatNote.noteId));
            if (tabItems.length === 0 || tabItems[0] === undefined) {
                setSelectedTabIndex(0);
                setTabItems([currentChatNote]);
            } else if (
                tabItems.some(
                    (item) =>
                        `${item.noteType}-${item.noteId}` ===
                        `${currentChatNote.noteType}-${currentChatNote.noteId}`
                ) === false
            ) {
                setSelectedTabIndex(tabItems.length);
                setTabItems([...tabItems, currentChatNote]);
            }
        }
    }, [currentChatNote]);
};
