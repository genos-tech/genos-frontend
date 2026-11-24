import { Fragment, useMemo } from "react";
import { Link } from "react-router-dom";

import { parseBlocks, parseInline, type Block } from "./markdown";

/** Inline marks of one line of manual text as React nodes. */
export function ManualInline({ text }: { text: string }) {
    return (
        <>
            {parseInline(text).map((part, i) => {
                switch (part.type) {
                    case "bold":
                        return <b key={i}>{part.text}</b>;
                    case "italic":
                        return <em key={i}>{part.text}</em>;
                    case "code":
                        return (
                            <code key={i} translate="no">
                                {part.text}
                            </code>
                        );
                    case "link":
                        if (part.href.startsWith("/")) {
                            return (
                                <Link key={i} to={part.href}>
                                    {part.text}
                                </Link>
                            );
                        }
                        return (
                            <a key={i} href={part.href}>
                                {part.text}
                            </a>
                        );
                    default:
                        return <Fragment key={i}>{part.text}</Fragment>;
                }
            })}
        </>
    );
}

function BlockView({ block }: { block: Block }) {
    switch (block.type) {
        case "heading":
            return block.level === 2 ? (
                <h2 id={block.id}>
                    <ManualInline text={block.text} />
                </h2>
            ) : (
                <h3 id={block.id}>
                    <ManualInline text={block.text} />
                </h3>
            );
        case "paragraph":
            return (
                <p>
                    <ManualInline text={block.text} />
                </p>
            );
        case "ul":
            return (
                <ul>
                    {block.items.map((item, i) => (
                        <li key={i}>
                            <ManualInline text={item} />
                        </li>
                    ))}
                </ul>
            );
        case "ol":
            return (
                <ol>
                    {block.items.map((item, i) => (
                        <li key={i}>
                            <ManualInline text={item} />
                        </li>
                    ))}
                </ol>
            );
        case "table":
            // The wrapper scrolls sideways on a phone and can be reached with the keyboard.
            return (
                <div className="lp-docs-table" tabIndex={0}>
                    <table>
                        <thead>
                            <tr>
                                {block.head.map((cell, i) => (
                                    <th key={i} scope="col">
                                        <ManualInline text={cell} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, r) => (
                                <tr key={r}>
                                    {row.map((cell, c) => (
                                        <td key={c}>
                                            <ManualInline text={cell} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
    }
}

/** One topic's Markdown, rendered. The first-level headings are the page's `h2`s. */
export function ManualMarkdown({ markdown }: { markdown: string }) {
    const blocks = useMemo(() => parseBlocks(markdown), [markdown]);
    return (
        <>
            {blocks.map((block, i) => (
                <BlockView key={i} block={block} />
            ))}
        </>
    );
}
