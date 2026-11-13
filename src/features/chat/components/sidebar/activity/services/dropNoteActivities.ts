import { activityChannel } from "../../../../../../db/workers/channels";
import type { ActivityMessageProps } from "../../../../../../types/chat";

/**
 * The @mention rows of a deleted note (MIP-1457). A note @mention is a surface activity:
 * chatType 6 / 7 / 8 for a backend note type 1 / 2 / 3, chatId = the note id.
 */
export const isActivityOfNote = (
    a: Pick<ActivityMessageProps, "chatType" | "chatId">,
    noteType: number,
    noteIds: ReadonlySet<number>
): boolean => a.chatType === noteType + 5 && noteIds.has(Number(a.chatId));

/** `list` without the rows of the given notes; the SAME array when there is nothing to drop. */
export const withoutNoteActivities = (
    list: ActivityMessageProps[],
    noteType: number,
    noteIds: readonly number[]
): ActivityMessageProps[] => {
    const ids = new Set(noteIds.map(Number));
    const next = list.filter((a) => !isActivityOfNote(a, noteType, ids));
    return next.length === list.length ? list : next;
};

/**
 * Forget a deleted note's rows in IndexedDB (the feed is re-read from there on a reload). The
 * server keeps them, so a full resync can bring one back: it is dropped again the next time it
 * is clicked (`handleNoteActivity`). Never throws: the in-memory feed is already updated.
 */
export const forgetNoteActivities = async (
    noteType: 1 | 2 | 3,
    noteIds: number[]
): Promise<void> => {
    if (noteIds.length === 0) return;
    try {
        await activityChannel.request("deleteNoteActivities", { noteType, noteIds });
    } catch (err) {
        console.warn("[notes] forgetting a deleted note's rows failed", err);
    }
};
