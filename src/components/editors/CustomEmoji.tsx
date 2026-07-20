import { createReactInlineContentSpec } from "@blocknote/react";

import { getTeamEmojiByName } from "../../services/teamEmojiStore";
import { CUSTOM_EMOJI_SHORTCODE_RE, CustomEmojiImg } from "./CustomEmojiImg";

// Team custom emoji as a BlockNote inline token (sibling of the mention
// specs). Props bake BOTH the shortcode name and the absolute image URL
// at insert time: bodies are stored verbatim and never rewritten, so a
// later emoji delete/rename must not break old content. The catalog is
// only consulted at insert time (and by reaction chips) — rendering a
// body never needs a lookup.
//
// This module pulls @blocknote/react, so it belongs to the lazy editor
// chunk. Only import it from editor surfaces. The plain <img> glyph and
// the shortcode regex live in CustomEmojiImg.tsx and are NOT re-exported
// here on purpose — see that file.

// Zero-arg factory like CreateMentionGroupSpec, so registration is one
// identical line in every BlockNoteSchema.create site. The schema drift
// guard test (SchemaCustomEmojiGuard.test.ts) enforces that no site is
// missed — an unregistered inline type makes BlockNote reject entire
// bodies with "node type not found in schema" (see bnChatPreview).
export const CreateCustomEmojiSpec = () =>
    createReactInlineContentSpec(
        {
            type: "customEmoji",
            propSchema: {
                name: { default: "" },
                url: { default: "" },
            },
            content: "none",
        },
        {
            render: (props) => (
                <CustomEmojiImg
                    name={props.inlineContent.props.name}
                    url={props.inlineContent.props.url}
                />
            ),
        }
    );

// Picker-selection insert helper. The emoji picker flattens every
// selection to a string (unicode glyph for standard emoji, ":name:" for
// custom — see EmojiPicker.handleEmojiSelect); composers hand that
// string here so custom shortcodes become real inline nodes while
// unicode stays plain text.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const insertEmojiValue = (editor: any, value: string): void => {
    const match = CUSTOM_EMOJI_SHORTCODE_RE.exec(value);
    const custom = match ? getTeamEmojiByName(match[1]) : undefined;
    if (custom) {
        editor.insertInlineContent([
            { type: "customEmoji", props: { name: custom.name, url: custom.url } },
            " ",
        ]);
    } else {
        editor.insertInlineContent([{ type: "text", text: value, styles: {} }]);
    }
};
