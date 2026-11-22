// Small pieces the structured approval previews share. The older previews
// each define their own copy of `MetaChip` / `asString`; the ones added with
// the to-do and milestone tools (MIP-877 to MIP-885) use these.

import { Box, Chip, Typography } from "@mui/joy";

import { g } from "../../../theme/tokens";
import type { LinkEntry } from "./previewValues";

export const MetaChip = ({ label }: { label: string }) => (
    <Chip size="sm" sx={{ fontSize: "0.75rem", "--Chip-minHeight": "18px" }} variant="soft">
        {label}
    </Chip>
);

/**
 * A link set as the card prints it: one line per link, title then URL, as TEXT.
 * Never an anchor: the card shows the proposal before the server has judged the
 * URL's scheme, and a `javascript:` href runs in the app's origin when clicked.
 */
export const LinkLines = ({ links, label }: { links: LinkEntry[]; label: string }) => (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        <Typography level="body-xs" sx={{ color: g.text.secondary, fontWeight: 600 }}>
            {label}
        </Typography>
        {links.map((link, i) => (
            <Typography
                key={`${i}-${link.url}`}
                level="body-xs"
                sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}
            >
                {link.title === link.url ? link.url : `${link.title} · ${link.url}`}
            </Typography>
        ))}
    </Box>
);
