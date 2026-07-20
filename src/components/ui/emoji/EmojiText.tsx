import { Fragment, useSyncExternalStore } from "react";

import {
    getTeamEmojiByName,
    getTeamEmojiSnapshot,
    subscribeTeamEmoji,
} from "../../../services/teamEmojiStore";
import { CUSTOM_EMOJI_SHORTCODE_SPLIT_RE, CustomEmojiImg } from "../../editors/CustomEmojiImg";

// Renders a PLAIN-TEXT preview line with any ":name:" shortcodes in it
// resolved against the team emoji catalog to inline images.
//
// Sibling of `EmojiGlyph`, and the split is deliberate: a reaction chip
// is exactly one emoji (anchored regex, whole-string match), whereas a
// preview line is mixed prose — "shipped it :parrot: 🎉". Message
// `body_text` stores custom emoji as their canonical `:name:` shortcode
// (that's what search + reactions index), so every surface that prints
// that stored text raw — chat list, activity feed, flagged list — showed
// the literal shortcode. Resolving at RENDER time (rather than changing
// what's stored) fixes existing messages too, with no backfill.
//
// Unknown shortcodes fall back to the literal text, Slack-style: a
// deleted emoji or another team's content has no catalog entry.
//
// Subscribes to the store so rows upgrade in place when the catalog
// lands after the sidebar first paints.
//
// NOTE: imports the glyph from `CustomEmojiImg.tsx`, never from
// `CustomEmoji.tsx` — the latter pulls the ~724 kB BlockNote vendor
// chunk into the entry critical path, and every caller of this
// component is an eager sidebar surface.
export const EmojiText = ({ size, text }: { size?: number; text: string }) => {
    useSyncExternalStore(subscribeTeamEmoji, getTeamEmojiSnapshot);

    // Fast path: no shortcode is even possible without a colon, which
    // is the overwhelmingly common case for a chat-list preview.
    if (!text.includes(":")) {
        return <>{text}</>;
    }

    // `split` on a capturing regex interleaves the captures: even
    // indices are literal text, odd indices are emoji names.
    const parts = text.split(CUSTOM_EMOJI_SHORTCODE_SPLIT_RE);
    return (
        <>
            {parts.map((part, idx) => {
                if (idx % 2 === 0) {
                    return <Fragment key={idx}>{part}</Fragment>;
                }
                const custom = getTeamEmojiByName(part);
                if (!custom) {
                    return <Fragment key={idx}>{`:${part}:`}</Fragment>;
                }
                return (
                    <CustomEmojiImg
                        key={idx}
                        name={custom.name}
                        size={size ?? 16}
                        url={custom.url}
                    />
                );
            })}
        </>
    );
};
