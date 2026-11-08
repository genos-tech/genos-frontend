import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Blog prose renderer. Uses the same markdown stack as Spotlight answers
 * (react-markdown + GFM). The elements render as plain HTML and `lp-prose`
 * (kit/lp.css) styles them, so the blog reads like every other long page on
 * the site and follows the page's light/dark choice.
 * Server-authored marketing copy only — no user-generated HTML.
 */
const components: Components = {
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
