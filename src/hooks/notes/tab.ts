import { useEffect } from "react";
import { MyNoteProps } from "../../types/notes";

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
