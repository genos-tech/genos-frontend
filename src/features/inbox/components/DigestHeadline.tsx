// The digest's headline for THAT edition ("Three things are stuck"),
// written by the agent and stored in `item_body.title` — a field that
// existed from day one and was never rendered, so every digest looked
// like every other digest before you'd read a word of it.
//
// The generic fallback is deliberately NOT shown: genos-api stores
// "Your Genos digest" whenever a run omits its headline, and every row
// written before headlines existed carries it. Repeating it under a chip
// that already reads "Genos digest" is noise, so it renders as nothing.
//
// Plain text by contract — the backend strips markdown and links out of
// the TITLE line, so this never needs a markdown renderer.

import { Typography } from "@mui/joy";

const GENERIC_DIGEST_TITLE = "Your Genos digest";

export const DigestHeadline = ({ title, isDark }: { title: string; isDark: boolean }) => {
    const headline = title.trim();
    if (!headline || headline === GENERIC_DIGEST_TITLE) return null;
    return (
        <Typography
            level="title-sm"
            sx={{
                mb: 0.75,
                fontWeight: 700,
                lineHeight: 1.35,
                color: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.88)",
            }}
        >
            {headline}
        </Typography>
    );
};

export default DigestHeadline;
