import { useMemo } from "react";

import { UserProps } from "../types/admin";
import { AllChatProps, TodoGroupProps } from "../types/chat";
import {
    ChatNoteMetaProps,
    MyNoteMetaProps,
    SharedNoteMetaProps,
    TaskNoteMetaProps,
    TeamNoteMetaProps,
} from "../types/notes";
import { ProjectProps, SearchTeamTasksResponse, TaskTableProps } from "../types/tasks";
import { HashMentionData } from "./HashMentionDataContext";

export type UseHashMentionDataInputs = {
    allChats: AllChatProps[];
    chatNoteMeta: ChatNoteMetaProps[];
    myNoteMeta: MyNoteMetaProps[];
    myself: UserProps | null;
    projects: ProjectProps[];
    refresh: HashMentionData["refresh"];
    sharedNoteMeta: SharedNoteMetaProps[];
    tasks: TaskTableProps[];
    taskNoteMeta: TaskNoteMetaProps[];
    teamNoteMeta: TeamNoteMetaProps[];
    teamTasks: SearchTeamTasksResponse[];
    todoGroups: TodoGroupProps[];
};

/**
 * Backing data for the "#" mention menu (tasks / notes / GM chats /
 * projects), fed to every editor's `HashSuggestionMenuController` via
 * `HashMentionDataProvider`. Memoized so the arrays keep stable refs across
 * renders: the menu builder's per-editor WeakMap cache only hits while these
 * references are unchanged, so without this each keystroke would re-merge the
 * lists. Notes are merged into one list, each row tagged with its kind so the
 * chip can rebuild the right deep-link URL; chats are pre-filtered to GM
 * (chatType === 2).
 *
 * Every input must be in the dependency list below: the value is only as
 * fresh as the inputs it re-runs on.
 */
export const useHashMentionData = ({
    allChats,
    chatNoteMeta,
    myNoteMeta,
    myself,
    projects,
    refresh,
    sharedNoteMeta,
    tasks,
    taskNoteMeta,
    teamNoteMeta,
    teamTasks,
    todoGroups,
}: UseHashMentionDataInputs): HashMentionData =>
    useMemo(
        () => ({
            tasks,
            teamTasks,
            notes: [
                ...myNoteMeta.map((m) => ({ kind: "my" as const, ...m })),
                ...taskNoteMeta.map((m) => ({ kind: "task" as const, ...m })),
                ...chatNoteMeta.map((m) => ({ kind: "chat" as const, ...m })),
                ...sharedNoteMeta.map((m) => ({ kind: "shared" as const, ...m })),
                ...teamNoteMeta.map((m) => ({ kind: "team" as const, ...m })),
            ],
            chats: allChats.filter((c) => c.chatType === 2),
            allChats,
            projects,
            todoGroups,
            myself,
            refresh,
        }),
        [
            tasks,
            teamTasks,
            myNoteMeta,
            taskNoteMeta,
            chatNoteMeta,
            sharedNoteMeta,
            teamNoteMeta,
            allChats,
            projects,
            todoGroups,
            myself,
            refresh,
        ]
    );
