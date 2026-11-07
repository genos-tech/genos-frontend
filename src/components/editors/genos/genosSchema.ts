import { useMemo } from "react";
import { BlockNoteSchema } from "@blocknote/core";
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
import { Alert } from "../sub/Alert";
import { genosBaseBlockSpecs, genosBaseInlineContentSpecs } from "./genosSchemaParts";

/**
 * THE schema of every Genos editor (MIP-1131): chat composers, thread and update editors,
 * comment editors' host documents, note editors, the task body, templates and the read-only
 * previews. One definition, so a block type or chip added here is in every editor at once
 * and no editor deletes a block it does not know (see `genosSchemaParts`).
 *
 * The only thing a surface chooses is how a mention chip RENDERS (`mention`, `mentionGroup`):
 * the legacy chips open the profile modal and need the app's hook stack, the v3 composer's do
 * not. Their shape is the same (`MENTION_SPEC_CONFIG`), which is what the schema cares about.
 */
export type GenosMentionSpecs = {
    mention: ReturnType<typeof CreateMentionSpec>;
    mentionGroup: ReturnType<typeof CreateMentionGroupSpec>;
};

export const createGenosSchema = (mentions: GenosMentionSpecs) =>
    BlockNoteSchema.create({
        styleSpecs: genosStyleSpecs,
        inlineContentSpecs: {
            ...genosBaseInlineContentSpecs(),
            mention: mentions.mention,
            mentionGroup: mentions.mentionGroup,
            customEmoji: CreateCustomEmojiSpec(),
            hashTask: CreateHashTaskSpec(),
            hashNote: CreateHashNoteSpec(),
            hashChat: CreateHashChatSpec(),
            hashProject: CreateHashProjectSpec(),
        },
        blockSpecs: {
            ...genosBaseBlockSpecs(),
            alert: Alert(),
        },
    });

export type GenosSchema = ReturnType<typeof createGenosSchema>;

/** What the legacy mention chip closes over (it opens the user-profile modal on click). */
export type GenosMentionContext = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
};

export const createLegacyMentionSpecs = (ctx: GenosMentionContext): GenosMentionSpecs => ({
    mention: CreateMentionSpec(
        ctx.teamMemberProfiles,
        ctx.socket,
        ctx.myself,
        ctx.setMyself,
        ctx.useUISM,
        ctx.useCM
    ),
    mentionGroup: CreateMentionGroupSpec(),
});

/**
 * The editors' schema, memoized.
 *
 * `"mount"`: built once, for editors that go through `useCreateBlockNote` without deps (it
 * keeps its first schema for the editor's lifetime, so rebuilding on later renders was
 * thrown away work: one full spec build per render). `"live"`: rebuilt when the values the
 * mention chip closes over change; for the collaborative editors, whose hook takes the
 * schema as an input. Either way this adds no state and no subscription to the host.
 */
export const useGenosSchema = (ctx: GenosMentionContext, rebuild: "mount" | "live") => {
    const deps =
        rebuild === "live"
            ? [
                  ctx.teamMemberProfiles,
                  ctx.socket,
                  ctx.myself,
                  ctx.setMyself,
                  ctx.useUISM,
                  ctx.useCM,
              ]
            : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => createGenosSchema(createLegacyMentionSpecs(ctx)), deps);
};
