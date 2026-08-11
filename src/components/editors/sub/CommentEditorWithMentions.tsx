import { createContext, useContext, useMemo } from "react";
import {
    BlockNoteSchema,
    createParagraphBlockSpec,
    defaultInlineContentSpecs,
    defaultStyleSpecs,
} from "@blocknote/core";
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
    type Components,
} from "@blocknote/react";
import { Socket } from "socket.io-client";

import { useMentionGroupsContext } from "../../../context/MentionGroupsContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { filterAndRankSuggestionItems } from "../../../utils/suggestionRanking";
import { CreateCustomEmojiSpec } from "../CustomEmoji";
import {
    CreateHashChatSpec,
    CreateHashNoteSpec,
    CreateHashProjectSpec,
    CreateHashTaskSpec,
    HashSuggestionMenuController,
} from "../HashMention";
import {
    CreateMentionGroupSpec,
    CreateMentionSpec,
    MentionMenuItems,
    MentionSuggestionMenu,
} from "../Mention";
import { ThreadsSidebarErrorBoundary } from "./ThreadsSidebarErrorBoundary";

// ─────────────────────────────────────────────────────────────────────────
// Mentions inside BlockNote *comments* (the inline body-comment feature:
// AddCommentButton → FloatingComposer → threads), NOT the task-comment
// feature. This module adds `@` user/group mentions and `#` hash mentions to
// every comment surface — the new-comment composer, thread replies, and
// comment editing — across all four collaborative editors (task body, task
// note, personal note, chat note).
//
// It works by two independent seams into BlockNote 0.49's comments:
//
//   1. RENDERING — `buildCommentSchema()` produces a mention-capable schema
//      that the caller hands to `useCollaborativeBlockNote({ commentSchema })`,
//      which passes it to `CommentsExtension({ schema })`. BlockNote stores it
//      as `commentEditorSchema`; ALL three internal comment editors (composer,
//      reply, edit) AND the read-only display of committed comments build via
//      `useCreateBlockNote({ schema: commentEditorSchema || default })`. So the
//      chips render everywhere a comment is shown once the schema knows the
//      mention/hash inline specs.
//
//   2. TYPING — the stock comment editor has no `@`/`#` suggestion menus. We
//      swap ONLY the leaf `Comments.Editor` component (the one that renders the
//      actual editable surface) via a nested `ComponentsContext.Provider`,
//      reusing the identical `components` object mantine itself provides but
//      with our `CommentEditorWithMentions` in the `Comments.Editor` slot. Every
//      other comment sub-component (Card, Comment, reactions, resolve, the reply
//      composer shell) is untouched — no forking of BlockNote's thread logic.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Builds the schema used for comment bodies. Mirrors BlockNote's default
 * comment schema (a single `paragraph` block type + the default inline/style
 * specs, minus the color styles the comment toolbar doesn't expose) and adds
 * the `@` mention / `#` hash inline content specs so those chips can be
 * inserted, persisted, and re-rendered inside comments.
 *
 * Deliberately paragraph-only: comments shouldn't grow headings, tables,
 * images, or code blocks — matching the stock comment editor's affordances.
 *
 * The `mention` spec closes over the same values as the main editor's
 * `CreateMentionSpec` (it opens the user-profile modal on click), so callers
 * must memoize this with those exact deps — the same ones their main `schema`
 * `useMemo` already uses.
 */
export const buildCommentSchema = (args: {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
}) => {
    // Drop the color styles from the default style specs, exactly as the stock
    // comment schema does — the comment formatting toolbar offers no color
    // buttons, so keeping them would be dead schema.
    const { textColor, backgroundColor, ...styleSpecs } = defaultStyleSpecs;
    return BlockNoteSchema.create({
        blockSpecs: {
            paragraph: createParagraphBlockSpec(),
        },
        inlineContentSpecs: {
            ...defaultInlineContentSpecs,
            mention: CreateMentionSpec(
                args.teamMemberProfiles,
                args.socket,
                args.myself,
                args.setMyself,
                args.useUISM,
                args.useCM
            ),
            mentionGroup: CreateMentionGroupSpec(),
            // Register `customEmoji` for the same reason every other schema
            // site does: a body carrying an inline type the reader's schema
            // doesn't know makes BlockNote reject the WHOLE body ("node type
            // not found in schema"). A comment could contain a `:shortcode:`
            // custom emoji, so its schema must know the spec too. Enforced by
            // `SchemaCustomEmojiGuard.test.ts`.
            customEmoji: CreateCustomEmojiSpec(),
            hashTask: CreateHashTaskSpec(),
            hashNote: CreateHashNoteSpec(),
            hashChat: CreateHashChatSpec(),
            hashProject: CreateHashProjectSpec(),
        },
        styleSpecs,
    });
};

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
                    suggestionMenuComponent={MentionSuggestionMenu}
                    triggerCharacter={"@"}
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
                <FloatingComposerController />
                <ThreadsSidebarErrorBoundary>
                    <FloatingThreadController />
                </ThreadsSidebarErrorBoundary>
            </ComponentsContext.Provider>
        </CommentMentionDataContext.Provider>
    );
};
