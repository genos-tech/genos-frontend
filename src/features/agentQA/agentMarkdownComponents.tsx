import type { Components } from "react-markdown";

import { BlockedImage, ExternalLink } from "./agentMarkdown";

/** Spread into every model-authored `ReactMarkdown`'s `components`, ahead
 *  of the surface's own overrides. `a` is supplied too, for surfaces that
 *  have no link handling of their own; one that does (citations) keeps its
 *  own and sends plain hrefs to `ExternalLink`. */
export const agentMarkdownComponents: Components = {
    img: ({ src }) => <BlockedImage src={typeof src === "string" ? src : undefined} />,
    a: ({ href, children }) => <ExternalLink href={href}>{children}</ExternalLink>,
};
