import { filterSuggestionItems } from "@blocknote/core";
import {
    DefaultReactSuggestionItem,
    getDefaultReactSlashMenuItems,
    SuggestionMenuController,
} from "@blocknote/react";

import { UserProps } from "../../../types/admin";
import { filterAndRankSuggestionItems } from "../../../utils/suggestionRanking";
import { getEmojiSuggestionItems } from "../EmojiSuggestion";
import { withGenosBlockSlashItems } from "../genosBlockSpecs";
import { withGifSlashItem } from "../GifToolbarButton";
import { HashSuggestionMenuController } from "../HashMention";
import { MentionMenuItems, MentionSuggestionMenu } from "../Mention";

// The editors only ever hand these helpers the editor they built, whose type depends on the
// schema; the helpers themselves take it loosely (`MentionMenuItems`, `HashSuggestionMenuController`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = any;

/** What the `@` menu lists. A function, so an editor can hand over refs (chat composers read
 *  the latest values without re-creating anything) or plain props (documents). */
export type MentionSources = {
    teamMemberProfiles: Record<string, UserProps>;
    teamMembers: UserProps[];
    myselfUserId: string;
    mentionGroups: Parameters<typeof MentionMenuItems>[4];
};

/**
 * The `/` menu per surface kind (MIP-1131). Both start from BlockNote's default items plus
 * the Genos GIF entry; `document` (notes, task bodies, templates) adds the math and diagram
 * blocks. Every type is in every SCHEMA either way; this only decides what a menu offers.
 */
export type SlashPreset = "chat" | "document";

export const genosSlashItems = (
    preset: SlashPreset,
    editor: AnyEditor,
    setShowGifPicker: (value: boolean) => void
): DefaultReactSuggestionItem[] => {
    const withGif = withGifSlashItem(getDefaultReactSlashMenuItems(editor), setShowGifPicker);
    return preset === "document" ? withGenosBlockSlashItems(editor, withGif) : withGif;
};

type GenosSuggestionMenusProps = {
    editor: AnyEditor;
    getMentionSources: () => MentionSources;
    /** Omit for a surface with no `/` menu (the todo body). */
    slash?: { preset: SlashPreset; setShowGifPicker: (value: boolean) => void };
};

/**
 * The four suggestion menus every Genos editor mounts: `@` people and groups, `#` tasks /
 * notes / chats / projects, `/` blocks, `:` emoji. Place it inside the `BlockNoteView`
 * (or its `BlockNoteViewEditor`). Cheap to re-render: BlockNote subscribes the controllers
 * itself, and nothing here holds state.
 */
export const GenosSuggestionMenus = ({
    editor,
    getMentionSources,
    slash,
}: GenosSuggestionMenusProps) => (
    <>
        {/* "#" mentions: tasks / notes / GM chats / projects */}
        <HashSuggestionMenuController editor={editor} />
        <SuggestionMenuController
            suggestionMenuComponent={MentionSuggestionMenu}
            triggerCharacter={"@"}
            getItems={async (query) => {
                const s = getMentionSources();
                return filterAndRankSuggestionItems(
                    MentionMenuItems(
                        s.teamMemberProfiles,
                        editor,
                        s.teamMembers,
                        s.myselfUserId,
                        s.mentionGroups
                    ),
                    query
                );
            }}
        />
        {slash && (
            <SuggestionMenuController
                triggerCharacter={"/"}
                // Replaces the default slash items with ours. The built-in menu must be off
                // on the view (`slashMenu={false}`) or BOTH render on "/".
                getItems={async (query) =>
                    filterSuggestionItems(
                        genosSlashItems(slash.preset, editor, slash.setShowGifPicker),
                        query
                    )
                }
            />
        )}
        <SuggestionMenuController
            getItems={async (query) => getEmojiSuggestionItems(editor, query)}
            minQueryLength={2}
            triggerCharacter={":"}
        />
    </>
);
