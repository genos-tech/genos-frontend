import { PartialBlock } from "@blocknote/core";

import { UserProps } from "../../../../types/admin";
import { MyNoteProps } from "../../../../types/notes";

export interface NoteEditorState {
    currentMyNoteTitle: string;
    noteBodyEdited: boolean;
    noteBodySaved: boolean;
    body: PartialBlock[] | undefined;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface NoteEditorActions {
    setCurrentMyNoteTitle: (title: string) => void;
    setNoteBodyEdited: (edited: boolean) => void;
    setNoteBodySaved: (saved: boolean) => void;
    setBody: (body: PartialBlock[]) => void;
    handleTitleChange: (value: string) => void;
    handleTitleBlur: () => void;
    handleBodyChange: (newBody: PartialBlock[]) => void;
    updateNote: () => Promise<void>;
}

export interface NoteEditorProps {
    currentMyNote: MyNoteProps | null;
    myself: UserProps;
    accessToken: string | null;
    onNoteUpdate: (updatedNote: MyNoteProps) => void;
}

export interface TabItem {
    noteType: number;
    noteId: number;
    title: string;
}

export interface NoteTabActions {
    handleCloseTab: (tabIndex: number, closingNoteId: number) => Promise<void>;
    handleTabChange: (newValue: number) => void;
}
