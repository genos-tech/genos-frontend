import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowRight,
    Bot,
    Check,
    ChevronRight,
    ClipboardList,
    Database,
    FileText,
    Globe2,
    Layers3,
    Mail,
    MessageSquareText,
    Moon,
    Search,
    Sparkles,
    Sun,
    Target,
    Users,
    Workflow,
} from "lucide-react";

import { GitHubIcon } from "../assets/GithubIcon";
import GenosAIHubSection from "./GenosAIHubSection";

const APP_URL = "https://genosai.dev";
const LINKEDIN_URL = "https://www.linkedin.com/in/kentaro-kamiya-jp/";
const CONTACT_EMAIL = "genos.support@genosai.dev";
const GOOGLE_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSeOlcGhTldzM8mhLkKU3h9hw0eKetSPnV9FQ8z4NhJ6Qi3ziw/viewform?usp=publish-editor";

type Lang = "ja" | "en";
const copy = {
    ja: {
        nav: {
            features: "機能",
            value: "価値",
            ai: "AI活用",
            contact: "お問い合わせ",
            faq: "FAQ",
            demo: "デモを試す",
        },
        hero: {
            badge: "MVP公開中 / Software & Product teams向け",
            title: "AIが仕事の流れを理解する、",
            titleSub: "Context OS for product teams.",
            lead: "Genosは、チャット・タスク・ドキュメントをAIが参照しやすい形でつなぐ、software / product team向けのワークスペースです。Slack、Jira、Notionに分断された議論・意思決定・タスクの経緯を、検索とAIエージェントが活用できるチームのコンテキストとして蓄積します。",
            primary: "デモを試す",
            secondary: "仕組みを見る",
            footnote:
                "ログインなしで体験できます。アカウント登録するとデータを継続保存できます。Webブラウザのみで利用可能です。",
        },
        socialProof: [
            "AIが参照できるチームのコンテキストを蓄積",
            "Software / Product teams向けに設計",
            "Chat / Task / Note / Search / AI Agentを接続",
        ],
        problem: {
            eyebrow: "The problem",
            title: "AIを導入しても、チームの情報が分断されたままでは、本当に役立つ答えは返ってこない。",
            body: "Software / Product teamでは、仕様の議論はSlack、実装タスクはJira、決定事項や仕様書はNotionに分かれがちです。人間はなんとか思い出せても、AIはツールをまたいだ経緯、決定理由、現在の状態を正しく理解できません。結果として、検索・要約・次アクション提案は表面的なものになってしまいます。",
            cards: [
                {
                    title: "議論がAIから見えない",
                    body: "Slackに流れた背景や判断が、タスクやドキュメントから切り離される。",
                },
                {
                    title: "タスクが理由を失う",
                    body: "Jiraのチケットだけでは、なぜその作業が必要なのかAIにも人にも伝わりにくい。",
                },
                {
                    title: "ドキュメントが孤立する",
                    body: "Notionに整理された情報が、実際の会話や進行中のタスクと同期されなくなる。",
                },
            ],
        },
        solution: {
            eyebrow: "AI-native context layer",
            title: "Genosは、チームの仕事をAIが読める構造に変える。",
            body: "Genosでは、Chat、Task、Noteが単なる別機能ではなく、互いにリンクされたチームのコンテキストとして保存されます。AI Agentは、会話の経緯、タスクの状態、ドキュメントの内容を横断して参照し、検索・要約・Q&A・次アクション提案に活用できます。",
        },
        features: [
            {
                icon: "chat",
                title: "Chat",
                subtitle: "議論を、AIが参照できる履歴に",
                image: "/lp-chat.png",
                imageAlt: "Chat linked with tasks and notes in Genos",
                bullets: [
                    "チャンネル / DM / スレッド",
                    "タスクやノートとの紐付け",
                    "意思決定や背景を後から追える",
                ],
            },
            {
                icon: "task",
                title: "Task",
                subtitle: "タスクに、背景と判断理由を残す",
                image: "/lp-task.png",
                imageAlt: "Task linked with chats and notes in Genos",
                bullets: [
                    "スプリントとマイルストーン管理",
                    "関連するチャット・ノートとのリンク",
                    "担当・期限・状態・コメントを一元管理",
                ],
            },
            {
                icon: "note",
                title: "Note",
                subtitle: "仕様・決定事項・学びを、仕事の流れに接続",
                image: "/lp-note.png",
                imageAlt: "Note linked with chats and tasks in Genos",
                bullets: [
                    "共同編集機能",
                    "チャット・タスクとのリンク",
                    "仕様、議事録、PRD、調査メモの管理",
                ],
            },
        ],
        context: {
            eyebrow: "Context operating system",
            title: "AIに必要なのは、ただのデータではなく、仕事のつながりです。",
            body: "AI Agentが本当に役立つには、チームの会話、タスク、ドキュメントをバラバラの断片ではなく、つながったプロジェクト記憶として扱える必要があります。Genosは、software / product teamの日々の仕事を、AIが理解しやすいcontext graphとして蓄積します。",
            points: [
                "会話・タスク・ノートを横断検索",
                "AI Agentがプロジェクトの経緯と現在の状態を参照",
                "仕様変更、意思決定、未完了タスクの履歴を自然に蓄積",
                "新メンバーが過去の議論と判断理由を追いやすい",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "Software / Product teamsのための、AI-native workspace。",
            cards: [
                {
                    title: "Product teams",
                    body: "PRD、仕様変更、ユーザーフィードバック、優先順位の議論を、タスクやドキュメントとつなげて管理したいチームに。",
                },
                {
                    title: "Engineering teams",
                    body: "実装方針、バグ調査、スプリントタスク、技術メモを、AIが参照できる形で残したい開発チームに。",
                },
                {
                    title: "Startup teams",
                    body: "少人数で高速に動きながら、議論・意思決定・実行履歴を失わずに積み上げたいチームに。",
                },
            ],
        },
        ai: {
            eyebrow: "AI Agent beta",
            title: "Genosは、AI Agentがチームのコンテキストを扱える基盤を作っています。",
            body: "GenosはOpenAI APIを利用したAI Agent機能をMVPとして検証中です。現在は、関連するChat、Task、Noteを横断して検索・要約・Q&Aを行う体験を改善しています。完璧な自律エージェントではなく、まずはチームの議論、タスク、ドキュメントをAIが参照しやすい形で蓄積することに重点を置いています。",
            items: ["Context search", "Q&A", "要約", "次アクション提案"],
        },
        comparison: {
            eyebrow: "Why Genos",
            title: "All-in-oneではなく、AI-nativeなcontext layerへ。",
            rows: [
                [
                    "会話",
                    "Slack/Teamsに流れていく",
                    "タスク・ノートと接続され、AIが参照できる履歴になる",
                ],
                [
                    "タスク",
                    "Jira/Asanaで単独管理される",
                    "背景の会話や関連ドキュメントと一緒に扱える",
                ],
                [
                    "ドキュメント",
                    "Notionに後からまとめる",
                    "実際の議論・タスクとリンクされたプロジェクト記憶になる",
                ],
                [
                    "AI活用",
                    "ツールごとに情報が分断される",
                    "つながったcontext graphをもとに検索・要約・回答できる",
                ],
            ],
            headers: ["テーマ", "一般的な分断", "Genos"],
        },
        cta: {
            title: "AIがチームの仕事を理解する構造を、一緒に検証してください。",
            body: "Genosは現在MVPとして公開中です。AI Agentはまだ発展途上ですが、Chat、Task、Noteをつなげてチームのコンテキストを蓄積する体験を、software / product teamのinitial usersと一緒に磨いていきたいと考えています。",
            primary: "デモを試す",
            secondary: "フィードバックする",
        },
        faq: {
            eyebrow: "FAQ",
            title: "よくある質問",
            items: [
                {
                    q: "無料で使えますか？",
                    a: "現在のMVPは無料で試せます。将来的には有料プランを追加予定ですが、initial usersには一定期間無料で提供する予定です。",
                },
                {
                    q: "ログインなしで試せますか？",
                    a: "はい。ログインなしでデモを体験できます。アカウント登録すると、データを継続的に保存できます。",
                },
                {
                    q: "誰向けのプロダクトですか？",
                    a: "主な対象は、software team、product team、startup teamです。特に、Slack、Jira、Notionなどを使いながら、議論・タスク・ドキュメントの分断に課題を感じているチームを想定しています。",
                },
                {
                    q: "Slack、Jira、Notionとは何が違いますか？",
                    a: "Genosは、単にChat、Task、Noteを同じ画面に置くことではなく、それらをAIが参照できるチームのコンテキストとして接続することを重視しています。AI Agentが関連する会話、タスク、ドキュメントを横断して扱える構造を目指しています。",
                },
                {
                    q: "AI Agentはどこまで使えますか？",
                    a: "現在のAI Agent機能はMVP / betaとして提供しています。関連するChat、Task、Noteをもとにした検索、要約、Q&Aなどを検証中です。今後、チームのコンテキストをより深く理解し、次アクション提案やナレッジ活用を支援できるよう改善していきます。",
                },
            ],
        },
        footer: {
            product: "Genos",
            line: "An AI-native context operating system for product teams.",
            creator: "Created by Kentaro Kamiya",
        },
    },

    en: {
        nav: {
            features: "Features",
            value: "Value",
            ai: "AI",
            contact: "Contact",
            faq: "FAQ",
            demo: "Try the demo",
        },
        hero: {
            badge: "MVP is live / Built for software & product teams",
            title: "Context OS",
            titleSub: "for AI-native teams.",
            lead: "Genos connects chat, tasks, and docs into a context layer that AI agents can use. Instead of leaving decisions scattered across Slack, Jira, and Notion, Genos turns your team’s work history into searchable, actionable context for AI.",
            primary: "Try the demo",
            secondary: "See how it works",
            footnote:
                "You can try it without logging in. Create an account to keep your data permanently. Only available in a web browser.",
        },
        socialProof: [
            "Build team context that AI can use",
            "Designed for software & product teams",
            "Connects Chat / Task / Note / Search / AI Agent",
        ],
        problem: {
            eyebrow: "The problem",
            title: "AI cannot help your team deeply if your work context is scattered across tools.",
            body: "Software and product teams discuss decisions in Slack, track execution in Jira, and document outcomes in Notion. Humans can sometimes reconstruct the story. AI usually cannot. When context is fragmented, search, summaries, and next-action suggestions stay shallow.",
            cards: [
                {
                    title: "Discussions disappear",
                    body: "Decisions and tradeoffs get buried in chat, disconnected from tasks and docs.",
                },
                {
                    title: "Tasks lose the why",
                    body: "A Jira ticket rarely explains the full discussion, decision, and product reasoning behind it.",
                },
                {
                    title: "Docs become detached",
                    body: "Specs and notes drift away from the conversations and work that created them.",
                },
            ],
        },
        solution: {
            eyebrow: "AI-native context layer",
            title: "Genos turns team work into context AI can understand.",
            body: "In Genos, Chat, Task, and Note are not just three features placed side by side. They become connected records of how work actually happens. AI agents can search across discussions, task status, and documentation to answer questions, summarize history, and suggest next actions.",
        },
        features: [
            {
                icon: "chat",
                title: "Chat",
                subtitle: "Turn discussions into AI-readable history",
                image: "/lp-chat.png",
                imageAlt: "Chat linked with tasks and notes in Genos",
                bullets: [
                    "Channels / DM / threads",
                    "Links to tasks and notes",
                    "Keep decisions and tradeoffs connected",
                ],
            },
            {
                icon: "task",
                title: "Task",
                subtitle: "Keep execution connected to the why",
                image: "/lp-task.png",
                imageAlt: "Task linked with chats and notes in Genos",
                bullets: [
                    "Sprint and milestone management",
                    "Links to chats and notes",
                    "Status tracking, comments, owners, and due dates",
                ],
            },
            {
                icon: "Note",
                title: "Note",
                subtitle: "Connect specs, decisions, and learnings",
                image: "/lp-note.png",
                imageAlt: "Note linked with chats and tasks in Genos",
                bullets: [
                    "Collaborative editing",
                    "Links to chats and tasks",
                    "Specs, PRDs, meeting notes, and research docs",
                ],
            },
        ],
        context: {
            eyebrow: "Context operating system",
            title: "AI does not just need data. It needs the relationships between work.",
            body: "To be useful, AI agents need more than isolated messages, tickets, or docs. They need to understand how discussions led to decisions, how decisions became tasks, and how tasks changed the product. Genos stores everyday teamwork as a connected project memory.",
            points: [
                "Search across chats, tasks, and notes",
                "Let AI agents reference project history and current status",
                "Capture decisions, tradeoffs, and open tasks as connected context",
                "Help new teammates understand why work happened, not just what happened",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "Built for software and product teams moving fast.",
            cards: [
                {
                    title: "Product teams",
                    body: "For teams managing PRDs, user feedback, roadmap decisions, and prioritization discussions across too many tools.",
                },
                {
                    title: "Engineering teams",
                    body: "For teams that want implementation discussions, sprint tasks, bug investigations, and technical notes connected.",
                },
                {
                    title: "Startup teams",
                    body: "For small teams that move quickly but do not want to lose decisions, context, and execution history along the way.",
                },
            ],
        },
        ai: {
            eyebrow: "AI Agent beta",
            title: "Genos is building the context layer AI agents need to work with team knowledge.",
            body: "Genos includes AI agent features powered by the OpenAI API, currently in MVP/beta. We are improving the experience of searching, summarizing, and answering questions across related Chats, Tasks, and Notes. The goal is not to claim a perfect autonomous agent today, but to build the structure that makes team context usable by AI.",
            items: ["Context search", "Q&A", "Summaries", "Next actions"],
        },
        comparison: {
            eyebrow: "Why Genos",
            title: "Not another all-in-one tool. An AI-native context layer.",
            rows: [
                [
                    "Chat",
                    "Lives in Slack/Teams",
                    "Connected to tasks and notes as AI-readable history",
                ],
                [
                    "Tasks",
                    "Managed separately in Jira/Asana",
                    "Managed with the discussion and background that created them",
                ],
                [
                    "Docs",
                    "Summarized later in Notion",
                    "Linked to the actual conversations and work behind them",
                ],
                [
                    "AI",
                    "Context is split across tools",
                    "Can search, summarize, and answer from connected project memory",
                ],
            ],
            headers: ["Theme", "Common fragmentation", "Genos"],
        },
        cta: {
            title: "Help us test the context layer AI agents should have.",
            body: "Genos is currently available as an MVP. The AI Agent is still in progress, but the core idea is clear: connect Chats, Tasks, and Notes so team context becomes usable by AI. We are looking for initial users from software and product teams to help shape the product.",
            primary: "Try the demo",
            secondary: "Send feedback",
        },
        faq: {
            eyebrow: "FAQ",
            title: "Frequently asked questions",
            items: [
                {
                    q: "Is it free?",
                    a: "The current MVP is free to try. Paid plans are planned for the future, and initial users will be offered access free for a limited period.",
                },
                {
                    q: "Can I try it without logging in?",
                    a: "Yes. You can explore the demo without logging in. Create an account if you want to keep your data permanently.",
                },
                {
                    q: "Who is Genos for?",
                    a: "Genos is mainly designed for software teams, product teams, and startup teams that already use tools like Slack, Jira, and Notion but feel that work context is fragmented.",
                },
                {
                    q: "How is it different from Slack, Jira, and Notion?",
                    a: "Genos does not simply place chat, tasks, and notes in the same UI. It connects them as context that AI agents can search, summarize, and reason over. The goal is to make team work understandable to AI.",
                },
                {
                    q: "How advanced is the AI Agent today?",
                    a: "The AI Agent is currently available as an MVP/beta feature. We are testing search, summarization, and Q&A across related Chats, Tasks, and Notes. The long-term goal is to help AI understand team context more deeply and support next-action suggestions and knowledge workflows.",
                },
            ],
        },
        footer: {
            product: "Genos",
            line: "An AI-native context operating system for product teams.",
            creator: "Created by Kentaro Kamiya",
        },
    },
};

function cn(...classes: Array<string | false | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function FeatureIcon({ type }: { type: string }) {
    const className = "h-6 w-6";
    if (type === "chat") return <MessageSquareText className={className} />;
    if (type === "task") return <Target className={className} />;
    return <FileText className={className} />;
}

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
    return (
        <div className="flex rounded-full border border-violet-200/70 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
            {(["ja", "en"] as Lang[]).map((item) => (
                <button
                    key={item}
                    className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                        lang === item
                            ? "bg-violet-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-violet-700 dark:text-slate-300 dark:hover:text-white"
                    )}
                    onClick={() => setLang(item)}
                >
                    {item === "ja" ? "日本語" : "EN"}
                </button>
            ))}
        </div>
    );
}

function createMailtoHref(lang: "ja" | "en") {
    const subject =
        lang === "ja" ? "Genosに関する問い合わせ / フィードバック" : "Genos inquiry / feedback";

    const body =
        lang === "ja"
            ? [
                  "Genosチームへ",
                  "",
                  "Genosについて問い合わせ・フィードバックがあります。",
                  "",
                  "【利用目的】",
                  "例: チームで試したい / 個人で使ってみたい / バグを報告したい / 機能について相談したい",
                  "",
                  "【内容】",
                  "",
                  "",
                  "【現在使っているツール】",
                  "例: Slack, Asana, Notion, Google Docs など",
                  "",
                  "【返信先】",
                  "",
                  "",
                  "よろしくお願いいたします。",
              ].join("\r\n")
            : [
                  "Hi Genos team,",
                  "",
                  "I have a question or feedback about Genos.",
                  "",
                  "Purpose:",
                  "e.g. I want to try it with my team / I want to use it individually / I found a bug / I have a feature request",
                  "",
                  "Message:",
                  "",
                  "",
                  "Tools I currently use:",
                  "e.g. Slack, Asana, Notion, Google Docs",
                  "",
                  "Reply email:",
                  "",
                  "",
                  "Thank you.",
              ].join("\r\n");

    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
        subject
    )}&body=${encodeURIComponent(body)}`;
}

function ContactSection({ lang }: { lang: "ja" | "en" }) {
    const t =
        lang === "ja"
            ? {
                  eyebrow: "Contact / Feedback",
                  title: "Genosを試して、気になった点を教えてください。",
                  body: "MVP公開中のため、実際に使ってみた感想、改善してほしい点、チームで使う上で必要な機能などを募集しています。短いコメントだけでも大歓迎です。",
                  emailTitle: "メールで問い合わせる",
                  emailBody:
                      "導入相談、バグ報告、チーム利用の相談などはこちらからご連絡ください。",
                  formTitle: "フォームでフィードバックする",
                  formBody:
                      "数分で回答できるフィードバックフォームです。使いづらかった点や欲しい機能を教えてください。",
                  emailCta: "メールを送る",
                  formCta: "フォームを開く",
              }
            : {
                  eyebrow: "Contact / Feedback",
                  title: "Try Genos and tell us what you think.",
                  body: "Genos is currently available as an MVP. We are looking for feedback on what feels useful, confusing, missing, or important for team use. Even a short comment helps.",
                  emailTitle: "Contact by email",
                  emailBody:
                      "For product questions, bug reports, team usage, or partnership discussions, reach out by email.",
                  formTitle: "Send feedback via form",
                  formBody:
                      "A short feedback form for sharing your experience, pain points, and feature requests.",
                  emailCta: "Send email",
                  formCta: "Open form",
              };

    return (
        <section className="px-4 py-16 sm:px-6 lg:px-8" id="contact">
            <div className="mx-auto max-w-7xl">
                <div className="rounded-[2.5rem] border border-violet-100 bg-white p-8 shadow-2xl shadow-violet-900/10 dark:border-white/10 dark:bg-white/5 lg:p-12">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                            {t.eyebrow}
                        </p>

                        <h2
                            className={`mt-4 ${lang === "en" ? "text-[24px]" : "text-[21px]"} font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl`}
                        >
                            {t.title}
                        </h2>

                        <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                            {t.body}
                        </p>
                    </div>

                    <div className="mt-10 grid gap-5 md:grid-cols-2">
                        <div className="rounded-[2rem] border border-violet-100 bg-violet-50/60 p-6 dark:border-white/10 dark:bg-white/5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm dark:bg-slate-950 dark:text-violet-200">
                                <Mail className="h-6 w-6" />
                            </div>

                            <h3 className="mt-5 text-xl font-black text-slate-950 dark:text-white">
                                {t.emailTitle}
                            </h3>

                            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                {t.emailBody}
                            </p>

                            <a
                                className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                href={createMailtoHref(lang)}
                            >
                                {t.emailCta}
                                <ArrowRight className="h-4 w-4" />
                            </a>

                            <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                {CONTACT_EMAIL}
                            </p>
                        </div>

                        <div className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-sm dark:bg-violet-500/15 dark:text-violet-200">
                                <ClipboardList className="h-6 w-6" />
                            </div>

                            <h3 className="mt-5 text-xl font-black text-slate-950 dark:text-white">
                                {t.formTitle}
                            </h3>

                            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                {t.formBody}
                            </p>

                            <a
                                className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-black text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:text-violet-100 dark:hover:bg-white/15"
                                href={GOOGLE_FORM_URL}
                                rel="noreferrer"
                                target="_blank"
                            >
                                {t.formCta}
                                <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function ScreenshotFrame({
    src,
    alt,
    label,
    className = "",
    imageClassName = "",
}: {
    src: string;
    alt: string;
    label?: string;
    className?: string;
    imageClassName?: string;
}) {
    return (
        <div
            className={`relative overflow-hidden rounded-[1.75rem] border border-violet-100 bg-white p-2 shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5 ${className}`}
        >
            {label && (
                <div className="mb-2 flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                        {label}
                    </span>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                        Genos
                    </span>
                </div>
            )}

            <img
                alt={alt}
                className={`w-full rounded-[1.35rem] object-contain ${imageClassName}`}
                loading="lazy"
                src={src}
            />
        </div>
    );
}

export default function GenosLandingPage() {
    const [lang, setLang] = useState<Lang>("en");
    const [dark, setDark] = useState(false);
    const t = copy[lang];

    const year = useMemo(() => new Date().getFullYear(), []);

    return (
        <div className={cn(dark && "dark")}>
            <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#faf7ff_44%,#ffffff_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.22),_transparent_32%),linear-gradient(180deg,#020617_0%,#111827_48%,#020617_100%)] dark:text-white">
                <header className="sticky top-0 z-50 border-b border-violet-100/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                        <a className="flex items-center gap-3" href="#top">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-900/10 dark:border-white/10 dark:bg-white">
                                <img
                                    alt="Genos"
                                    className="h-11 w-11 object-contain"
                                    src="/genos_tech.png"
                                />
                            </div>

                            <div>
                                <div className="text-lg font-black tracking-tight">Genos</div>
                                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Connected workspace
                                </div>
                            </div>
                        </a>

                        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 dark:text-slate-300 md:flex">
                            <a
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                href="#features"
                            >
                                {t.nav.features}
                            </a>
                            <a
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                href="#value"
                            >
                                {t.nav.value}
                            </a>
                            <a
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                href="#ai"
                            >
                                {t.nav.ai}
                            </a>
                            <a
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                href="#contact"
                            >
                                {t.nav.contact}
                            </a>
                            <a
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                href="#faq"
                            >
                                {t.nav.faq}
                            </a>
                        </nav>

                        <div className="flex items-center gap-2">
                            <LanguageToggle lang={lang} setLang={setLang} />
                            <button
                                aria-label="Toggle dark mode"
                                className="hidden h-10 w-10 items-center justify-center rounded-full border border-violet-200/70 bg-white/70 text-slate-700 shadow-sm transition hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:text-white sm:flex"
                                onClick={() => setDark((value) => !value)}
                            >
                                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            </button>
                            <a
                                className="hidden rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-violet-700 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-100 lg:inline-flex"
                                href={APP_URL}
                                rel="noreferrer"
                                target="_blank"
                            >
                                {t.nav.demo}
                            </a>
                        </div>
                    </div>
                </header>

                <section
                    className="relative px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24"
                    id="top"
                >
                    <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.92fr]">
                        <div>
                            <motion.div
                                animate={{ opacity: 1, y: 0 }}
                                className={`mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 ${lang === "en" ? "text-md" : "text-sm"} font-bold text-violet-700 shadow-sm dark:border-violet-400/20 dark:bg-white/10 dark:text-violet-200"`}
                                initial={{ opacity: 0, y: 12 }}
                                transition={{ duration: 0.55 }}
                            >
                                <Sparkles className="h-4 w-4" />
                                {t.hero.badge}
                            </motion.div>

                            <motion.h1
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-4xl font-black tracking-[-0.06em] text-slate-950 dark:text-white text-[44px] sm:text-6xl lg:text-[76px]"
                                initial={{ opacity: 0, y: 16 }}
                                transition={{ duration: 0.65, delay: 0.05 }}
                            >
                                <span className="block">{t.hero.title}</span>

                                {"titleSub" in t.hero && t.hero.titleSub && (
                                    <span className="mt-3 block tracking-[-0.04em] text-violet-700 dark:text-violet-200 text-2xl sm:text-3xl lg:text-4xl">
                                        {t.hero.titleSub}
                                    </span>
                                )}
                            </motion.h1>

                            <motion.p
                                animate={{ opacity: 1, y: 0 }}
                                className={`mt-6 max-w-2xl ${lang === "en" ? "text-lg" : "text-md"} leading-8 text-slate-600 dark:text-slate-300 sm:text-xl`}
                                initial={{ opacity: 0, y: 16 }}
                                transition={{ duration: 0.65, delay: 0.12 }}
                            >
                                {t.hero.lead}
                            </motion.p>

                            <motion.div
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 flex flex-col gap-3 sm:flex-row"
                                initial={{ opacity: 0, y: 16 }}
                                transition={{ duration: 0.65, delay: 0.18 }}
                            >
                                <a
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                    href={APP_URL}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    {t.hero.primary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                                <a
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-4 text-base font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:border-violet-300/50"
                                    href="#features"
                                >
                                    {t.hero.secondary}
                                    <ChevronRight className="h-5 w-5" />
                                </a>
                            </motion.div>

                            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                                {t.hero.footnote}
                            </p>

                            <div className="mt-8 grid gap-3 sm:grid-cols-3">
                                {t.socialProof.map((item) => (
                                    <div
                                        key={item}
                                        className="flex items-start gap-2 rounded-2xl border border-violet-100 bg-white/70 p-3 text-sm font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                    >
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <ScreenshotFrame
                            alt="Genos main workspace screenshot"
                            className="mx-auto max-w-2xl p-3"
                            label="Genos Workspace"
                            src="/lp-top.png"
                        />
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                            <div className="rounded-[2rem] border border-violet-100 bg-white p-8 shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                                <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                    {t.problem.eyebrow}
                                </p>
                                <h2
                                    className={`mt-4 ${lang === "en" ? "text-[25px]" : "text-[21px]"} font-black tracking-tight sm:text-4xl`}
                                >
                                    {t.problem.title}
                                </h2>
                                <p className="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300">
                                    {t.problem.body}
                                </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                {t.problem.cards.map((card, index) => (
                                    <motion.div
                                        key={card.title}
                                        className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
                                        initial={{ opacity: 0, y: 18 }}
                                        transition={{ duration: 0.55, delay: index * 0.08 }}
                                        viewport={{ once: true, amount: 0.4 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                    >
                                        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                                            {index === 0 ? (
                                                <MessageSquareText className="h-5 w-5" />
                                            ) : index === 1 ? (
                                                <Target className="h-5 w-5" />
                                            ) : (
                                                <FileText className="h-5 w-5" />
                                            )}
                                        </div>
                                        <h3 className="text-lg font-black">{card.title}</h3>
                                        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                            {card.body}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="features">
                    <div className="mx-auto max-w-7xl">
                        <div className="mx-auto max-w-3xl text-center">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.solution.eyebrow}
                            </p>
                            <h2
                                className={`mt-4 ${lang === "en" ? "text-[25px]" : "text-[28px]"} font-black tracking-tight sm:text-5xl ${
                                    lang === "en" ? "lg:text-5xl" : "lg:text-6xl"
                                }`}
                            >
                                {t.solution.title}
                            </h2>
                            <p
                                className={`mt-5 ${lang === "en" ? "text-lg" : "text-md"} leading-8 text-slate-600 dark:text-slate-300`}
                            >
                                {t.solution.body}
                            </p>
                        </div>

                        <div className="mt-12 grid gap-5 lg:grid-cols-3">
                            {t.features.map((feature, index) => (
                                <motion.div
                                    key={feature.title}
                                    className="group rounded-[2rem] border border-violet-100 bg-white p-7 shadow-xl shadow-violet-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-900/10 dark:border-white/10 dark:bg-white/5"
                                    initial={{ opacity: 0, y: 18 }}
                                    transition={{ duration: 0.55, delay: index * 0.08 }}
                                    viewport={{ once: true, amount: 0.35 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                >
                                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-600/20">
                                        <FeatureIcon type={feature.icon} />
                                    </div>
                                    <h3 className="text-2xl font-black">{feature.title}</h3>
                                    <p className="mt-2 text-sm font-bold text-violet-700 dark:text-violet-200">
                                        {feature.subtitle}
                                    </p>
                                    <ul className="mt-6 space-y-3">
                                        {feature.bullets.map((bullet) => (
                                            <li
                                                key={bullet}
                                                className="flex items-start gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
                                            >
                                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                                                {bullet}
                                            </li>
                                        ))}
                                    </ul>
                                    <ScreenshotFrame
                                        alt={feature.imageAlt}
                                        className="mt-6"
                                        imageClassName="max-h-56"
                                        label={feature.title}
                                        src={feature.image}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="value">
                    <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
                        <div>
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.context.eyebrow}
                            </p>
                            <h2
                                className={`mt-4 ${lang === "en" ? "text-[27px]" : "text-[24.5px]"} font-black tracking-tight sm:text-5xl lg:text-[40px]`}
                            >
                                {t.context.title}
                            </h2>
                            <p
                                className={`mt-5 ${lang === "en" ? "text-lg" : "text-md"} leading-8 text-slate-600 dark:text-slate-300`}
                            >
                                {t.context.body}
                            </p>
                            <div className="mt-8 grid gap-3 sm:grid-cols-2">
                                {t.context.points.map((point) => (
                                    <div
                                        key={point}
                                        className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-white/80 p-4 text-sm font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                    >
                                        <Database className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                                        {point}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-violet-500/20 to-fuchsia-400/20 blur-2xl" />
                            <div className="relative rounded-[2rem] border border-violet-100 bg-white p-6 shadow-2xl shadow-violet-900/10 dark:border-white/10 dark:bg-white/5">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {[
                                        {
                                            icon: <MessageSquareText className="h-5 w-5" />,
                                            label: "Chat",
                                            value: "12,840",
                                        },
                                        {
                                            icon: <Target className="h-5 w-5" />,
                                            label: "Tasks",
                                            value: "1,284",
                                        },
                                        {
                                            icon: <FileText className="h-5 w-5" />,
                                            label: "Notes",
                                            value: "436",
                                        },
                                        {
                                            icon: <Search className="h-5 w-5" />,
                                            label: "Search",
                                            value: "Unified",
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950/60"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                                                    {item.icon}
                                                </div>
                                                <Layers3 className="h-4 w-4 text-slate-300" />
                                            </div>
                                            <div className="mt-5 text-sm font-bold text-slate-500 dark:text-slate-400">
                                                {item.label}
                                            </div>
                                            <div className="mt-1 text-2xl font-black">
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-5 text-white">
                                    <div className="flex items-center gap-2 text-sm font-black">
                                        <Workflow className="h-5 w-5" />
                                        Connected context graph
                                    </div>
                                    <div className="mt-4 flex items-center justify-between gap-2 text-xs font-bold">
                                        <span className="rounded-full bg-white/20 px-3 py-2">
                                            Chat
                                        </span>
                                        <span className="h-px flex-1 bg-white/30" />
                                        <span className="rounded-full bg-white/20 px-3 py-2">
                                            Task
                                        </span>
                                        <span className="h-px flex-1 bg-white/30" />
                                        <span className="rounded-full bg-white/20 px-3 py-2">
                                            Note
                                        </span>
                                        <span className="h-px flex-1 bg-white/30" />
                                        <span className="rounded-full bg-white/20 px-3 py-2">
                                            AI
                                        </span>
                                    </div>
                                </div>
                                {/* TODO: Add screenshot of unified search */}
                                {/* <ScreenshotFrame
                                    src="/landing_page_1.png"
                                    alt="Genos unified search screenshot"
                                    label="Unified Search"
                                    className="relative p-3"
                                /> */}
                            </div>
                        </div>
                    </div>
                </section>

                <GenosAIHubSection lang={lang} />

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="mx-auto max-w-3xl text-center">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.audience.eyebrow}
                            </p>
                            <h2
                                className={`mt-4 ${lang === "en" ? "text-[26px]" : "text-[21px]"} font-black tracking-tight sm:text-5xl ${
                                    lang === "en" ? "lg:text-5xl" : "lg:text-[44px]"
                                }`}
                            >
                                {t.audience.title}
                            </h2>
                        </div>
                        <div className="mt-12 grid gap-5 lg:grid-cols-3">
                            {t.audience.cards.map((card, index) => (
                                <motion.div
                                    key={card.title}
                                    className="rounded-[2rem] border border-violet-100 bg-white p-7 shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
                                    initial={{ opacity: 0, y: 18 }}
                                    transition={{ duration: 0.55, delay: index * 0.08 }}
                                    viewport={{ once: true, amount: 0.35 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                >
                                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                                        {index === 0 ? (
                                            <Users className="h-6 w-6" />
                                        ) : index === 1 ? (
                                            <Database className="h-6 w-6" />
                                        ) : (
                                            <Globe2 className="h-6 w-6" />
                                        )}
                                    </div>
                                    <h3 className="text-xl font-black">{card.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        {card.body}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="ai">
                    <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-violet-200 bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-8 text-white shadow-2xl shadow-violet-900/20 dark:border-white/10 lg:p-12">
                        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
                            <div>
                                <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-100">
                                    {t.ai.eyebrow}
                                </p>
                                <h2
                                    className={`mt-4 ${lang === "en" ? "text-[26px]" : "text-[24.5px]"} font-black tracking-tight sm:text-5xl`}
                                >
                                    {t.ai.title}
                                </h2>
                                <p className="mt-5 text-lg leading-8 text-violet-50/90">
                                    {t.ai.body}
                                </p>
                            </div>
                            <div className="rounded-[2rem] bg-white/10 p-5 backdrop-blur">
                                <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-slate-950 shadow-xl">
                                    <Bot className="h-6 w-6 text-violet-600" />
                                    <div>
                                        <div className="text-sm font-black">Genos AI Agent</div>
                                        <div className="text-xs text-slate-500">
                                            OpenAI API powered
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    {t.ai.items.map((item) => (
                                        <div
                                            key={item}
                                            className="rounded-2xl bg-white/15 p-4 text-sm font-black"
                                        >
                                            <Sparkles className="mb-3 h-5 w-5 text-violet-100" />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="mb-10 max-w-3xl">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.comparison.eyebrow}
                            </p>
                            <h2
                                className={`mt-4 ${lang === "en" ? "text-[26px]" : "text-[23px]"} font-black tracking-tight sm:text-5xl`}
                            >
                                {t.comparison.title}
                            </h2>
                        </div>
                        <div className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                            <div className="grid grid-cols-3 border-b border-violet-100 bg-violet-50 text-sm font-black text-violet-900 dark:border-white/10 dark:bg-white/10 dark:text-white">
                                {t.comparison.headers.map((header) => (
                                    <div key={header} className="p-4 sm:p-5">
                                        {header}
                                    </div>
                                ))}
                            </div>
                            {t.comparison.rows.map((row) => (
                                <div
                                    key={row[0]}
                                    className="grid grid-cols-3 border-b border-violet-100 last:border-b-0 dark:border-white/10"
                                >
                                    {row.map((cell, cellIndex) => (
                                        <div
                                            key={cell}
                                            className={cn(
                                                "p-4 text-sm leading-6 sm:p-5",
                                                cellIndex === 0 &&
                                                    "font-black text-slate-950 dark:text-white",
                                                cellIndex === 1 &&
                                                    "text-slate-500 dark:text-slate-400",
                                                cellIndex === 2 &&
                                                    "font-semibold text-violet-700 dark:text-violet-200"
                                            )}
                                        >
                                            {cell}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-violet-100 bg-white p-8 shadow-2xl shadow-violet-900/10 dark:border-white/10 dark:bg-white/5 lg:p-12">
                        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                            <div>
                                <h2
                                    className={`${lang === "en" ? "text-[23px]" : "text-[25px]"} font-black tracking-tight sm:text-5xl ${
                                        lang === "en" ? "lg:text-6xl" : "lg:text-[56px]"
                                    }`}
                                >
                                    {t.cta.title}
                                </h2>
                                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                    {t.cta.body}
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                                <a
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                    href={APP_URL}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    {t.cta.primary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                                <a
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-4 text-base font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
                                    href={GOOGLE_FORM_URL}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    {t.cta.secondary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                <ContactSection lang={lang} />

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="faq">
                    <div className="mx-auto max-w-4xl">
                        <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.faq.eyebrow}
                            </p>
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-5xl">
                                {t.faq.title}
                            </h2>
                        </div>
                        <div className="mt-10 space-y-4">
                            {t.faq.items.map((item) => (
                                <details
                                    key={item.q}
                                    className="group rounded-3xl border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 open:border-violet-200 dark:border-white/10 dark:bg-white/5"
                                >
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black">
                                        {item.q}
                                        <ChevronRight className="h-5 w-5 shrink-0 text-violet-600 transition group-open:rotate-90" />
                                    </summary>
                                    <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        {item.a}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                <footer className="border-t border-violet-100 px-4 py-10 sm:px-6 lg:px-8 dark:border-white/10">
                    <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-900/10 dark:border-white/10 dark:bg-white">
                                    <img
                                        alt="Genos"
                                        className="h-11 w-11 object-contain"
                                        src="/genos_tech.png"
                                    />
                                </div>
                                <div className="font-black">{t.footer.product}</div>
                            </div>
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                {t.footer.line}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            <span>© {year} Genos</span>
                            <a
                                className="inline-flex items-center gap-2 transition hover:text-violet-700 dark:hover:text-white"
                                href={LINKEDIN_URL}
                                rel="noreferrer"
                                target="_blank"
                            >
                                {t.footer.creator}
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
