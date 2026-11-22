import { createReactInlineContentSpec } from "@blocknote/react";

import { CustomEmojiImg } from "./CustomEmojiImg";
import { CUSTOM_EMOJI_SPEC_CONFIG } from "./schemaSpecConfigs";

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
    createReactInlineContentSpec(CUSTOM_EMOJI_SPEC_CONFIG, {
        render: (props) => (
            <CustomEmojiImg
                name={props.inlineContent.props.name}
                url={props.inlineContent.props.url}
            />
        ),
    });
