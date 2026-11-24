import { useEffect, useId, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";

import { DOCS_COPY, type DocsCopy } from "./copy/docs";
import { LpShell } from "./kit/LpShell";
import type { Lang } from "./lpLang";
import { loadManual, type LoadedManual } from "./manual/loadManual";
import { ManualMarkdown } from "./manual/ManualMarkdown";
import { parseBlocks, plainText } from "./manual/markdown";
import { hitPath, search } from "./manual/search";
import { topicSummary } from "./manual/summary";
import { groupTopics, topicOrder } from "./manual/topics";
import { DOCS_META } from "./seo/pageMeta";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/docs` and `/docs/<topic>` — the manual for people who are not signed in (MIP-2331, built on
 * the manual source of MIP-2321). `/docs` is the hub: a search box and every topic. A topic page
 * renders the same Markdown the in-app guide shows. Public and auth-free, like /support.
 *
 * The text is not in this file: topics come from `src/manual/manual.<lang>.json` (the Japanese
 * file is written by MIP-2322; until it exists a Japanese visitor reads English with a notice),
 * and the words around it (title, search box, group names) from `copy/docs.ts`.
 *
 * The search runs in the browser over the loaded JSON. It sends nothing anywhere.
 */

type State =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; loaded: LoadedManual };

/** The manual for `lang`, loaded on demand; `reload` retries after an error. */
function useManual(lang: Lang): { state: State; reload: () => void } {
    const [state, setState] = useState<State>({ status: "loading" });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let live = true;
        setState({ status: "loading" });
        loadManual(lang).then(
            (loaded) => live && setState({ status: "ready", loaded }),
            () => live && setState({ status: "error" })
        );
        return () => {
            live = false;
        };
    }, [lang, attempt]);
    return { state, reload: () => setAttempt((n) => n + 1) };
}

/** The "TODO(copy)" markers are for Ken's review in the copy file; a visitor never sees them. */
const clean = (text: string): string => text.replace(/\s*TODO\(copy\):[^\n]*$/u, "");

const countText = (c: DocsCopy, n: number): string =>
    n === 1 ? c.resultsOne : c.resultsMany.replace("{n}", String(n));

function SearchBox({
    c,
    query,
    onChange,
}: {
    c: DocsCopy;
    query: string;
    onChange: (value: string) => void;
}) {
    const id = useId();
    return (
        <div className="lp-docs-search">
            <label className="lp-small" htmlFor={id}>
                {c.searchLabel}
            </label>
            <input
                autoComplete="off"
                id={id}
                name="q"
                placeholder={c.searchPlaceholder}
                spellCheck={false}
                type="search"
                value={query}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

function SearchResults({
    c,
    loaded,
    query,
}: {
    c: DocsCopy;
    loaded: LoadedManual;
    query: string;
}) {
    const hits = useMemo(() => search(loaded.index(), query), [loaded, query]);
    return (
        <section aria-label={c.searchLabel} className="lp-docs-results">
            <p aria-live="polite" className="lp-small" role="status">
                {hits.length === 0 ? c.noMatch : countText(c, hits.length)}
            </p>
            <ul>
                {hits.map(({ entry, snippet }, i) => (
                    <li key={`${entry.topicId}-${entry.anchor ?? ""}-${entry.kind}-${i}`}>
                        <Link to={hitPath(entry)}>
                            <span className="lp-docs-hit-title">
                                {entry.heading ?? entry.topicTitle}
                            </span>
                            <span className="lp-docs-hit-where lp-small">
                                {entry.kind === "setting" && (
                                    <span className="lp-docs-tag">{c.settingTag}</span>
                                )}
                                {entry.heading ? entry.topicTitle : ""}
                            </span>
                            {entry.kind === "setting" ? (
                                <span className="lp-docs-hit-snippet lp-small">{entry.text}</span>
                            ) : (
                                snippet && (
                                    <span className="lp-docs-hit-snippet lp-small">
                                        {snippet.before}
                                        <mark>{snippet.match}</mark>
                                        {snippet.after}
                                    </span>
                                )
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function Status({
    c,
    state,
    reload,
}: {
    c: DocsCopy;
    state: Exclude<State, { status: "ready" }>;
    reload: () => void;
}) {
    if (state.status === "loading") {
        return (
            <p aria-live="polite" className="lp-small" role="status">
                {c.loading}
            </p>
        );
    }
    return (
        <p className="lp-small" role="alert">
            {c.loadError}{" "}
            <button className="lp-docs-retry" type="button" onClick={reload}>
                {c.retry}
            </button>
        </p>
    );
}

function Hub({ lang, loaded }: { lang: Lang; loaded: LoadedManual }) {
    const c = DOCS_COPY[lang];
    const groups = useMemo(() => groupTopics(loaded.manual.topics), [loaded]);
    return (
        <>
            {groups.map((group) => (
                <section key={group.id} className="lp-docs-group">
                    <h2>{c.groups[group.id]}</h2>
                    <ul className="lp-docs-topics">
                        {group.topics.map((topic) => (
                            <li key={topic.id}>
                                <Link to={`/docs/${topic.id}`}>
                                    <span className="lp-docs-topic-title">{topic.title}</span>
                                    <span className="lp-docs-topic-summary lp-small">
                                        {topicSummary(topic)}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
            <section className="lp-docs-group">
                <h2>{c.other.heading}</h2>
                <ul className="lp-docs-other">
                    {c.other.links.map((l) => (
                        <li key={l.to}>
                            <Link to={l.to}>{l.label}</Link>
                        </li>
                    ))}
                </ul>
            </section>
        </>
    );
}

function TopicNav({ c, loaded, current }: { c: DocsCopy; loaded: LoadedManual; current: string }) {
    const groups = useMemo(() => groupTopics(loaded.manual.topics), [loaded]);
    const list = (
        <div className="lp-docs-nav-groups">
            {groups.map((group) => (
                <div key={group.id}>
                    <p className="lp-docs-nav-group">{c.groups[group.id]}</p>
                    <ul>
                        {group.topics.map((t) => (
                            <li key={t.id}>
                                <Link
                                    aria-current={t.id === current ? "page" : undefined}
                                    to={`/docs/${t.id}`}
                                >
                                    {t.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
    return (
        <>
            {/* Wide screens: a list beside the page. Narrow: the same list, folded away. */}
            <nav aria-label={c.topicsHeading} className="lp-docs-nav lp-docs-nav--side">
                {list}
            </nav>
            <details className="lp-docs-nav lp-docs-nav--fold">
                <summary>{c.topicsHeading}</summary>
                {list}
            </details>
        </>
    );
}

function Topic({ lang, loaded, topicId }: { lang: Lang; loaded: LoadedManual; topicId: string }) {
    const c = DOCS_COPY[lang];
    const { hash } = useLocation();
    const order = useMemo(() => topicOrder(loaded.manual.topics), [loaded]);
    const index = order.findIndex((t) => t.id === topicId);
    const topic = order[index];
    const outline = useMemo(
        () =>
            topic
                ? parseBlocks(topic.markdown).flatMap((b) =>
                      b.type === "heading" && b.level === 2
                          ? [{ id: b.id, text: plainText(b.text) }]
                          : []
                  )
                : [],
        [topic]
    );

    // The page arrives after the browser has looked for its #anchor, so scroll to it here.
    useEffect(() => {
        if (!topic) return;
        let target: HTMLElement | null = null;
        try {
            target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
        } catch {
            target = null;
        }
        if (target) target.scrollIntoView();
        else window.scrollTo(0, 0);
    }, [topic, hash]);

    if (!topic) return <Navigate to="/docs" replace />;
    const prev = order[index - 1];
    const next = order[index + 1];

    return (
        <>
            <div className="lp-docs-layout">
                <TopicNav c={c} current={topicId} loaded={loaded} />
                <article className="lp-prose lp-docs-article" lang={loaded.shown}>
                    <h1 className="lp-docs-h1">{topic.title}</h1>
                    {outline.length > 1 && (
                        <nav aria-label={c.onThisPage} className="lp-docs-toc">
                            <p className="lp-docs-nav-group">{c.onThisPage}</p>
                            <ul>
                                {outline.map((o) => (
                                    <li key={o.id}>
                                        <a href={`#${o.id}`}>{o.text}</a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    )}
                    <ManualMarkdown markdown={topic.markdown} />
                    <nav aria-label={c.topicsHeading} className="lp-docs-pager">
                        {prev ? (
                            <Link rel="prev" to={`/docs/${prev.id}`}>
                                <span className="lp-small">{c.previous}</span>
                                <span>{prev.title}</span>
                            </Link>
                        ) : (
                            <span />
                        )}
                        {next ? (
                            <Link
                                className="lp-docs-pager-next"
                                rel="next"
                                to={`/docs/${next.id}`}
                            >
                                <span className="lp-small">{c.next}</span>
                                <span>{next.title}</span>
                            </Link>
                        ) : (
                            <span />
                        )}
                    </nav>
                </article>
            </div>
        </>
    );
}

function DocsBody({ lang }: { lang: Lang }) {
    const c = DOCS_COPY[lang];
    const { topic: topicId } = useParams<{ topic: string }>();
    const { state, reload } = useManual(lang);
    const [query, setQuery] = useState("");
    const searching = query.trim() !== "";
    const ready = state.status === "ready" ? state.loaded : null;

    // Following a result (or any link) ends the search, so the page it points at is what shows.
    const { pathname, hash } = useLocation();
    useEffect(() => setQuery(""), [pathname, hash]);

    // The head: the topic's own title and summary once the manual is in, the hub's until then.
    const topic = ready && topicId ? ready.manual.topics.find((t) => t.id === topicId) : undefined;
    useDocumentMeta({
        title: topic ? `${topic.title} | Genos` : DOCS_META[lang].title,
        description: topic ? topicSummary(topic) : DOCS_META[lang].description,
        lang,
        path: topicId ? `/docs/${topicId}` : "/docs",
    });

    return (
        <>
            <header className="lp-pagehead">
                <div className="lp-container lp-container--wide lp-stack-s">
                    {topicId ? (
                        <p className="lp-small">
                            <Link to="/docs">{c.backToDocs}</Link>
                        </p>
                    ) : (
                        <>
                            <h1 className="lp-title">{c.title}</h1>
                            <p className="lp-body">{clean(c.lead)}</p>
                        </>
                    )}
                    <SearchBox c={c} query={query} onChange={setQuery} />
                </div>
            </header>

            <div className="lp-container lp-container--wide lp-pagebody">
                {ready && ready.shown !== lang && (
                    <p className="lp-docs-notice" role="note">
                        {clean(c.notTranslated)}
                    </p>
                )}
                {state.status !== "ready" && <Status c={c} reload={reload} state={state} />}
                {ready && searching && <SearchResults c={c} loaded={ready} query={query} />}
                {ready && !searching && !topicId && <Hub lang={lang} loaded={ready} />}
                {ready && !searching && topicId && (
                    <Topic key={topicId} lang={lang} loaded={ready} topicId={topicId} />
                )}
            </div>
        </>
    );
}

export default function DocsPage() {
    return <LpShell active={null}>{({ lang }) => <DocsBody lang={lang} />}</LpShell>;
}
