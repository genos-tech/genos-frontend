import type { SegmentConfig } from "./types";

export const teams: SegmentConfig = {
    key: "teams",
    route: "/for-teams",
    mailtoTag: "[Genos Team Workflow Pilot]",
    secondaryCtaKind: "mailto",
    ja: {
        meta: {
            title: "Genos for Teams | 会議・ノート・タスクをつなぐAIワークスペース",
            description:
                "会議で決まったことをノート、担当、期限、進捗へつなげる。Genos AIが業務の状況を根拠リンク付きで整理し、タスクや予定は確認後に作成します。",
            ogTitle: "会議で決まったことを、次の会議まで消さない。",
            ogDescription:
                "ノート・担当・期限・進捗を、ひとつの業務フローに。AIに詳しくなくても使える、承認付きのAIワークスペース。",
        },
        hero: {
            title: "会議で決まったことを、次の会議まで消さない。",
            sub: "ノート・担当・期限・進捗を、ひとつの業務フローに。",
            lead: "会議では決まったのに、タスクになっていない。担当は決まったのに、期限が分からない。次の会議で、また同じ確認から始まる。Genosは、会議のノート、タスク、Todo、予定をひとつのワークスペースに置き、Genos AIが「何が決まり、何が残っているか」を根拠リンク付きで答えます。タスクや予定を作るときも、実行前に人が確認します。",
            primary: "デモを試す",
            secondary: "業務パイロットを相談する",
            footnote:
                "ログインなしで体験できます。無料プランはクレジットカード不要です。現在はWebブラウザのみで利用できます。",
        },
        trust: [
            "会議 → ノート → タスク → 次回フォローをひとつに",
            "普段の言葉で、未完了・期限・ブロッカーを確認",
            "AIによる変更は、必ず承認してから実行",
        ],
        questions: {
            title: "記録はあるのに、次に何をすべきかが見えない。",
            items: [
                "前回の会議で、何が決まりましたか？",
                "まだ終わっていないフォローは何ですか？",
                "今週の業務を止めているものは何ですか？",
                "誰が、いつまでに、何をする予定ですか？",
            ],
            closing:
                "Genosが目指すのは「AIを導入した会社」になることではなく、毎週の仕事を少し明確にすることです。",
        },
        workflow: {
            title: "会社全体を変える前に、毎週繰り返す一つの業務をつなぐ。",
            body: "営業会議、採用レビュー、顧客対応、マーケティング進捗、業務改善会議。まずは一つの定例業務をGenosで運用します。",
            steps: [
                "会議・相談",
                "共有ノート・決定",
                "タスク・Todo・予定",
                "進捗とブロッカーの確認",
                "結果・次のフォロー",
            ],
        },
        features: [
            {
                title: "共有ノートと決定",
                subtitle: "会議の内容を、次の仕事から切り離さない",
                bullets: [
                    "議事録、決定事項、顧客情報、運用メモを共同ノートに保存",
                    "関連するタスクや予定を同じワークスペースで管理",
                    "長いノートやスレッドを要約して、必要な点だけ確認",
                ],
            },
            {
                title: "確認してから実行するAI",
                subtitle: "ノートから、担当・期限・予定を提案",
                bullets: [
                    "会議ノートからタスク計画を提案",
                    "Todoやカレンダー予定の作成・更新を依頼",
                    "AIの提案内容を確認し、承認したものだけを実行",
                ],
            },
            {
                title: "毎週の状況確認",
                subtitle: "未完了・期限・負荷・ブロッカーを、質問するだけで確認",
                bullets: [
                    "チームのタスク、期限、ブロッカー、進捗を横断して質問",
                    "担当者別の負荷や、自分の優先作業を確認",
                    "回答から元のタスクやノートへ戻れる",
                ],
            },
        ],
        ai: {
            title: "チームの仕事について、普段の言葉で質問できる。",
            body: "Genos AIは、ワークスペース内のノート、タスク、Todo、予定、議論を読み、現在の状況を根拠リンク付きで答えます。必要なら、会議ノートからタスクや予定を提案させ、確認後に反映できます。",
            prompts: [
                "前回の会議で、何が決まりましたか？",
                "まだ終わっていないフォローを担当者別にまとめてください。",
                "今週の業務を止めているものは何ですか？",
                "この会議ノートを、担当と期限を含むタスク計画にしてください。",
                "合意した期限をカレンダー予定として提案してください。",
            ],
        },
        now: [
            "ノート、タスク、Todo、予定の管理",
            "チームの進捗、負荷、期限、ブロッカーに関する質問",
            "AI回答から元の情報へ戻るリンク",
            "会議ノート等からタスク計画を提案",
            "タスク、ノート、Todo、予定の承認付き作成・更新",
            "UI言語に合わせたAI回答",
        ],
        coming: [
            "AIへの質問にPDFや画像を直接添付する",
            "ルーティン：よく使う指示を保存して、スケジュールで実行する",
            "チャットの返信下書き（送信するのはいつもあなた）",
        ],
        audience: {
            title: "毎週同じ確認と転記を繰り返している、小さな業務チームへ。",
            items: [
                "営業会議のフォローを一人が手作業でまとめている",
                "採用候補者や面談の次の行動が複数の場所に分かれている",
                "顧客対応や案件進行で、担当・期限・背景が見えにくい",
                "マーケティング施策の決定と実行が別々に管理されている",
                "AIを導入したいが、具体的な業務への使い方が分からない",
            ],
            quote: "前回、結局何をすることになったんだっけ？",
        },
        faq: {
            title: "よくある質問",
            items: [
                {
                    q: "AIの専門知識がなくても使えますか？",
                    a: "はい。業務について普段使う言葉で質問できます。専用のプロンプトを書くことより、「前回何を決めたか」「何が未完了か」といった具体的な業務の質問から始めることを想定しています。",
                },
                {
                    q: "今使っているツールをすべて移行する必要がありますか？",
                    a: "いいえ。最初は会社全体ではなく、一つの定例業務やプロジェクトをGenosで運用することを推奨します。外部ツールの全履歴が自動的に移行・同期されるわけではありません。",
                },
                {
                    q: "AIが勝手にタスクや予定を変更しませんか？",
                    a: "変更しません。AIがタスク、ノート、Todo、予定の作成・更新を提案した場合、実行前に人の承認が必要です。",
                },
                {
                    q: "Slackや他のチャットへ返信できますか？",
                    a: "現在、Genos AIにはチャットへの送信・返信・リアクション機能はありません。チャット内容の読み取りや、スレッドに関する質問・要約を中心に利用できます。",
                },
                {
                    q: "日本語で使えますか？",
                    a: "はい。日本語UIを選択したユーザーには、Genos AIも日本語で回答するよう設計されています。",
                },
            ],
        },
        cta: {
            title: "AI導入プロジェクトではなく、一つの業務改善から始める。",
            body: "営業会議、採用レビュー、顧客案件、マーケティング進捗など、毎週繰り返す一つの業務を4週間だけGenosで運用してください。会議後の転記が減るか、未完了の確認が速くなるか、次回会議の質が上がるかを測ります。",
            primary: "デモを試す",
            secondary: "4週間の業務パイロットを相談する",
        },
    },
    en: {
        meta: {
            title: "Genos for Teams | Connect meetings, notes, tasks, and follow-ups",
            description:
                "Keep decisions, owners, deadlines, progress, and follow-ups in one connected workflow. Ask Genos what happened and approve any proposed task or calendar change before it runs.",
            ogTitle: "Make sure decisions survive the meeting.",
            ogDescription:
                "Keep notes, owners, deadlines, and follow-ups in one AI-ready workflow—without giving AI permission to act on its own.",
        },
        hero: {
            title: "Make sure decisions survive the meeting.",
            sub: "Keep notes, owners, deadlines, progress, and follow-ups in one workflow.",
            lead: "The meeting ended with a decision, but no task was created. Someone owns the follow-up, but the deadline is unclear. The next meeting begins by asking the same questions again. Genos keeps meeting notes, tasks, todos, and schedules in one workspace. Genos AI answers what was decided and what remains open, with links to the source—and no task or calendar change happens until a person approves it.",
            primary: "Try the demo",
            secondary: "Discuss a workflow pilot",
            footnote:
                "Explore without logging in. The free plan requires no credit card. Genos is currently available in a web browser.",
        },
        trust: [
            "Keep meetings, notes, tasks, and follow-ups together",
            "Ask about open work, deadlines, and blockers in plain language",
            "Approve every AI-proposed change before it runs",
        ],
        questions: {
            title: "The records exist, but the next action is still unclear.",
            items: [
                "What did we decide in the last meeting?",
                "Which follow-ups are still incomplete?",
                "What is blocking this week's work?",
                "Who is doing what, and by when?",
            ],
            closing:
                'The goal is not to become "an AI company." It is to make the team\'s recurring work clearer every week.',
        },
        workflow: {
            title: "Connect one weekly process before changing the whole company.",
            body: "A sales review, hiring review, client-delivery meeting, marketing check-in, or operations meeting is enough for the first pilot.",
            steps: [
                "Meeting or discussion",
                "Shared note and decision",
                "Tasks, todos, and schedule",
                "Progress and blocker check",
                "Result and next follow-up",
            ],
        },
        features: [
            {
                title: "Shared Decisions",
                subtitle: "Keep meeting records connected to the work they create",
                bullets: [
                    "Store meeting notes, decisions, client records, and operating notes collaboratively",
                    "Manage the related tasks and schedules in the same workspace",
                    "Summarize long notes or threads and focus on what matters",
                ],
            },
            {
                title: "Approved Actions",
                subtitle: "Turn notes into owners, deadlines, and scheduled work",
                bullets: [
                    "Ask Genos to propose a task plan from a meeting note",
                    "Create or update todos and calendar events through the agent",
                    "Review the proposal and run only the changes you approve",
                ],
            },
            {
                title: "Weekly Visibility",
                subtitle: "Ask about open work, deadlines, workload, and blockers",
                bullets: [
                    "Ask across team tasks, deadlines, blockers, and progress",
                    "Review workload by person or the work that needs your attention",
                    "Open the tasks and notes behind the answer",
                ],
            },
        ],
        ai: {
            title: "Ask about the team's work in ordinary language.",
            body: "Genos AI reads the notes, tasks, todos, schedules, and discussions in the workspace and answers with links to the source. When needed, it can propose tasks or calendar events from a meeting note and wait for approval.",
            prompts: [
                "What did we decide in the last meeting?",
                "Group the unfinished follow-ups by owner.",
                "What is blocking this week's work?",
                "Turn this meeting note into a task plan with owners and deadlines.",
                "Propose calendar events for the deadlines we agreed on.",
            ],
        },
        now: [
            "Manage notes, tasks, todos, and schedules",
            "Ask about team progress, workload, deadlines, and blockers",
            "Open the source records behind an AI answer",
            "Propose a task plan from meeting notes and related context",
            "Create or update tasks, notes, todos, and calendar events through approval",
            "Receive AI answers in the active interface language",
        ],
        coming: [
            "Attach a PDF or image directly to an AI question",
            "Routines: save an instruction and run it on a schedule",
            "Reply drafts in chat (you always press send)",
        ],
        audience: {
            title: "For small teams that repeat the same follow-up and copy work every week.",
            items: [
                "One person manually converts every sales meeting into follow-up work",
                "Candidate discussions and next hiring actions live in several places",
                "Client work lacks a clear view of the owner, deadline, and background",
                "Marketing decisions and execution are managed separately",
                "The company wants to use AI but does not have a concrete workflow for it",
            ],
            quote: "What did we actually agree to do last time?",
        },
        faq: {
            title: "Frequently asked questions",
            items: [
                {
                    q: "Do we need AI expertise to use Genos?",
                    a: "No. Ask ordinary questions about the workflow, such as what was decided or what remains incomplete. The experience should not depend on learning specialized prompting.",
                },
                {
                    q: "Do we need to migrate every tool first?",
                    a: "No. Begin with one recurring workflow or project. Genos does not automatically import or continuously synchronize the full history of other tools today.",
                },
                {
                    q: "Can AI change tasks or schedules without permission?",
                    a: "No. Proposed writes to tasks, notes, todos, and calendar events require human approval before they run.",
                },
                {
                    q: "Can Genos reply in Slack or another chat tool?",
                    a: "Not currently. Genos can read supported chat context and answer or summarize, but chat sending, replying, and reacting are not current agent capabilities.",
                },
                {
                    q: "Can the team use Genos in Japanese?",
                    a: "Yes. When the Japanese interface is active, Genos AI is instructed to answer in Japanese as well.",
                },
            ],
        },
        cta: {
            title: "Start with one workflow improvement, not an AI transformation project.",
            body: "Choose one recurring process—a sales review, hiring review, client project, or marketing check-in—and run it in Genos for four weeks. Measure whether the team copies less, finds open work faster, and begins the next meeting with clearer context.",
            primary: "Try the demo",
            secondary: "Discuss a four-week workflow pilot",
        },
    },
};
