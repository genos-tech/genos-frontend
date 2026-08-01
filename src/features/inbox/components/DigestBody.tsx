// Rich-text body for the Genos digest inbox bubble (item_type 6).
//
// The digest's `item_body.text` is agent-authored MARKDOWN. Rendering it
// as plain text (the original bubble) showed raw `**bold**` and
// `[label](task:...)` — user-reported. The backend now resolves citation
// tokens to real `/workspace/...` hrefs at save time (genos-api
// `rewrite_citation_md`), so this component only has to:
//
//   * render markdown compactly (bullets, bold, links);
//   * route INTERNAL links through the URL-link modal (peek without
//     losing your place), falling back to SPA navigation — never a
//     full-page load from a relative <a>;
//   * degrade PRE-EXISTING items that still carry raw citation tokens
//     (`task:1015`) to plain emphasized text instead of dead links.
//
// Default export so `InboxBubble` can `React.lazy` it — react-markdown
// stays out of the inbox's initial chunk.

import { Box, Typography } from "@mui/joy";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { useNavigate } from "react-router-dom";

import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";

// Old digest rows stored the agent's raw token grammar as link targets.
// Blank them (the anchor override then renders plain text) rather than
// letting defaultUrlTransform-blanked hrefs become click-the-current-page
// anchors.
const TOKEN_TARGET = /^(?:chat|task|note|project|todo|milestone):/;

const digestUrlTransform = (url: string): string =>
    TOKEN_TARGET.test(url) ? "" : defaultUrlTransform(url);

const DigestBody = ({ text, isDark }: { text: string; isDark: boolean }) => {
    const urlLinkModal = useUrlLinkModal();
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                fontSize: "0.85rem",
                lineHeight: 1.6,
                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                "& p": { m: 0, mb: 0.75 },
                "& ul, & ol": { m: 0, mb: 0.75, pl: 2.5 },
                "& li": { mb: 0.5 },
                "& li:last-child": { mb: 0 },
                "& strong": {
                    fontWeight: 700,
                    color: isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.85)",
                },
                "& code": {
                    fontSize: "0.8em",
                    px: 0.5,
                    borderRadius: "4px",
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                },
                "& a": {
                    color: isDark ? "#a5b4fc" : "#6366f1",
                    textDecoration: "underline",
                    textDecorationStyle: "dotted",
                    textUnderlineOffset: "2px",
                    "&:hover": { textDecorationStyle: "solid" },
                },
            }}
        >
            <ReactMarkdown
                urlTransform={digestUrlTransform}
                components={{
                    a: ({ href, children }) => {
                        if (!href) {
                            // A blanked citation token from a pre-rewrite
                            // digest row — show the label, not a dead link.
                            return <Typography component="span">{children}</Typography>;
                        }
                        if (href.startsWith("/")) {
                            return (
                                <a
                                    href={href}
                                    onClick={(e) => {
                                        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                                        e.preventDefault();
                                        // Every openModalByHref outcome
                                        // ("opened"/"navigated"/"external")
                                        // means it handled the click; the
                                        // router fallback is only for
                                        // rendering outside the provider.
                                        if (urlLinkModal) {
                                            urlLinkModal.openModalByHref(href);
                                            return;
                                        }
                                        navigate(href);
                                    }}
                                >
                                    {children}
                                </a>
                            );
                        }
                        return (
                            <a href={href} rel="noopener noreferrer" target="_blank">
                                {children}
                            </a>
                        );
                    },
                }}
            >
                {text}
            </ReactMarkdown>
        </Box>
    );
};

export default DigestBody;
