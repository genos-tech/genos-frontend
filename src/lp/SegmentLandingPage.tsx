import { ArrowRight, CheckCircle2, Plus } from "lucide-react";

import { APP_URL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import { Shot } from "./kit/Shot";
import { SHOT_ALT } from "./kit/shotAlts";
import type { ShotName } from "./kit/shots";
import type { Lang } from "./lpLang";
import { SEGMENTS, type SegmentKey } from "./segments";
import { createSegmentMailtoHref, SEGMENT_LABELS } from "./segments/shared";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * The four audience pages (/for-research, /for-teams, /for-projects,
 * /for-students), one template (MIP-1232).
 *
 * The page answers, in order: is this for me (hero, audience), what is wrong
 * with how I do it today (the questions), how does the work flow (steps), what
 * do I get (three features, each with a real screenshot), what can I ask, what
 * works today and what does not exist yet, and the usual objections (FAQ).
 * Copy lives in `segments/<key>.ts`; nothing here is audience-specific.
 */

/** Which real screenshot illustrates which part of each audience's page. */
const SEGMENT_SHOTS: Record<
    SegmentKey,
    { hero: ShotName; features: [ShotName, ShotName, ShotName] }
> = {
    research: { hero: "note", features: ["note", "ask", "tasks"] },
    teams: { hero: "tasks", features: ["note", "approval", "tasks"] },
    projects: { hero: "task", features: ["chat", "task", "board"] },
    students: { hero: "todo", features: ["note", "todo", "ask"] },
};

function SegmentBody({
    segment,
    lang,
    appHref,
}: {
    segment: SegmentKey;
    lang: Lang;
    appHref: (url: string) => string;
}) {
    const config = SEGMENTS[segment];
    const t = config[lang];
    const labels = SEGMENT_LABELS[lang];
    const shots = SEGMENT_SHOTS[segment];
    const alt = SHOT_ALT[lang];

    useDocumentMeta({
        title: t.meta.title,
        description: t.meta.description,
        ogTitle: t.meta.ogTitle,
        ogDescription: t.meta.ogDescription,
    });

    const secondaryHref =
        config.secondaryCtaKind === "anchor"
            ? "#workflow"
            : createSegmentMailtoHref(lang, config.mailtoTag);

    return (
        <>
            <section className="lp-hero">
                <div className="lp-container">
                    <div className="lp-hero__copy lp-stack-m">
                        <h1 className="lp-display">{t.hero.title}</h1>
                        <p className="lp-lead" style={{ color: "var(--lp-text)" }}>
                            {t.hero.sub}
                        </p>
                        <p className="lp-lead">{t.hero.lead}</p>
                        <div className="lp-actions" style={{ paddingTop: 8 }}>
                            <a className="lp-btn lp-btn--primary" href={appHref(APP_URL)}>
                                {t.hero.primary}
                                <ArrowRight size={16} aria-hidden />
                            </a>
                            <a className="lp-btn lp-btn--secondary" href={secondaryHref}>
                                {t.hero.secondary}
                            </a>
                        </div>
                        <p className="lp-small">{t.hero.footnote}</p>
                    </div>
                    <div style={{ marginTop: 48 }}>
                        <Shot alt={alt[shots.hero]} lang={lang} name={shots.hero} priority />
                    </div>
                    <ul className="lp-points" style={{ marginTop: 32 }}>
                        {t.trust.map((item) => (
                            <li key={item}>
                                <CheckCircle2 aria-hidden />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="lp-section" id="questions">
                <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                    <div className="lp-stack-m">
                        <p className="lp-kicker">{labels.questions}</p>
                        <h2 className="lp-h2">{t.questions.title}</h2>
                        <p className="lp-lead">{t.questions.closing}</p>
                    </div>
                    <div className="lp-rows">
                        {t.questions.items.map((item) => (
                            <div key={item} className="lp-row">
                                <span className="lp-h3">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="lp-section lp-section--subtle" id="workflow">
                <div className="lp-container lp-stack-l">
                    <div className="lp-head">
                        <p className="lp-kicker">{labels.workflow}</p>
                        <h2 className="lp-h2">{t.workflow.title}</h2>
                        <p className="lp-lead">{t.workflow.body}</p>
                    </div>
                    <ol className="lp-steps">
                        {t.workflow.steps.map((step, index) => (
                            <li key={step} className="lp-steps__item">
                                <span className="lp-steps__n lp-num" aria-hidden>
                                    {index + 1}
                                </span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {t.features.map((feature, index) => (
                <section
                    key={feature.title}
                    className={index % 2 === 1 ? "lp-section lp-section--subtle" : "lp-section"}
                >
                    <div
                        className={`lp-container lp-split${index % 2 === 1 ? " lp-split--flip" : ""}`}
                    >
                        <div className="lp-stack-m">
                            {index === 0 && <p className="lp-kicker">{labels.features}</p>}
                            <h2 className="lp-h2">{feature.title}</h2>
                            <p className="lp-lead">{feature.subtitle}</p>
                            <ul className="lp-points">
                                {feature.bullets.map((bullet) => (
                                    <li key={bullet}>
                                        <CheckCircle2 aria-hidden />
                                        <span>{bullet}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <Shot
                            alt={alt[shots.features[index]]}
                            lang={lang}
                            name={shots.features[index]}
                        />
                    </div>
                </section>
            ))}

            <section className="lp-section" id="ask">
                <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                    <div className="lp-stack-m">
                        <p className="lp-kicker">{labels.ai}</p>
                        <h2 className="lp-h2">{t.ai.title}</h2>
                        <p className="lp-lead">{t.ai.body}</p>
                    </div>
                    <div>
                        <p className="lp-small" style={{ marginBottom: 12 }}>
                            {labels.askLabel}
                        </p>
                        <div className="lp-prompts">
                            {t.ai.prompts.map((prompt) => (
                                <p key={prompt} className="lp-prompt">
                                    {prompt}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="lp-section lp-section--subtle" id="status">
                <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                    <div className="lp-stack-m">
                        <h2 className="lp-h3">{labels.now}</h2>
                        <ul className="lp-points">
                            {t.now.map((item) => (
                                <li key={item}>
                                    <CheckCircle2 aria-hidden />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="lp-stack-m">
                        <h2 className="lp-h3">{labels.coming}</h2>
                        <ul className="lp-points">
                            {t.coming.map((item) => (
                                <li key={item}>
                                    <Plus aria-hidden />
                                    <span>
                                        {item}{" "}
                                        <span className="lp-badge lp-badge--coming">
                                            {labels.comingBadge}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            <section className="lp-section">
                <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                    <div className="lp-stack-m">
                        <p className="lp-kicker">{labels.audience}</p>
                        <h2 className="lp-h2">{t.audience.title}</h2>
                        <blockquote className="lp-quote">{t.audience.quote}</blockquote>
                    </div>
                    <ul className="lp-points">
                        {t.audience.items.map((item) => (
                            <li key={item}>
                                <CheckCircle2 aria-hidden />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="lp-section" id="faq">
                <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                    <h2 className="lp-h2">{t.faq.title}</h2>
                    <div className="lp-faq">
                        {t.faq.items.map((item) => (
                            <details key={item.q}>
                                <summary>
                                    {item.q}
                                    <Plus size={18} aria-hidden />
                                </summary>
                                <div>{item.a}</div>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            <section className="lp-section lp-section--flush" style={{ paddingTop: 0 }}>
                <div className="lp-container">
                    <div className="lp-cta">
                        <div className="lp-stack-s">
                            <h2 className="lp-h2">{t.cta.title}</h2>
                            <p className="lp-body">{t.cta.body}</p>
                        </div>
                        <div className="lp-actions">
                            <a className="lp-btn lp-btn--primary" href={appHref(APP_URL)}>
                                {t.cta.primary}
                                <ArrowRight size={16} aria-hidden />
                            </a>
                            <a className="lp-btn lp-btn--secondary" href={secondaryHref}>
                                {t.cta.secondary}
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

export default function SegmentLandingPage({ segment }: { segment: SegmentKey }) {
    return (
        <LpShell active={null}>
            {({ lang, appHref }) => (
                <SegmentBody appHref={appHref} lang={lang} segment={segment} />
            )}
        </LpShell>
    );
}
