import { createContext, useContext, useEffect, useMemo } from "react";
import { CommentsExtension } from "@blocknote/core/comments";
import { BlockNoteView, components as mantineComponents } from "@blocknote/mantine";
import {
    ComponentsContext,
    FloatingComposerController,
    FloatingThreadController,
    FormattingToolbar,
    FormattingToolbarController,
    getFormattingToolbarItems,
    SuggestionMenuController,
    useBlockNoteContext,
    useExtension,
    useThreads,
    type Components,
} from "@blocknote/react";

import { useMentionGroupsContext } from "../../../context/MentionGroupsContext";
import { UserProps } from "../../../types/admin";
import { filterAndRankSuggestionItems } from "../../../utils/suggestionRanking";
import { HashSuggestionMenuController } from "../HashMention";
import { MentionMenuItems, MentionSuggestionMenu } from "../Mention";
import { ThreadsSidebarErrorBoundary } from "./ThreadsSidebarErrorBoundary";

/**
 * The `@`-menu needs the member list, member profiles, and the current
 * user id. Those come from `useTEM` / `myself` PROPS in each editor (there's
 * no team-members React context), so the editor supplies them here and the
 * (module-constant) `CommentEditorWithMentions` reads them from context —
 * keeping that component stable so the comment editor never remounts.
 */
type CommentMentionData = {
    teamMemberProfiles: Record<string, UserProps>;
    teamMembers: UserProps[];
    myselfUserId: string;
};

const CommentMentionDataContext = createContext<CommentMentionData | null>(null);

// Reproduces the stock comment formatting toolbar: the default formatting
// toolbar items minus the block nest/unnest buttons (which make no sense in a
// flat, paragraph-only comment). Identical to mantine's internal `xe`.
const commentFormattingToolbar = () => (
    <FormattingToolbar blockTypeSelectItems={[]}>
        {getFormattingToolbarItems([]).filter(
            (item) => item.key !== "nestBlockButton" && item.key !== "unnestBlockButton"
        )}
    </FormattingToolbar>
);

type CommentEditorProps = {
    className?: string;
    autoFocus?: boolean;
    editable: boolean;
    editor: any;
    onFocus?: () => void;
    onBlur?: () => void;
};

/**
 * Drop-in replacement for mantine's default `Comments.Editor`. Faithfully
 * reproduces its `<BlockNoteView>` (same disabled sub-UIs, same theme sourced
 * from `useBlockNoteContext`, same formatting toolbar) and ADDS the `@` and
 * `#` suggestion controllers as children.
 *
 * Module-level and stable: BlockNote reads this from the components context by
 * identity, so recreating it per render would remount the comment editor and
 * drop focus/caret mid-typing. It reads the mention data from context instead
 * of props for the same reason.
 *
 * The suggestion controllers bind to whichever editor `<BlockNoteView>`
 * provides via context — here, the COMMENT editor passed as `editor` — so they
 * insert into the comment, not the parent document. The comment editor has no
 * CommentsExtension, so there's no recursion.
 */
const CommentEditorWithMentions = (props: CommentEditorProps) => {
    const { className, autoFocus, editable, editor, onFocus, onBlur } = props;
    const blockNoteContext = useBlockNoteContext();
    const mentionData = useContext(CommentMentionDataContext);
    const { mentionGroups } = useMentionGroupsContext();

    return (
        <BlockNoteView
            autoFocus={autoFocus}
            className={className}
            editable={editable}
            editor={editor}
            filePanel={false}
            formattingToolbar={false}
            sideMenu={false}
            slashMenu={false}
            tableHandles={false}
            theme={blockNoteContext?.colorSchemePreference}
            onBlur={onBlur}
            onFocus={onFocus}
        >
            <FormattingToolbarController formattingToolbar={commentFormattingToolbar} />
            {/* `@` mentions — only while the comment is editable (the
                read-only display of committed comments passes editable=false).
                Needs the member data the editor provided via context. */}
            {editable && mentionData && (
                <SuggestionMenuController
                    suggestionMenuComponent={MentionSuggestionMenu}
                    triggerCharacter={"@"}
                    getItems={async (query) =>
                        filterAndRankSuggestionItems(
                            MentionMenuItems(
                                mentionData.teamMemberProfiles,
                                editor,
                                mentionData.teamMembers,
                                mentionData.myselfUserId,
                                mentionGroups
                            ),
                            query
                        )
                    }
                />
            )}
            {/* `#` hash mentions — self-sufficient (reads its own context). */}
            {editable && <HashSuggestionMenuController editor={editor} />}
        </BlockNoteView>
    );
};

// The components override: identical to mantine's own `components` object
// (the very value its `BlockNoteView` provides), with only the leaf
// `Comments.Editor` swapped. Module-constant so the provider value below never
// changes identity — a changing value would remount the comment editors.
const COMMENTS_COMPONENTS_WITH_MENTIONS: Components = {
    ...mantineComponents,
    Comments: {
        ...mantineComponents.Comments,
        Editor: CommentEditorWithMentions,
    },
};

/**
 * Warms BlockNote's comment `UserStore` with every user referenced by the
 * current threads (comment authors + whoever resolved a thread) whenever the
 * thread set changes. Renders nothing.
 *
 * BlockNote's floating card reads these users *synchronously during render* and
 * THROWS if a `resolvedBy` user isn't cached yet ("their data could not be
 * found"). Pre-loading here means the users are resolved before any card
 * renders, so that throw never fires. This is the pre-warm the deleted
 * `ThreadsSidebarWithPreload` used to do for the docked sidebar; the floating
 * card needs it just the same. The `ThreadsSidebarErrorBoundary` around the
 * controller is the backstop for whatever slips through (e.g. a thread that
 * arrives and is opened in the same tick); this preloader is what keeps that
 * backstop from being exercised in the first place.
 */
const CommentsUserPreloader = () => {
    const comments = useExtension(CommentsExtension);
    const threads = useThreads();

    useEffect(() => {
        const userIds = new Set<string>();
        threads.forEach((thread) => {
            if (thread.resolvedBy) {
                userIds.add(thread.resolvedBy);
            }
            thread.comments.forEach((comment) => userIds.add(comment.userId));
        });
        if (userIds.size === 0) {
            return;
        }
        // `resolveUsers` never rejects (it falls back to an "unknown user"), so
        // this settles for every id; guard anyway so a store-level failure
        // can't surface as an unhandled rejection.
        void comments.userStore.loadUsers(Array.from(userIds)).catch(() => {});
    }, [threads, comments]);

    return null;
};

type CommentsWithMentionsProps = {
    teamMemberProfiles: Record<string, UserProps>;
    teamMembers: UserProps[];
    myselfUserId: string;
};

/**
 * Renders the comment surfaces (new-comment composer + floating thread popup)
 * with `@`/`#` mentions enabled. Drops in where the four editors previously
 * rendered `<FloatingComposerController />` + `<FloatingThreadController />`.
 *
 * Provides the mention data (for the `@` menu) and the components override (for
 * the custom leaf editor) to the stock BlockNote comment controllers.
 */
export const CommentsWithMentions = (props: CommentsWithMentionsProps) => {
    const { teamMemberProfiles, teamMembers, myselfUserId } = props;

    // Memoized so the provider value only changes when the underlying member
    // data does (e.g. the 60s profile refresh) — a change re-renders the
    // comment editors' consumers but never remounts them.
    const mentionData = useMemo<CommentMentionData>(
        () => ({ teamMemberProfiles, teamMembers, myselfUserId }),
        [teamMemberProfiles, teamMembers, myselfUserId]
    );

    return (
        <CommentMentionDataContext.Provider value={mentionData}>
            <ComponentsContext.Provider value={COMMENTS_COMPONENTS_WITH_MENTIONS}>
                <CommentsUserPreloader />
                <FloatingComposerController />
                <ThreadsSidebarErrorBoundary>
                    <FloatingThreadController />
                </ThreadsSidebarErrorBoundary>
            </ComponentsContext.Provider>
        </CommentMentionDataContext.Provider>
    );
};
