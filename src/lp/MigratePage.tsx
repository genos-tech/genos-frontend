import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { MIGRATE_COPY, type MigrateCopy } from "./copy/migrate";
import { LpShell } from "./kit/LpShell";
import type { Lang } from "./lpLang";
import { MIGRATE_META } from "./seo/pageMeta";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/migrate` — moving into Genos (MIP-1260): what can be imported today (Markdown notes, one file or a
 * whole folder), how tasks are made, and the honest list of what has no import. Public and auth-free,
 * like /docs and /support.
 *
 * Copy is in `copy/migrate.ts`. Inline markup: **bold**, `code`, [label](#anchor) or [label](/path).
 * The `TODO(copy)` markers are for Ken's review and are never shown to a visitor.
 */

/** Same markup as DocsPage's renderer; one copy per page until both are merged, then one shared module. */
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;

const stripTodo = (text: string): string => text.replace(/\s*TODO\(copy\):[^\n]*$/u, "");

function Inline({ text }: { text: string }): ReactNode {
    return (
        <>
            {stripTodo(text)
                .split(TOKEN)
                .map((part, i) => {
                    if (part === "") return null;
                    if (part.startsWith("**") && part.endsWith("**")) {
                        return <b key={i}>{part.slice(2, -2)}</b>;
                    }
                    if (part.startsWith("`") && part.endsWith("`")) {
                        return <code key={i}>{part.slice(1, -1)}</code>;
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

function MigrateBody({ lang }: { lang: Lang }) {
    const c: MigrateCopy = MIGRATE_COPY[lang];
    useDocumentMeta({ ...MIGRATE_META[lang], lang });

    const list = (items: string[]) => (
        <ol>
            {items.map((s) => (
                <li key={s}>
                    <Inline text={s} />
                </li>
            ))}
        </ol>
    );

    return (
        <>
            <header className="lp-pagehead">
                <div className="lp-container lp-container--narrow lp-stack-s">
                    <h1 className="lp-title">{c.title}</h1>
                    <p className="lp-body">
                        <Inline text={c.lead} />
                    </p>
                </div>
            </header>

            <div className="lp-container lp-container--narrow lp-pagebody">
                <article className="lp-prose">
                    <section id="start">
                        <h2>{c.startHeading}</h2>
                        <p>{c.startIntro}</p>
                        {list(c.startSteps)}
                    </section>

                    <section id="notes">
                        <h2>{c.notesHeading}</h2>
                        <p>{c.notesIntro}</p>
                        <h3>{lang === "ja" ? "1つのファイル" : "One file"}</h3>
                        {list(c.notesOne)}
                        <h3>{lang === "ja" ? "フォルダ全体" : "A whole folder"}</h3>
                        {list(c.notesFolder)}
                        <p>
                            <Inline text={c.notesBack} />
                        </p>
                    </section>

                    <section id="tasks">
                        <h2>{c.tasksHeading}</h2>
                        <p>
                            <Inline text={c.tasksBody} />
                        </p>
                    </section>

                    <section id="gaps">
                        <h2>{c.gapsHeading}</h2>
                        <p>{c.gapsIntro}</p>
                        <dl>
                            {c.gaps.map((g) => (
                                <Fragment key={g.tool}>
                                    <dt>
                                        <b>{g.tool}</b>
                                    </dt>
                                    <dd>
                                        <Inline text={g.body} />
                                    </dd>
                                </Fragment>
                            ))}
                        </dl>
                        <p>{c.gapsOutro}</p>
                    </section>

                    <section>
                        <h2>{c.nextHeading}</h2>
                        <ul>
                            {c.nextLinks.map((l) => (
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

export default function MigratePage() {
    return <LpShell active={null}>{({ lang }) => <MigrateBody lang={lang} />}</LpShell>;
}
