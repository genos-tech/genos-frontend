import { getTeamEmojiByName } from "../../services/teamEmojiStore";
import { CUSTOM_EMOJI_SHORTCODE_RE } from "./CustomEmojiImg";

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
