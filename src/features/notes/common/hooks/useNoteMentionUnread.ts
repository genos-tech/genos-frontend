import { useCallback, useMemo } from "react";

import { activityChannel } from "../../../../db/workers/channels";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../../types/admin";
import { NoteUnreadValue, UnreadNote } from "../context/NoteUnreadContext";

// Surface chatType (on activity rows) ↔ note_type. 6=my(1), 7=task(2), 8=chat(3).
const SURFACE_TO_NOTE_TYPE: Record<number, number> = { 6: 1, 7: 2, 8: 3 };
const noteTypeToSurface = (noteType: number): number => noteType + 5;

/**
 * Derives note-unread state from the activity feed already synced into
 * `useCM.activityMessages`. A note @mention is a surface activity
 * (chatType 6/7/8, chatId = noteId) with `isRead === false`. Marking read
 * reuses the proven per-activity `updateActivityReadStatus` worker — same
 * path the activity sidebar uses — so there's no new endpoint and the IDB
 * + backend stay in sync.
 */
export const useNoteMentionUnread = (
    useCM: ChatManagementState,
    myself: UserProps,
    accessToken: string | null
): NoteUnreadValue => {
    const activityMessages = useCM.activityMessages;

    const unreadActivities = useMemo(
        () =>
            (activityMessages || []).filter(
                (a) =>
                    (a.chatType === 6 || a.chatType === 7 || a.chatType === 8) &&
                    a.isRead === false &&
                    // Exclude self-authored mentions: when YOU @mention a group
                    // in a note and you're a member, the group expansion makes
                    // you a recipient of your own note — that shouldn't surface
                    // your own note as "unread" (the live feed already skips
                    // self-sends; this also covers the REST-loaded rows). The
                    // notification toast already skips self via senderId too.
                    a.senderId !== myself.userId
            ),
        [activityMessages, myself.userId]
    );

    const unreadKeys = useMemo(
        () =>
            new Set(
                unreadActivities.map((a) => `${SURFACE_TO_NOTE_TYPE[a.chatType]}:${a.chatId}`)
            ),
        [unreadActivities]
    );

    const unreadNotes = useMemo<UnreadNote[]>(() => {
        const seen = new Set<string>();
        const out: UnreadNote[] = [];
        for (const a of unreadActivities) {
            const noteType = SURFACE_TO_NOTE_TYPE[a.chatType];
            const noteId = Number(a.chatId);
            const key = `${noteType}:${noteId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ noteType, noteId, title: a.chatName || "" });
        }
        return out;
    }, [unreadActivities]);

    const isUnread = useCallback(
        (noteType: number, noteId: number) => unreadKeys.has(`${noteType}:${noteId}`),
        [unreadKeys]
    );

    const markRead = useCallback(
        (noteType: number, noteId: number) => {
            if (!accessToken) return;
            const surface = noteTypeToSurface(noteType);
            const targets = (useCM.activityMessages || []).filter(
                (a) =>
                    a.chatType === surface &&
                    String(a.chatId) === String(noteId) &&
                    a.isRead === false &&
                    !!a.activityId
            );
            if (targets.length === 0) return;
            void (async () => {
                // Chain the worker's returned list through each mark so the
                // final `setActivityMessages` reflects every flip. The worker
                // persists each row to IDB + the backend.
                let list = useCM.activityMessages;
                for (const tgt of targets) {
                    try {
                        const res = await activityChannel.request("updateActivityReadStatus", {
                            accessToken,
                            myself,
                            activityId: tgt.activityId,
                            isRead: true,
                            activityMessages: list,
                        });
                        if (Array.isArray(res)) list = res;
                    } catch (err) {
                        console.warn("[notes] mark note mention read failed", err);
                    }
                }
                useCM.setActivityMessages(list);
            })();
        },
        [accessToken, myself, useCM]
    );

    // Stable object identity so context consumers only re-render when the
    // underlying unread data actually changes.
    return useMemo(() => ({ isUnread, markRead, unreadNotes }), [isUnread, markRead, unreadNotes]);
};
