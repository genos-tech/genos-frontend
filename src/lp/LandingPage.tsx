import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
    ArrowRight,
    CheckCircle2,
    ClipboardCheck,
    FileText,
    FolderOpen,
    History,
    Info,
    MessageSquareText,
    Plug,
    Plus,
    ShieldCheck,
    TrendingUp,
    User,
} from "lucide-react";
import { Link } from "react-router-dom";

import claudeMark from "../assets/ai-apps/claude.svg";
import { HOME_COPY, type HomeCopy, type IdeaKey, type LineKind } from "./copy/home";
import { APP_URL, SIGNUP_URL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import { Shot } from "./kit/Shot";
import { SHOT_ALT } from "./kit/shotAlts";
import { shotRect } from "./kit/shots";
import type { Lang } from "./lpLang";
import { MCP_TOOLS } from "./mcpTools";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * /home, rebuilt from zero for MIP-1232, with a new top for MIP-1611.
 *
 * The top of the page is the agent record: the work your AI agent did, kept as
 * tasks and notes you can open. Hero (layout A of the design boards, with a
 * real product screenshot on its right), the idea in three lines, three steps,
 * "why not just the AI's own memory?" answered by showing, what it works with,
 * and a short FAQ. Everything below that is the earlier page (the decision's
 * line and Genos's answer, the workspace, Ask Genos, MCP, the secretary,
 * audiences, trust and plans, the other FAQ), reordered and not rewritten.
 *
 * Every picture is a real screenshot of the demo workspace (`kit/Shot`), so the
 * page shows exactly what "Try the demo" opens.
 */

const LINE_ICON: Record<LineKind, typeof MessageSquareText> = {
    chat: MessageSquareText,
    note: FileText,
    task: CheckCircle2,
};

const IDEA_ICON: Record<IdeaKey, typeof TrendingUp> = {
    more: TrendingUp,
    lose: History,
    keep: FolderOpen,
};

const HOW_ICON = [Plug, MessageSquareText, FileText] as const;

/** Where "Connect Claude" goes: the steps, which also say what the plan needs. */
const CONNECT_PATH = "/developers#connect-an-ai-app";

const withTools = (text: string) => text.replace("{tools}", String(MCP_TOOLS.length));

function ComingBadge({ label }: { label: string }) {
    return <span className="lp-badge lp-badge--coming">{label}</span>;
}

/**
 * The hero's proof: the real screenshot of a task's Activity (title and rows), with two labels drawn
 * over it in HTML, so the claim does not rest on a 16 px icon. They are real text (screen readers
 * read them), translated, and follow the picture's own scale because they are placed by fractions
 * (`callouts` in shots.json, checked on every retake). On a narrow window the picture is the phone
 * crop and the labels stack under it, each with a larger copy of the mark.
 */
function HeroProof({ t, lang }: { t: HomeCopy; lang: Lang }) {
    const points = shotRect("record", lang).callouts;
    const at = (key: "claude" | "you") =>
        points ? ({ "--x": points[key].x, "--y": points[key].y } as CSSProperties) : undefined;
    return (
        <div className="lp-proof">
            <Shot
                alt={t.hero.alt}
                lang={lang}
                name="record"
                priority
                variants={{
                    dark: "record-dark",
                    narrow: "record-phone",
                    narrowDark: "record-phone-dark",
                }}
            />
            <ul className="lp-proof__tags">
                <li className="lp-proof__tag lp-proof__tag--claude" style={at("claude")}>
                    <img
                        alt=""
                        aria-hidden
                        className="lp-proof__icon"
                        height={20}
                        src={claudeMark}
                        width={20}
                    />
                    <span>{t.hero.callouts.claude}</span>
                </li>
                <li className="lp-proof__tag lp-proof__tag--you" style={at("you")}>
                    <span aria-hidden className="lp-proof__icon lp-proof__icon--you">
                        <User size={14} />
                    </span>
                    <span>{t.hero.callouts.you}</span>
                </li>
            </ul>
        </div>
    );
}

function Hero({ t, lang, appHref }: { t: HomeCopy; lang: Lang; appHref: (u: string) => string }) {
    return (
        <section className="lp-hero lp-hero--record">
            <div className="lp-container lp-hero__grid">
                <div className="lp-hero__copy lp-stack-m">
                    <h1 className="lp-display">{t.hero.title}</h1>
                    <div className="lp-stack-s">
                        {t.hero.sub.split("\n\n").map((paragraph) => (
                            <p key={paragraph} className="lp-lead">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                    <div className="lp-actions" style={{ paddingTop: 8 }}>
                        <Link className="lp-btn lp-btn--primary" to={CONNECT_PATH}>
                            {t.hero.primary}
                            <ArrowRight size={16} aria-hidden />
                        </Link>
                        <a className="lp-btn lp-btn--secondary" href={appHref(APP_URL)}>
                            {t.hero.secondary}
                        </a>
                    </div>
                    {/* TODO(recording): "Watch a real session" goes here, as a third button
                        or a link under the note, once a real recording exists (Ken, 2026-11-20:
                        the hero shows only the product screenshot until then). Nothing is
                        drawn for it now: no chat card, no placeholder button. */}
                    <p className="lp-small">{t.hero.note}</p>
                </div>

                <div className="lp-hero__panel">
                    {/* The marks in the picture are the app's own, drawn from rows the demo workspace
                        stamped (genos-api, MIP-1740). The two labels over it are HTML (HeroProof). */}
                    <HeroProof lang={lang} t={t} />
                    <p className="lp-hero__legend">{t.hero.legend}</p>
                </div>
            </div>
        </section>
    );
}

function Idea({ t }: { t: HomeCopy }) {
    return (
        <section className="lp-section lp-section--flush lp-section--tight" id="idea">
            <div className="lp-container lp-stack-l">
                <h2 className="lp-kicker">{t.idea.kicker}</h2>
                <ol className="lp-tiles">
                    {t.idea.tiles.map((tile) => {
                        const Icon = IDEA_ICON[tile.key];
                        return (
                            <li
                                key={tile.key}
                                className={
                                    tile.key === "keep" ? "lp-tile lp-tile--accent" : "lp-tile"
                                }
                            >
                                <span className="lp-tile__icon" aria-hidden>
                                    <Icon size={22} />
                                </span>
                                <h3 className="lp-tile__title">{tile.title}</h3>
                                <p className="lp-body">{tile.body}</p>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}

function HowItWorks({ t }: { t: HomeCopy }) {
    return (
        <section className="lp-section" id="how">
            <div className="lp-container lp-stack-l">
                <div className="lp-head">
                    <p className="lp-kicker">{t.how.kicker}</p>
                    <h2 className="lp-h2">{t.how.title}</h2>
                </div>
                <ol className="lp-how">
                    {t.how.steps.map((step, index) => {
                        const Icon = HOW_ICON[index];
                        return (
                            <li key={step.title} className="lp-how__step">
                                <div className="lp-how__head">
                                    <span className="lp-how__n lp-num">{index + 1}</span>
                                    <span className="lp-how__icon" aria-hidden>
                                        <Icon size={18} />
                                    </span>
                                </div>
                                <h3 className="lp-h3">{step.title}</h3>
                                <p className="lp-body">{step.body}</p>
                            </li>
                        );
                    })}
                </ol>
                <p className="lp-small">
                    {t.how.plan}{" "}
                    <Link className="lp-link" to={CONNECT_PATH}>
                        {t.how.link}
                        <ArrowRight size={16} aria-hidden />
                    </Link>
                </p>
            </div>
        </section>
    );
}

/** "Why not just the AI's own memory?", answered by showing what Genos keeps. */
function AgentRecord({ t, lang }: { t: HomeCopy; lang: Lang }) {
    const alt = SHOT_ALT[lang];
    return (
        <section className="lp-section lp-section--subtle" id="record">
            <div className="lp-container lp-stack-l">
                <div className="lp-head">
                    <h2 className="lp-h2">{t.record.title}</h2>
                    <p className="lp-lead">{t.record.sub}</p>
                </div>
                <div className="lp-record">
                    <Shot
                        alt={alt.tasks}
                        caption={t.record.tasksCaption}
                        lang={lang}
                        name="tasks"
                    />
                    <Shot alt={alt.note} caption={t.record.noteCaption} lang={lang} name="note" />
                </div>
                <ul className="lp-points lp-points--cols">
                    {t.record.points.map((point) => (
                        <li key={point.lead}>
                            <CheckCircle2 aria-hidden />
                            <span>
                                <strong>{point.lead}</strong> {point.text}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/** Which agents work today, what is kept, and the two integrations the old strip listed. */
function WorksWith({ t }: { t: HomeCopy }) {
    const works = t.works;
    return (
        <section className="lp-section lp-section--tight" id="works">
            <div className="lp-container lp-stack-m">
                <h2 className="lp-kicker">{works.label}</h2>
                <ul className="lp-agents">
                    {works.agents.map((agent) => (
                        <li key={agent.name} className="lp-agent">
                            <strong translate="no">{agent.name}</strong>
                            {agent.where && (
                                <span className="lp-small" translate="no">
                                    {agent.where}
                                </span>
                            )}
                            {agent.coming ? (
                                <ComingBadge label={agent.state} />
                            ) : (
                                <span className="lp-badge lp-badge--success">{agent.state}</span>
                            )}
                        </li>
                    ))}
                </ul>
                <p className="lp-kept">
                    <Info aria-hidden />
                    <span>{works.kept}</span>
                </p>
                <p className="lp-small">
                    {works.also.label}:{" "}
                    {works.also.items.map((item, index) => (
                        <span key={item}>
                            {index > 0 && " · "}
                            <strong translate="no">{item}</strong>
                        </span>
                    ))}
                </p>
            </div>
        </section>
    );
}

/** The old hero: how one decision happened, next to the Genos answer that cites it. */
function DecisionLine({ t, lang }: { t: HomeCopy; lang: Lang }) {
    return (
        <section className="lp-section lp-section--subtle" id="decision">
            <div className="lp-container lp-stack-l">
                <h2 className="lp-h2" id="lp-line-label">
                    {t.line.label}
                </h2>
                <div className="lp-hero__stage lp-stage">
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
                    <Shot alt={t.heroAlt} lang={lang} name="ask" />
                </div>
            </div>
        </section>
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

function Faq({
    id,
    title,
    items,
}: {
    id: string;
    title: string;
    items: Array<{ q: string; a: string }>;
}) {
    return (
        <section className="lp-section" id={id}>
            <div className="lp-container lp-split" style={{ alignItems: "start" }}>
                <h2 className="lp-h2">{title}</h2>
                <div className="lp-faq">
                    {items.map((item) => (
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
            <Idea t={t} />
            <HowItWorks t={t} />
            <AgentRecord lang={lang} t={t} />
            <WorksWith t={t} />
            <Faq id="questions" items={t.questions.items} title={t.questions.title} />
            {/* From here down is the earlier page, reordered and not rewritten (MIP-1611). */}
            <DecisionLine lang={lang} t={t} />
            <Workspace lang={lang} t={t} />
            <Receipts lang={lang} t={t} />
            <Mcp t={t} />
            <Secretary lang={lang} t={t} />
            <Audiences t={t} />
            <TrustAndPlans t={t} />
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
