import { Mail } from "lucide-react";
import { Link } from "react-router-dom";

import { SECURITY_COPY } from "./copy/security";
import { LpShell } from "./kit/LpShell";
import type { Lang } from "./lpLang";
import { SECURITY_META } from "./seo/pageMeta";
import { SUPPORT_EMAIL } from "./supportLabels";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/security` — how Genos handles data (MIP-1248). Public and auth-free, the same shell and
 * ja/en toggle as `/support`, `/privacy` and `/legal`. Every statement is in `copy/security.ts`
 * with its evidence next to it. Facts only the operator can confirm are not on this page, except the
 * MIP-2284 statements (the host's attestations, the guidance we refer to, the basic policy), which Ken decided on
 * 2026-11-24 and which go live only after he and counsel approve the wording.
 */

function SecurityBody({ lang }: { lang: Lang }) {
    const c = SECURITY_COPY[lang];
    useDocumentMeta({ ...SECURITY_META[lang], lang });

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
                    {c.sections.map((section) => (
                        <section key={section.id} id={section.id}>
                            <h2>{section.heading}</h2>
                            {section.body.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                            {section.links && (
                                <ul aria-label={c.sourcesLabel}>
                                    {section.links.map((link) => (
                                        <li key={link.href}>
                                            <a href={link.href} rel="noopener noreferrer">
                                                {link.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}

                    <section>
                        <h2>{c.reportLabel}</h2>
                        <p>
                            <a
                                className="lp-btn lp-btn--secondary"
                                data-cta="security_report_email"
                                href={`mailto:${SUPPORT_EMAIL}?subject=Security`}
                            >
                                <Mail size={16} aria-hidden />
                                {c.reportButton}
                            </a>
                        </p>
                    </section>

                    <section>
                        <h2>{c.moreHeading}</h2>
                        <p>
                            <Link to="/privacy">{c.privacy}</Link>
                            {" · "}
                            <Link to="/legal">{c.legal}</Link>
                        </p>
                    </section>
                </article>
            </div>
        </>
    );
}

export default function SecurityPage() {
    return <LpShell active={null}>{({ lang }) => <SecurityBody lang={lang} />}</LpShell>;
}
