import { useEffect } from "react";

import { UserProps } from "../../types/admin";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";

const MAX_TAB_ITEMS = 9;

type updateTabFromMyNoteUpdateProps = {
    myself: UserProps;
    currentMyNote: MyNoteProps | null;
    setSelectedTabIndex: (value: number) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
};
export const updateTabFromMyNoteUpdate = (props: updateTabFromMyNoteUpdateProps) => {
    const { myself, currentMyNote, setSelectedTabIndex, tabItems, setTabItems } = props;

    useEffect(() => {
        if (currentMyNote) {
            if (myself.teamId !== currentMyNote.teamId) {
                setTabItems([]);
                return;
            }
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
                if (tabItems.length < MAX_TAB_ITEMS) {
                    setSelectedTabIndex(tabItems.length);
                    setTabItems([...tabItems, currentMyNote]);
                } else {
                    // Remove the first item and add the current my note
                    setSelectedTabIndex(tabItems.length - 1);
                    setTabItems([...tabItems.slice(1), currentMyNote]);
                }
            } else {
                const targetTabIndex = tabItems.findIndex(
                    (item) =>
                        `${item.noteType}-${item.noteId}` ===
                        `${currentMyNote.noteType}-${currentMyNote.noteId}`
                );
                if (targetTabIndex !== -1) {
                    setSelectedTabIndex(targetTabIndex);
                }
            }
        }
    }, [currentMyNote]);
};

type updateTabFromTaskNoteUpdateProps = {
    myself: UserProps;
    currentTaskNote: TaskNoteProps | null;
    setSelectedTabIndex: (value: number) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
};
export const updateTabFromTaskNoteUpdate = (props: updateTabFromTaskNoteUpdateProps) => {
    const { myself, currentTaskNote, setSelectedTabIndex, tabItems, setTabItems } = props;

    useEffect(() => {
        if (currentTaskNote) {
            if (myself.teamId !== currentTaskNote.teamId) {
                setTabItems([]);
                return;
            }
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
                if (tabItems.length < MAX_TAB_ITEMS) {
                    setSelectedTabIndex(tabItems.length);
                    setTabItems([...tabItems, currentTaskNote]);
                } else {
                    // Remove the first item and add the current task note
                    setSelectedTabIndex(tabItems.length - 1);
                    setTabItems([...tabItems.slice(1), currentTaskNote]);
                }
            } else {
                const targetTabIndex = tabItems.findIndex(
                    (item) =>
                        `${item.noteType}-${item.noteId}` ===
                        `${currentTaskNote.noteType}-${currentTaskNote.noteId}`
                );
                if (targetTabIndex !== -1) {
                    setSelectedTabIndex(targetTabIndex);
                }
            }
        }
    }, [currentTaskNote]);
};

type updateTabFromChatNoteUpdateProps = {
    myself: UserProps;
    currentChatNote: ChatNoteProps | null;
    setSelectedTabIndex: (value: number) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
};
export const updateTabFromChatNoteUpdate = (props: updateTabFromChatNoteUpdateProps) => {
    const { myself, currentChatNote, setSelectedTabIndex, tabItems, setTabItems } = props;

    useEffect(() => {
        if (currentChatNote) {
            if (myself.teamId !== currentChatNote.teamId) {
                setTabItems([]);
                return;
            }
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
                if (tabItems.length < MAX_TAB_ITEMS) {
                    setSelectedTabIndex(tabItems.length);
                    setTabItems([...tabItems, currentChatNote]);
                } else {
                    // Remove the first item and add the current chat note
                    setSelectedTabIndex(tabItems.length - 1);
                    setTabItems([...tabItems.slice(1), currentChatNote]);
                }
            } else {
                const targetTabIndex = tabItems.findIndex(
                    (item) =>
                        `${item.noteType}-${item.noteId}` ===
                        `${currentChatNote.noteType}-${currentChatNote.noteId}`
                );
                if (targetTabIndex !== -1) {
                    setSelectedTabIndex(targetTabIndex);
                }
            }
        }
    }, [currentChatNote]);
};
