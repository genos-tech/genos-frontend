import { useRef, useState, type KeyboardEvent } from "react";
import {
    ArrowRight,
    CheckCircle2,
    ClipboardCheck,
    FileText,
    MessageSquareText,
    Plus,
    ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { HOME_COPY, type HomeCopy, type LineKind } from "./copy/home";
import { APP_URL, SIGNUP_URL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import { Shot } from "./kit/Shot";
import type { Lang } from "./lpLang";
import { MCP_TOOLS } from "./mcpTools";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * /home, rebuilt from zero for MIP-1232.
 *
 * One idea carries the page: the history of the work stays connected, so an
 * AI (Genos's own, or Claude / ChatGPT over MCP) can answer from it and move it
 * forward with your OK. The hero shows that literally: a decision's line from
 * the thread where it was discussed, to the note where it was decided, to the
 * task where it was done, next to the Genos answer that cites all three.
 *
 * Every picture is a real screenshot of the demo workspace (`kit/Shot`), so the
 * page shows exactly what "Try the demo" opens.
 */

const LINE_ICON: Record<LineKind, typeof MessageSquareText> = {
    chat: MessageSquareText,
    note: FileText,
    task: CheckCircle2,
};

const withTools = (text: string) => text.replace("{tools}", String(MCP_TOOLS.length));

function ComingBadge({ label }: { label: string }) {
    return <span className="lp-badge lp-badge--coming">{label}</span>;
}

function Hero({ t, lang, appHref }: { t: HomeCopy; lang: Lang; appHref: (u: string) => string }) {
    return (
        <section className="lp-hero">
            <div className="lp-container">
                <div className="lp-hero__copy lp-stack-m">
                    <h1 className="lp-display">{t.hero.title}</h1>
                    <p className="lp-lead">{t.hero.sub}</p>
                    <div className="lp-actions" style={{ paddingTop: 8 }}>
                        <a className="lp-btn lp-btn--primary" href={appHref(APP_URL)}>
                            {t.hero.primary}
                            <ArrowRight size={16} aria-hidden />
                        </a>
                        <a className="lp-btn lp-btn--secondary" href={appHref(SIGNUP_URL)}>
                            {t.hero.secondary}
                        </a>
                    </div>
                    <p className="lp-small">{t.hero.note}</p>
                </div>

                <div className="lp-hero__stage">
                    <div>
                        <p className="lp-small" id="lp-line-label" style={{ marginBottom: 16 }}>
                            {t.line.label}
                        </p>
                        <ol aria-labelledby="lp-line-label" className="lp-line">
                            {t.line.items.map((item) => {
                                const Icon = LINE_ICON[item.kind];
                                return (
                                    <li key={item.kind} className="lp-line__item">
                                        <span className="lp-line__dot" aria-hidden>
                                            <Icon />
                                        </span>
                                        <div className="lp-line__when">{item.tag}</div>
                                        <div className="lp-line__what">{item.what}</div>
                                        <div className="lp-line__where">{item.where}</div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                    <Shot alt={t.heroAlt} lang={lang} name="ask" priority />
                </div>
            </div>
        </section>
    );
}

function Works({ t }: { t: HomeCopy }) {
    return (
        <div className="lp-container">
            <div className="lp-works">
                <span>{t.works.label}</span>
                {t.works.items.map((item) => (
                    <span key={item.name}>
                        <strong translate="no">{item.name}</strong>
                        {item.note && <span className="lp-small"> ({item.note})</span>}
                    </span>
                ))}
            </div>
        </div>
    );
}

const TAB_ICON = { chat: MessageSquareText, tasks: ClipboardCheck, note: FileText } as const;
const TAB_SHOT = { chat: "chat", tasks: "tasks", note: "note" } as const;

function Workspace({ t, lang }: { t: HomeCopy; lang: Lang }) {
    const [active, setActive] = useState(0);
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const tabs = t.workspace.tabs;
    const tab = tabs[active];

    // Arrow keys move between tabs (WAI-ARIA tabs pattern, automatic activation).
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!delta) return;
        event.preventDefault();
        const next = (active + delta + tabs.length) % tabs.length;
        setActive(next);
        tabRefs.current[next]?.focus();
    };

    return (
        <section className="lp-section" id="workspace">
            <div className="lp-container lp-stack-l">
                <div className="lp-head">
                    <p className="lp-kicker">{t.workspace.kicker}</p>
                    <h2 className="lp-h2">{t.workspace.title}</h2>
                    <p className="lp-lead">{t.workspace.sub}</p>
                </div>
                <div
                    aria-label={t.workspace.kicker}
                    className="lp-tabs"
                    role="tablist"
                    onKeyDown={onKeyDown}
                >
                    {tabs.map((item, index) => {
                        const Icon = TAB_ICON[item.key];
                        return (
                            <button
                                key={item.key}
                                ref={(el) => {
                                    tabRefs.current[index] = el;
                                }}
                                aria-controls={`lp-tab-panel-${item.key}`}
                                aria-selected={index === active}
                                id={`lp-tab-${item.key}`}
                                role="tab"
                                tabIndex={index === active ? 0 : -1}
                                type="button"
                                onClick={() => setActive(index)}
                            >
                                <Icon aria-hidden />
                                {item.label}
                            </button>
                        );
                    })}
                </div>
                <div
                    aria-labelledby={`lp-tab-${tab.key}`}
                    className="lp-split"
                    id={`lp-tab-panel-${tab.key}`}
                    role="tabpanel"
                >
                    <div className="lp-stack-m">
                        <h3 className="lp-h3">{tab.title}</h3>
                        <ul className="lp-points">
                            {tab.points.map((point) => (
                                <li key={point}>
                                    <CheckCircle2 aria-hidden />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <Shot alt={tab.alt} lang={lang} name={TAB_SHOT[tab.key]} />
                </div>
            </div>
        </section>
    );
}

function Receipts({ t, lang }: { t: HomeCopy; lang: Lang }) {
    return (
        <section className="lp-section lp-section--subtle" id="ask">
            <div className="lp-container lp-split lp-split--flip">
                <div className="lp-stack-m">
                    <p className="lp-kicker">{t.receipts.kicker}</p>
                    <h2 className="lp-h2">{t.receipts.title}</h2>
                    <p className="lp-lead">{t.receipts.sub}</p>
                    <ul className="lp-points">
                        {t.receipts.points.map((point) => (
                            <li key={point}>
                                <CheckCircle2 aria-hidden />
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <Shot alt={t.receipts.approvalAlt} lang={lang} name="approval" />
            </div>
        </section>
    );
}

function Mcp({ t }: { t: HomeCopy }) {
    const tr = t.mcp.transcript;
    return (
        <section className="lp-section" id="mcp">
            <div className="lp-container lp-split">
                <div className="lp-stack-m">
                    <p className="lp-kicker">{t.mcp.kicker}</p>
                    <h2 className="lp-h2">{t.mcp.title}</h2>
                    <p className="lp-lead">{t.mcp.sub}</p>
                    <ul className="lp-points">
                        {t.mcp.points.map((point) => (
                            <li key={point}>
                                <CheckCircle2 aria-hidden />
                                <span>{withTools(point)}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="lp-rows" style={{ marginTop: 28 }}>
                        {t.mcp.clients.map((client) => (
                            <div key={client.name} className="lp-row" style={{ paddingBlock: 14 }}>
                                <strong translate="no">{client.name}</strong>
                                {client.coming ? (
                                    <ComingBadge label={client.state} />
                                ) : (
                                    <span className="lp-badge lp-badge--success">
                                        {client.state}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                    <Link className="lp-link" to="/developers">
                        {t.mcp.link}
                        <ArrowRight size={16} aria-hidden />
                    </Link>
                </div>
                {/* Our own style on purpose: an illustration of the flow, not a
                    copy of any assistant's interface. */}
                <figure aria-label={tr.label} className="lp-transcript" style={{ margin: 0 }}>
                    <p className="lp-msg lp-msg--you">{tr.you}</p>
                    <p className="lp-tool" translate="no">
                        {tr.tool}
                    </p>
                    <p className="lp-msg lp-msg--ai">{tr.ai}</p>
                    <div className="lp-approve">
                        <ShieldCheck size={16} aria-hidden />
                        <span>{tr.approve}</span>
                        <span className="lp-btn lp-btn--primary lp-btn--sm" aria-hidden>
                            {tr.approveBtn}
                        </span>
                    </div>
                </figure>
            </div>
        </section>
    );
}

function Secretary({ t, lang }: { t: HomeCopy; lang: Lang }) {
    return (
        <section className="lp-section lp-section--subtle" id="secretary">
            <div className="lp-container lp-split lp-split--flip">
                <div className="lp-stack-m">
                    <p className="lp-kicker">{t.secretary.kicker}</p>
                    <h2 className="lp-h2">{t.secretary.title}</h2>
                    <p className="lp-lead">{t.secretary.sub}</p>
                    <ul className="lp-points">
                        {t.secretary.points.map((point) => (
                            <li key={point.text}>
                                <CheckCircle2 aria-hidden />
                                <span>
                                    {point.text} {point.coming && <ComingBadge label={t.coming} />}
                                    {point.plan && <span className="lp-badge">{point.plan}</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="lp-small">{t.secretary.privacy}</p>
                </div>
                <Shot alt={t.secretary.alt} lang={lang} name="inbox" />
            </div>
        </section>
    );
}

function Audiences({ t }: { t: HomeCopy }) {
    return (
        <section className="lp-section" id="for">
            <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                <h2 className="lp-h2">{t.audiences.title}</h2>
                <div className="lp-rows">
                    {t.audiences.items.map((item) => (
                        <Link key={item.to} className="lp-row" to={item.to}>
                            <span>
                                <span className="lp-h3" style={{ display: "block" }}>
                                    {item.title}
                                </span>
                                <span className="lp-body">{item.body}</span>
                            </span>
                            <ArrowRight className="lp-row__arrow" size={18} aria-hidden />
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}

function TrustAndPlans({ t }: { t: HomeCopy }) {
    return (
        <section className="lp-section" id="trust">
            <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                <div className="lp-stack-m">
                    <h2 className="lp-h2">{t.trust.title}</h2>
                    <ul className="lp-points">
                        {t.trust.items.map((item) => (
                            <li key={item}>
                                <ShieldCheck aria-hidden />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="lp-cta" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                    <div className="lp-stack-s">
                        <h2 className="lp-h2">{t.plans.title}</h2>
                        <p className="lp-body">{t.plans.body}</p>
                    </div>
                    <Link className="lp-link" to="/plans">
                        {t.plans.link}
                        <ArrowRight size={16} aria-hidden />
                    </Link>
                </div>
            </div>
        </section>
    );
}

function Faq({ t }: { t: HomeCopy }) {
    return (
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
    );
}

function ClosingCta({ t, appHref }: { t: HomeCopy; appHref: (u: string) => string }) {
    return (
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
                        <a className="lp-btn lp-btn--secondary" href={appHref(SIGNUP_URL)}>
                            {t.cta.secondary}
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

function HomeBody({ lang, appHref }: { lang: Lang; appHref: (u: string) => string }) {
    const t = HOME_COPY[lang];
    useDocumentMeta({
        title: t.meta.title,
        description: t.meta.description,
        ogTitle: t.meta.title,
        ogDescription: t.meta.description,
    });
    return (
        <>
            <Hero appHref={appHref} lang={lang} t={t} />
            <Works t={t} />
            <Workspace lang={lang} t={t} />
            <Receipts lang={lang} t={t} />
            <Mcp t={t} />
            <Secretary lang={lang} t={t} />
            <Audiences t={t} />
            <TrustAndPlans t={t} />
            <Faq t={t} />
            <ClosingCta appHref={appHref} t={t} />
        </>
    );
}

export default function GenosLandingPage() {
    return (
        <LpShell active="home">
            {({ lang, appHref }) => <HomeBody appHref={appHref} lang={lang} />}
        </LpShell>
    );
}
