import { Fragment, useState } from "react";
import { Link } from "react-router-dom";

import { cycleKeys, shortcutText, type ShortcutId } from "../shortcuts";
import { DOCS_COPY, type DocsCopy, type DocsSectionId } from "./copy/docs";
import { LpShell } from "./kit/LpShell";
import type { Lang } from "./lpLang";
import { DOCS_META } from "./seo/pageMeta";
import { SUPPORT_MCP_ADDRESS } from "./supportLabels";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/docs` — the help hub (MIP-1259): getting started, connecting Claude, API keys,
 * schedules, exporting data, keyboard shortcuts and the FAQ, on one page with an
 * anchor per guide. Public and auth-free, like /support: someone who has not
 * signed up yet is exactly who reads it.
 *
 * The copy is in `copy/docs.ts`. Inline markup there: **bold** (a UI label),
 * `code`, [label](#anchor) or [label](/path), and {key:ShortcutId}, which is filled
 * in from the shortcut registry so the keys always match the visitor's system.
 *
 * The search box filters the guides and sections by their own text. It does not
 * search the app, and it does not send anything anywhere.
 */

/** The keys of a shortcut for this visitor's system. The cycle gesture is two keys, not a chord. */
const keysText = (id: ShortcutId): string => {
    if (id === "global.cycle") {
        const k = cycleKeys();
        return `${k.hold} + ${k.tap}`;
    }
    return shortcutText(id);
};

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\{key:[a-zA-Z.]+\})/;

/** Renders the copy's inline markup as React nodes. */
function Inline({ text }: { text: string }) {
    const parts = text.split(TOKEN);
    return (
        <>
            {parts.map((part, i) => {
                if (part === "") return null;
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <b key={i}>{part.slice(2, -2)}</b>;
                }
                if (part.startsWith("`") && part.endsWith("`")) {
                    return <code key={i}>{part.slice(1, -1)}</code>;
                }
                if (part.startsWith("{key:") && part.endsWith("}")) {
                    return (
                        <Fragment key={i}>{keysText(part.slice(5, -1) as ShortcutId)}</Fragment>
                    );
                }
                const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
                if (link) {
                    const [, label, href] = link;
                    return href.startsWith("/") ? (
                        <Link key={i} to={href}>
                            {label}
                        </Link>
                    ) : (
                        <a key={i} href={href}>
                            {label}
                        </a>
                    );
                }
                return <Fragment key={i}>{part}</Fragment>;
            })}
        </>
    );
}

/** Every string inside a value, for the search box. */
const strings = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    if (value && typeof value === "object") return Object.values(value).flatMap(strings);
    return [];
};

/** The copy key that holds each guide's text. */
const SECTION_KEY: Record<DocsSectionId, keyof DocsCopy> = {
    start: "start",
    connect: "connect",
    "api-keys": "apiKeys",
    schedules: "schedules",
    export: "export",
    shortcuts: "shortcuts",
    faq: "faq",
};

const SECTION_ORDER: DocsSectionId[] = [
    "start",
    "connect",
    "api-keys",
    "schedules",
    "export",
    "shortcuts",
    "faq",
];

function DocsBody({ lang }: { lang: Lang }) {
    const c = DOCS_COPY[lang];
    useDocumentMeta({ ...DOCS_META[lang], lang });
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();

    const matches = (id: DocsSectionId): boolean => {
        if (q === "") return true;
        const guide = c.guides[id];
        const body = strings(c[SECTION_KEY[id]]).join(" ");
        return `${guide.title} ${guide.summary} ${body}`.toLowerCase().includes(q);
    };
    const visible = SECTION_ORDER.filter(matches);

    return (
        <>
            <header className="lp-pagehead">
                <div className="lp-container lp-container--narrow lp-stack-s">
                    <h1 className="lp-title">{c.title}</h1>
                    <p className="lp-body">{c.lead}</p>
                    <label className="lp-docs-search">
                        <span className="lp-small">{c.searchLabel}</span>
                        <input
                            placeholder={c.searchPlaceholder}
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </label>
                </div>
            </header>

            <div className="lp-container lp-container--narrow lp-pagebody">
                {visible.length === 0 && <p className="lp-small">{c.noMatch}</p>}

                {visible.length > 0 && (
                    <nav aria-label={c.guidesHeading} className="lp-docs-index">
                        <h2>{c.guidesHeading}</h2>
                        <ul>
                            {visible.map((id) => (
                                <li key={id}>
                                    <a href={`#${id}`}>{c.guides[id].title}</a>
                                    <span className="lp-small"> — {c.guides[id].summary}</span>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}

                <article className="lp-prose">
                    {visible.includes("start") && (
                        <section id="start">
                            <h2>{c.start.heading}</h2>
                            <p>{c.start.intro}</p>
                            <ol>
                                {c.start.steps.map((s, i) => (
                                    <li key={i}>
                                        <Inline text={s} />
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}

                    {visible.includes("connect") && (
                        <section id="connect">
                            <h2>{c.connect.heading}</h2>
                            <p>{c.connect.intro}</p>
                            <p className="lp-small">
                                {c.connect.addressLabel}{" "}
                                <code translate="no">{SUPPORT_MCP_ADDRESS}</code>
                            </p>
                            <h3>{c.connect.claudeHeading}</h3>
                            <ol>
                                {c.connect.claudeSteps.map((s, i) => (
                                    <li key={i}>
                                        <Inline text={s} />
                                    </li>
                                ))}
                            </ol>
                            <h3>{c.connect.codeHeading}</h3>
                            <ol>
                                {c.connect.codeSteps.map((s, i) => (
                                    <li key={i}>
                                        <Inline text={s.replace("ADDRESS", SUPPORT_MCP_ADDRESS)} />
                                    </li>
                                ))}
                            </ol>
                            <p>
                                <Inline text={c.connect.plan} />
                            </p>
                            <p>
                                <Inline text={c.connect.disconnect} />
                            </p>
                            <p className="lp-small">{c.connect.trap}</p>
                        </section>
                    )}

                    {visible.includes("api-keys") && (
                        <section id="api-keys">
                            <h2>{c.apiKeys.heading}</h2>
                            <p>{c.apiKeys.intro}</p>
                            <ol>
                                {c.apiKeys.steps.map((s, i) => (
                                    <li key={i}>
                                        <Inline text={s} />
                                    </li>
                                ))}
                            </ol>
                            <h3>{c.apiKeys.usageHeading}</h3>
                            <p>
                                <Inline text={c.apiKeys.usageNote} />
                            </p>
                            <pre className="lp-docs-code">
                                <code translate="no">
                                    {c.apiKeys.usageExample.replace(
                                        "ORIGIN",
                                        new URL(SUPPORT_MCP_ADDRESS).origin
                                    )}
                                </code>
                            </pre>
                        </section>
                    )}

                    {visible.includes("schedules") && (
                        <section id="schedules">
                            <h2>{c.schedules.heading}</h2>
                            <p>{c.schedules.intro}</p>
                            <ol>
                                {c.schedules.steps.map((s, i) => (
                                    <li key={i}>
                                        <Inline text={s} />
                                    </li>
                                ))}
                            </ol>
                            <p>
                                <Inline text={c.schedules.plan} />
                            </p>
                        </section>
                    )}

                    {visible.includes("export") && (
                        <section id="export">
                            <h2>{c.export.heading}</h2>
                            <p>{c.export.intro}</p>
                            <ol>
                                {c.export.steps.map((s, i) => (
                                    <li key={i}>
                                        <Inline text={s} />
                                    </li>
                                ))}
                            </ol>
                            <p className="lp-small">{c.export.scope}</p>
                        </section>
                    )}

                    {visible.includes("shortcuts") && (
                        <section id="shortcuts">
                            <h2>{c.shortcuts.heading}</h2>
                            <p>{c.shortcuts.intro}</p>
                            <table>
                                <tbody>
                                    {c.shortcuts.rows.map((row) => (
                                        <tr key={row.id}>
                                            <td>
                                                <kbd translate="no">{keysText(row.id)}</kbd>
                                            </td>
                                            <td>{row.label}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="lp-small">{c.shortcuts.note}</p>
                        </section>
                    )}

                    {visible.includes("faq") && (
                        <section id="faq">
                            <h2>{c.faq.heading}</h2>
                            {c.faq.items.map((item) => (
                                <Fragment key={item.q}>
                                    <h3>{item.q}</h3>
                                    <p>
                                        <Inline text={item.a} />
                                    </p>
                                </Fragment>
                            ))}
                        </section>
                    )}

                    <section>
                        <h2>{c.other.heading}</h2>
                        <ul>
                            {c.other.links.map((l) => (
                                <li key={l.to}>
                                    <Link to={l.to}>{l.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                </article>
            </div>
        </>
    );
}

export default function DocsPage() {
    return <LpShell active={null}>{({ lang }) => <DocsBody lang={lang} />}</LpShell>;
}
