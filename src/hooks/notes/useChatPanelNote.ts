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
    // Tab list local to the chat panel — separate from notes-home's
    // `tabsApi.tabs`. Each `setNote` call dedups + appends so the user
    // can jump between recently-opened chat notes (e.g. parent ↔ child
    // after a "Child Note" create).
    tabs: ChatNoteProps[];
    openOrCreate: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number,
        chatName?: string
    ) => Promise<void>;
    setNote: (note: ChatNoteProps | null) => void;
    closeTab: (noteId: number) => void;
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
    const [tabs, setTabs] = useState<ChatNoteProps[]>([]);

    const setNote = useCallback((next: ChatNoteProps | null) => {
        setNoteState(next);
        // Mirror into the tab list: dedup by noteId, append at the end.
        // Updating an existing tab's metadata (e.g. fresh title from
        // auto-save) keeps the same slot, so order is stable.
        if (next) {
            setTabs((prev) => {
                const idx = prev.findIndex((t) => t.noteId === next.noteId);
                if (idx === -1) return [...prev, next];
                const merged = [...prev];
                merged[idx] = next;
                return merged;
            });
        }
    }, []);

    const closeTab = useCallback((noteId: number) => {
        setTabs((prev) => {
            const idx = prev.findIndex((t) => t.noteId === noteId);
            if (idx === -1) return prev;
            const next = prev.filter((t) => t.noteId !== noteId);
            // If the closed tab was the active one, promote a neighbour
            // (prefer the one to the left, else the new first). When no
            // tabs remain, clear the active note.
            setNoteState((active) => {
                if (active?.noteId !== noteId) return active;
                if (next.length === 0) return null;
                const neighbourIdx = Math.max(0, idx - 1);
                return next[Math.min(neighbourIdx, next.length - 1)];
            });
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setNoteState(null);
        setTabs([]);
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
                    setNote(next);
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
                    setNote(newNote);
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
        [accessToken, myself, onNoteCreated, refreshMeta, setNote]
    );

    return {
        note,
        isLoading,
        tabs,
        openOrCreate,
        setNote,
        closeTab,
        clear,
    };
};
