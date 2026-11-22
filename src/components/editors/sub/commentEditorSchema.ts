import {
    BlockNoteSchema,
    createParagraphBlockSpec,
    defaultInlineContentSpecs,
} from "@blocknote/core";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { CreateCustomEmojiSpec } from "../CustomEmoji";
import { genosStyleSpecs } from "../genosStyleSpecs";
import {
    CreateHashChatSpec,
    CreateHashNoteSpec,
    CreateHashProjectSpec,
    CreateHashTaskSpec,
} from "../HashMention";
import { CreateMentionGroupSpec, CreateMentionSpec } from "../Mention";

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
    // Drop the color styles from the style specs, exactly as the stock comment
    // schema does (the comment formatting toolbar offers no color buttons, so
    // keeping them would be dead schema), starting from ours so inline code
    // can still be combined with the other styles (see `genosStyleSpecs`).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop them from the spread
    const { textColor, backgroundColor, ...styleSpecs } = genosStyleSpecs;
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
