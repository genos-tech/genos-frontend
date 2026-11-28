import { ActivityMessageProps } from "../../../../../types/chat";

// The rows whose avatar `ActivityAvatar` may draw as a button of its own: every chat's, and a
// task's or task note's (the project's). A shared personal note's mention (6) has an icon.
export const hasButtonAvatar = (activity: ActivityMessageProps): boolean =>
    activity.chatType !== 6;
