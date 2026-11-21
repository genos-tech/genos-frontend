import { Link } from "react-router-dom";

import { ACCESSIBILITY_COPY } from "./copy/accessibility";
import { LpShell } from "./kit/LpShell";
import type { Lang } from "./lpLang";
import { ACCESSIBILITY_META } from "./seo/pageMeta";
import { SUPPORT_EMAIL } from "./supportLabels";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/accessibility` — what Genos does for accessibility, what is not done yet,
 * and which browsers and devices are supported (MIP-1265).
 *
 * Public and auth-free, same shell as `/support`. Every statement is written
 * from what the code tests; the claim-by-claim evidence is in the PR body.
 * The page links to the support address and says how to report a problem.
 */

function AccessibilityBody({ lang }: { lang: Lang }) {
    const c = ACCESSIBILITY_COPY[lang];
    useDocumentMeta({ ...ACCESSIBILITY_META[lang], lang });
    const sections = [c.sections.covered, c.sections.gaps, c.sections.browsers, c.sections.report];
    return (
        <>
            <header className="lp-pagehead">
                <div className="lp-container lp-container--narrow lp-stack-s">
                    <h1 className="lp-title">{c.title}</h1>
                    <p className="lp-body">{c.lead}</p>
                    <p className="lp-small">{c.lastReviewed}</p>
                </div>
            </header>
            <div className="lp-container lp-container--narrow lp-pagebody">
                <article className="lp-prose">
                    {sections.map((section) => (
                        <section key={section.heading}>
                            <h2>{section.heading}</h2>
                            {section.body.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                            {section === c.sections.report && (
                                <p className="lp-small">
                                    {c.contactEmailLabel}{" "}
                                    <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                                    <br />
                                    {c.contactCopyLabel}{" "}
                                    <span translate="no">{SUPPORT_EMAIL}</span>
                                </p>
                            )}
                        </section>
                    ))}
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

export default function AccessibilityPage() {
    return <LpShell active={null}>{({ lang }) => <AccessibilityBody lang={lang} />}</LpShell>;
}
