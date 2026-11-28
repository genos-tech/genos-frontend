import { ActivityMessageProps } from "../../../../../types/chat";

// The rows whose avatar `ActivityAvatar` draws as a button of its own: a group's, and a
// multi-person DM's (chat type 4 without a task; with one it is a task comment), including a
// chat note's mention, which borrows its chat's avatar.
export const hasButtonAvatar = (activity: ActivityMessageProps): boolean =>
    activity.chatType === 2 ||
    (activity.chatType === 4 && !activity.taskId) ||
    (activity.chatType === 8 && (activity.noteChatType === 2 || activity.noteChatType === 4));
