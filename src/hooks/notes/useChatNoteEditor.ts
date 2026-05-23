import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { useNoteEditorCore } from "../../features/notes/common/hooks/useNoteEditorCore";
import { UserProps } from "../../types/admin";
import { ChatNoteProps } from "../../types/notes";

export interface ChatNoteEditorState {
    currentChatNoteTitle: string;
    noteBodyEdited: boolean;
    noteBodySaved: boolean;
    body: PartialBlock[] | undefined;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface ChatNoteEditorActions {
    setCurrentChatNoteTitle: (title: string) => void;
    setNoteBodyEdited: (edited: boolean) => void;
    setNoteBodySaved: (saved: boolean) => void;
    setBody: (body: PartialBlock[]) => void;
    handleTitleChange: (value: string) => void;
    handleTitleBlur: () => void;
    handleBodyChange: (newBody: PartialBlock[]) => void;
    updateNote: () => Promise<void>;
}

export interface ChatNoteEditorProps {
    currentChatNote: ChatNoteProps | null;
    myself: UserProps;
    accessToken: string | null;
    socket: Socket | null;
    onNoteUpdate: (updatedNote: ChatNoteProps) => void;
    resyncSignal?: number | string;
}

interface UseChatNoteEditorReturn extends ChatNoteEditorState, ChatNoteEditorActions {}

/**
 * Chat-note editor hook. Thin wrapper around `useNoteEditorCore` that
 * preserves the legacy field names (`currentChatNoteTitle` /
 * `setCurrentChatNoteTitle`) expected by `ChatNoteMain` and `ChatNoteEditor`.
 */
export const useChatNoteEditor = ({
    currentChatNote,
    myself,
    accessToken,
    socket,
    onNoteUpdate,
    resyncSignal,
}: ChatNoteEditorProps): UseChatNoteEditorReturn => {
    const core = useNoteEditorCore<ChatNoteProps>({
        currentNote: currentChatNote,
        myself,
        accessToken,
        socket,
        onNoteUpdate,
        resyncSignal,
    });

    return {
        currentChatNoteTitle: core.title,
        setCurrentChatNoteTitle: core.setTitle,
        titleInputRef: core.titleInputRef,
        handleTitleChange: core.handleTitleChange,
        handleTitleBlur: core.handleTitleBlur,
        body: core.body,
        setBody: core.setBody,
        handleBodyChange: core.handleBodyChange,
        noteBodyEdited: core.noteBodyEdited,
        noteBodySaved: core.noteBodySaved,
        setNoteBodyEdited: core.setNoteBodyEdited,
        setNoteBodySaved: core.setNoteBodySaved,
        updateNote: core.updateNote,
    };
};
