import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import {
    useNoteDeleted,
    type NoteDeletedDetail,
} from "../../features/notes/common/utils/noteDeleted";
import { toBackendNoteType } from "../../features/notes/common/utils/noteTypeAlias";
import {
    ChatHistoryEntry,
    HistoryContext,
    HistoryContextValue,
    HistoryEntry,
    mergeAndCap,
    MilestoneHistoryEntry,
    NoteHistoryEntry,
    readFromStorage,
    STORAGE_KEY_PREFIX,
    TaskHistoryEntry,
    ThreadHistoryEntry,
    writeToStorage,
} from "./historyState";

export const HistoryProvider = ({
    children,
    teamId,
}: {
    children: ReactNode;
    teamId: string | null | undefined;
}) => {
    const [entries, setEntries] = useState<HistoryEntry[]>(() => readFromStorage(teamId));

    // Re-load when the active team changes. Each team carries its own
    // localStorage bucket so switching back surfaces the previous team's
    // history intact.
    useEffect(() => {
        setEntries(readFromStorage(teamId));
    }, [teamId]);

    const record = useCallback(
        (entry: HistoryEntry) => {
            // Compute + persist inside the state updater so the write
            // sees the freshly-merged array — NOT a ref that's only
            // populated by a [entries] effect a render later. A
            // setItem of a 50-row JSON is sub-millisecond; the previous
            // microtask coalescing wasn't worth the lost-write hazard.
            setEntries((prev) => {
                const next = mergeAndCap(prev, entry);
                writeToStorage(teamId, next);
                return next;
            });
        },
        [teamId]
    );

    // A deleted note goes from the list too: its row would open a note that is not there
    // (MIP-1435). The row's noteType is the sidebar bucket (My 1, Shared 4, Team 8 are all backend
    // type 1), so compare backend types.
    const forgetNotes = useCallback(
        ({ noteType, noteIds }: NoteDeletedDetail) => {
            const gone = new Set(noteIds);
            setEntries((prev) => {
                const next = prev.filter(
                    (e) =>
                        !(
                            e.kind === "note" &&
                            toBackendNoteType(e.noteType) === noteType &&
                            gone.has(e.noteId)
                        )
                );
                if (next.length === prev.length) return prev;
                writeToStorage(teamId, next);
                return next;
            });
        },
        [teamId]
    );
    useNoteDeleted(forgetNotes);

    const clear = useCallback(() => {
        setEntries([]);
        if (teamId && typeof window !== "undefined") {
            try {
                window.localStorage.removeItem(STORAGE_KEY_PREFIX + teamId);
            } catch {
                // ignore
            }
        }
    }, [teamId]);

    const chatsEntries = useMemo(
        () =>
            entries.filter(
                (e): e is ChatHistoryEntry | ThreadHistoryEntry =>
                    e.kind === "chat" || e.kind === "thread"
            ),
        [entries]
    );
    const tasksEntries = useMemo(
        () =>
            entries.filter(
                (e): e is TaskHistoryEntry | MilestoneHistoryEntry =>
                    e.kind === "task" || e.kind === "milestone"
            ),
        [entries]
    );
    const notesEntries = useMemo(
        () => entries.filter((e): e is NoteHistoryEntry => e.kind === "note"),
        [entries]
    );

    const value = useMemo<HistoryContextValue>(
        () => ({ entries, chatsEntries, tasksEntries, notesEntries, record, clear }),
        [entries, chatsEntries, tasksEntries, notesEntries, record, clear]
    );

    return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
};
