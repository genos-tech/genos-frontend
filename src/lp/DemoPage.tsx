import { useState } from "react";
import {
    ArrowRight,
    Bot,
    Check,
    Copy,
    CornerDownRight,
    ListTodo,
    MessageSquareText,
    Search,
    Sparkles,
    Workflow,
} from "lucide-react";

import { I18nProvider, useTranslation } from "../i18n";
import { APP_URL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import { useSyncAppLocale } from "./kit/useSyncAppLocale";
import type { Lang } from "./lpLang";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * Icon for each Spotlight prompt group, by POSITION in `t.demoPage.spotlight.groups`.
 *
 * Position, not the translated `id`: the other locales do not translate `id` (ja/ar/hi resolved
 * 0 of 7, es/fr 1 of 7 by luck) and every unresolved card fell back to a generic Sparkles.
 * `DeepPartial<Messages>` widens string literals so translators can fill keys incrementally, so
 * TypeScript cannot catch that: nothing but position is safe to rely on.
 *
 * This mirrors `FeaturesPage`'s `FEATURE_ORDER`, which iterates a code-side constant and uses
 * translations only as values. `localeGroupIds.test.ts` pins both halves.
 */
const GROUP_ICONS: ReadonlyArray<React.ComponentType> = [
    Search,
    MessageSquareText,
    Workflow,
    CornerDownRight,
    ListTodo,
    Sparkles,
    Bot,
];

/**
 * Canonical group ids, in the same order as `GROUP_ICONS`. Exported so the cross-locale test
 * asserts against the real table rather than a copy that could drift and let the test pass while
 * the page stays broken.
 */
export const GROUP_ORDER = [
    "search",
    "ask",
    "reason",
    "followup",
    "todos",
    "thread",
    "agent",
] as const;

const META: Record<Lang, { title: string; description: string }> = {
    ja: {
        title: "デモの見方 | Genos",
        description:
            "サンプルチームのワークスペースで、Genosの検索とAIを試すためのガイド。そのまま貼って使える質問つき。",
    },
    en: {
        title: "Demo guide | Genos",
        description:
            "A guide to the sample-team workspace: what is inside, and prompts you can paste to see Genos search and AI work.",
    },
};

function PromptButton({
    text,
    copyLabel,
    copiedLabel,
}: {
    text: string;
    copyLabel: string;
    copiedLabel: string;
}) {
    const [copied, setCopied] = useState(false);

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard blocked (insecure context or permission): the prompt is still readable.
        }
    };

    return (
        <button
            aria-label={`${copyLabel}: ${text}`}
            className="lp-prompt-btn"
            type="button"
            onClick={onCopy}
        >
            <span>{text}</span>
            <span aria-live="polite" className="lp-prompt-btn__state">
                {copied ? (
                    <>
                        <Check size={14} aria-hidden />
                        {copiedLabel}
                    </>
                ) : (
                    <>
                        <Copy size={14} aria-hidden />
                        {copyLabel}
                    </>
                )}
            </span>
        </button>
    );
}

function DemoBody({ lang, appHref }: { lang: Lang; appHref: (url: string) => string }) {
    const { t } = useTranslation();
    const copy = t.demoPage;
    useSyncAppLocale(lang);
    useDocumentMeta({
        title: META[lang].title,
        description: META[lang].description,
        ogTitle: META[lang].title,
        ogDescription: META[lang].description,
    });

    return (
        <>
            <section className="lp-hero">
                <div className="lp-container">
                    <div className="lp-hero__copy lp-stack-m">
                        <p className="lp-kicker">{copy.hero.badge}</p>
                        <h1 className="lp-display">{copy.hero.title}</h1>
                        <p className="lp-lead">{copy.hero.lead}</p>
                        <div className="lp-actions" style={{ paddingTop: 8 }}>
                            <a className="lp-btn lp-btn--primary" href={appHref(APP_URL)}>
                                {copy.login.cta}
                                <ArrowRight size={16} aria-hidden />
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <section className="lp-section" id="login">
                <div className="lp-container lp-stack-l">
                    <div className="lp-head">
                        <p className="lp-kicker">{copy.login.eyebrow}</p>
                        <h2 className="lp-h2">{copy.login.title}</h2>
                        <p className="lp-lead">{copy.login.lead}</p>
                    </div>
                    <ol className="lp-steps">
                        {copy.login.steps.map((step, index) => (
                            <li key={step.title} className="lp-steps__item">
                                <span className="lp-steps__n lp-num" aria-hidden>
                                    {index + 1}
                                </span>
                                <span>{step.title}</span>
                                <span className="lp-small" style={{ fontWeight: 400 }}>
                                    {step.body}
                                </span>
                            </li>
                        ))}
                    </ol>
                    <p className="lp-small">{copy.login.note}</p>
                </div>
            </section>

            <section className="lp-section lp-section--subtle" id="inside">
                <div className="lp-container lp-stack-l">
                    <div className="lp-head">
                        <p className="lp-kicker">{copy.data.eyebrow}</p>
                        <h2 className="lp-h2">{copy.data.title}</h2>
                        <p className="lp-lead">{copy.data.lead}</p>
                    </div>
                    <div className="lp-grid lp-grid--4">
                        {copy.data.cards.map((card) => (
                            <div key={card.title} className="lp-item">
                                <h3 className="lp-h3">{card.title}</h3>
                                <p className="lp-body">{card.body}</p>
                            </div>
                        ))}
                    </div>
                    <div>
                        <h3 className="lp-h3" style={{ marginBottom: 12 }}>
                            {copy.data.castTitle}
                        </h3>
                        <ul className="lp-cast">
                            {copy.data.cast.map((person) => (
                                <li key={person.name}>
                                    <strong translate="no">{person.name}</strong>
                                    <span className="lp-small">{person.role}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            <section className="lp-section" id="prompts">
                <div className="lp-container lp-stack-l">
                    <div className="lp-head">
                        <p className="lp-kicker">{copy.spotlight.eyebrow}</p>
                        <h2 className="lp-h2">{copy.spotlight.title}</h2>
                        <p className="lp-lead">{copy.spotlight.lead}</p>
                        <p className="lp-small">{copy.spotlight.copyHint}</p>
                    </div>
                    <div className="lp-grid lp-grid--2">
                        {copy.spotlight.groups.map((group, index) => {
                            const Icon = GROUP_ICONS[index] ?? Sparkles;
                            const isHeadline = "headline" in group && group.headline === true;
                            return (
                                <div
                                    key={group.id}
                                    className={
                                        isHeadline ? "lp-panel lp-panel--accent" : "lp-panel"
                                    }
                                >
                                    <div className="lp-panel__head">
                                        <span className="lp-item__icon" aria-hidden>
                                            <Icon />
                                        </span>
                                        <h3 className="lp-h3">{group.title}</h3>
                                        {isHeadline && (
                                            <span className="lp-badge lp-badge--accent">
                                                {copy.spotlight.headlineBadge}
                                            </span>
                                        )}
                                    </div>
                                    <p className="lp-small">{group.desc}</p>
                                    <div className="lp-prompts">
                                        {group.prompts.map((prompt) => (
                                            <PromptButton
                                                key={prompt}
                                                copiedLabel={copy.spotlight.copiedLabel}
                                                copyLabel={copy.spotlight.copyLabel}
                                                text={prompt}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="lp-section lp-section--flush" style={{ paddingTop: 0 }}>
                <div className="lp-container">
                    <div className="lp-cta">
                        <div className="lp-stack-s">
                            <h2 className="lp-h2">{copy.footerCta.title}</h2>
                            <p className="lp-body">{copy.footerCta.body}</p>
                        </div>
                        <div className="lp-actions">
                            <a className="lp-btn lp-btn--primary" href={appHref(APP_URL)}>
                                {copy.footerCta.button}
                                <ArrowRight size={16} aria-hidden />
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

export default function GenosDemoPage() {
    return (
        <I18nProvider>
            <LpShell active="demo">
                {({ lang, appHref }) => <DemoBody appHref={appHref} lang={lang} />}
            </LpShell>
        </I18nProvider>
    );
}
