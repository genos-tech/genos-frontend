import { Link } from "react-router-dom";

import { CONTACT_EMAIL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import {
    ENACTED_ON,
    TERMS_ARTICLES,
    TERMS_CONTACT_EN,
    TERMS_CONTACT_HEADING_JA,
    TERMS_CONTACT_JA,
    TERMS_DRAFT_NOTICE,
    TERMS_EN_HEADING,
    TERMS_EN_LINK_LABEL,
    TERMS_EN_NOTE,
    TERMS_ENACTED_LABEL_JA,
    TERMS_INTRO_JA,
    TERMS_STATUS,
    TERMS_SUBTITLE_EN,
    TERMS_SUMMARY_EN,
    TERMS_TITLE_JA,
    TERMS_TOC_LABEL,
} from "./termsContent";

/**
 * `/terms` — 利用規約 (Terms of Service).
 *
 * Same conventions as `/privacy` and `/legal`: a public, auth-free legal
 * document inside the marketing shell, deliberately NOT run through the app
 * i18n (the wording must not drift per locale). Japanese is the operative text,
 * an English summary follows; the shell's ja/en toggle switches the header and
 * footer, not this body. A visitor whose app locale has no LP copy (fr, zh, ...)
 * gets the English shell and the same two sections.
 *
 * Every word of the terms lives in `termsContent.ts`; this file only lays it
 * out. The route exists only when `VITE_SHOW_TERMS_PAGE=true` (termsRoute.tsx).
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
                                {TERMS_SUBTITLE_EN}
                            </p>
                            {TERMS_STATUS === "draft" && (
                                <p
                                    className="lp-note"
                                    data-testid="terms-draft-notice"
                                    role="note"
                                >
                                    <span lang="ja">{TERMS_DRAFT_NOTICE.ja}</span>
                                    <br />
                                    <span lang="en">{TERMS_DRAFT_NOTICE.en}</span>
                                </p>
                            )}
                        </div>
                    </header>

                    <div className="lp-container lp-container--narrow lp-pagebody">
                        <article className="lp-prose">
                            <div className="lp-pagesection" lang="ja">
                                <nav aria-label={TERMS_TOC_LABEL} className="lp-toc">
                                    {TERMS_ARTICLES.map((article) => (
                                        <a key={article.id} href={`#${article.id}`}>
                                            {article.heading.split("（")[0]}
                                        </a>
                                    ))}
                                    <a href="#terms-en" lang="en">
                                        {TERMS_EN_LINK_LABEL}
                                    </a>
                                </nav>
                                <p>{TERMS_INTRO_JA}</p>
                                <div className="lp-sections">
                                    {TERMS_ARTICLES.map((article) => (
                                        <section key={article.id}>
                                            <h2 id={article.id}>{article.heading}</h2>
                                            <div className="lp-sec-body">
                                                {article.lead && <p>{article.lead}</p>}
                                                {article.clauses && (
                                                    <ol>
                                                        {article.clauses.map((clause) => (
                                                            <li key={clause}>{clause}</li>
                                                        ))}
                                                    </ol>
                                                )}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                                <h2>{TERMS_CONTACT_HEADING_JA}</h2>
                                <p>
                                    {TERMS_CONTACT_JA}：
                                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                                </p>
                                <p>
                                    {TERMS_ENACTED_LABEL_JA}：{ENACTED_ON}
                                </p>
                            </div>

                            <section className="lp-pagesection" id="terms-en" lang="en">
                                <h2>{TERMS_EN_HEADING}</h2>
                                <p className="lp-small">{TERMS_EN_NOTE}</p>
                                <ul>
                                    {TERMS_SUMMARY_EN.map((item) => (
                                        <li key={item.lead}>
                                            <b>{item.lead}</b> {item.body}
                                        </li>
                                    ))}
                                </ul>
                                <p>
                                    {TERMS_CONTACT_EN}:{" "}
                                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
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
