import { Link } from "react-router-dom";

import { CONTACT_EMAIL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import {
    ENACTED_ON_EN,
    ENACTED_ON_JA,
    TERMS_ARTICLES,
    TERMS_CONTACT_HEADING_EN,
    TERMS_CONTACT_HEADING_JA,
    TERMS_CONTACT_JA,
    TERMS_ENACTED_LABEL_EN,
    TERMS_ENACTED_LABEL_JA,
    TERMS_INTERIM_NOTICE,
    TERMS_INTRO_EN,
    TERMS_INTRO_JA,
    TERMS_STATUS,
    TERMS_SUBTITLE_EN,
    TERMS_SUBTITLE_JA,
    TERMS_TITLE_EN,
    TERMS_TITLE_JA,
    TERMS_TOC_LABEL,
} from "./termsContent";

/**
 * `/terms` — 利用規約 (Terms of Service), interim v1 (MIP-1843).
 *
 * Same conventions as `/privacy` and `/legal`: a public, auth-free legal
 * document inside the marketing shell, deliberately NOT run through the app
 * i18n, so the wording cannot drift per locale. Japanese is the operative
 * text; each article's English follows it. The shell's ja/en toggle switches
 * the header and footer only.
 *
 * Every word lives in `termsContent.ts`; this file only lays it out. The route
 * is mounted at `/terms` from main.tsx.
 */
export default function TermsPage() {
    return (
        <LpShell active={null}>
            {() => (
                <>
                    <header className="lp-pagehead">
                        <div className="lp-container lp-container--narrow lp-stack-s">
                            <h1 className="lp-title" lang="ja">
                                {TERMS_TITLE_JA}
                            </h1>
                            <p className="lp-body" lang="en">
                                {TERMS_TITLE_EN}
                            </p>
                            <p className="lp-small" lang="ja">
                                {TERMS_SUBTITLE_JA}
                            </p>
                            <p className="lp-small" lang="en">
                                {TERMS_SUBTITLE_EN}
                            </p>
                            {TERMS_STATUS === "interim" && (
                                <p
                                    className="lp-note"
                                    data-testid="terms-interim-notice"
                                    role="note"
                                >
                                    <span lang="ja">{TERMS_INTERIM_NOTICE.ja}</span>
                                    <br />
                                    <span lang="en">{TERMS_INTERIM_NOTICE.en}</span>
                                </p>
                            )}
                        </div>
                    </header>

                    <div className="lp-container lp-container--narrow lp-pagebody">
                        <article className="lp-prose">
                            <nav aria-label={TERMS_TOC_LABEL} className="lp-toc">
                                {TERMS_ARTICLES.map((article) => (
                                    <a key={article.id} href={`#${article.id}`} lang="ja">
                                        {article.ja.heading.split("（")[0]}
                                    </a>
                                ))}
                            </nav>

                            <p lang="ja">{TERMS_INTRO_JA}</p>
                            <p lang="en">{TERMS_INTRO_EN}</p>

                            <div className="lp-sections">
                                {TERMS_ARTICLES.map((article) => (
                                    <section
                                        key={article.id}
                                        data-article={article.id}
                                        data-testid="terms-article"
                                        id={article.id}
                                    >
                                        <h2 lang="ja">{article.ja.heading}</h2>
                                        <ol lang="ja">
                                            {article.ja.items.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ol>
                                        <h3 lang="en">{article.en.heading}</h3>
                                        <ol lang="en">
                                            {article.en.items.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ol>
                                    </section>
                                ))}
                            </div>

                            <section className="lp-pagesection">
                                <h2 lang="ja">{TERMS_CONTACT_HEADING_JA}</h2>
                                <p lang="ja">
                                    {TERMS_CONTACT_JA}：
                                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                                </p>
                                <p lang="ja">
                                    {TERMS_ENACTED_LABEL_JA}：{ENACTED_ON_JA}
                                </p>
                                <h2 lang="en">{TERMS_CONTACT_HEADING_EN}</h2>
                                <p lang="en">
                                    Questions about these Terms:{" "}
                                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                                </p>
                                <p lang="en">
                                    {TERMS_ENACTED_LABEL_EN}: {ENACTED_ON_EN}
                                </p>
                            </section>

                            <p className="lp-small">
                                <Link to="/privacy">プライバシーポリシー / Privacy Policy</Link>
                                <span className="lp-sep">·</span>
                                <Link to="/legal">特定商取引法に基づく表記 / Legal Notice</Link>
                            </p>
                        </article>
                    </div>
                </>
            )}
        </LpShell>
    );
}
