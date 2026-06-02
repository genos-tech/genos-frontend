import { createContext, ReactNode, useContext } from "react";

import { AllChatProps } from "../types/chat";
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
    // Already filtered to GM (chatType === 2) by the provider.
    chats: AllChatProps[];
    projects: ProjectProps[];
};

const EMPTY: HashMentionData = { tasks: [], notes: [], chats: [], projects: [] };

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
