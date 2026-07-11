import { createContext, ReactNode, useContext } from "react";

import { UserProps } from "../types/admin";
import { AllChatProps, TodoGroupProps } from "../types/chat";
import {
    ChatNoteMetaProps,
    MyNoteMetaProps,
    SharedNoteMetaProps,
    TaskNoteMetaProps,
} from "../types/notes";
import { ProjectProps, TaskTableProps } from "../types/tasks";

// One note row for the "#" mention menu, tagged with its note kind so the
// chip can rebuild the correct deep-link URL (the four note kinds use
// different URL shapes — see `entityRefToHref`). The metadata is exactly
// the shape `useNM` already holds; the provider just stamps `kind` while
// merging the four arrays so the menu builder doesn't re-derive it.
export type HashNoteEntry =
    | ({ kind: "my" } & MyNoteMetaProps)
    | ({ kind: "task" } & TaskNoteMetaProps)
    | ({ kind: "chat" } & ChatNoteMetaProps)
    | ({ kind: "shared" } & SharedNoteMetaProps);

// The data backing the "#" mention suggestion menu. Provided once at the
// App root (where the task / note / chat / project hooks already live) and
// read by every editor's `HashSuggestionMenuController` via context —
// mirrors how `MentionGroupsContext` feeds the `@group` menu, avoiding a
// four-list prop-drill through a dozen editors.
export type HashMentionData = {
    tasks: TaskTableProps[];
    notes: HashNoteEntry[];
    // Already filtered to GM (chatType === 2) by the provider. The
    // editors' "#" menu keeps this GM-only scope deliberately (notes
    // embed in shared surfaces where a DM title would leak who you
    // talk to); the agent-input mention picker uses `allChats` below.
    chats: AllChatProps[];
    // The unfiltered chat list (DM / GM / PM / MDM) for the agent-input
    // "#" mention picker — agent asks are private to the requester, so
    // the leak rationale above doesn't apply there.
    allChats: AllChatProps[];
    projects: ProjectProps[];
    // Daily todo groups (agent-input "#" picker only — todos are the
    // requester's own, so the editors' shared-surface leak rationale
    // rules them out of the BlockNote menu the same way DMs are).
    todoGroups: TodoGroupProps[];
    // Current user — used by the task-mention hover card to fetch a task's
    // live status (`loadSpecificTask` needs `myself.teamId`). Null outside
    // the provider; the hover card degrades to a static label.
    myself: UserProps | null;
};

const EMPTY: HashMentionData = {
    tasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: null,
};

const HashMentionDataContext = createContext<HashMentionData | null>(null);

export const HashMentionDataProvider = ({
    value,
    children,
}: {
    value: HashMentionData;
    children: ReactNode;
}) => <HashMentionDataContext.Provider value={value}>{children}</HashMentionDataContext.Provider>;

// Returns an empty dataset when used outside the provider (e.g. editors
// mounted on pre-auth pages) so the menu just shows nothing instead of
// crashing.
// eslint-disable-next-line react-refresh/only-export-components
export const useHashMentionData = (): HashMentionData => {
    return useContext(HashMentionDataContext) ?? EMPTY;
};
