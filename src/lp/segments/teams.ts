import { SHARED_NAV } from "./shared";
import type { SegmentConfig } from "./types";

export const teams: SegmentConfig = {
    key: "teams",
    route: "/for-teams",
    mailtoTag: "[Genos Team Workflow Pilot]",
    secondaryCtaKind: "mailto",
    ja: {
        nav: SHARED_NAV.ja,
        meta: {
            pageTitle: "Genos for Teams | 会議・ノート・タスクをつなぐAIワークスペース",
            metaDescription:
                "会議で決まったことをノート、担当、期限、進捗へつなげる。Genos AIが業務の状況を根拠リンク付きで整理し、タスクや予定は確認後に作成します。",
            ogTitle: "会議で決まったことを、次の会議まで消さない。",
            ogDescription:
                "ノート・担当・期限・進捗を、ひとつの業務フローに。AIに詳しくなくても使える、承認付きのAIワークスペース。",
        },
        hero: {
            badge: "小規模チーム向け · AIの専門知識は不要",
            title: "会議で決まったことを、次の会議まで消さない。",
            titleSub: "ノート・担当・期限・進捗を、ひとつの業務フローに。",
            lead: "会議では決まったのに、タスクになっていない。担当は決まったのに、期限が分からない。次の会議で、また同じ確認から始まる。Genosは、会議のノート、タスク、Todo、予定をひとつのワークスペースに置き、Genos AIが「何が決まり、何が残っているか」を根拠リンク付きで答えます。タスクや予定を作るときも、実行前に人が確認します。",
            primary: "デモを試す",
            secondary: "業務パイロットを相談する",
            footnote:
                "ログインなしで体験できます。無料プランはクレジットカード不要です。現在はWebブラウザのみで利用できます。",
        },
        socialProof: [
            "会議 → ノート → タスク → 次回フォローをひとつに",
            "普段の言葉で、未完了・期限・ブロッカーを確認",
            "AIによる変更は、必ず承認してから実行",
        ],
        problem: {
            eyebrow: "The everyday operations gap",
            title: "記録はあるのに、次に何をすべきかが見えない。",
            body: "議事録はドキュメント、担当はチャット、期限はカレンダー、進捗は担当者の頭の中。情報は残っていても、業務としてつながっていなければ、確認と転記に時間がかかります。",
            questions: [
                "前回の会議で、何が決まりましたか？",
                "まだ終わっていないフォローは何ですか？",
                "今週の業務を止めているものは何ですか？",
                "誰が、いつまでに、何をする予定ですか？",
            ],
            closing:
                "Genosが目指すのは「AIを導入した会社」になることではなく、毎週の仕事を少し明確にすることです。",
            cards: [
                {
                    title: "議事録が保管庫になる",
                    body: "会議の内容は残るが、担当・期限・次の確認につながらない。",
                },
                {
                    title: "フォローが人に依存する",
                    body: "誰かが覚えている限り進むが、その人が忙しいと業務が止まる。",
                },
                {
                    title: "AIの使い道が抽象的なまま",
                    body: "チャットAIはあるが、実際のノート、タスク、予定とつながっていない。",
                },
            ],
        },
        workflow: {
            eyebrow: "One recurring workflow",
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
        solution: {
            eyebrow: "A practical way to use AI",
            title: "会議の記録を、確認できる行動に変える。",
            body: "Genosは、ノート、タスク、Todo、予定を同じ業務ワークスペースに置きます。Genos AIに「何が決まったか」「何が残っているか」を聞き、必要ならノートからタスク計画や予定を提案させます。提案は人が確認し、承認されたものだけが反映されます。",
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
                image: "/lp-note.png",
                imageAlt: "会議ノートと関連タスクの画面",
            },
            {
                title: "確認してから実行するAI",
                subtitle: "ノートから、担当・期限・予定を提案",
                bullets: [
                    "会議ノートからタスク計画を提案",
                    "Todoやカレンダー予定の作成・更新を依頼",
                    "AIの提案内容を確認し、承認したものだけを実行",
                ],
                image: "/lp-task.png",
                imageAlt: "会議ノートから提案されたタスク計画の承認画面",
            },
            {
                title: "毎週の状況確認",
                subtitle: "未完了・期限・負荷・ブロッカーを、質問するだけで確認",
                bullets: [
                    "チームのタスク、期限、ブロッカー、進捗を横断して質問",
                    "担当者別の負荷や、自分の優先作業を確認",
                    "回答から元のタスクやノートへ戻れる",
                ],
                image: "/lp-chat.png",
                imageAlt: "チームの進捗状況についてのGenos AIの回答",
            },
        ],
        context: {
            eyebrow: "AI inside the workflow",
            title: "AIの使い方を考えるのではなく、いつもの業務について質問する。",
            body: "新しいAIツールを導入しても、何を聞けばよいか分からなければ使われません。Genosでは、会議ノート、タスク、Todo、予定が同じ場所にあるため、「前回何を決めたか」「誰の作業が止まっているか」と、普段の業務の言葉で質問できます。",
            points: [
                "専門的なプロンプトではなく、日常の質問で使える",
                "回答の根拠になったノートやタスクを開ける",
                "AIの提案は、実行前に人が確認",
                "まず一つの業務から始められる",
            ],
        },
        ai: {
            eyebrow: "Genos AI for teams",
            title: "チームの仕事について、普段の言葉で質問できる。",
            body: "Genos AIは、ワークスペース内のノート、タスク、Todo、予定、議論を読み、現在の状況を根拠リンク付きで答えます。必要なら、会議ノートからタスクや予定を提案させ、確認後に反映できます。",
            agentTagline: "Ask. Review. Follow through.",
            examplePrompts: [
                "前回の会議で、何が決まりましたか？",
                "まだ終わっていないフォローを担当者別にまとめてください。",
                "今週の業務を止めているものは何ですか？",
                "この会議ノートを、担当と期限を含むタスク計画にしてください。",
                "合意した期限をカレンダー予定として提案してください。",
            ],
        },
        approvalTrust: {
            eyebrow: "AI that asks before it acts",
            title: "AIに不慣れなチームほど、「勝手に実行しない」ことが重要です。",
            body: "Genosは、タスク、ノート、Todo、予定への書き込みを実行する前に、変更内容を表示して承認を求めます。AIが提案し、責任を持つ人が判断する設計です。",
            steps: ["業務について依頼", "作成・変更内容を確認", "承認したものだけ実行"],
        },
        currentAndNext: {
            availableNow: [
                "ノート、タスク、Todo、予定の管理",
                "チームの進捗、負荷、期限、ブロッカーに関する質問",
                "AI回答から元の情報へ戻るリンク",
                "会議ノート等からタスク計画を提案",
                "タスク、ノート、Todo、予定の承認付き作成・更新",
                "UI言語に合わせたAI回答",
            ],
            roadmap: [
                "「金曜日に思い出させて」等のリマインダー",
                "カスタムの週次レポート・定期ブリーフ",
                "会議前の自動準備と会議後の自動フォロー",
                "チャットへの送信・返信・リアクション",
                "承認前の編集、Undo、より細かな記憶管理UI",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "毎週同じ確認と転記を繰り返している、小さな業務チームへ。",
            items: [
                "営業会議のフォローを一人が手作業でまとめている",
                "採用候補者や面談の次の行動が複数の場所に分かれている",
                "顧客対応や案件進行で、担当・期限・背景が見えにくい",
                "マーケティング施策の決定と実行が別々に管理されている",
                "AIを導入したいが、具体的な業務への使い方が分からない",
            ],
            hookQuote: "前回、結局何をすることになったんだっけ？",
            hookLine: "その質問が毎週出るなら、まず一つの定例業務をGenosでつないでください。",
        },
        comparison: {
            headers: ["", "よくある運用", "Genos"],
            rows: [
                ["会議", "議事録を保存して終了", "ノートをタスク・予定・次回フォローにつなぐ"],
                [
                    "担当と期限",
                    "チャットや口頭で決まり、後から転記",
                    "AIが提案し、人が確認して反映",
                ],
                ["進捗確認", "担当者へ個別に聞く", "タスク、期限、ブロッカーを横断して質問"],
                [
                    "AI",
                    "仕事と離れた一般チャット",
                    "実際のワークスペース情報を使い、出典付きで回答",
                ],
                ["導入", "会社全体の移行から始める", "一つの定例業務から4週間試す"],
            ],
        },
        cta: {
            title: "AI導入プロジェクトではなく、一つの業務改善から始める。",
            body: "営業会議、採用レビュー、顧客案件、マーケティング進捗など、毎週繰り返す一つの業務を4週間だけGenosで運用してください。会議後の転記が減るか、未完了の確認が速くなるか、次回会議の質が上がるかを測ります。",
            primary: "デモを試す",
            secondary: "4週間の業務パイロットを相談する",
        },
        faq: {
            eyebrow: "FAQ",
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
    },
    en: {
        nav: SHARED_NAV.en,
        meta: {
            pageTitle: "Genos for Teams | Connect meetings, notes, tasks, and follow-ups",
            metaDescription:
                "Keep decisions, owners, deadlines, progress, and follow-ups in one connected workflow. Ask Genos what happened and approve any proposed task or calendar change before it runs.",
            ogTitle: "Make sure decisions survive the meeting.",
            ogDescription:
                "Keep notes, owners, deadlines, and follow-ups in one AI-ready workflow—without giving AI permission to act on its own.",
        },
        hero: {
            badge: "For small teams · No AI expertise required",
            title: "Make sure decisions survive the meeting.",
            titleSub: "Keep notes, owners, deadlines, progress, and follow-ups in one workflow.",
            lead: "The meeting ended with a decision, but no task was created. Someone owns the follow-up, but the deadline is unclear. The next meeting begins by asking the same questions again. Genos keeps meeting notes, tasks, todos, and schedules in one workspace. Genos AI answers what was decided and what remains open, with links to the source—and no task or calendar change happens until a person approves it.",
            primary: "Try the demo",
            secondary: "Discuss a workflow pilot",
            footnote:
                "Explore without logging in. The free plan requires no credit card. Genos is currently available in a web browser.",
        },
        socialProof: [
            "Keep meetings, notes, tasks, and follow-ups together",
            "Ask about open work, deadlines, and blockers in plain language",
            "Approve every AI-proposed change before it runs",
        ],
        problem: {
            eyebrow: "The everyday operations gap",
            title: "The records exist, but the next action is still unclear.",
            body: "The meeting note is in a document, the owner was named in chat, the deadline is on a calendar, and progress lives in someone's head. The information may be preserved, but the workflow is not connected.",
            questions: [
                "What did we decide in the last meeting?",
                "Which follow-ups are still incomplete?",
                "What is blocking this week's work?",
                "Who is doing what, and by when?",
            ],
            closing:
                'The goal is not to become "an AI company." It is to make the team\'s recurring work clearer every week.',
            cards: [
                {
                    title: "Meeting notes become storage",
                    body: "The discussion is preserved but does not turn into an owner, deadline, or follow-up.",
                },
                {
                    title: "Follow-up depends on memory",
                    body: "Work progresses while one person remembers everything, then stalls when that person is busy.",
                },
                {
                    title: "AI remains abstract",
                    body: "The team has access to a chat assistant, but it is disconnected from the actual notes, tasks, and schedules.",
                },
            ],
        },
        workflow: {
            eyebrow: "One recurring workflow",
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
        solution: {
            eyebrow: "A practical way to use AI",
            title: "Turn meeting records into visible, reviewable action.",
            body: "Genos keeps notes, tasks, todos, and schedules in the same workflow. Ask what was decided or what remains open, then have Genos propose a task plan or calendar change from the records already there. A person reviews every proposal before it is applied.",
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
                image: "/lp-note.png",
                imageAlt: "Meeting note connected to related tasks",
            },
            {
                title: "Approved Actions",
                subtitle: "Turn notes into owners, deadlines, and scheduled work",
                bullets: [
                    "Ask Genos to propose a task plan from a meeting note",
                    "Create or update todos and calendar events through the agent",
                    "Review the proposal and run only the changes you approve",
                ],
                image: "/lp-task.png",
                imageAlt: "Task plan proposed from a meeting note, awaiting approval",
            },
            {
                title: "Weekly Visibility",
                subtitle: "Ask about open work, deadlines, workload, and blockers",
                bullets: [
                    "Ask across team tasks, deadlines, blockers, and progress",
                    "Review workload by person or the work that needs your attention",
                    "Open the tasks and notes behind the answer",
                ],
                image: "/lp-chat.png",
                imageAlt: "Genos AI answer about weekly team status",
            },
        ],
        context: {
            eyebrow: "AI inside the workflow",
            title: "Do not invent an AI use case. Ask about the work your team already does.",
            body: "A new AI tool will not be adopted if people do not know what to ask. In Genos, meeting notes, tasks, todos, and schedules already live together, so the team can ask ordinary questions such as what was decided or whose work is blocked.",
            points: [
                "Use everyday questions instead of specialized prompting",
                "Open the notes and tasks behind an answer",
                "Keep a person in control of every proposed change",
                "Start with one workflow instead of replacing the whole stack",
            ],
        },
        ai: {
            eyebrow: "Genos AI for teams",
            title: "Ask about the team's work in ordinary language.",
            body: "Genos AI reads the notes, tasks, todos, schedules, and discussions in the workspace and answers with links to the source. When needed, it can propose tasks or calendar events from a meeting note and wait for approval.",
            agentTagline: "Ask. Review. Follow through.",
            examplePrompts: [
                "What did we decide in the last meeting?",
                "Group the unfinished follow-ups by owner.",
                "What is blocking this week's work?",
                "Turn this meeting note into a task plan with owners and deadlines.",
                "Propose calendar events for the deadlines we agreed on.",
            ],
        },
        approvalTrust: {
            eyebrow: "AI that asks before it acts",
            title: 'For teams new to AI, "nothing changes without approval" matters.',
            body: "Before Genos writes to a task, note, todo, or calendar event, it shows the proposed change and asks for approval. The AI proposes; a responsible person decides.",
            steps: [
                "Ask about the work",
                "Review the proposed change",
                "Run only what you approve",
            ],
        },
        currentAndNext: {
            availableNow: [
                "Manage notes, tasks, todos, and schedules",
                "Ask about team progress, workload, deadlines, and blockers",
                "Open the source records behind an AI answer",
                "Propose a task plan from meeting notes and related context",
                "Create or update tasks, notes, todos, and calendar events through approval",
                "Receive AI answers in the active interface language",
            ],
            roadmap: [
                '"Remind me Friday" and other deferred reminders',
                "Custom weekly reports and recurring briefs",
                "Automatic meeting preparation and follow-up",
                "Sending, replying, or reacting in chat",
                "Edit-before-approve, undo, and a fuller memory-control interface",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "For small teams that repeat the same follow-up and copy work every week.",
            items: [
                "One person manually converts every sales meeting into follow-up work",
                "Candidate discussions and next hiring actions live in several places",
                "Client work lacks a clear view of the owner, deadline, and background",
                "Marketing decisions and execution are managed separately",
                "The company wants to use AI but does not have a concrete workflow for it",
            ],
            hookQuote: "What did we actually agree to do last time?",
            hookLine:
                "If that question appears every week, connect one recurring workflow in Genos first.",
        },
        comparison: {
            headers: ["", "Common workflow", "Genos"],
            rows: [
                [
                    "Meetings",
                    "Save the minutes and stop there",
                    "Connect the note to tasks, schedules, and the next follow-up",
                ],
                [
                    "Owners and deadlines",
                    "Agree in chat or verbally, then copy later",
                    "Let Genos propose the change and have a person approve it",
                ],
                [
                    "Progress checks",
                    "Ask each owner separately",
                    "Ask across tasks, deadlines, and blockers",
                ],
                [
                    "AI",
                    "A general chat assistant outside the workflow",
                    "Answers from the actual workspace with links to sources",
                ],
                [
                    "Adoption",
                    "Begin with a company-wide migration",
                    "Test one recurring workflow for four weeks",
                ],
            ],
        },
        cta: {
            title: "Start with one workflow improvement, not an AI transformation project.",
            body: "Choose one recurring process—a sales review, hiring review, client project, or marketing check-in—and run it in Genos for four weeks. Measure whether the team copies less, finds open work faster, and begins the next meeting with clearer context.",
            primary: "Try the demo",
            secondary: "Discuss a four-week workflow pilot",
        },
        faq: {
            eyebrow: "FAQ",
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
    },
};
