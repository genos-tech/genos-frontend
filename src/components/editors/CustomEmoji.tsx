import { useState } from "react";
import { createReactInlineContentSpec } from "@blocknote/react";

import { getTeamEmojiByName } from "../../services/teamEmojiStore";
import { upgradeInsecureUrl } from "../../utils/downloadUtils";

// Team custom emoji as a BlockNote inline token (sibling of the mention
// specs). Props bake BOTH the shortcode name and the absolute image URL
// at insert time: bodies are stored verbatim and never rewritten, so a
// later emoji delete/rename must not break old content. The catalog is
// only consulted at insert time (and by reaction chips) — rendering a
// body never needs a lookup.

// Matches the server-side name rule (view regex + CharField(50)).
export const CUSTOM_EMOJI_SHORTCODE_RE = /^:([a-z0-9_+-]{1,50}):$/;

export const CustomEmojiImg = ({
    name,
    url,
    size,
}: {
    name: string;
    url: string;
    size?: number;
}) => {
    const [broken, setBroken] = useState(false);
    if (broken || !url) {
        // Purged file or empty props — degrade to the literal shortcode,
        // Slack-style, instead of a broken-image glyph.
        return <span>{`:${name}:`}</span>;
    }
    return (
        <img
            alt={`:${name}:`}
            loading="lazy"
            // Inline-spec props bypass the editor-level `resolveFileUrl`
            // hook, so the baked-http:// upgrade has to happen here.
            src={upgradeInsecureUrl(url)}
            style={{
                height: size ?? "1.4em",
                width: "auto",
                verticalAlign: "text-bottom",
                objectFit: "contain",
                display: "inline-block",
            }}
            title={`:${name}:`}
            onError={() => setBroken(true)}
        />
    );
};

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
