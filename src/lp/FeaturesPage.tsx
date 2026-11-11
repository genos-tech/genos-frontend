import type React from "react";
import {
    ArrowRight,
    Bell,
    Bot,
    CalendarDays,
    Code2,
    FileText,
    Inbox,
    ListChecks,
    MessageSquareText,
    Plug,
    Search,
    Sparkles,
    Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { I18nProvider, useTranslation } from "../i18n";
import { APP_URL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import { Shot } from "./kit/Shot";
import { SHOT_ALT } from "./kit/shotAlts";
import { useSyncAppLocale } from "./kit/useSyncAppLocale";
import type { Lang } from "./lpLang";
import { shortcutRows } from "./shortcutRows";
import { useDocumentMeta } from "./useDocumentMeta";

// Order + icon for each entry in `t.featuresPage.features.items`.
//
// The order is read in ROWS of three, because that is what the grid renders at wide widths: each
// row is a theme rather than an arbitrary run (the places work lives, the ways it reaches you,
// Genos AI, and the ways in from outside). A card added to the wrong row still renders; it just
// stops the page explaining itself. The keys are code-side on purpose: the catalogs are only values.
const FEATURE_ORDER = [
    "chat",
    "tasks",
    "notes",

    "inbox",
    "calendar",
    "notifications",

    "spotlight",
    "genos",
    "agent",

    "integrations",
    "developers",
    "mcp",
] as const;

const FEATURE_ICONS: Record<(typeof FEATURE_ORDER)[number], React.ComponentType> = {
    chat: MessageSquareText,
    tasks: ListChecks,
    notes: FileText,
    inbox: Inbox,
    calendar: CalendarDays,
    notifications: Bell,
    spotlight: Search,
    genos: Sparkles,
    agent: Bot,
    integrations: Plug,
    developers: Code2,
    mcp: Wand2,
};

const META: Record<Lang, { title: string; description: string }> = {
    ja: {
        title: "機能 | Genos",
        description:
            "チャット・タスク・ノート・受信箱・カレンダー、そしてGenos AIとMCP。Genosでできることを一覧で。",
    },
    en: {
        title: "Features | Genos",
        description:
            "Chat, tasks, notes, Inbox and calendar, plus Genos AI and MCP: everything Genos does, in one list.",
    },
};

function FeaturesBody({ lang, appHref }: { lang: Lang; appHref: (url: string) => string }) {
    const { t } = useTranslation();
    const copy = t.featuresPage;
    // Keys from the registry for this visitor's system; the catalog holds the labels.
    const shortcuts = shortcutRows(copy.shortcuts.items, t.settings.shortcuts.global.cycleCombo);
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
                        <h1 className="lp-display">{copy.hero.title}</h1>
                        <p className="lp-lead">{copy.hero.lead}</p>
                        <div className="lp-actions" style={{ paddingTop: 8 }}>
                            <a className="lp-btn lp-btn--primary" href={appHref(APP_URL)}>
                                {copy.footerCta.button}
                                <ArrowRight size={16} aria-hidden />
                            </a>
                            <Link className="lp-btn lp-btn--secondary" to="/demo-guide">
                                {t.demoPage.hero.badge}
                            </Link>
                        </div>
                    </div>
                    <div style={{ marginTop: 48, maxWidth: 960 }}>
                        <Shot alt={SHOT_ALT[lang].tasks} lang={lang} name="tasks" priority />
                    </div>
                </div>
            </section>

            <section className="lp-section" id="start">
                <div className="lp-container lp-stack-l">
                    <div className="lp-head">
                        <p className="lp-kicker">{copy.gettingStarted.eyebrow}</p>
                        <h2 className="lp-h2">{copy.gettingStarted.title}</h2>
                        <p className="lp-lead">{copy.gettingStarted.lead}</p>
                    </div>
                    <ol className="lp-steps">
                        {copy.gettingStarted.steps.map((step, index) => (
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
                </div>
            </section>

            <section className="lp-section lp-section--subtle" id="features">
                <div className="lp-container lp-stack-l">
                    <div className="lp-head">
                        <p className="lp-kicker">{copy.features.eyebrow}</p>
                        <h2 className="lp-h2">{copy.features.title}</h2>
                        <p className="lp-lead">{copy.features.lead}</p>
                    </div>
                    <div className="lp-grid lp-grid--3">
                        {FEATURE_ORDER.map((key) => {
                            const item = copy.features.items[key];
                            const Icon = FEATURE_ICONS[key];
                            return (
                                <div key={key} className="lp-item">
                                    <span className="lp-item__icon" aria-hidden>
                                        <Icon />
                                    </span>
                                    <h3 className="lp-h3">{item.title}</h3>
                                    <p className="lp-body">{item.desc}</p>
                                    <ul className="lp-dots">
                                        {item.bullets.map((bullet) => (
                                            <li key={bullet}>{bullet}</li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="lp-section" id="shortcuts">
                <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                    <div className="lp-stack-m">
                        <p className="lp-kicker">{copy.shortcuts.eyebrow}</p>
                        <h2 className="lp-h2">{copy.shortcuts.title}</h2>
                        <p className="lp-small">{copy.shortcuts.platformNote}</p>
                    </div>
                    <ul className="lp-rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {shortcuts.map((shortcut) => (
                            <li key={shortcut.label} className="lp-row">
                                <span>{shortcut.label}</span>
                                <kbd className="lp-kbd" translate="no">
                                    {shortcut.keys}
                                </kbd>
                            </li>
                        ))}
                    </ul>
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

export default function GenosFeaturesPage() {
    return (
        <I18nProvider>
            <LpShell active="features">
                {({ lang, appHref }) => <FeaturesBody appHref={appHref} lang={lang} />}
            </LpShell>
        </I18nProvider>
    );
}
