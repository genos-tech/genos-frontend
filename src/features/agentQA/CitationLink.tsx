// Inline citation hyperlink: the ONE "click a citation inside an agent
// answer" component, shared by the live answer turn (Spotlight, the Genos
// page, the thread and note Ask modals) and Spotlight's history archive.
//
// ReactMarkdown's anchor override. When the href carries our
// `spotlight-citation:` sentinel (see `rewriteCitations`), it renders a styled
// <button> that fires `onPreview(source)` on click. Any other href (the model
// occasionally inlines a real URL, e.g. for web-search results) falls through
// to a normal external-link anchor that says where it goes.
//
// Props-only, on purpose: it never reads the UrlLinkModal context. What a
// click DOES belongs to the host, because the hosts differ for a real reason:
// Spotlight sits above the UrlLinkModalProvider and routes through its own
// `handleSpotlightPreview`; the Ask modals sit inside it and try the
// quick-look modal first. Pair with `agentQAUrlTransform`, which keeps the
// sentinel from being blanked on the way in.

import { Box } from "@mui/joy";

import type { SpotlightResult } from "../spotlight/types";
import { ExternalLink } from "./agentMarkdown";
import { CITATION_HREF_PREFIX } from "./citationUtils";
import { DARK_TEXT_STRONG } from "./markdownAnswerSx";

interface CitationLinkProps {
    href?: string;
    children?: React.ReactNode;
    sourcesById: ReadonlyMap<string, SpotlightResult>;
    onPreview: (r: SpotlightResult) => void;
    isDark: boolean;
}

export const CitationLink = ({
    href,
    children,
    sourcesById,
    onPreview,
    isDark,
}: CitationLinkProps) => {
    if (href && href.startsWith(CITATION_HREF_PREFIX)) {
        const token = href.slice(CITATION_HREF_PREFIX.length);
        const source = sourcesById.get(token);
        if (source) {
            return (
                <Box
                    component="button"
                    type="button"
                    sx={{
                        // Inline-link affordance, not a chrome button.
                        background: "none",
                        border: "none",
                        p: 0,
                        cursor: "pointer",
                        font: "inherit",
                        color: isDark ? DARK_TEXT_STRONG : "primary.600",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                        textUnderlineOffset: "2px",
                        // Soft hover highlight to advertise interactivity.
                        borderRadius: "3px",
                        transition: "background 100ms ease",
                        "&:hover": {
                            background: isDark
                                ? "rgba(var(--gp-brandalt-400-rgb), 0.18)"
                                : "rgba(var(--gp-brand-700-rgb), 0.10)",
                            textDecorationStyle: "solid",
                        },
                        "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.400",
                            outlineOffset: "1px",
                        },
                    }}
                    onClick={() => onPreview(source)}
                >
                    {children}
                </Box>
            );
        }
        // Unresolved sentinel — shouldn't happen post-rewriteCitations,
        // but be safe: render the children plainly without an anchor.
        return <>{children}</>;
    }
    // Any other href: an external link that says where it goes.
    return <ExternalLink href={href}>{children}</ExternalLink>;
};
