import { useSyncExternalStore } from "react";

import {
    getTeamEmojiByName,
    getTeamEmojiSnapshot,
    subscribeTeamEmoji,
} from "../../../services/teamEmojiStore";
import { CUSTOM_EMOJI_SHORTCODE_RE, CustomEmojiImg } from "../../editors/CustomEmoji";

// Renders a reaction emoji string: unicode glyphs pass through as text;
// a ":name:" shortcode resolves against the team catalog to an image.
// Unknown shortcodes (deleted emoji, other-team content) fall back to
// the literal ":name:" text, Slack-style — reactions store only the
// shortcode, so unlike bodies there is no baked URL to fall back on.
// Subscribes to the store so chips upgrade in place when the catalog
// lands after the message list renders.
export const EmojiGlyph = ({ emoji, size }: { emoji: string; size?: number }) => {
    useSyncExternalStore(subscribeTeamEmoji, getTeamEmojiSnapshot);
    const match = CUSTOM_EMOJI_SHORTCODE_RE.exec(emoji);
    const custom = match ? getTeamEmojiByName(match[1]) : undefined;
    if (custom) {
        return <CustomEmojiImg name={custom.name} size={size ?? 16} url={custom.url} />;
    }
    return <>{emoji}</>;
};
