import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Flow } from "../guides/Flow";
import { pictureSize } from "./pictureSize";

/**
 * Blog prose renderer. Uses the same markdown stack as Spotlight answers
 * (react-markdown + GFM). The elements render as plain HTML and `lp-prose`
 * (kit/lp.css) styles them, so the blog reads like every other long page on
 * the site and follows the page's light/dark choice.
 * Server-authored marketing copy only — no user-generated HTML.
 *
 * Two things make a post visual (MIP-2416): a screenshot gets its size, so nothing jumps when it
 * loads, and a ```flow block (one box per line) is drawn as a diagram.
 */
const components: Components = {
    img: ({ src, alt }) => {
        if (typeof src !== "string" || !src) return null;
        // Opens full size: on a phone the words inside a screenshot are small.
        return (
            <a href={src} rel="noreferrer" target="_blank">
                <img alt={alt} className="lp-blog-figure" src={src} {...pictureSize(src)} />
            </a>
        );
    },
    // A flow is not code, so it loses the code block's box.
    pre: ({ node, children }) => {
        const first = node?.children[0];
        const isFlow =
            first?.type === "element" && String(first.properties.className) === "language-flow";
        return isFlow ? <>{children}</> : <pre>{children}</pre>;
    },
    code: ({ className, children }) =>
        className === "language-flow" ? (
            <Flow steps={String(children).trim().split("\n")} />
        ) : (
            <code className={className}>{children}</code>
        ),
    table: ({ children }) => (
        <div className="lp-table-scroll">
            <table>{children}</table>
        </div>
    ),
    a: ({ href, children }) => {
        if (!href) return <>{children}</>;
        const external = /^https?:\/\//i.test(href);
        return (
            <a href={href} {...(external ? { rel: "noreferrer", target: "_blank" } : {})}>
                {children}
            </a>
        );
    },
};

export function BlogMarkdown({ markdown }: { markdown: string }) {
    return (
        <div className="lp-prose">
            <ReactMarkdown
                components={components}
                remarkPlugins={[remarkGfm]}
                urlTransform={defaultUrlTransform}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
}
