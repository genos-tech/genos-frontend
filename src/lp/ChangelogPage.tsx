import { Link } from "react-router-dom";

import { CHANGELOG_ENTRIES } from "./changelog/changelog";
import { CHANGELOG_RSS_PATH } from "./changelog/rss";
import { CHANGELOG_COPY } from "./copy/changelog";
import { LpShell } from "./kit/LpShell";
import type { Lang } from "./lpLang";
import { CHANGELOG_META } from "./seo/pageMeta";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/changelog` — dated updates from merged work, a public roadmap with `Live`
 * and `Coming` labels and no dates, and the RSS feed (MIP-1257).
 *
 * Public and auth-free, same shell as `/support`. The entries come from
 * `changelog/entries.json`; the roadmap copy and its labels from
 * `copy/changelog.ts`. The feed is written at build time (`scripts/lpSeo.ts`).
 */

const dateFormat = (lang: Lang) =>
    new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });

function ChangelogBody({ lang }: { lang: Lang }) {
    const c = CHANGELOG_COPY[lang];
    useDocumentMeta({ ...CHANGELOG_META[lang], lang });
    const format = dateFormat(lang);
    return (
        <>
            <header className="lp-pagehead">
                <div className="lp-container lp-container--narrow lp-stack-s">
                    <h1 className="lp-title">{c.title}</h1>
                    <p className="lp-body">{c.lead}</p>
                </div>
            </header>
            <div className="lp-container lp-container--narrow lp-pagebody">
                <article className="lp-prose">
                    <section aria-labelledby="roadmap-heading" id="roadmap">
                        <h2 id="roadmap-heading">{c.roadmapHeading}</h2>
                        <p>{c.roadmapLead}</p>
                        <ul className="lp-roadmap">
                            {c.roadmap.map((item) => (
                                <li key={item.text}>
                                    <span
                                        className={
                                            item.status === "live"
                                                ? "lp-badge lp-badge--success"
                                                : "lp-badge lp-badge--coming"
                                        }
                                    >
                                        {c.statusLabel[item.status]}
                                    </span>{" "}
                                    {item.text}
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section aria-labelledby="updates-heading" id="updates">
                        <h2 id="updates-heading">{c.changelogHeading}</h2>
                        <p>{c.changelogLead}</p>
                        {CHANGELOG_ENTRIES.map((entry) => (
                            <section
                                key={entry.id}
                                aria-labelledby={`${entry.id}-title`}
                                id={entry.id}
                            >
                                <p className="lp-small">
                                    <time dateTime={entry.date}>
                                        {format.format(new Date(`${entry.date}T00:00:00Z`))}
                                    </time>
                                </p>
                                <h3 id={`${entry.id}-title`}>{entry[lang].title}</h3>
                                <p>{entry[lang].body}</p>
                            </section>
                        ))}
                    </section>
                    <section aria-labelledby="rss-heading">
                        <h2 id="rss-heading">{c.rssLabel}</h2>
                        <p>
                            {c.rssHint} <a href={CHANGELOG_RSS_PATH}>{CHANGELOG_RSS_PATH}</a>
                        </p>
                    </section>
                    <section>
                        <h2>{c.moreHeading}</h2>
                        <p>
                            <Link to="/support">{c.support}</Link>
                            {" · "}
                            <Link to="/privacy">{c.privacy}</Link>
                        </p>
                    </section>
                </article>
            </div>
        </>
    );
}

export default function ChangelogPage() {
    return <LpShell active={null}>{({ lang }) => <ChangelogBody lang={lang} />}</LpShell>;
}
