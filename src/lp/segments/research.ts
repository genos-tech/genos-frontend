import type { SegmentConfig } from "./types";

export const research: SegmentConfig = {
    key: "research",
    route: "/for-research",
    mailtoTag: "[Genos Research Pilot]",
    secondaryCtaKind: "mailto",
    ja: {
        meta: {
            title: "Genos for Research | 実験・結果・次の判断をつなぐAIワークスペース",
            description:
                "実験ノート、タスク、予定、結果をひとつの研究履歴として管理。Genos AIが根拠リンク付きで過去の経緯を整理し、次の実験に必要な行動計画づくりを支援します。",
            ogTitle: "研究の記録を、次の判断につなげる。",
            ogDescription:
                "何を試し、何が起き、何を学び、次に何をするのか。研究の流れを、ノート・タスク・予定・AIでつなぎます。",
        },
        hero: {
            title: "研究の記録を、次の判断につなげる。",
            sub: "実験ノート・タスク・予定・結果を、ひとつの研究履歴に。",
            lead: "研究では、結果だけでなく「なぜその方法を試したのか」「何が次の方針を変えたのか」が重要です。Genosは、研究ノート、タスク、予定、議論をひとつのワークスペースに置き、Genos AIが根拠へのリンク付きで経緯をたどれるようにします。次の実験に必要なタスクや予定を提案させる場合も、実行前にあなたが内容を確認します。",
            primary: "デモを試す",
            secondary: "研究パイロットを相談する",
            footnote:
                "ログインなしで体験できます。無料プランはクレジットカード不要です。現在はWebブラウザのみで利用できます。",
        },
        trust: [
            "実験・結果・次の行動を、ひとつの流れとして保存",
            "AIの回答から、元のノートやタスクへ戻れる",
            "タスクや予定の作成は、必ず確認してから実行",
        ],
        questions: {
            title: "結果は残る。判断の経緯が消えていく。",
            items: [
                "なぜ、方法Aを使うのをやめたのか？",
                "どの結果が、次の実験条件を変えたのか？",
                "まだ確認できていない前提は何か？",
                "次回の研究レビューまでに、何を準備すべきか？",
            ],
            closing:
                "研究の価値は、個々の記録だけではなく、その間にある「だから次にこれをする」というつながりにもあります。",
        },
        workflow: {
            title: "問いから次の実験まで、経緯を切らさない。",
            body: "Genosでは、研究の各段階を別々の記録として保存しながら、同じテーマ・プロジェクトの流れとしてたどれます。",
            steps: [
                "研究の問い",
                "仮説",
                "実験・調査",
                "観察・結果",
                "考察・結論",
                "次の実験計画",
            ],
        },
        features: [
            {
                title: "研究ノート",
                subtitle: "手順・観察・考察を、実際の作業につなげる",
                bullets: [
                    "実験メモ、週次レビュー、考察、決定を共同ノートに保存",
                    "関連するタスクや議論と同じワークスペースで管理",
                    "長いノートを要約し、内容について続けて質問",
                ],
            },
            {
                title: "計画と行動",
                subtitle: "次の実験を、タスクと予定に落とし込む",
                bullets: [
                    "研究テーマごとのタスク、Todo、期限、予定を管理",
                    "ノートの内容から、次の作業計画をGenosに提案させる",
                    "AIによる作成・更新は、実行前に内容を確認",
                ],
            },
            {
                title: "根拠へ戻れるAI",
                subtitle: "過去を探し直さず、答えの根拠を確認する",
                bullets: [
                    "研究ノート、タスク、予定、議論を横断して質問",
                    "回答から元の情報へ戻れるクリック可能なリンク",
                    "プロジェクト、マイルストーン、進捗、ブロッカーも確認",
                ],
            },
        ],
        ai: {
            title: "何を試し、何を学び、次に何をするのかを質問できる。",
            body: "Genos AIは、ワークスペースに保存された研究ノート、タスク、予定、議論を読み、普段の言葉で答えます。回答には元の記録へのリンクが付きます。計画の作成を依頼した場合は、提案を確認してからタスクや予定へ反映できます。",
            prompts: [
                "先週、何を試して、何が分かりましたか？",
                "どの結果が、次の実験方針を変えましたか？",
                "次回の実験前に、まだ確認が必要なことは何ですか？",
                "この研究ノートをもとに、次の作業計画を提案してください。",
                "金曜日の研究レビュー前に確認すべきタスクと予定をまとめてください。",
            ],
        },
        now: [
            "研究ノート、タスク、Todo、予定を同じワークスペースで管理",
            "ノート・タスク・議論等を横断したAI回答と出典リンク",
            "長いノートやスレッドの要約",
            "プロジェクト、マイルストーン、スプリント、ブロッカー等の確認",
            "タスク計画、ノート、Todo、予定の承認付き作成・更新",
            "GitHub pull requestに関する読み取り",
        ],
        coming: [
            "AIへの質問にPDFや画像を直接添付する",
            "ルーティン：よく使う指示を保存して、スケジュールで実行する",
            "チャットの返信下書き（送信するのはいつもあなた）",
        ],
        audience: {
            title: "研究の経緯を、個人の記憶だけに置きたくない人へ。",
            items: [
                "複数の実験や調査を並行しているPhD学生・Postdoc",
                "週次レビューで結果と次の作業を整理する小規模研究室",
                "研究ノートとタスク管理が別々になっている研究チーム",
                "過去の判断理由を新メンバーへ説明することが多いR&Dチーム",
                "一人で研究を進め、過去の自分の判断を追いたい独立研究者",
            ],
            quote: "なぜ、この条件に変えたんだっけ？",
        },
        faq: {
            title: "よくある質問",
            items: [
                {
                    q: "GenosはPDFや論文を直接読めますか？",
                    a: "現在、AIへの質問にPDFや画像を直接添付する機能と、ワークスペース内の全添付を横断検索する機能は未提供です。現時点では、Genos内のノート、タスク、議論、予定などを中心に質問できます。ファイルを質問へ添付する機能はロードマップに含まれています。",
                },
                {
                    q: "電子実験ノートやLIMSの代わりになりますか？",
                    a: "現在のGenosは、研究の記録・計画・タスク・予定・振り返りをつなぐワークスペースです。規制対応、機器データ管理、正式なELN / LIMS要件を満たす製品としては提供していません。",
                },
                {
                    q: "AIが研究記録を自動で変更しますか？",
                    a: "いいえ。AIによるタスク、ノート、Todo、予定の作成・更新は、実行前に確認を求めます。承認されるまで変更されません。",
                },
                {
                    q: "一人でも使えますか？",
                    a: "はい。個人研究者や大学院生は、自分の研究ノート、タスク、予定をつなぐ個人ワークスペースとして利用できます。小規模チームでは共同ノートやプロジェクト履歴として使えます。",
                },
                {
                    q: "AIの答えを信用してよいですか？",
                    a: "AIの回答には誤りが含まれる可能性があります。Genosは回答に使った元の情報へのリンクを返すため、重要な判断では必ず根拠を開いて確認してください。",
                },
            ],
        },
        cta: {
            title: "研究室全体を移行する前に、ひとつの研究テーマで試してください。",
            body: "最初のパイロットは、一つの研究テーマを4週間Genosで運用するだけで十分です。研究ノート、関連タスク、予定、週次レビューをつなぎ、過去を探す時間が減るか、次の判断が明確になるかを確認します。",
            primary: "デモを試す",
            secondary: "4週間の研究パイロットを相談する",
        },
    },
    en: {
        meta: {
            title: "Genos for Research | Connect experiments, results, and next decisions",
            description:
                "Keep research notes, tasks, schedules, results, and decisions in one connected history. Ask Genos what changed, what was learned, and what needs to happen next—with links to the source.",
            ogTitle: "Turn research records into the next decision.",
            ogDescription:
                "Keep what you tried, what happened, what you learned, and what comes next connected in one research workspace.",
        },
        hero: {
            title: "Turn research records into the next decision.",
            sub: "Keep experiments, notes, tasks, schedules, and results in one connected history.",
            lead: "Research depends on more than the final result. You also need to remember why a method was chosen, what changed the interpretation, and what should happen next. Genos keeps research notes, tasks, schedules, and discussions in one workspace, then lets you ask across that history with links to the source. When Genos proposes tasks or calendar changes, you review them before anything is written.",
            primary: "Try the demo",
            secondary: "Discuss a research pilot",
            footnote:
                "Explore without logging in. The free plan requires no credit card. Genos is currently available in a web browser.",
        },
        trust: [
            "Keep experiments, results, and next actions connected",
            "Open the notes and tasks behind every AI answer",
            "Review every proposed task or calendar change before it runs",
        ],
        questions: {
            title: "The result survives. The reasoning around it fades.",
            items: [
                "Why did we stop using method A?",
                "Which result changed the next experimental condition?",
                "What assumptions are still unresolved?",
                "What should we prepare before the next research review?",
            ],
            closing:
                "The value of a research record is not only what it contains. It is also the path from evidence to the next decision.",
        },
        workflow: {
            title: "Keep the path from question to next experiment intact.",
            body: "Genos lets each stage remain a distinct record while keeping it traceable as part of the same research theme or project.",
            steps: [
                "Research question",
                "Hypothesis",
                "Experiment or investigation",
                "Observation and result",
                "Interpretation and conclusion",
                "Next experiment plan",
            ],
        },
        features: [
            {
                title: "Research Notes",
                subtitle:
                    "Connect protocols, observations, and conclusions to the work around them",
                bullets: [
                    "Keep experiment notes, weekly reviews, interpretations, and decisions in collaborative notes",
                    "Manage the related tasks and discussions in the same workspace",
                    "Summarize a long note and ask follow-up questions about it",
                ],
            },
            {
                title: "Plans and Actions",
                subtitle: "Turn the next experiment into tasks and scheduled work",
                bullets: [
                    "Manage tasks, todos, deadlines, and calendar events for a research theme",
                    "Ask Genos to propose the next work plan from the notes already in the workspace",
                    "Review every AI-created or updated item before it is written",
                ],
            },
            {
                title: "Source-linked AI",
                subtitle: "Ask across the history and inspect the evidence behind the answer",
                bullets: [
                    "Ask across research notes, tasks, schedules, and discussions",
                    "Follow clickable links back to the original records",
                    "Check project, milestone, progress, and blocker information",
                ],
            },
        ],
        ai: {
            title: "Ask what was tried, what was learned, and what needs to happen next.",
            body: "Genos AI reads the research notes, tasks, schedules, and discussions stored in the workspace and answers in plain language with links to the original records. When you ask it to create a plan, you can review the proposal before it becomes tasks or calendar events.",
            prompts: [
                "What did we try last week, and what did we learn?",
                "Which result caused us to change the next experiment?",
                "What is still unresolved before the next run?",
                "Propose a task plan for the next experiment from these notes.",
                "What should I review before Friday's research meeting?",
            ],
        },
        now: [
            "Manage research notes, tasks, todos, and schedules in the same workspace",
            "Ask across notes, tasks, discussions, and related records with source links",
            "Summarize long notes and threads",
            "Review projects, milestones, sprints, blockers, and related work",
            "Create or update task plans, notes, todos, and calendar events through approval",
            "Read selected GitHub pull-request information",
        ],
        coming: [
            "Attach a PDF or image directly to an AI question",
            "Routines: save an instruction and run it on a schedule",
            "Reply drafts in chat (you always press send)",
        ],
        audience: {
            title: "For researchers who do not want the history of a project to live only in someone's memory.",
            items: [
                "PhD students and postdocs running several experiments or investigations",
                "Small labs that review results and next actions every week",
                "Research teams whose notes and task management live in separate places",
                "R&D teams that repeatedly explain earlier decisions to new members",
                "Independent researchers who need to follow the reasoning of their past self",
            ],
            quote: "Why did we change this condition again?",
        },
        faq: {
            title: "Frequently asked questions",
            items: [
                {
                    q: "Can Genos read a PDF or paper directly?",
                    a: "Not yet through the AI question flow. Direct PDF or image attachment to an ask, and search across every workspace attachment, are roadmap items. Today, Genos answers mainly from notes, tasks, discussions, schedules, and other supported workspace records.",
                },
                {
                    q: "Does Genos replace an ELN or LIMS?",
                    a: "Genos currently connects research records, plans, tasks, schedules, and reviews. It is not positioned as a regulated ELN, LIMS, or instrument-data system.",
                },
                {
                    q: "Can the AI change research records automatically?",
                    a: "No. AI-created or updated tasks, notes, todos, and calendar events wait for human approval before anything is written.",
                },
                {
                    q: "Can an individual researcher use it?",
                    a: "Yes. An independent researcher or graduate student can use Genos as a personal workspace for connected notes, tasks, and schedules. Small teams can use shared notes and project history.",
                },
                {
                    q: "Should I trust every AI answer?",
                    a: "AI can be wrong. Genos links answers back to the records it used so you can inspect the evidence before making an important research decision.",
                },
            ],
        },
        cta: {
            title: "Test one research theme before moving an entire lab.",
            body: "A first pilot can be as small as one research theme for four weeks. Keep the notes, related tasks, schedules, and weekly reviews connected, then measure whether the team spends less time reconstructing the past and makes the next decision more clearly.",
            primary: "Try the demo",
            secondary: "Discuss a four-week research pilot",
        },
    },
};
