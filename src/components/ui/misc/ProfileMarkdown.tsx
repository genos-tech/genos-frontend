// The deliberately small markdown a profile blurb is allowed to be.
//
// The other markdown surfaces in the app (`DigestBody`, the Spotlight and
// agent answers) render text the SERVER authored, so their job is to show
// all of it. This one renders text a colleague typed about themselves,
// which is a different job: a profile card is a fixed slot in a shared
// layout, and everything markdown can do to break out of that slot is
// something one person can then do to everyone else's view of them.
//
// So the block-level grammar is disallowed rather than styled down. A
// heading is turned back into a paragraph instead of being shrunk,
// because shrinking it invites the next size up; images are dropped
// rather than sized, because the objection isn't their size — a remote
// `<img>` in a profile is an IP-address beacon that fires for every
// teammate who opens it.
//
// What survives is the grammar of a sentence: emphasis, links, lists,
// inline code. Anything else renders as the text the author typed, which
// is a readable outcome for someone who pasted a heading and a fair one
// for someone probing the edges.

import type { ReactNode } from "react";
import { Box } from "@mui/joy";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Render children in place, dropping the wrapper element entirely. */
const Unwrap = ({ children }: { children?: ReactNode }) => <>{children}</>;

const components: Components = {
    // Blocks that would resize or restructure the card. `h1`-`h6` become
    // paragraphs so the words survive; the rest unwrap to their text.
    h1: ({ children }) => <p>{children}</p>,
    h2: ({ children }) => <p>{children}</p>,
    h3: ({ children }) => <p>{children}</p>,
    h4: ({ children }) => <p>{children}</p>,
    h5: ({ children }) => <p>{children}</p>,
    h6: ({ children }) => <p>{children}</p>,
    blockquote: Unwrap,
    pre: Unwrap,
    table: Unwrap,
    thead: Unwrap,
    tbody: Unwrap,
    tr: Unwrap,
    th: Unwrap,
    td: Unwrap,
    hr: () => null,
    // Not rendered at all. A profile is loaded by every colleague who
    // clicks the avatar, so a remote image here is a request each of them
    // makes to a host of the author's choosing.
    img: () => null,
    a: ({ href, children }) => {
        // `defaultUrlTransform` blanks javascript: and data: URLs; a
        // blanked href would otherwise render as a link to the current
        // page, which looks live and isn't.
        if (!href) return <>{children}</>;
        return (
            <a href={href} rel="noopener noreferrer nofollow ugc" target="_blank">
                {children}
            </a>
        );
    },
};

type Props = {
    text: string;
    isDark: boolean;
};

export const ProfileMarkdown = ({ text, isDark }: Props) => (
    <Box
        sx={{
            fontSize: "14px",
            lineHeight: 1.6,
            color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
            // Someone will paste a URL with no spaces in it, and without
            // this the card grows a horizontal scrollbar on every viewport.
            overflowWrap: "anywhere",
            "& p": { m: 0, mb: 0.75 },
            "& p:last-child": { mb: 0 },
            "& ul, & ol": { m: 0, mb: 0.75, pl: 2.5 },
            "& li": { mb: 0.25 },
            "& code": {
                fontSize: "0.85em",
                px: 0.5,
                borderRadius: "4px",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            },
            "& a": {
                color: isDark ? "#a5b4fc" : "#6366f1",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
            },
        }}
    >
        <ReactMarkdown
            components={components}
            remarkPlugins={[remarkGfm]}
            urlTransform={defaultUrlTransform}
        >
            {text}
        </ReactMarkdown>
    </Box>
);
