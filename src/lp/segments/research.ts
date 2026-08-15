import { DEFAULT_APPROVAL_STEPS, SHARED_NAV } from "./shared";
import type { SegmentConfig } from "./types";

export const research: SegmentConfig = {
    key: "research",
    route: "/for-research",
    mailtoTag: "[Genos Research Pilot]",
    secondaryCtaKind: "mailto",
    ja: {
        nav: SHARED_NAV.ja,
        meta: {
            pageTitle: "Genos for Research | 実験・結果・次の判断をつなぐAIワークスペース",
            metaDescription:
                "実験ノート、タスク、予定、結果をひとつの研究履歴として管理。Genos AIが根拠リンク付きで過去の経緯を整理し、次の実験に必要な行動計画づくりを支援します。",
            ogTitle: "研究の記録を、次の判断につなげる。",
            ogDescription:
                "何を試し、何が起き、何を学び、次に何をするのか。研究の流れを、ノート・タスク・予定・AIでつなぎます。",
        },
        hero: {
            badge: "研究者・小規模研究チーム向け · MVP公開中",
            title: "研究の記録を、次の判断につなげる。",
            titleSub: "実験ノート・タスク・予定・結果を、ひとつの研究履歴に。",
            lead: "研究では、結果だけでなく「なぜその方法を試したのか」「何が次の方針を変えたのか」が重要です。Genosは、研究ノート、タスク、予定、議論をひとつのワークスペースに置き、Genos AIが根拠へのリンク付きで経緯をたどれるようにします。次の実験に必要なタスクや予定を提案させる場合も、実行前にあなたが内容を確認します。",
            primary: "デモを試す",
            secondary: "研究パイロットを相談する",
            footnote:
                "ログインなしで体験できます。無料プランはクレジットカード不要です。現在はWebブラウザのみで利用できます。",
        },
        socialProof: [
            "実験・結果・次の行動を、ひとつの流れとして保存",
            "AIの回答から、元のノートやタスクへ戻れる",
            "タスクや予定の作成は、必ず確認してから実行",
        ],
        problem: {
            eyebrow: "The research gap",
            title: "結果は残る。判断の経緯が消えていく。",
            body: "実験結果はノートに残り、作業はタスクに入り、次回の予定はカレンダーに入る。それでも数週間後には、なぜ条件を変えたのか、どの観察が次の仮説につながったのかを、もう一度探し直すことになります。",
            questions: [
                "なぜ、方法Aを使うのをやめたのか？",
                "どの結果が、次の実験条件を変えたのか？",
                "まだ確認できていない前提は何か？",
                "次回の研究レビューまでに、何を準備すべきか？",
            ],
            closing:
                "研究の価値は、個々の記録だけではなく、その間にある「だから次にこれをする」というつながりにもあります。",
            cards: [
                {
                    title: "実験が理由から離れる",
                    body: "手順と結果は残っていても、なぜその条件を選んだのかが別の会話や個人の記憶に残る。",
                },
                {
                    title: "結果が次の判断につながらない",
                    body: "観察、解釈、結論、次の行動が別々に管理され、研究レビューのたびに再構成が必要になる。",
                },
                {
                    title: "チームの記憶が人に依存する",
                    body: "新しいメンバーが過去の判断を理解するために、同じ質問と調査を繰り返す。",
                },
            ],
        },
        workflow: {
            eyebrow: "A connected research loop",
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
        solution: {
            eyebrow: "A better research record",
            title: "研究ログを保存するだけでなく、次の判断に使える形でつなぐ。",
            body: "Genosは、ノート、タスク、Todo、予定、議論を同じ研究ワークスペースに置きます。Genos AIは、その中に保存された情報を横断して回答し、根拠になった場所へのリンクを返します。AIに記録や計画の作成を依頼した場合は、提案内容を確認してから実行できます。",
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
                image: "/lp-note.png",
                imageAlt: "研究ノートと関連タスクの画面",
            },
            {
                title: "計画と行動",
                subtitle: "次の実験を、タスクと予定に落とし込む",
                bullets: [
                    "研究テーマごとのタスク、Todo、期限、予定を管理",
                    "ノートの内容から、次の作業計画をGenosに提案させる",
                    "AIによる作成・更新は、実行前に内容を確認",
                ],
                image: "/lp-task.png",
                imageAlt: "研究テーマのタスクと承認待ちの計画",
            },
            {
                title: "根拠へ戻れるAI",
                subtitle: "過去を探し直さず、答えの根拠を確認する",
                bullets: [
                    "研究ノート、タスク、予定、議論を横断して質問",
                    "回答から元の情報へ戻れるクリック可能なリンク",
                    "プロジェクト、マイルストーン、進捗、ブロッカーも確認",
                ],
                image: "/lp-chat.png",
                imageAlt: "根拠リンク付きのGenos AIの回答",
            },
        ],
        context: {
            eyebrow: "Evidence before confidence",
            title: "検索結果を並べるだけでなく、どの記録が答えを支えているかを示す。",
            body: "「同じ単語が含まれている記録」と「次の判断を変えた記録」は同じではありません。Genosは、ワークスペースに保存されたノート、タスク、議論、予定を使って回答し、元の記録へのリンクを返します。AIの要約だけで判断せず、自分で根拠を確認できます。",
            points: [
                "研究テーマに関係する複数の記録を横断",
                "回答に使ったノートやタスクへ戻れる",
                "未完了作業、ブロッカー、期限を研究履歴と一緒に確認",
                "新しいメンバーも、結論だけでなく経緯を追える",
            ],
        },
        ai: {
            eyebrow: "Genos AI for research",
            title: "何を試し、何を学び、次に何をするのかを質問できる。",
            body: "Genos AIは、ワークスペースに保存された研究ノート、タスク、予定、議論を読み、普段の言葉で答えます。回答には元の記録へのリンクが付きます。計画の作成を依頼した場合は、提案を確認してからタスクや予定へ反映できます。",
            agentTagline: "Ask. Trace. Plan.",
            examplePrompts: [
                "先週、何を試して、何が分かりましたか？",
                "どの結果が、次の実験方針を変えましたか？",
                "次回の実験前に、まだ確認が必要なことは何ですか？",
                "この研究ノートをもとに、次の作業計画を提案してください。",
                "金曜日の研究レビュー前に確認すべきタスクと予定をまとめてください。",
            ],
        },
        approvalTrust: {
            eyebrow: "Human approval by design",
            title: "AIが勝手に研究記録や計画を書き換えることはありません。",
            body: "Genosがタスク、ノート、Todo、予定の作成や更新を提案すると、実行前に確認画面で内容を表示します。研究者が承認するまで、変更は行われません。",
            steps: DEFAULT_APPROVAL_STEPS.ja,
        },
        currentAndNext: {
            availableNow: [
                "研究ノート、タスク、Todo、予定を同じワークスペースで管理",
                "ノート・タスク・議論等を横断したAI回答と出典リンク",
                "長いノートやスレッドの要約",
                "プロジェクト、マイルストーン、スプリント、ブロッカー等の確認",
                "タスク計画、ノート、Todo、予定の承認付き作成・更新",
                "GitHub pull requestに関する読み取り",
            ],
            roadmap: [
                "AIへの質問にPDFや画像を直接添付",
                "すべての添付資料を横断する検索",
                "リマインダー、定期研究ブリーフ、イベント通知",
                "AIによるProject / Folder等のより深い整理",
                "過去の特定時点を再現するtime-travel表示",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "研究の経緯を、個人の記憶だけに置きたくない人へ。",
            items: [
                "複数の実験や調査を並行しているPhD学生・Postdoc",
                "週次レビューで結果と次の作業を整理する小規模研究室",
                "研究ノートとタスク管理が別々になっている研究チーム",
                "過去の判断理由を新メンバーへ説明することが多いR&Dチーム",
                "一人で研究を進め、過去の自分の判断を追いたい独立研究者",
            ],
            hookQuote: "なぜ、この条件に変えたんだっけ？",
            hookLine:
                "その答えを人の記憶ではなく、研究の記録からたどりたいなら、Genosを試す価値があります。",
        },
        comparison: {
            headers: ["", "分散した研究フロー", "Genos"],
            rows: [
                [
                    "実験ノート",
                    "結果だけが残り、関連タスクと離れる",
                    "ノートを実際の作業と同じワークスペースに保存",
                ],
                [
                    "次の行動",
                    "会議後に別のTodoやカレンダーへ転記",
                    "AIが計画を提案し、確認後にタスクや予定へ反映",
                ],
                [
                    "過去の確認",
                    "ファイル、メッセージ、タスクを個別に検索",
                    "ワークスペースを横断して質問し、出典を開く",
                ],
                [
                    "チーム引き継ぎ",
                    "結論だけ共有され、判断理由が抜ける",
                    "結論と関連記録を一緒にたどる",
                ],
                ["AI", "もっともらしい要約だけを受け取る", "元の記録へのリンク付きで回答を確認"],
            ],
        },
        cta: {
            title: "研究室全体を移行する前に、ひとつの研究テーマで試してください。",
            body: "最初のパイロットは、一つの研究テーマを4週間Genosで運用するだけで十分です。研究ノート、関連タスク、予定、週次レビューをつなぎ、過去を探す時間が減るか、次の判断が明確になるかを確認します。",
            primary: "デモを試す",
            secondary: "4週間の研究パイロットを相談する",
        },
        faq: {
            eyebrow: "FAQ",
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
    },
    en: {
        nav: SHARED_NAV.en,
        meta: {
            pageTitle: "Genos for Research | Connect experiments, results, and next decisions",
            metaDescription:
                "Keep research notes, tasks, schedules, results, and decisions in one connected history. Ask Genos what changed, what was learned, and what needs to happen next—with links to the source.",
            ogTitle: "Turn research records into the next decision.",
            ogDescription:
                "Keep what you tried, what happened, what you learned, and what comes next connected in one research workspace.",
        },
        hero: {
            badge: "For researchers and small labs · MVP live",
            title: "Turn research records into the next decision.",
            titleSub:
                "Keep experiments, notes, tasks, schedules, and results in one connected history.",
            lead: "Research depends on more than the final result. You also need to remember why a method was chosen, what changed the interpretation, and what should happen next. Genos keeps research notes, tasks, schedules, and discussions in one workspace, then lets you ask across that history with links to the source. When Genos proposes tasks or calendar changes, you review them before anything is written.",
            primary: "Try the demo",
            secondary: "Discuss a research pilot",
            footnote:
                "Explore without logging in. The free plan requires no credit card. Genos is currently available in a web browser.",
        },
        socialProof: [
            "Keep experiments, results, and next actions connected",
            "Open the notes and tasks behind every AI answer",
            "Review every proposed task or calendar change before it runs",
        ],
        problem: {
            eyebrow: "The research gap",
            title: "The result survives. The reasoning around it fades.",
            body: "Results live in notes, work lives in task lists, and the next run lives on a calendar. A few weeks later, the team still has to reconstruct why a condition changed or which observation led to the next hypothesis.",
            questions: [
                "Why did we stop using method A?",
                "Which result changed the next experimental condition?",
                "What assumptions are still unresolved?",
                "What should we prepare before the next research review?",
            ],
            closing:
                "The value of a research record is not only what it contains. It is also the path from evidence to the next decision.",
            cards: [
                {
                    title: "Experiments lose their rationale",
                    body: "The protocol and result remain, but the reason for choosing a condition stays in a conversation or in someone's memory.",
                },
                {
                    title: "Results do not lead cleanly to the next step",
                    body: "Observation, interpretation, conclusion, and action are stored separately and must be reconstructed at every review.",
                },
                {
                    title: "Research memory depends on people",
                    body: "New members repeat old questions because the path behind earlier decisions is hard to follow.",
                },
            ],
        },
        workflow: {
            eyebrow: "A connected research loop",
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
        solution: {
            eyebrow: "A better research record",
            title: "Do more than store research. Keep it usable for the next decision.",
            body: "Genos brings notes, tasks, todos, schedules, and discussions into the same research workspace. Genos AI answers across the information stored there and links back to the supporting records. When you ask it to create or update work, the proposal waits for your approval.",
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
                image: "/lp-note.png",
                imageAlt: "Research note connected to related tasks",
            },
            {
                title: "Plans and Actions",
                subtitle: "Turn the next experiment into tasks and scheduled work",
                bullets: [
                    "Manage tasks, todos, deadlines, and calendar events for a research theme",
                    "Ask Genos to propose the next work plan from the notes already in the workspace",
                    "Review every AI-created or updated item before it is written",
                ],
                image: "/lp-task.png",
                imageAlt: "Task plan for a research theme awaiting approval",
            },
            {
                title: "Source-linked AI",
                subtitle: "Ask across the history and inspect the evidence behind the answer",
                bullets: [
                    "Ask across research notes, tasks, schedules, and discussions",
                    "Follow clickable links back to the original records",
                    "Check project, milestone, progress, and blocker information",
                ],
                image: "/lp-chat.png",
                imageAlt: "Genos AI answer with source links",
            },
        ],
        context: {
            eyebrow: "Evidence before confidence",
            title: "Do not stop at a plausible summary. See which records support it.",
            body: "A record that shares the same words is not always the record that changed the next decision. Genos answers from the notes, tasks, discussions, and schedules stored in the workspace, then links back to the originals. You can inspect the evidence instead of trusting a summary in isolation.",
            points: [
                "Ask across multiple records related to the same research theme",
                "Open the notes and tasks used in an answer",
                "Review open work, blockers, and deadlines alongside the research history",
                "Help new members follow the path, not only the conclusion",
            ],
        },
        ai: {
            eyebrow: "Genos AI for research",
            title: "Ask what was tried, what was learned, and what needs to happen next.",
            body: "Genos AI reads the research notes, tasks, schedules, and discussions stored in the workspace and answers in plain language with links to the original records. When you ask it to create a plan, you can review the proposal before it becomes tasks or calendar events.",
            agentTagline: "Ask. Trace. Plan.",
            examplePrompts: [
                "What did we try last week, and what did we learn?",
                "Which result caused us to change the next experiment?",
                "What is still unresolved before the next run?",
                "Propose a task plan for the next experiment from these notes.",
                "What should I review before Friday's research meeting?",
            ],
        },
        approvalTrust: {
            eyebrow: "Human approval by design",
            title: "Genos does not silently rewrite your research records or plans.",
            body: "When Genos proposes creating or updating a task, note, todo, or calendar event, it shows the proposed change first. Nothing is written until a person approves it.",
            steps: DEFAULT_APPROVAL_STEPS.en,
        },
        currentAndNext: {
            availableNow: [
                "Manage research notes, tasks, todos, and schedules in the same workspace",
                "Ask across notes, tasks, discussions, and related records with source links",
                "Summarize long notes and threads",
                "Review projects, milestones, sprints, blockers, and related work",
                "Create or update task plans, notes, todos, and calendar events through approval",
                "Read selected GitHub pull-request information",
            ],
            roadmap: [
                "Attach a PDF or image directly to an AI question",
                "Search across every attachment in the workspace",
                "Reminders, recurring research briefs, and event-triggered alerts",
                "Deeper AI organization of projects, folders, and related structures",
                "Time-travel views of past workspace state",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "For researchers who do not want the history of a project to live only in someone's memory.",
            items: [
                "PhD students and postdocs running several experiments or investigations",
                "Small labs that review results and next actions every week",
                "Research teams whose notes and task management live in separate places",
                "R&D teams that repeatedly explain earlier decisions to new members",
                "Independent researchers who need to follow the reasoning of their past self",
            ],
            hookQuote: "Why did we change this condition again?",
            hookLine:
                "If the answer should be traceable from the research record instead of someone's memory, Genos is worth testing.",
        },
        comparison: {
            headers: ["", "Scattered research workflow", "Genos"],
            rows: [
                [
                    "Experiment notes",
                    "The result survives, disconnected from the work around it",
                    "Notes stay in the same workspace as the related work",
                ],
                [
                    "Next actions",
                    "Someone copies decisions into a separate task list or calendar",
                    "Genos proposes a plan and writes it only after approval",
                ],
                [
                    "Looking back",
                    "Search files, messages, and tasks one by one",
                    "Ask across the workspace and open the supporting records",
                ],
                [
                    "Handover",
                    "The conclusion transfers but the rationale is lost",
                    "Follow the conclusion together with its related history",
                ],
                [
                    "AI",
                    "Receive a plausible summary in isolation",
                    "Verify the answer through links to the original records",
                ],
            ],
        },
        cta: {
            title: "Test one research theme before moving an entire lab.",
            body: "A first pilot can be as small as one research theme for four weeks. Keep the notes, related tasks, schedules, and weekly reviews connected, then measure whether the team spends less time reconstructing the past and makes the next decision more clearly.",
            primary: "Try the demo",
            secondary: "Discuss a four-week research pilot",
        },
        faq: {
            eyebrow: "FAQ",
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
    },
};
