import { useState } from "react";

import { upgradeInsecureUrl } from "../../utils/downloadUtils";

// The BlockNote-free half of the custom-emoji feature: the <img> glyph
// and the shortcode pattern.
//
// This lives apart from CustomEmoji.tsx ON PURPOSE. That module builds
// the BlockNote inline spec, so it statically imports @blocknote/react
// and anything importing it inherits the ~724 kB gzip vendor-editor
// chunk. Several EAGER surfaces need only the glyph — reaction chips
// (EmojiGlyph), the settings emoji panel (TeamEmojiPanel) — and are
// reachable from App.tsx, so importing them from CustomEmoji.tsx pulls
// the whole editor stack into the entry's critical path.
//
// Import the glyph FROM HERE, never from CustomEmoji.tsx. CustomEmoji.tsx
// deliberately does not re-export it: a re-export would make the
// regression silently reachable again.

// Matches the server-side name rule (view regex + CharField(50)).
export const CUSTOM_EMOJI_SHORTCODE_RE = /^:([a-z0-9_+-]{1,50}):$/;

// Same pattern UNANCHORED, for splitting a mixed line of text into
// alternating literal / shortcode parts (`EmojiText`). Reactions store
// exactly one shortcode so they use the anchored form above; preview
// lines ("hi :parrot: bye") need this one. Deliberately not `/g` — it's
// used with `String.split`, which ignores the flag but where a shared
// global regex's `lastIndex` state would be a footgun.
export const CUSTOM_EMOJI_SHORTCODE_SPLIT_RE = /:([a-z0-9_+-]{1,50}):/;

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
            // Editor surfaces open an image-zoom/download modal on ANY
            // <img> click; this attribute is their opt-out marker so an
            // emoji never gets treated as a downloadable image block.
            data-custom-emoji="true"
            loading="lazy"
            // Inline-spec props bypass the editor-level `resolveFileUrl`
            // hook, so the baked-http:// upgrade has to happen here.
            src={upgradeInsecureUrl(url)}
            title={`:${name}:`}
            style={{
                height: size ?? "1.4em",
                width: "auto",
                verticalAlign: "text-bottom",
                objectFit: "contain",
                display: "inline-block",
            }}
            onError={() => setBroken(true)}
        />
    );
};
