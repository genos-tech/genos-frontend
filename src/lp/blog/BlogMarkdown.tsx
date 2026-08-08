import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Blog prose renderer. Uses the same markdown stack as Spotlight answers
 * (react-markdown + GFM) with Tailwind classes that match the LP shell.
 * Server-authored marketing copy only — no user-generated HTML.
 */
const components: Components = {
    h1: ({ children }) => (
        <h1 className="mt-10 text-3xl font-black tracking-tight text-slate-950 first:mt-0 dark:text-white">
            {children}
        </h1>
    ),
    h2: ({ children }) => (
        <h2 className="mt-10 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            {children}
        </h2>
    ),
    h3: ({ children }) => (
        <h3 className="mt-8 text-xl font-black tracking-tight text-slate-900 dark:text-white">
            {children}
        </h3>
    ),
    p: ({ children }) => (
        <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">{children}</p>
    ),
    ul: ({ children }) => (
        <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-slate-600 dark:text-slate-300">
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-7 text-slate-600 dark:text-slate-300">
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="mt-6 border-l-4 border-violet-300 bg-violet-50/60 px-5 py-3 text-slate-700 dark:border-violet-400/40 dark:bg-white/5 dark:text-slate-200">
            {children}
        </blockquote>
    ),
    a: ({ href, children }) => {
        if (!href) return <>{children}</>;
        const external = /^https?:\/\//i.test(href);
        return (
            <a
                className="font-semibold text-violet-700 underline decoration-violet-300/70 underline-offset-2 transition hover:text-violet-900 dark:text-violet-300 dark:hover:text-white"
                href={href}
                {...(external ? { rel: "noreferrer", target: "_blank" } : {})}
            >
                {children}
            </a>
        );
    },
    strong: ({ children }) => (
        <strong className="font-black text-slate-900 dark:text-white">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    hr: () => <hr className="my-10 border-violet-100 dark:border-white/10" />,
    code: ({ className, children }) => {
        const isBlock = Boolean(
            className?.includes("language-") || String(children).includes("\n")
        );
        if (isBlock) {
            return (
                <code className="block overflow-x-auto whitespace-pre font-mono text-[0.8125rem] leading-6 text-slate-100">
                    {children}
                </code>
            );
        }
        return (
            <code className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[0.875rem] text-violet-800 dark:bg-white/10 dark:text-violet-200">
                {children}
            </code>
        );
    },
    pre: ({ children }) => (
        <pre className="mt-6 overflow-x-auto rounded-2xl bg-slate-900 p-4 dark:bg-black/60">
            {children}
        </pre>
    ),
    table: ({ children }) => (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-violet-100 dark:border-white/10">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }) => (
        <thead className="bg-violet-50 text-slate-900 dark:bg-white/10 dark:text-white">
            {children}
        </thead>
    ),
    th: ({ children }) => (
        <th className="border-b border-violet-100 px-4 py-3 font-black dark:border-white/10">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="border-b border-violet-50 px-4 py-3 align-top text-slate-600 dark:border-white/5 dark:text-slate-300">
            {children}
        </td>
    ),
};

export function BlogMarkdown({ markdown }: { markdown: string }) {
    return (
        <div className="blog-markdown">
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
