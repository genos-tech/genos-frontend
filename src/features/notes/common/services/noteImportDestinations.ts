import { fmt, Messages } from "../../../../i18n";
import { ChatNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";

/**
 * Destinations offered by the "Import Markdown…" dialog on the task and
 * chat surfaces.
 *
 * A note can only live under a real task or a real chat, so the pickers
 * list ONLY those. The sidebar's grouping rows — the project root, and the
 * "DM" / "GM" / "PM" chat-type roots — are containers, not note anchors,
 * and never appear here. That's why the destinations are derived from the
 * note meta (each row is a task/chat that demonstrably anchors notes)
 * rather than from a task or channel list.
 */

export type TaskNoteDestination = {
    /** Stable Select value. */
    key: string;
    projectId: number;
    taskId: number;
    /** "Project › Milestone › Task" — the sidebar's own nesting, flattened. */
    label: string;
};

export type ChatNoteDestination = {
    key: string;
    chatType: number;
    chatId: number;
    isThread: boolean;
    threadId: number;
    /** "DM › Alex" (with the thread named when the anchor is a thread). */
    label: string;
};

export const taskDestinationKey = (projectId: number, taskId: number) => `${projectId}-${taskId}`;

export const chatDestinationKey = (
    chatType: number,
    chatId: number,
    isThread: boolean,
    threadId: number
) => `${chatType}-${chatId}-${isThread ? 1 : 0}-${threadId}`;

const SEP = " › ";

/**
 * One row per task that holds task notes, labelled with its container
 * chain. Milestone-backing tasks are valid destinations (the milestone
 * folder in the sidebar IS a task); project rows are not.
 */
export const buildTaskNoteDestinations = (
    meta: TaskNoteMetaProps[],
    t: Messages
): TaskNoteDestination[] => {
    const byKey = new Map<string, TaskNoteDestination>();

    for (const note of meta) {
        const key = taskDestinationKey(note.projectId, note.taskId);
        if (byKey.has(key)) continue;

        const projectName =
            note.projectName ||
            fmt(t.notes.defaults.projectFallback, { projectId: note.projectId });
        const displayId = formatTaskDisplayId({ taskId: note.taskId, displayId: note.displayId });
        // "Fix login GEN-42", the same pairing the sidebar folder row
        // shows. Untitled tasks fall back to the id alone rather than
        // repeating it ("Task #42 #42").
        const taskName = note.taskTitle
            ? displayId
                ? `${note.taskTitle} ${displayId}`
                : note.taskTitle
            : displayId || fmt(t.notes.defaults.taskFallback, { taskId: note.taskId });

        // Mirror the sidebar's nesting in the label. The milestone crumb
        // is only known for notes whose task sits inside one.
        const crumbs = [projectName];
        if (note.milestoneId != null) {
            crumbs.push(
                note.milestoneTitle ||
                    fmt(t.notes.defaults.milestoneFallback, { milestoneId: note.milestoneId })
            );
        }
        crumbs.push(taskName);

        byKey.set(key, {
            key,
            projectId: note.projectId,
            taskId: note.taskId,
            label: crumbs.join(SEP),
        });
    }

    return Array.from(byKey.values()).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
};

const chatTypeLabel = (chatType: number, t: Messages): string => {
    switch (chatType) {
        // 4 (MDM) shares the DM bucket, same as the sidebar grouping.
        case 1:
        case 4:
            return t.notes.chatTypes.dm;
        case 2:
            return t.notes.chatTypes.gm;
        case 3:
            return t.notes.chatTypes.pm;
        default:
            return t.notes.chatTypes.chat;
    }
};

/**
 * One row per chat anchor that holds chat notes. Chat notes anchor to a
 * channel OR to a thread inside it, and those are different destinations,
 * so both parts of the anchor are part of the row's identity.
 */
export const buildChatNoteDestinations = (
    meta: ChatNoteMetaProps[],
    t: Messages
): ChatNoteDestination[] => {
    const byKey = new Map<string, ChatNoteDestination>();

    for (const note of meta) {
        const key = chatDestinationKey(note.chatType, note.chatId, note.isThread, note.threadId);
        if (byKey.has(key)) continue;

        const typeName = chatTypeLabel(note.chatType, t);
        const chatName = note.chatName || `${typeName} ${note.chatId}`;
        const label = note.isThread
            ? [typeName, chatName, `${t.notes.header.threadCrumb} ${note.threadId}`].join(SEP)
            : [typeName, chatName].join(SEP);

        byKey.set(key, {
            key,
            chatType: note.chatType,
            chatId: note.chatId,
            isThread: note.isThread,
            threadId: note.threadId,
            label,
        });
    }

    return Array.from(byKey.values()).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
};
