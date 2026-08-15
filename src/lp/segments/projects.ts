import { DEFAULT_APPROVAL_STEPS, SHARED_NAV } from "./shared";
import type { SegmentConfig } from "./types";

export const projects: SegmentConfig = {
    key: "projects",
    route: "/for-projects",
    mailtoTag: "[Genos Project Pilot]",
    secondaryCtaKind: "mailto",
    ja: {
        nav: SHARED_NAV.ja,
        meta: {
            pageTitle:
                "Genos for Projects | 議論・仕様・タスクをつなぐAIプロジェクトワークスペース",
            metaDescription:
                "仕様変更の理由、タスクの背景、依存関係、リリース状況をひとつのワークスペースで追跡。Genos AIが出典リンク付きで答え、タスク計画は確認後に作成します。",
            ogTitle: "すべての決定を、それが生んだ仕事につなげる。",
            ogDescription:
                "議論・仕様・タスク・依存関係・GitHubの状況を、ひとつのプロジェクト履歴としてたどる。",
        },
        hero: {
            badge: "プロジェクト・スタートアップチーム向け · MVP公開中",
            title: "すべての決定を、それが生んだ仕事につなげる。",
            titleSub: "議論・仕様・タスク・依存関係・リリース状況を、ひとつのプロジェクト履歴に。",
            lead: "仕様は更新された。でも、なぜ変わったのかはチャットの中。タスクは残っている。でも、現在も正しいのか分からない。Genosは、会話、ノート、タスクを同じワークスペースに置き、Genos AIが変更理由、ブロッカー、関連作業を根拠リンク付きで答えます。議論からマイルストーンとタスク計画を作る場合も、実行前にチームが確認します。",
            primary: "デモを試す",
            secondary: "プロジェクトパイロットを相談する",
            footnote:
                "ログインなしで体験できます。無料プランはクレジットカード不要です。現在はWebブラウザのみで利用できます。",
        },
        socialProof: [
            "議論・仕様・タスク・依存関係をひとつのプロジェクトに",
            "変更理由・ブロッカー・関連PRを、出典付きで確認",
            "マイルストーンとタスク計画を、承認後に作成",
        ],
        problem: {
            eyebrow: "The project context gap",
            title: "プロジェクトは進むほど、「現在の正解」が分からなくなる。",
            body: "案はチャットで生まれ、仕様はノートに書かれ、実装はタスクとPull Requestで進みます。前提が変わるたびに、それぞれが少しずつずれ、最終的には誰かが正しい経緯を再構成しなければなりません。",
            questions: [
                "結局、何を作ることになっていますか？",
                "なぜ、スコープが変わったのですか？",
                "何がブロックされ、何に依存していますか？",
                "現在のリリースに関係するタスクとPRはどれですか？",
            ],
            closing:
                "検索で関連情報を見つけるだけでは、どの決定が現在も有効かは分かりません。プロジェクトには、情報と情報の間の履歴が必要です。",
            cards: [
                {
                    title: "決定が実行から離れる",
                    body: "チャットで決まったことが、仕様やタスクへ移る途中で背景を失う。",
                },
                {
                    title: "タスクが古い前提を持ち続ける",
                    body: "スコープが変わっても、変更理由と影響範囲が関連作業へ伝わらない。",
                },
                {
                    title: "キャッチアップが考古学になる",
                    body: "新しいメンバーや休暇明けの担当者が、複数の場所から経緯を再構成する。",
                },
            ],
        },
        workflow: {
            eyebrow: "A connected delivery loop",
            title: "議論からリリースまで、変更の理由を切らさない。",
            body: "Genosは、会話、決定、仕様、タスク、依存関係、進捗を、同じプロジェクトの流れとして扱います。",
            steps: [
                "議論",
                "決定",
                "仕様・ノート",
                "タスク・依存関係",
                "実装・Pull Request",
                "結果・次の変更",
            ],
        },
        solution: {
            eyebrow: "Context native by design",
            title: "別々のツールを後から検索するのではなく、仕事の関係を最初から残す。",
            body: "Genosでは、会話、ノート、タスクを同じワークスペースに置き、関連情報へ戻れる状態を作ります。Genos AIは、タスク、依存関係、プロジェクト、マイルストーン、スプリント、GitHub PR等を読み、現在の状況を出典付きで答えます。計画の作成や更新は、承認フローを通じて実行します。",
        },
        features: [
            {
                title: "つながった議論",
                subtitle: "決定の背景を、仕様とタスクからたどれる状態に",
                bullets: [
                    "チャンネル、DM、スレッドをプロジェクトの会話として管理",
                    "チャット、ノート、タスクを同じワークスペースに置く",
                    "長いスレッドを要約し、内容について続けて質問",
                ],
                image: "/lp-chat.png",
                imageAlt: "プロジェクトの議論スレッドと要約",
            },
            {
                title: "構造化された実行計画",
                subtitle: "議論から、マイルストーン・タスク・依存関係を提案",
                bullets: [
                    "タスク、担当、期限、状態、コメントを管理",
                    "ブロッカー、依存関係、stale task、throughputを確認",
                    "複合タスク計画を一度の承認で作成",
                ],
                image: "/lp-task.png",
                imageAlt: "議論から提案されたマイルストーンとタスク計画",
            },
            {
                title: "プロジェクトの状況を読むAI",
                subtitle: "現在の計画、変更理由、関連作業を、根拠付きで確認",
                bullets: [
                    "プロジェクト、マイルストーン、スプリント、チーム状況を横断",
                    "GitHub PRのコメント、ファイル、レビュー、コミットを読み取り",
                    "回答から元のタスク、ノート、チャットへ戻れる",
                ],
                image: "/lp-note.png",
                imageAlt: "プロジェクト状況についてのGenos AIの回答",
            },
        ],
        context: {
            eyebrow: "Retrieval is not project history",
            title: "関連する情報ではなく、現在の判断を説明する情報を見つける。",
            body: "古い仕様も、変更後の仕様も、検索上はどちらも関連しています。重要なのは、どの議論がタスクを作り、どの決定が前提を変え、どの依存関係が今も作業を止めているかです。Genosは、保存されたプロジェクト情報を横断し、答えの根拠へ戻れるようにします。",
            points: [
                "タスク、依存関係、ブロッカーを一緒に確認",
                "プロジェクト、マイルストーン、スプリントの状況を横断",
                "GitHub PRと関連作業の文脈を確認",
                "回答から元の議論・仕様・タスクを開く",
            ],
        },
        ai: {
            eyebrow: "Genos AI for projects",
            title: "現在の正しい計画と、その理由を質問できる。",
            body: "Genos AIは、会話、ノート、タスク、依存関係、プロジェクト状況、選択されたGitHub情報を横断して答えます。長い履歴を探し直す代わりに、まず要約を受け取り、必要な出典を開けます。新しい計画の作成は、チームの承認後に実行されます。",
            agentTagline: "Ask. Trace. Execute with approval.",
            examplePrompts: [
                "結局、現在は何を作ることになっていますか？",
                "なぜ、この機能のスコープが変わったのですか？",
                "何がブロックされ、どのタスクに依存していますか？",
                "この議論から、マイルストーンとタスク計画を提案してください。",
                "現在のリリースに関係するタスクとPull Requestをまとめてください。",
            ],
        },
        approvalTrust: {
            eyebrow: "Control before automation",
            title: "計画を速く作っても、実行権限はチームに残す。",
            body: "Genosは、タスク計画や更新を提案できますが、書き込み前に内容を表示します。チームが確認し、承認した変更だけが実行されます。Autonomousな変更は現在の製品方針ではありません。",
            steps: DEFAULT_APPROVAL_STEPS.ja,
        },
        currentAndNext: {
            availableNow: [
                "Chat、Note、Taskを同じワークスペースで管理",
                "タスク依存関係、ブロッカー、stale task、throughputの確認",
                "プロジェクト、マイルストーン、スプリント、チーム状況の読み取り",
                "GitHub PRのコメント、ファイル、レビュー、コミットの読み取り",
                "マイルストーン、タスクツリー、依存関係を含む計画の承認付き作成",
                "出典リンク付きAI回答と長文要約",
            ],
            roadmap: [
                "チャットへの送信、返信、リアクション",
                "TaskやCalendar画面から直接Ask Genosする入口",
                "書き込み後に作成物をすぐ開く統一導線",
                "AIによるProject / Folder / Sprint等のより広い整理",
                "承認前の編集、Undo、過去時点のtime-travel",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "変更が多く、判断理由と実行が離れやすいプロジェクトへ。",
            items: [
                "一つの機能について、議論・仕様・実装が何度も変わるスタートアップ",
                "複数の顧客案件を少人数で進めるAgency",
                "依存関係やブロッカーを日常的に管理するプロジェクトチーム",
                "新しいメンバーのキャッチアップに時間がかかるチーム",
                "AI検索だけでなく、計画作成まで支援してほしいFounderやPM",
            ],
            hookQuote: "結局、いま何を作るのが正しいんだっけ？",
            hookLine:
                "その答えが複数の場所に分かれているなら、一つのfeatureやclient projectでGenosを試してください。",
        },
        comparison: {
            headers: ["", "分散したプロジェクト", "Genos"],
            rows: [
                ["議論", "チャットに流れ、後から探す", "ノート・タスクと同じワークスペースで保持"],
                ["仕様", "決定後に別の場所へ転記", "背景の議論と実行作業を一緒にたどる"],
                ["タスク", "何をするかだけが残る", "依存関係、ブロッカー、関連情報と一緒に確認"],
                [
                    "計画作成",
                    "PMが手作業でタスクへ分解",
                    "Genosが構造化案を作り、チーム承認後に作成",
                ],
                ["AI", "複数ツールの関連情報を検索", "プロジェクト情報を横断し、出典付きで回答"],
            ],
        },
        cta: {
            title: "会社全体ではなく、一つのfeature・launch・client projectで試す。",
            body: "4週間のパイロットでは、議論、仕様、タスク、依存関係、進捗確認を一つのプロジェクトで運用します。変更理由を探す時間、キャッチアップ時間、計画作成の負荷が減るかを確認してください。",
            primary: "デモを試す",
            secondary: "4週間のプロジェクトパイロットを相談する",
        },
        faq: {
            eyebrow: "FAQ",
            title: "よくある質問",
            items: [
                {
                    q: "Slack、Notion、Jiraのデータを自動で統合しますか？",
                    a: "外部ツールの全履歴が自動的に移行・同期されるわけではありません。現在の強みは、Genos内のChat、Note、Taskを同じワークスペースで扱い、対応している情報をAIが横断できることです。",
                },
                {
                    q: "Genos AIはどのようなプロジェクト情報を読めますか？",
                    a: "対応する範囲では、タスク、依存関係、ブロッカー、プロジェクト、マイルストーン、スプリント、チーム状況、予定、選択されたGitHub Pull Request情報などを読めます。",
                },
                {
                    q: "議論からタスク計画を作れますか？",
                    a: "はい。Genosはマイルストーン、タスクツリー、依存関係を含む構造化計画を提案できます。作成前に内容を確認し、承認する必要があります。",
                },
                {
                    q: "チャットへ返信できますか？",
                    a: "現在、Genos AIはチャットメッセージの送信、返信、リアクションを行えません。チャットの読み取り、要約、質問が中心です。",
                },
                {
                    q: "AIがプロジェクトを自動で変更しますか？",
                    a: "いいえ。タスク、ノート、Todo、予定への書き込みはすべて承認付きです。Autonomousな書き込みは現在の方針ではありません。",
                },
            ],
        },
    },
    en: {
        nav: SHARED_NAV.en,
        meta: {
            pageTitle: "Genos for Projects | Keep decisions connected to execution",
            metaDescription:
                "Trace scope changes, task rationale, dependencies, project status, and selected GitHub pull-request context in one workspace. Ask Genos with source links and approve structured plans before they are created.",
            ogTitle: "Keep every decision connected to the work it creates.",
            ogDescription:
                "Bring discussions, specifications, tasks, dependencies, and release context into one traceable project history.",
        },
        hero: {
            badge: "For project and startup teams · MVP live",
            title: "Keep every decision connected to the work it creates.",
            titleSub:
                "Bring discussions, specs, tasks, dependencies, and release context into one project history.",
            lead: "The specification changed, but the reason is buried in chat. The task still exists, but nobody knows whether it is still correct. Genos keeps conversations, notes, and tasks in the same workspace. Genos AI answers why scope changed, what is blocked, and which work is related—with links to the source. When it proposes a milestone and task plan, the team reviews it before creation.",
            primary: "Try the demo",
            secondary: "Discuss a project pilot",
            footnote:
                "Explore without logging in. The free plan requires no credit card. Genos is currently available in a web browser.",
        },
        socialProof: [
            "Keep discussions, specs, tasks, and dependencies in one project",
            "Trace scope changes, blockers, and related pull requests with sources",
            "Create milestone and task plans only after approval",
        ],
        problem: {
            eyebrow: "The project context gap",
            title: "As a project moves forward, the current truth becomes harder to find.",
            body: "An idea begins in chat, a specification is written in a note, and implementation moves through tasks and pull requests. Every change shifts those records slightly apart until someone has to reconstruct the correct history.",
            questions: [
                "What are we actually supposed to build?",
                "Why did the scope change?",
                "What is blocked, and what does it depend on?",
                "Which tasks and pull requests relate to the current release?",
            ],
            closing:
                "Finding relevant information is not enough to know which decision is still valid. A project needs a traceable history between its records.",
            cards: [
                {
                    title: "Decisions separate from execution",
                    body: "A choice made in chat loses its rationale while becoming a specification or task.",
                },
                {
                    title: "Tasks keep outdated assumptions",
                    body: "Scope changes, but the reason and impact do not reach all related work.",
                },
                {
                    title: "Catch-up becomes archaeology",
                    body: "New members and returning teammates reconstruct the project from several different places.",
                },
            ],
        },
        workflow: {
            eyebrow: "A connected delivery loop",
            title: "Keep the reason for change intact from discussion to release.",
            body: "Genos treats conversations, decisions, specifications, tasks, dependencies, and progress as parts of the same project history.",
            steps: [
                "Discussion",
                "Decision",
                "Specification or note",
                "Tasks and dependencies",
                "Implementation and pull request",
                "Result and next change",
            ],
        },
        solution: {
            eyebrow: "Context native by design",
            title: "Do not search disconnected tools after the fact. Preserve the relationship while the work happens.",
            body: "Genos keeps conversations, notes, and tasks in the same workspace so related records remain traceable. Genos AI can read tasks, dependencies, projects, milestones, sprints, selected GitHub pull-request data, and more, then answer with sources. Plans and updates run through an approval flow.",
        },
        features: [
            {
                title: "Connected Discussion",
                subtitle: "Keep the decision history reachable from specifications and tasks",
                bullets: [
                    "Manage channels, DMs, and threads as part of project work",
                    "Keep chat, notes, and tasks in the same workspace",
                    "Summarize a long thread and ask follow-up questions",
                ],
                image: "/lp-chat.png",
                imageAlt: "Project discussion thread with a summary",
            },
            {
                title: "Structured Execution",
                subtitle: "Turn a discussion into milestones, tasks, and dependencies",
                bullets: [
                    "Manage tasks, owners, deadlines, status, and comments",
                    "Review blockers, dependencies, stale tasks, and throughput",
                    "Create a structured task plan through one approval",
                ],
                image: "/lp-task.png",
                imageAlt: "Milestone and task plan proposed from a discussion",
            },
            {
                title: "Project Intelligence",
                subtitle: "Ask about the current plan, why it changed, and which work is related",
                bullets: [
                    "Ask across projects, milestones, sprints, and team activity",
                    "Read selected GitHub pull-request comments, files, reviews, and commits",
                    "Open the tasks, notes, and chats behind the answer",
                ],
                image: "/lp-note.png",
                imageAlt: "Genos AI answer about project status",
            },
        ],
        context: {
            eyebrow: "Retrieval is not project history",
            title: "Find the record that explains the current decision, not only something relevant.",
            body: "An old specification and its replacement may both be relevant to a search. What matters is which discussion created the task, which decision changed the assumption, and which dependency still blocks the work. Genos answers across the project records it can access and lets you open the sources.",
            points: [
                "Review tasks, dependencies, and blockers together",
                "Ask across projects, milestones, and sprints",
                "Inspect selected GitHub pull-request context",
                "Open the discussion, specification, or task behind the answer",
            ],
        },
        ai: {
            eyebrow: "Genos AI for projects",
            title: "Ask for the current plan—and the history that explains it.",
            body: "Genos AI answers across conversations, notes, tasks, dependencies, project status, and selected GitHub context. Instead of reconstructing weeks of history, get a grounded summary first and open the sources that matter. New plans are created only after team approval.",
            agentTagline: "Ask. Trace. Execute with approval.",
            examplePrompts: [
                "What are we actually supposed to build now?",
                "Why did the scope of this feature change?",
                "What is blocked, and which tasks does it depend on?",
                "Propose a milestone and task plan from this discussion.",
                "Summarize the tasks and pull requests related to the current release.",
            ],
        },
        approvalTrust: {
            eyebrow: "Control before automation",
            title: "Create plans faster without giving up team control.",
            body: "Genos can propose a task plan or update, but it shows the change before writing. Only the changes approved by the team are executed. Autonomous writes are not part of the current product policy.",
            steps: DEFAULT_APPROVAL_STEPS.en,
        },
        currentAndNext: {
            availableNow: [
                "Manage chat, notes, and tasks in the same workspace",
                "Review task dependencies, blockers, stale work, and throughput",
                "Read project, milestone, sprint, and team-status information",
                "Read selected GitHub pull-request comments, files, reviews, and commits",
                "Create an approved plan containing a milestone, task tree, and dependencies",
                "Receive source-linked AI answers and summarize long content",
            ],
            roadmap: [
                "Sending, replying, or reacting in chat",
                '"Ask Genos" entry points directly on task and calendar surfaces',
                "A consistent link to open every item created by an agent write",
                "Broader AI organization of projects, folders, sprints, and related structures",
                "Edit-before-approve, undo, and time-travel views",
            ],
        },
        audience: {
            eyebrow: "Who it is for",
            title: "For projects where decisions change quickly and execution loses the reason behind them.",
            items: [
                "Startups where a feature moves repeatedly between discussion, specification, and implementation",
                "Agencies running several client projects with a small team",
                "Project teams that manage dependencies and blockers every day",
                "Teams that spend too long onboarding new members into project history",
                "Founders and PMs who want AI to help build plans, not only search",
            ],
            hookQuote: "What are we actually supposed to build now?",
            hookLine:
                "If the answer is spread across several places, test Genos on one feature or client project.",
        },
        comparison: {
            headers: ["", "Scattered project", "Genos"],
            rows: [
                [
                    "Discussion",
                    "Scrolls away in chat and must be found later",
                    "Lives in the same workspace as notes and tasks",
                ],
                [
                    "Specification",
                    "Copied somewhere else after the decision",
                    "Remains traceable with the discussion and execution work",
                ],
                [
                    "Tasks",
                    "Preserve only what to do",
                    "Review dependencies, blockers, and related context together",
                ],
                [
                    "Planning",
                    "A PM manually decomposes the work",
                    "Genos proposes a structured plan and creates it after approval",
                ],
                [
                    "AI",
                    "Searches for relevant fragments across tools",
                    "Answers across project records and links to the sources",
                ],
            ],
        },
        cta: {
            title: "Test one feature, launch, or client project—not the entire company.",
            body: "For four weeks, keep the discussion, specification, tasks, dependencies, and status checks inside one project. Measure whether the team spends less time finding the reason for change, catching up, and manually building plans.",
            primary: "Try the demo",
            secondary: "Discuss a four-week project pilot",
        },
        faq: {
            eyebrow: "FAQ",
            title: "Frequently asked questions",
            items: [
                {
                    q: "Does Genos automatically combine all Slack, Notion, and Jira data?",
                    a: "No. Genos does not automatically migrate or continuously synchronize every external-tool history. The current strength is keeping Genos chat, notes, and tasks in one workspace and letting AI work across supported information.",
                },
                {
                    q: "What project information can Genos AI read?",
                    a: "Within its supported scope, it can read tasks, dependencies, blockers, projects, milestones, sprints, team status, schedules, and selected GitHub pull-request information.",
                },
                {
                    q: "Can it turn a discussion into a task plan?",
                    a: "Yes. Genos can propose a structured plan containing a milestone, task tree, and dependencies. The team reviews and approves it before creation.",
                },
                {
                    q: "Can it reply in chat?",
                    a: "Not currently. Genos AI can read supported chat context, summarize it, and answer questions, but it cannot send, reply, or react.",
                },
                {
                    q: "Can AI change the project automatically?",
                    a: "No. Writes to tasks, notes, todos, and calendar events are approval-gated. Autonomous writes are not the current product policy.",
                },
            ],
        },
    },
};
