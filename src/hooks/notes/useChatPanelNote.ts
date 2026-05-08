// Isolated state for the chat-page note panel.
//
// In the legacy architecture, opening a chat note from a thread chat header
// reused `useNM.currentChatNote` and `useNM.tabItems`, which meant any
// chat-page activity rippled into the notes-home tab strip (causing the
// "snap-back" and "click does nothing" bugs).
//
// This hook owns chat-panel state independently. Notes-home is no longer
// touched by chat-page panel activity.

import { useCallback, useState } from "react";

import { createEmptyChatNote } from "../../features/notes/chat-notes/services/createEmptyChatNote";
import { loadChatNoteMeta } from "../../features/notes/chat-notes/services/loadChatNoteMeta";
import { loadChatNotesByChatId } from "../../features/notes/chat-notes/services/loadChatNotesByChatId";
import { addNote } from "../../features/notes/common/services/addNote";
import { UserProps } from "../../types/admin";
import { ChatNoteMetaProps, ChatNoteProps } from "../../types/notes";

export interface ChatPanelNoteApi {
    note: ChatNoteProps | null;
    isLoading: boolean;
    openOrCreate: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number,
        chatName?: string
    ) => Promise<void>;
    setNote: (note: ChatNoteProps | null) => void;
    clear: () => void;
}

interface UseChatPanelNoteOptions {
    myself: UserProps;
    accessToken: string | null;
    onNoteCreated?: (note: ChatNoteProps) => void;
    onMetaRefreshed?: (meta: ChatNoteMetaProps[]) => void;
}

export const useChatPanelNote = ({
    myself,
    accessToken,
    onNoteCreated,
    onMetaRefreshed,
}: UseChatPanelNoteOptions): ChatPanelNoteApi => {
    const [note, setNoteState] = useState<ChatNoteProps | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const setNote = useCallback((next: ChatNoteProps | null) => {
        setNoteState(next);
    }, []);

    const clear = useCallback(() => {
        setNoteState(null);
        setIsLoading(false);
    }, []);

    const refreshMeta = useCallback(async () => {
        if (!accessToken) return;
        try {
            const meta: ChatNoteMetaProps[] = await loadChatNoteMeta(myself, accessToken);
            if (meta.length > 0) onMetaRefreshed?.(meta);
        } catch (error) {
            console.error("Error refreshing chat note meta:", error);
        }
    }, [accessToken, myself, onMetaRefreshed]);

    // Mirrors the legacy `handleCreateNewChatNoteIfNotExist` body —
    // attempts to load chat notes for this chat first, and only creates a
    // new one if none exist. Persists into IDB and refreshes meta so the
    // sidebar reflects the new note. The result is held in this hook's
    // local state, fully isolated from notes-home.
    const openOrCreate = useCallback(
        async (
            chatType: number,
            chatId: number,
            isThread: boolean,
            threadId: number,
            _chatName?: string
        ) => {
            if (!accessToken) return;
            setIsLoading(true);
            try {
                const chatNotes: ChatNoteProps[] = await loadChatNotesByChatId(
                    myself,
                    chatType,
                    chatId,
                    isThread,
                    threadId,
                    accessToken
                );

                if (chatNotes && chatNotes.length > 0) {
                    const next = chatNotes[0];
                    setNoteState(next);
                    addNote(3, next);
                    await refreshMeta();
                    return;
                }

                const title = "New Chat Note (1)";
                const created = await createEmptyChatNote(
                    myself,
                    null,
                    chatType,
                    chatId,
                    isThread,
                    threadId,
                    title,
                    accessToken
                );
                if (created) {
                    const newNote: ChatNoteProps = { noteType: 3, ...created };
                    setNoteState(newNote);
                    addNote(3, newNote);
                    onNoteCreated?.(newNote);
                    await refreshMeta();
                }
            } catch (error) {
                console.error("Error opening or creating chat note:", error);
            } finally {
                setIsLoading(false);
            }
        },
        [accessToken, myself, onNoteCreated, refreshMeta]
    );

    return {
        note,
        isLoading,
        openOrCreate,
        setNote,
        clear,
    };
};
