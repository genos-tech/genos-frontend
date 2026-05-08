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

const APP_URL = "https://genos.up.railway.app";
const LINKEDIN_URL = "https://www.linkedin.com/in/kentaro-kamiya-jp/";
const GITHUB_URL = "https://github.com/kentarokamiyajp";
const CONTACT_EMAIL = "genos.support@gmail.com";
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
            badge: "MVP公開中 / Initial users募集中",
            title: "話す、進める、残す。",
            titleSub: "チームの仕事をひとつの流れに。",
            lead: "Genosは、チャット、タスク管理、ドキュメントを同じ場所で扱えるワークスペースです。Slack、Jira、Notionを行き来する手間を減らし、チームの情報を検索とAIで活用しやすくします。",
            primary: "デモを試す",
            secondary: "機能を見る",
            footnote:
                "ログインなしで体験できます。アカウント登録するとデータを継続保存できます。Webブラウザのみで利用可能です。",
        },
        socialProof: [
            "Chat / Task / Noteを横断せずに扱う",
            "チーム利用を中心に設計",
            "検索とAIエージェントに対応",
        ],
        problem: {
            eyebrow: "The problem",
            title: "Slackで話し、Jiraで管理し、Notionにまとめる。その間に情報のつながりは失われる。",
            body: "多くのチームでは、同じテーマに関する会話、担当者、期限、決定事項、背景情報が別々のツールに散らばっています。結果として、探す・転記する・思い出す時間が増え、本来進めるべき仕事に集中しづらくなります。",
            cards: [
                { title: "会話が流れる", body: "重要な決定や背景がチャットの奥に埋もれやすい。" },
                {
                    title: "タスクが孤立する",
                    body: "タスクだけ見ても、なぜ必要なのかが追いづらい。",
                },
                {
                    title: "ノートが後追いになる",
                    body: "まとめる作業が別で発生し、更新されなくなりがち。",
                },
            ],
        },
        solution: {
            eyebrow: "Genos workspace",
            title: "必要なものを、同じ文脈の中に。",
            body: "Genosでは、チャンネルでの会話、カンバンやリストでのタスク管理、Wiki形式のノートが互いにリンクします。チームのやり取りがそのままナレッジになり、ナレッジが次のタスクにつながります。",
        },
        features: [
            {
                icon: "chat",
                title: "Chat",
                subtitle: "会話から次のアクションへ",
                image: "/lp-chat.png",
                imageAlt: "Chat linked with tasks and notes in Genos",
                bullets: [
                    "チャンネル / DM / スレッド",
                    "タスクやノートとの紐付け",
                    "メンション・ファイル添付",
                ],
            },
            {
                icon: "task",
                title: "Task",
                subtitle: "進行状況と責任をクリアに",
                image: "/lp-task.png",
                imageAlt: "Task linked with chats and notes in Genos",
                bullets: [
                    "スプリントとマイルストーン管理",
                    "チャットとノートとのリンク",
                    "ステータス管理とコメント",
                ],
            },
            {
                icon: "note",
                title: "Note",
                subtitle: "背景と決定事項を残す",
                image: "/lp-note.png",
                imageAlt: "Note linked with chats and tasks in Genos",
                bullets: ["共同編集機能", "チャット・タスクとのリンク", "メンションとコメント"],
            },
        ],
        context: {
            eyebrow: "Unified context",
            title: "チームのデータが、検索可能でAIが扱いやすい形で蓄積される。",
            body: "Genosの核は、単に3つの機能を並べることではありません。会話、タスク、ノートが同じデータ基盤にあることで、過去の経緯・現在の状態・次にやることをつなげて扱えます。",
            points: [
                "過去の会話・タスク・ノートを横断検索",
                "AIエージェントがプロジェクトの経緯を参照",
                "意思決定やタスクのヒストリーを自然に蓄積",
                "新しいメンバーや外部協力者への共有がスムーズ",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "小さく速く動くチームと、知識を積み重ねる研究チームへ。",
            cards: [
                {
                    title: "スタートアップ / 小規模チーム",
                    body: "プロダクト開発、営業、CS、バックオフィスなど、複数の文脈が同時に走るチームに。",
                },
                {
                    title: "大学研究室 / 研究者",
                    body: "議論、実験タスク、調査メモ、論文関連の情報をひとつの流れで管理したいチームに。",
                },
                {
                    title: "個人のナレッジワーカー",
                    body: "個人プロジェクト、学習、調査、日々のタスクを同じ場所で進めたい人に。",
                },
            ],
        },
        ai: {
            eyebrow: "AI-ready by design",
            title: "AIは、分断されたデータよりも、情報のつながりで強くなる。",
            body: "GenosはOpenAI APIを利用したAIエージェント機能を備えています。今後は、チームに蓄積された会話・タスク・ノートを活用し、調査、要約、次アクション提案、ナレッジ検索をより深く支援していきます。",
            items: ["横断検索", "文脈理解", "要約", "次アクション提案"],
        },
        comparison: {
            eyebrow: "Why Genos",
            title: "ツールを増やすのではなく、情報をつなげる。",
            rows: [
                ["会話", "Slack/Teamsで進む", "Genos内でタスク・ノートと接続"],
                ["タスク", "Jira/Asanaなどで別管理", "会話や背景と同じ場所で管理"],
                ["ドキュメント", "Notionなどに後から整理", "進行中の会話・タスクから自然に残す"],
                ["AI活用", "ツールごとに情報が分断される", "統合されたデータを参照しやすい"],
            ],
            headers: ["テーマ", "一般的な分断", "Genos"],
        },
        cta: {
            title: "まずはデモを触って、気になる点を教えてください。",
            body: "Genosは現在MVPとして公開中です。チームでも個人でも試せます。Initial usersには、将来的な有料プランを一定期間無料で提供する予定です。",
            primary: "デモを試す",
            secondary: "LinkedInを見る",
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
                    q: "チーム利用と個人利用のどちら向けですか？",
                    a: "主な想定はチーム利用ですが、個人のタスク管理・ノート・調査にも使えます。",
                },
                {
                    q: "Slack、Jira、Notionとは何が違いますか？",
                    a: "Genosは会話、タスク、ノートを同じ文脈で扱うことを重視しています。ツールを行き来せず、チームのデータを検索やAIで活かしやすい形に蓄積できます。",
                },
            ],
        },
        footer: {
            product: "Genos",
            line: "A seamless workspace for connected team data.",
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
            badge: "MVP is live / Looking for initial users",
            title: "Discuss. Act. Capture.",
            titleSub: "Teamwork in one flow.",
            lead: "Genos brings chat, tasks, and docs into one workspace — reducing the need to jump between Slack, Jira, and Notion while making team knowledge easier to search and use with AI.",
            primary: "Try the demo",
            secondary: "Explore features",
            footnote:
                "You can try it without logging in. Create an account to keep your data permanently. Only available in a web browser.",
        },
        socialProof: [
            "Chat / Task / Note without switching tools",
            "Designed primarily for teams",
            "Built with search and AI agents",
        ],
        problem: {
            eyebrow: "The problem",
            title: "Teams talk in Slack, manage tasks in Asana, and summarize in Notion. Context disappears between them.",
            body: "For many teams, conversations, owners, deadlines, decisions, and background knowledge are scattered across separate tools. That creates extra work: searching, copying, remembering, and re-explaining what already happened.",
            cards: [
                {
                    title: "Conversations move on",
                    body: "Important decisions and context get buried deep in chat history.",
                },
                {
                    title: "Tasks become isolated",
                    body: "A task alone often does not explain why it exists or what led to it.",
                },
                {
                    title: "Notes lag behind",
                    body: "Documentation becomes a separate chore and quickly goes stale.",
                },
            ],
        },
        solution: {
            eyebrow: "Genos workspace",
            title: "Keep the work where the context is.",
            body: "In Genos, channel conversations, Kanban/List tasks, and Wiki-style notes are connected. Team discussions become knowledge, and knowledge naturally leads to the next action.",
        },
        features: [
            {
                icon: "chat",
                title: "Chat",
                subtitle: "Turn conversations into action",
                image: "/lp-chat.png",
                imageAlt: "Chat linked with tasks and notes in Genos",
                bullets: [
                    "Channels / DM / threads",
                    "Link to tasks and notes",
                    "Mentions and file attachments",
                ],
            },
            {
                icon: "task",
                title: "Task",
                subtitle: "Make ownership and progress clear",
                image: "/lp-task.png",
                imageAlt: "Task linked with chats and notes in Genos",
                bullets: [
                    "Sprint and milestone management",
                    "Links to chats and nates",
                    "Status tracking and comments",
                ],
            },
            {
                icon: "note",
                title: "Note",
                subtitle: "Capture decisions and background",
                image: "/lp-note.png",
                imageAlt: "Note linked with chats and tasks in Genos",
                bullets: [
                    "Collaborative editing",
                    "Links to chats and tasks",
                    "Mentions and comments",
                ],
            },
        ],
        context: {
            eyebrow: "Unified context",
            title: "Team data becomes searchable and easier for AI to use.",
            body: "The core of Genos is not just putting three features side by side. Because chats, tasks, and notes live on the same data foundation, teams can connect what happened before, what is happening now, and what should happen next.",
            points: [
                "Search across past chats, tasks, and notes",
                "AI agents can reference project context",
                "Decision and task history accumulates naturally",
                "New members and collaborators can get up to speed faster",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "For fast-moving small teams and research groups that build on knowledge.",
            cards: [
                {
                    title: "Startups / small teams",
                    body: "For product, sales, CS, and operations teams that handle many threads of work at the same time.",
                },
                {
                    title: "Labs / researchers",
                    body: "For teams that want discussions, experiment tasks, research notes, and literature context in one flow.",
                },
                {
                    title: "Individual knowledge workers",
                    body: "For personal projects, learning, research, and daily task management in a single connected space.",
                },
            ],
        },
        ai: {
            eyebrow: "AI-ready by design",
            title: "AI works better when it can see connected context, not fragmented data.",
            body: "Genos includes AI agent features powered by the OpenAI API. Going forward, Genos will focus more deeply on helping teams use their accumulated chats, tasks, and notes for research, summarization, next-action suggestions, and knowledge search.",
            items: ["Cross-search", "Context awareness", "Summaries", "Next actions"],
        },
        comparison: {
            eyebrow: "Why Genos",
            title: "Do not add more tools. Connect the context.",
            rows: [
                ["Chat", "Lives in Slack/Teams", "Connected with tasks and notes in Genos"],
                [
                    "Tasks",
                    "Managed separately in tools like Jira/Asana",
                    "Managed next to the conversation and background",
                ],
                [
                    "Docs",
                    "Summarized later in tools like Notion",
                    "Captured naturally from ongoing work",
                ],
                [
                    "AI",
                    "Context is split across tools",
                    "Unified data is easier for AI to reference",
                ],
            ],
            headers: ["Theme", "Common fragmentation", "Genos"],
        },
        cta: {
            title: "Try the demo and tell us what feels missing, confusing, or useful.",
            body: "Genos is currently available as an MVP. You can try it as a team or as an individual. Initial users will be offered future paid plans free for a limited period.",
            primary: "Try the demo",
            secondary: "View LinkedIn",
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
                    q: "Is it for teams or individuals?",
                    a: "Genos is primarily designed for teams, but it can also be used for personal task management, notes, and research.",
                },
                {
                    q: "How is it different from Slack, Jira, and Notion?",
                    a: "Genos focuses on keeping conversations, tasks, and notes in the same context. That makes team data easier to search and easier for AI agents to use.",
                },
            ],
        },
        footer: {
            product: "Genos",
            line: "A seamless workspace for connected team data.",
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
                    onClick={() => setLang(item)}
                    className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                        lang === item
                            ? "bg-violet-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-violet-700 dark:text-slate-300 dark:hover:text-white"
                    )}
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
        <section id="contact" className="px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="rounded-[2.5rem] border border-violet-100 bg-white p-8 shadow-2xl shadow-violet-900/10 dark:border-white/10 dark:bg-white/5 lg:p-12">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                            {t.eyebrow}
                        </p>

                        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
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
                                href={createMailtoHref(lang)}
                                className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
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
                                href={GOOGLE_FORM_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-black text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:text-violet-100 dark:hover:bg-white/15"
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
                src={src}
                alt={alt}
                loading="lazy"
                className={`w-full rounded-[1.35rem] object-contain ${imageClassName}`}
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
                        <a href="#top" className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-900/10 dark:border-white/10 dark:bg-white">
                                <img
                                    src="/genos_tech.png"
                                    alt="Genos"
                                    className="h-11 w-11 object-contain"
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
                                onClick={() => setDark((value) => !value)}
                                className="hidden h-10 w-10 items-center justify-center rounded-full border border-violet-200/70 bg-white/70 text-slate-700 shadow-sm transition hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:text-white sm:flex"
                                aria-label="Toggle dark mode"
                            >
                                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            </button>
                            <a
                                href={APP_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="hidden rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-violet-700 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-100 lg:inline-flex"
                            >
                                {t.nav.demo}
                            </a>
                        </div>
                    </div>
                </header>

                <section
                    id="top"
                    className="relative px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24"
                >
                    <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.92fr]">
                        <div>
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.55 }}
                                className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-sm font-bold text-violet-700 shadow-sm dark:border-violet-400/20 dark:bg-white/10 dark:text-violet-200"
                            >
                                <Sparkles className="h-4 w-4" />
                                {t.hero.badge}
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.65, delay: 0.05 }}
                                className="max-w-4xl font-black tracking-[-0.06em] text-slate-950 dark:text-white text-4xl sm:text-6xl lg:text-[64px]"
                            >
                                <span className="block">{t.hero.title}</span>

                                {"titleSub" in t.hero && t.hero.titleSub && (
                                    <span className="mt-3 block tracking-[-0.04em] text-violet-700 dark:text-violet-200 text-2xl sm:text-3xl lg:text-4xl">
                                        {t.hero.titleSub}
                                    </span>
                                )}
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.65, delay: 0.12 }}
                                className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300 sm:text-xl"
                            >
                                {t.hero.lead}
                            </motion.p>

                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.65, delay: 0.18 }}
                                className="mt-8 flex flex-col gap-3 sm:flex-row"
                            >
                                <a
                                    href={APP_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                >
                                    {t.hero.primary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                                <a
                                    href="#features"
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-4 text-base font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:border-violet-300/50"
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
                            src="/lp-top.png"
                            alt="Genos main workspace screenshot"
                            label="Genos Workspace"
                            className="mx-auto max-w-2xl p-3"
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
                                <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
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
                                        initial={{ opacity: 0, y: 18 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, amount: 0.4 }}
                                        transition={{ duration: 0.55, delay: index * 0.08 }}
                                        className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
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

                <section id="features" className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="mx-auto max-w-3xl text-center">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.solution.eyebrow}
                            </p>
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-5xl lg:text-[44px]">
                                {t.solution.title}
                            </h2>
                            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                                {t.solution.body}
                            </p>
                        </div>

                        <div className="mt-12 grid gap-5 lg:grid-cols-3">
                            {t.features.map((feature, index) => (
                                <motion.div
                                    key={feature.title}
                                    initial={{ opacity: 0, y: 18 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.35 }}
                                    transition={{ duration: 0.55, delay: index * 0.08 }}
                                    className="group rounded-[2rem] border border-violet-100 bg-white p-7 shadow-xl shadow-violet-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-900/10 dark:border-white/10 dark:bg-white/5"
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
                                        src={feature.image}
                                        alt={feature.imageAlt}
                                        label={feature.title}
                                        className="mt-6"
                                        imageClassName="max-h-56"
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="value" className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
                        <div>
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.context.eyebrow}
                            </p>
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-5xl lg:text-[44px]">
                                {t.context.title}
                            </h2>
                            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
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
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-5xl">
                                {t.audience.title}
                            </h2>
                        </div>
                        <div className="mt-12 grid gap-5 lg:grid-cols-3">
                            {t.audience.cards.map((card, index) => (
                                <motion.div
                                    key={card.title}
                                    initial={{ opacity: 0, y: 18 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.35 }}
                                    transition={{ duration: 0.55, delay: index * 0.08 }}
                                    className="rounded-[2rem] border border-violet-100 bg-white p-7 shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
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

                <section id="ai" className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-violet-200 bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-8 text-white shadow-2xl shadow-violet-900/20 dark:border-white/10 lg:p-12">
                        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
                            <div>
                                <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-100">
                                    {t.ai.eyebrow}
                                </p>
                                <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-5xl">
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
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-5xl">
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
                                <h2 className="text-2xl font-black tracking-tight sm:text-5xl">
                                    {t.cta.title}
                                </h2>
                                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                    {t.cta.body}
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                                <a
                                    href={APP_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                >
                                    {t.cta.primary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                                <a
                                    href={LINKEDIN_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-4 text-base font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
                                >
                                    {t.cta.secondary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                <ContactSection lang={lang} />

                <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
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
                                        src="/genos_tech.png"
                                        alt="Genos"
                                        className="h-11 w-11 object-contain"
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
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 transition hover:text-violet-700 dark:hover:text-white"
                            >
                                <GitHubIcon className="h-4 w-4" />
                                {t.footer.creator}
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
