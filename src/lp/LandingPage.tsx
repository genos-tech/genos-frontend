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
    HelpCircle,
    Layers3,
    Mail,
    MessageSquareText,
    Moon,
    Search,
    Sparkles,
    Sun,
    Target,
    Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";

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
            demoGuide: "デモ",
            value: "価値",
            ai: "AI活用",
            contact: "お問い合わせ",
            faq: "FAQ",
            demo: "デモを試す",
        },
        hero: {
            badge: "MVP公開中 · すべてがつながるワークスペース",
            title: "散らばったコンテキストを、もう見失わない。",
            titleSub: "Slack・Notion・Jiraを、ひとつのワークスペースに。",
            lead: "議論・ドキュメント・タスクが、それぞれ別のツールに分かれている。それらをまたいで探すのは、人にもAIにも大きな負担です。Genosは、会話・ドキュメント・タスクをひとつのつながったワークスペースにまとめ、コンテキストを散らばらせず、仕事の進行とともに自動的に蓄積します。",
            primary: "デモを試す",
            secondary: "仕組みを見る",
            footnote:
                "ログインなしで体験できます。アカウント登録するとデータを継続保存できます。Webブラウザのみで利用可能です。",
        },
        socialProof: [
            "チャット・ドキュメント・タスクをひとつのワークスペースに",
            "仕事の進行とともにコンテキストが自動で蓄積",
            "仕事のつながりを理解するAI",
        ],
        problem: {
            eyebrow: "The problem",
            title: "いまの仕事は、分断されている。",
            body: "議論はチャットで交わされ、決定は別の場所に記録され、作業はまた別のツールで管理される。気づけば、こんな単純な問いに答えるためだけに、いくつものアプリを横断して探す羽目になります。",
            questions: [
                "なぜ、このタスクをやっているのか？",
                "その決定は、どこでなされたのか？",
                "最新のドキュメントはどれか？",
                "この要件は、まだ有効なのか？",
            ],
            closing:
                "情報が失われているわけではありません。ただ、散らばっているだけ。そして、その散らばったコンテキストこそ、いまのAIが読み解けないものです。",
            cards: [
                {
                    title: "議論が消えていく",
                    body: "判断の背景やトレードオフがチャットに埋もれ、それが形づくったタスクやドキュメントから切り離される。",
                },
                {
                    title: "タスクが理由を失う",
                    body: "チケットだけでは、背景の議論や決定は分からない。なぜその作業が重要なのか、人にもAIにも伝わらない。",
                },
                {
                    title: "ドキュメントが孤立する",
                    body: "仕様やメモが、それを生んだ会話や作業から離れ、いつの間にか古くなっていく。",
                },
            ],
        },
        solution: {
            eyebrow: "A better way",
            title: "別々のツールをつなぐのではなく、仕事そのものをつなぐ。",
            body: "Genosは、連携（integration）ではなく関係性（relationship）を中心に設計されています。会話・ドキュメント・タスクはすべて同じプロジェクトに属し、後からコンテキストを組み立て直すのではなく、仕事が進むそばから自動的に蓄積されます。",
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
            eyebrow: "AI that understands context",
            title: "AIはツールを検索できる。でも、あなたの仕事は理解できない。",
            body: "AIをSlack・Notion・Jiraにつなげば、情報は取り出せます。でも、取り出すことと、理解することは違います。どの議論からこのタスクが生まれたのか。どの決定が、別の決定を無効にしたのか。そうした関係性は、人の頭の中にしかありません。Genosはそれをつながったコンテキストとして保存するので、AIは仕事のつながりを最初から把握しています。推測でも、再構築でもなく、設計としてつながっているのです。",
            points: [
                "会話・タスク・ノートをまとめて横断検索",
                "Genos AIが元の議論・決定・現在の状態を参照",
                "要件変更や未完了タスクが、その経緯とつながったまま残る",
                "新メンバーが「何を」だけでなく「なぜ」まで追える",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "ツールの間で、コンテキストを失っているチームへ。",
            items: [
                "古いメッセージを求めて、いつもSlackを検索している",
                "議論を、手作業でドキュメントに書き写している",
                "大事な決定を、チャットのどこかで見失う",
                "一日中、5つのツールを行き来している",
                "プロジェクトの文脈を本当に理解するAIが欲しい",
            ],
            hookQuote: "あれ、どこで話したっけ？",
            hookLine:
                "そう思ったことがあるなら、役割やチームを問わず、このワークスペースはあなたのためのものです。",
        },
        ai: {
            eyebrow: "Genos AI",
            title: "チームの仕事について、Genosに何でも聞ける。",
            body: "「なぜ、この機能を作っているのか？」——そう尋ねれば、Genosはもう知っています。元の議論、仕様、関連する決定、タスク、そして現在の状況まで。チャット・タスク・ノートを横断して読み取り、根拠となった場所へのリンク付きで、普段の言葉で答えます。何週間分もの履歴をさかのぼる必要はありません。",
            agentTagline: "質問も、要約も、キャッチアップも。",
            capabilities: [
                {
                    title: "何でも質問",
                    desc: "普段の言葉で質問するだけ。チャット・タスク・ノートを横断した答えが、出典リンク付きで返ってきます。",
                },
                {
                    title: "スレッドを要約",
                    desc: "長い議論もすぐに要点を把握。そのまま続けて質問もできます。",
                },
                {
                    title: "ノートを要約",
                    desc: "長い仕様書やドキュメントを分かりやすい要約に。気になる点はそのまま質問できます。",
                },
            ],
        },
        comparison: {
            eyebrow: "Traditional vs. connected",
            title: "もうひとつのall-in-oneではなく、つながったワークスペースへ。",
            rows: [
                ["チャット", "Slackに流れていく", "タスク・ノートと接続され、組み込まれている"],
                [
                    "ドキュメント",
                    "後からNotionにまとめる",
                    "背景の仕事とリンクして、組み込まれている",
                ],
                ["タスク", "Jiraで単独管理される", "背景の議論や決定と一緒に、組み込まれている"],
                ["コンテキスト", "アプリごとに散らばる", "仕事の進行とともに自動で蓄積される"],
                ["AI", "複数のツールを検索する", "すべてのつながりを理解する"],
                ["コスト", "複数のサブスクリプション", "ひとつのつながったワークスペース"],
            ],
            headers: ["", "散らばったツール", "Genos"],
        },
        cta: {
            title: "バラバラのツールを管理するのは、もう終わりに。",
            body: "多くのソフトウェアは、まず人間のために作られ、AIは後から付け足されました。だからAIは、分断されたツールからコンテキストを組み立て直すしかありません。Genosは、その逆から作られています。コンテキストが最初から存在するワークスペース——人もAIも、探す時間を減らし、つくる時間を増やせます。チームに必要なものをひとつに。ひとつの信頼できる情報源と、仕事を本当に理解するひとつのAIを。GenosはいまMVPとして公開中です。ぜひフィードバックをお寄せください。クレジットカードは不要です。",
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
                    a: "会話・ドキュメント・タスクを別々のツール（Slack、Notion、Jira、Google Docsなど）に分けて持ち、その間でコンテキストが失われていると感じるすべてのチームのためのものです。「あれ、どこで決めたっけ？」と何度も思うなら、Genosはあなたのためのプロダクトです。役割や肩書きではなく、抱えている課題で選んでください。",
                },
                {
                    q: "Slack、Jira、Notionとは何が違いますか？",
                    a: "これらのツールは、チャット・タスク・ドキュメントを別々に保存します。Genosはそれらをひとつのワークスペースにまとめ、さらに重要なこととして、互いにつなげます。だからGenos AIは、議論がどう決定になり、タスクになり、ドキュメントになったのかをたどれます。もうひとつのサイロではなく、つながったコンテキストレイヤーです。",
                },
                {
                    q: "Genos AIは何ができますか？",
                    a: "普段の言葉で質問すると、チームのチャット・タスク・ノートを横断して、出典リンク付きの答えが返ってきます。長いスレッドやノートもワンクリックで要約でき、そのまま続けて質問もできます。チームに使ってもらいながら、継続的に改善しています。",
                },
            ],
        },
        footer: {
            product: "Genos",
            line: "コンテキストを失わない、ひとつのつながったワークスペース。",
            creator: "Created by Kentaro Kamiya",
            legal: "特定商取引法に基づく表記",
            privacy: "プライバシーポリシー",
        },
    },

    en: {
        nav: {
            features: "Features",
            demoGuide: "Demo",
            value: "Value",
            ai: "AI",
            contact: "Contact",
            faq: "FAQ",
            demo: "Try the demo",
        },
        hero: {
            badge: "MVP is live · One connected workspace",
            title: "Stop losing project context",
            titleSub: "across Slack, Notion & Jira.",
            lead: "Every discussion, document, and task lives in a different tool — and searching across them is draining, for people and for AI alike. Genos brings conversations, docs, and tasks into one connected workspace, so context is captured automatically as work happens, instead of scattered and lost.",
            primary: "Try the demo",
            secondary: "See how it works",
            footnote:
                "You can try it without logging in. Create an account to keep your data permanently. Only available in a web browser.",
        },
        socialProof: [
            "Chat, docs, and tasks in one workspace",
            "Context preserved automatically as you work",
            "AI that understands how your work connects",
        ],
        problem: {
            eyebrow: "The problem",
            title: "Modern work is fragmented.",
            body: "Discussions happen in chat. Decisions get written down somewhere else. Work is tracked in a third tool. Before long, you're searching across apps just to answer simple questions:",
            questions: [
                "Why are we doing this task?",
                "Where was this decision made?",
                "Which document is the latest?",
                "Is this requirement still valid?",
            ],
            closing:
                "Nothing is actually missing — it's simply scattered. And scattered context is exactly what today's AI can't reason across.",
            cards: [
                {
                    title: "Discussions disappear",
                    body: "The background and tradeoffs behind a choice get buried in chat, disconnected from the tasks and docs they shaped.",
                },
                {
                    title: "Tasks lose the why",
                    body: "A ticket rarely explains the discussion and decision behind it — so neither a person nor an AI can tell why the work matters.",
                },
                {
                    title: "Docs drift apart",
                    body: "Specs and notes detach from the conversations and work that created them, and quietly fall out of date.",
                },
            ],
        },
        solution: {
            eyebrow: "A better way",
            title: "Don't connect separate tools. Connect the work itself.",
            body: "Genos is built around relationships, not integrations. Conversations, documents, and tasks all belong to the same project — so instead of reconstructing context later, it is captured automatically as work happens.",
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
                icon: "note",
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
            eyebrow: "AI that understands context",
            title: "AI can search your tools. It still can't understand your work.",
            body: "Connect AI to Slack, Notion, and Jira and it can retrieve information — but retrieving isn't understanding. Which discussion created this task? Which decision made another one obsolete? Those relationships only exist in people's heads. Genos stores them as connected context, so AI already knows how your work fits together — not inferred, not reconstructed, connected by design.",
            points: [
                "Search across chats, tasks, and notes at once",
                "Genos AI references the original discussion, decision, and current status",
                "Requirement changes and open tasks stay linked to their history",
                "New teammates see why work happened, not just what happened",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "Built for teams that lose context between tools.",
            items: [
                "Constantly search Slack for old messages",
                "Copy discussions into documents by hand",
                "Lose important decisions somewhere in chat",
                "Switch between five productivity tools all day",
                "Want AI that actually understands project context",
            ],
            hookQuote: "Where was that discussed again?",
            hookLine:
                "If you've ever asked that, this workspace was built for you — whatever your role or team.",
        },
        ai: {
            eyebrow: "Genos AI",
            title: "Ask Genos anything about your team's work.",
            body: 'Ask "Why are we building this feature?" and Genos already knows — the original discussion, the spec, the related decisions, the tasks, and where things stand. It reads across your chats, tasks, and notes and answers in plain language, with links to exactly where each answer came from. No scrolling back through weeks of history.',
            agentTagline: "Ask. Summarize. Catch up.",
            capabilities: [
                {
                    title: "Ask anything",
                    desc: "Ask in plain words and get an answer drawn from across your chats, tasks, and notes — every answer links back to its source.",
                },
                {
                    title: "Catch up on a thread",
                    desc: "Open any long discussion and get the gist in seconds, then ask follow-up questions right there.",
                },
                {
                    title: "Summarize any note",
                    desc: "Turn a long spec or doc into a clear summary — and ask it anything you need to know.",
                },
            ],
        },
        comparison: {
            eyebrow: "Traditional vs. connected",
            title: "Not another all-in-one tool. A connected workspace.",
            rows: [
                ["Chat", "Lives in Slack", "Built in, linked to tasks and notes"],
                ["Docs", "Written later in Notion", "Built in, linked to the work behind them"],
                [
                    "Tasks",
                    "Tracked alone in Jira",
                    "Built in, carrying their discussion and decisions",
                ],
                ["Context", "Spread across every app", "Preserved automatically as work happens"],
                ["AI", "Searches multiple tools", "Understands how everything connects"],
                ["Cost", "Multiple subscriptions", "One connected workspace"],
            ],
            headers: ["", "The scattered stack", "Genos"],
        },
        cta: {
            title: "Stop managing disconnected tools.",
            body: "Most software was built for humans first, with AI added later — leaving AI to reconstruct context from disconnected tools. Genos is built the other way around: one workspace where context already exists, so people and AI both spend less time searching and more time building. Everything your team needs — one source of truth, one AI that actually understands your work. Genos is live as an MVP now, and we'd love your feedback. No credit card required.",
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
                    a: 'Any team that keeps its conversations, documents, and tasks in separate tools — Slack, Notion, Jira, Google Docs, and the like — and feels the context between them slipping away. If you regularly ask "where was that decided again?", Genos is for you. It is about the problem you have, not the job title you hold.',
                },
                {
                    q: "How is it different from Slack, Jira, and Notion?",
                    a: "Those tools store your chat, tasks, and docs separately. Genos keeps them in one workspace and, more importantly, connected — so Genos AI can follow how a discussion became a decision, a task, and a doc. It is a connected context layer, not another silo.",
                },
                {
                    q: "What can Genos AI do?",
                    a: "Ask a question in plain language and Genos answers from across your team's chats, tasks, and notes — with links to the source. You can also summarize any long thread or note in a click and ask follow-up questions about it. We keep improving it as teams use it every day.",
                },
            ],
        },
        footer: {
            product: "Genos",
            line: "One connected workspace where context is never lost.",
            creator: "Created by Kentaro Kamiya",
            legal: "Legal Notice",
            privacy: "Privacy Policy",
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
                            <Link
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                to="/features-guide"
                            >
                                {t.nav.features}
                            </Link>
                            <Link
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                to="/demo-guide"
                            >
                                {t.nav.demoGuide}
                            </Link>
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
                                <ul className="mt-5 space-y-2.5">
                                    {t.problem.questions.map((question) => (
                                        <li
                                            key={question}
                                            className="flex items-start gap-3 text-base font-semibold leading-7 text-slate-800 dark:text-slate-100"
                                        >
                                            <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                                            {question}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-6 text-base font-bold leading-8 text-slate-900 dark:text-white">
                                    {t.problem.closing}
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
                        <div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-2">
                            {t.audience.items.map((item) => (
                                <motion.div
                                    key={item}
                                    className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-white/80 p-4 text-sm font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                    initial={{ opacity: 0, y: 12 }}
                                    transition={{ duration: 0.45 }}
                                    viewport={{ once: true, amount: 0.4 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                >
                                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                                    {item}
                                </motion.div>
                            ))}
                        </div>
                        <div className="mx-auto mt-8 max-w-2xl rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-8 text-center shadow-lg shadow-violet-900/5 dark:border-white/10 dark:from-white/10 dark:to-white/5">
                            <p className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                                “{t.audience.hookQuote}”
                            </p>
                            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
                                {t.audience.hookLine}
                            </p>
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
                                        <div className="text-sm font-black">Genos AI</div>
                                        <div className="text-xs text-slate-500">
                                            {t.ai.agentTagline}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-3">
                                    {t.ai.capabilities.map((cap) => (
                                        <div
                                            key={cap.title}
                                            className="rounded-2xl bg-white/15 p-4"
                                        >
                                            <div className="flex items-center gap-2 text-sm font-black">
                                                <Sparkles className="h-5 w-5 shrink-0 text-violet-100" />
                                                {cap.title}
                                            </div>
                                            <p className="mt-1.5 text-xs font-semibold leading-5 text-violet-50/80">
                                                {cap.desc}
                                            </p>
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
                            <Link
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                to="/legal"
                            >
                                {t.footer.legal}
                            </Link>
                            <Link
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                to="/privacy"
                            >
                                {t.footer.privacy}
                            </Link>
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
