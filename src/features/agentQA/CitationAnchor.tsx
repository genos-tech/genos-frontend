// Inline citation hyperlink — the single source of truth for "click a
// citation token inside an agent answer." Wired into ReactMarkdown's
// anchor override; on click it tries the UrlLinkModal preview first
// and falls back to a caller-supplied navigate handler.
//
// Pair this with `agentQAUrlTransform` below: ReactMarkdown's default
// `urlTransform` whitelists http/https/mailto/ircs/xmpp and blanks
// every other scheme to "" — including our `spotlight-citation:<token>`
// sentinel. Without the custom transform, the blanked href falls
// through this component's sentinel check and renders as a plain
// `<a href="" target="_blank">`, which opens the current page in a
// new tab on click. Whitelisting the sentinel keeps it intact end-to-end.

import { Box } from "@mui/joy";
import { defaultUrlTransform } from "react-markdown";

import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { SpotlightResult } from "../spotlight/types";
import { CITATION_HREF_PREFIX, sourceToUrl } from "./citationUtils";

// URL transform for ReactMarkdown that preserves our citation sentinel
// scheme and delegates everything else to its default whitelist.
export const agentQAUrlTransform = (url: string): string =>
    url.startsWith(CITATION_HREF_PREFIX) ? url : defaultUrlTransform(url);

interface CitationAnchorProps {
    href?: string;
    children?: React.ReactNode;
    sourcesById: Map<string, SpotlightResult>;
    onSelectSource?: (source: SpotlightResult) => void;
    isDark: boolean;
}

export const CitationAnchor = ({
    href,
    children,
    sourcesById,
    onSelectSource,
    isDark,
}: CitationAnchorProps) => {
    const urlLinkModal = useUrlLinkModal();
    if (href && href.startsWith(CITATION_HREF_PREFIX)) {
        const token = href.slice(CITATION_HREF_PREFIX.length);
        const source = sourcesById.get(token);
        if (source) {
            // Click handling: prefer the modal preview (lets the user
            // peek without losing place in the conversation), fall back
            // to the caller's navigate handler when no preview is
            // available — either we're outside a UrlLinkModalProvider,
            // the entity type has no preview yet (projects), or the
            // resolved href shape isn't modal-able.
            const handleClick = () => {
                const previewHref = sourceToUrl(source);
                if (previewHref && urlLinkModal) {
                    const outcome = urlLinkModal.openModalByHref(previewHref);
                    if (outcome === "opened") return;
                }
                onSelectSource?.(source);
            };
            return (
                <Box
                    component="button"
                    type="button"
                    sx={{
                        background: "none",
                        border: "none",
                        p: 0,
                        cursor: "pointer",
                        font: "inherit",
                        color: isDark ? "#a5b4fc" : "#6366f1",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                        textUnderlineOffset: "2px",
                        borderRadius: "3px",
                        transition: "background 100ms ease",
                        "&:hover": {
                            background: isDark
                                ? "rgba(167,139,250,0.18)"
                                : "rgba(124,58,237,0.10)",
                            textDecorationStyle: "solid",
                        },
                        "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: isDark ? "#a5b4fc" : "#6366f1",
                            outlineOffset: "1px",
                        },
                    }}
                    onClick={handleClick}
                >
                    {children}
                </Box>
            );
        }
        // Unresolved sentinel — render the children plain. Shouldn't
        // happen post-rewriteCitations but be defensive.
        return <>{children}</>;
    }
    return (
        <a href={href} rel="noopener noreferrer" target="_blank">
            {children}
        </a>
    );
};
