import type { Lang } from "../lpLang";

/**
 * /home copy, Japanese and English (MIP-1232).
 *
 * Written, not translated: the Japanese is its own text for the market it was
 * written for, so the two say the same things in different words.
 *
 * Truth rules for this file:
 *  - Anything not live in production says so (`coming: true`, rendered as a
 *    "Coming" badge). Checked 2026-11-08: the MCP OAuth server is live
 *    (`api.genosai.dev/.well-known/oauth-authorization-server`); ChatGPT's
 *    directory listing (MIP-1108) and Routines (MIP-1067) are not.
 *  - Numbers that can drift are not typed here: the MCP tool count is read
 *    from the developers page's tool list (`{tools}` below).
 *  - Nothing about model training: the privacy page deliberately makes no
 *    such claim (see its TODO(owner)), so neither does this page.
 *  - The examples are the demo workspace's own story (kept by MIP-1237): the
 *    "framer-motion or plain CSS?" spike of the website-redesign project. The
 *    page shows what "Try the demo" opens, so these words and the screenshots
 *    are the same events.
 */

export type LineKind = "chat" | "note" | "task";

type Point = { text: string; coming?: boolean; plan?: string };

export type HomeCopy = {
    meta: { title: string; description: string };
    hero: { title: string; sub: string; primary: string; secondary: string; note: string };
    line: {
        label: string;
        items: Array<{ kind: LineKind; tag: string; what: string; where: string }>;
    };
    heroAlt: string;
    works: { label: string; items: Array<{ name: string; note?: string }> };
    workspace: {
        kicker: string;
        title: string;
        sub: string;
        tabs: Array<{
            key: "chat" | "tasks" | "note";
            label: string;
            title: string;
            points: string[];
            alt: string;
        }>;
    };
    receipts: {
        kicker: string;
        title: string;
        sub: string;
        points: string[];
        askAlt: string;
        approvalAlt: string;
    };
    mcp: {
        kicker: string;
        title: string;
        sub: string;
        points: string[];
        clients: Array<{ name: string; state: string; coming?: boolean }>;
        transcript: {
            you: string;
            tool: string;
            ai: string;
            approve: string;
            approveBtn: string;
            label: string;
        };
        link: string;
    };
    secretary: {
        kicker: string;
        title: string;
        sub: string;
        points: Point[];
        privacy: string;
        alt: string;
    };
    audiences: { title: string; items: Array<{ to: string; title: string; body: string }> };
    trust: { title: string; items: string[] };
    plans: { title: string; body: string; link: string };
    faq: { title: string; items: Array<{ q: string; a: string }> };
    cta: { title: string; body: string; primary: string; secondary: string };
    coming: string;
};

export const HOME_COPY: Record<Lang, HomeCopy> = {
    ja: {
        meta: {
            title: "Genos — AIが、仕事の経緯までわかるワークスペース",
            description:
                "チャット・タスク・ノートがつながったチームのワークスペース。Genosや、ClaudeやChatGPTから、根拠つきの答えと承認制の変更で仕事を進められます。",
        },
        hero: {
            title: "AIが、仕事の経緯までわかるワークスペース。",
            sub: "チャット、タスク、ノートが、仕事が進んだ順番のままつながっています。Genosに聞けば（ClaudeやChatGPTからでも）根拠つきで答え、変更はあなたが承認してから実行します。",
            primary: "デモを試す",
            secondary: "無料で始める",
            note: "サンプルチームのワークスペースが数秒で開きます。登録もカードも不要です。",
        },
        line: {
            label: "ひとつの決定がたどった経緯",
            items: [
                {
                    kind: "chat",
                    tag: "議論",
                    what: "マーケは CSS だけで行く方向。難しいのはドロワーだけ",
                    where: "スパイク調査タスクのコメント",
                },
                {
                    kind: "note",
                    tag: "決定",
                    what: "マーケティングページでは framer-motion を使わない",
                    where: "同じタスクの「決定事項」",
                },
                {
                    kind: "task",
                    tag: "反映",
                    what: "ナビは CSS のドロワーで実装。800バイト（framer-motion は40KB）",
                    where: "全体チャットで共有されたナビのPR",
                },
            ],
        },
        heroAlt:
            "Genosの回答画面。「ホームページの作り直しを止めているものは何ですか？」に、リンクつきのタスクと出典チップを添えて答えている",
        works: {
            label: "連携",
            items: [
                { name: "Claude" },
                { name: "ChatGPT", note: "近日公開" },
                { name: "Googleカレンダー" },
                { name: "GitHub" },
            ],
        },
        workspace: {
            kicker: "ひとつのワークスペース",
            title: "仕事に関わるすべてが、ひとつの場所でつながる。",
            sub: "チャットで決まったことをドキュメントに写し、さらにチケットに写す。その手間はもういりません。Genosではスレッド・ノート・タスクが互いにリンクしているので、翌月になっても経緯をたどれます。",
            tabs: [
                {
                    key: "chat",
                    label: "チャット",
                    title: "そのまま仕事になるチャット",
                    points: [
                        "チャンネル・スレッド・DM。メンション、リアクション、カスタム絵文字やGIFも",
                        "スレッドからワンステップでタスク化。タスクには元のスレッドへのリンクが残ります",
                        "ピン留めと検索で、過去の決定をすぐに呼び戻せます",
                    ],
                    alt: "Genosのチャット画面。チャンネルの会話とスレッドが開いている",
                },
                {
                    key: "tasks",
                    label: "タスク",
                    title: "理由を忘れないタスク",
                    points: [
                        "テーブル・ボード・ダッシュボード。スプリントとマイルストーン",
                        "依存関係、プロジェクトごとのカスタム項目、保存できるフィルター",
                        "変更はすべて履歴に残り、GitHubのPRもタスクに直接ひも付きます",
                    ],
                    alt: "Genosのタスク一覧。ステータス・担当・優先度・スプリントが並ぶテーブル",
                },
                {
                    key: "note",
                    label: "ノート",
                    title: "みんなで同時に書けるノート",
                    points: [
                        "リアルタイム共同編集、フォルダ、共有、版の復元",
                        "タスクノートとチャットノートが、説明している仕事のすぐ隣に",
                        "Markdownの取り込みと書き出し",
                    ],
                    alt: "Genosのノート画面。見出し・チェックリスト・表を含む仕様メモ",
                },
            ],
        },
        receipts: {
            kicker: "Genosに聞く",
            title: "確かめられる答え。承認してから動く変更。",
            sub: "Genosは、チームのチャット・タスク・ノートを同僚のように読み込みます。答えには必ず出典があり、あなたが「はい」と言うまで何も書き換えません。",
            points: [
                "すべての答えに出典。引用元のスレッド・ノート・タスクをその場で開けます",
                "提案して、待つ。タスク・ノート・To-Do・予定の変更は承認後にだけ実行されます",
                "質問した言語で回答。画面は7言語に対応しています",
            ],
            askAlt: "Genosの回答。出典のチャット・ノート・タスクがチップで並んでいる",
            approvalAlt: "Genosが提案した変更の承認カード。承認と却下のボタンがある",
        },
        mcp: {
            kicker: "MCPネイティブ",
            title: "ClaudeやChatGPTから、Genosを使う。",
            sub: "一度つなげば、普段使っているAIアシスタントがあなたのプロジェクトを読み、最新に保ちます。状況のまとめ、今日の計画、タスクの更新、ノートの作成。変更のたびに、あなたの許可をとります。",
            points: [
                "タスク、マイルストーン、スプリント、ノート、チャット、To-Do、カレンダーを扱う{tools}個のツール",
                "Genosアカウントでサインイン（OAuth）。キーのコピーは不要で、接続は設定画面でいつでも確認・解除できます",
                "書き込みは必ず事前に確認。削除などの操作には、別途オプトインが必要です",
            ],
            clients: [
                { name: "Claude", state: "コネクタとして利用可能" },
                { name: "ChatGPT", state: "近日公開", coming: true },
                { name: "その他のMCPクライアント", state: "APIキーで利用可能" },
            ],
            transcript: {
                label: "AIアシスタントとの会話の例",
                you: "Webサイトリニューアルの状況を教えて。",
                tool: "get_my_briefing",
                ai: "火曜以降の動きです。framer-motion のスパイク調査は完了し、CSS のみで行く決定になりました。アクセシビリティ監査は Hero と FeatureGrid の完成待ち、モバイル Safari の読み込み遅延は調査中です。次の2件を今日のTo-Doに追加しますか？",
                approve: "今日のTo-Doに2件を追加",
                approveBtn: "承認",
            },
            link: "すべてのツールを見る",
        },
        secretary: {
            kicker: "あなたの秘書",
            title: "追いかけるのは、Genosの仕事。",
            sub: "コメント、変更、新しいリンク。あなたの仕事で起きたことをGenosが追いかけ、大事なことだけを伝えます。進捗報告を書く必要はありません。",
            points: [
                {
                    text: "「状況を教えて」のひと言で、他の人の動き・あなた待ちのこと・あなたが待っていることを一度に",
                },
                { text: "何が大事かは、古くなりがちな優先度ではなく、実際の動きから学習します" },
                {
                    text: "決まった時間に受信箱へレポート。AIの利用量を表示し、ワンクリックで止められます",
                    plan: "Core以上",
                },
                { text: "ルーティン：よく使う指示を保存して、スケジュールで実行", coming: true },
                { text: "チャットの返信下書き。送信するのはいつもあなた", coming: true },
            ],
            privacy:
                "Genosが記録するあなたの活動は、あなただけが見られます。オフにすれば削除されます。",
            alt: "Genosの受信箱。今日やることのレポートが、プロジェクトごとにチップつきで並んでいる",
        },
        audiences: {
            title: "あなたの仕事のかたちに合わせて",
            items: [
                {
                    to: "/for-research",
                    title: "研究・研究室",
                    body: "仮説・実験・結果を、次の実験までつなぐ。",
                },
                {
                    to: "/for-teams",
                    title: "業務チーム",
                    body: "会議・メモ・フォローアップを、取りこぼさない。",
                },
                {
                    to: "/for-projects",
                    title: "プロジェクト・スタートアップ",
                    body: "決定・仕様・タスクを、ずれないままに。",
                },
                {
                    to: "/for-students",
                    title: "学生・ゼミ",
                    body: "講義・ノート・課題を、ひとつの場所に。",
                },
            ],
        },
        trust: {
            title: "仕事を預けられる設計",
            items: [
                "すべての答えに出典",
                "AIの書き込みは、承認したあとだけ",
                "あなたの活動記録は、あなただけのもの。スイッチひとつで停止・削除",
                "カレンダーの予定は都度読み込み、保存しません",
                "データの書き出しとアカウント削除は、いつでも",
            ],
        },
        plans: {
            title: "まずは無料で。",
            body: "Freeプランでチャット・タスク・ノートを使えます。Core以上でMCP接続とGenosレポートが使え、上位プランほどAIの上限が広がります。",
            link: "プランを比較する",
        },
        faq: {
            title: "よくある質問",
            items: [
                {
                    q: "Genosとは何ですか？",
                    a: "チャット・タスク・ノートをひとつにまとめたチーム向けのワークスペースです。すべてが元の議論や決定にリンクしていて、AI（Genos）がそれをもとに出典つきで答え、あなたが承認した変更だけを実行します。",
                },
                {
                    q: "SlackやNotion、JiraにAIを足すのと何が違いますか？",
                    a: "それぞれのツールは検索できても、議論・決定・作業のつながりは失われています。Genosは仕事が進むその場でつながりを残すので、AIはそのつながりをたどって答えられます。",
                },
                {
                    q: "ClaudeやChatGPTから使えますか？",
                    a: "はい。GenosはMCPサーバーです。Claudeにはコネクタとして（Genosアカウントでサインイン）、その他のMCPクライアントにはAPIキーで接続できます。ChatGPTへの対応は近日公開です。MCPはCoreプラン以上で使えます。",
                },
                {
                    q: "Genosが記録する私の活動は、誰が見られますか？",
                    a: "あなただけです。チームのダッシュボードや他の人への回答には使われません。設定からいつでも止められ、止めると記録は削除されます。",
                },
                {
                    q: "登録せずに試せますか？",
                    a: "はい。デモを開くと、チャット・タスク・ノートが入ったサンプルチームのワークスペースが日本語で開きます。インストールもカードも不要です。",
                },
            ],
        },
        cta: {
            title: "チームの仕事が、つながる感覚を。",
            body: "数秒でデモを開くか、チームの無料ワークスペースを作成できます。",
            primary: "デモを試す",
            secondary: "無料で始める",
        },
        coming: "近日公開",
    },
    en: {
        meta: {
            title: "Genos — the workspace your AI already understands",
            description:
                "A team workspace where chat, tasks and notes stay linked. Ask Genos, Claude or ChatGPT and get answers with sources and changes that wait for your OK.",
        },
        hero: {
            title: "The workspace your AI already understands.",
            sub: "Chat, tasks and notes live together in Genos, linked by how the work actually happened. Ask Genos (or Claude and ChatGPT) and get answers with sources, and changes that wait for your OK.",
            primary: "Try the demo",
            secondary: "Start free",
            note: "The demo opens a sample team's workspace in seconds. No sign-up, no card.",
        },
        line: {
            label: "How one decision happened",
            items: [
                {
                    kind: "chat",
                    tag: "Discussed",
                    what: "Leaning toward CSS-only for marketing; the drawer is the tricky part",
                    where: "Comments on the spike task",
                },
                {
                    kind: "note",
                    tag: "Decided",
                    what: "No framer-motion on the marketing pages",
                    where: "The same task's Decision section",
                },
                {
                    kind: "task",
                    tag: "Applied",
                    what: "The nav ships with a CSS drawer: 800 bytes, not 40 KB",
                    where: "Nav PR shared in the general chat",
                },
            ],
        },
        heroAlt:
            'A Genos answer to "What\'s blocking the homepage rebuild?", with linked tasks and source chips underneath',
        works: {
            label: "Works with",
            items: [
                { name: "Claude" },
                { name: "ChatGPT", note: "coming" },
                { name: "Google Calendar" },
                { name: "GitHub" },
            ],
        },
        workspace: {
            kicker: "One workspace",
            title: "Everything the work touched, in one place and linked.",
            sub: "No more copying a decision from chat into a doc, then into a ticket. In Genos the thread, the note and the task point at each other, so the context is still there next month.",
            tabs: [
                {
                    key: "chat",
                    label: "Chat",
                    title: "Chat that turns into work",
                    points: [
                        "Channels, threads and DMs with mentions, reactions, custom emoji and GIFs",
                        "Turn a thread into a task in one step; the task keeps a link back",
                        "Pins and search bring old decisions back when you need them",
                    ],
                    alt: "The Genos chat screen with a channel conversation and a thread open",
                },
                {
                    key: "tasks",
                    label: "Tasks",
                    title: "Tasks that remember why",
                    points: [
                        "Table, board and dashboard views, sprints and milestones",
                        "Dependencies, per-project custom fields and saved filters",
                        "Every change lands in the task's history, and GitHub PRs link straight to it",
                    ],
                    alt: "The Genos task table with status, assignee, priority and sprint columns",
                },
                {
                    key: "note",
                    label: "Notes",
                    title: "Notes everyone edits at once",
                    points: [
                        "Real-time co-editing, folders, sharing and version restore",
                        "Task notes and chat notes sit next to the work they explain",
                        "Import and export Markdown",
                    ],
                    alt: "A Genos note: a spec with headings, a checklist and a table",
                },
            ],
        },
        receipts: {
            kicker: "Ask Genos",
            title: "Answers you can check. Changes you approve.",
            sub: "Genos reads your team's chats, tasks and notes the way a colleague would. Every answer links to where it came from, and nothing is written until you say yes.",
            points: [
                "Sources on every answer: open the thread, note or task it quotes",
                "It proposes, then waits: tasks, notes, to-dos and events change only after you approve",
                "Answers in the language you ask in, in an app available in 7 languages",
            ],
            askAlt: "A Genos answer with its source chat, note and task shown as chips",
            approvalAlt:
                "An approval card for a change Genos proposed, with Approve and Decline buttons",
        },
        mcp: {
            kicker: "MCP native",
            title: "Use Genos from Claude and ChatGPT.",
            sub: "Connect once, and the assistant you already use can read your projects and keep them current: catch you up, plan your day, update a task, write a note. It asks before every change.",
            points: [
                "{tools} tools for tasks, milestones, sprints, notes, chats, to-dos and calendar",
                "Sign in with your Genos account (OAuth): no keys to copy, and every connection is listed in Settings, where you can end it",
                "Writes always ask first; destructive actions need a separate opt-in",
            ],
            clients: [
                { name: "Claude", state: "Available as a connector" },
                { name: "ChatGPT", state: "Coming", coming: true },
                { name: "Any MCP client", state: "Available with an API key" },
            ],
            transcript: {
                label: "An example conversation with an AI assistant",
                you: "Catch me up on the website redesign.",
                tool: "get_my_briefing",
                ai: "Since Tuesday: the framer-motion spike is closed, and the call is CSS-only. The accessibility audit is waiting on the hero and feature grid, and the slow mobile Safari load is still being investigated. Want me to put the next two on today's to-do list?",
                approve: "Add 2 items to today's to-do list",
                approveBtn: "Approve",
            },
            link: "See every tool",
        },
        secretary: {
            kicker: "Your secretary",
            title: "It keeps track, so you don't have to.",
            sub: "Comments, changes, new links: Genos follows what happens on your work and tells you what matters. You never write a status report.",
            points: [
                {
                    text: "One ask catches you up: what others did on your items, what's waiting on you, what you're waiting on",
                },
                {
                    text: "What matters is learned from real activity, not from priority fields that go stale",
                },
                {
                    text: "Reports in your Inbox on your schedule, with the AI cost shown and a one-click off",
                    plan: "Core and up",
                },
                { text: "Routines: save an instruction and run it on a schedule", coming: true },
                { text: "Reply drafts in chat; you always press send", coming: true },
            ],
            privacy:
                "What Genos notes about your work is visible only to you. Turn it off and it's deleted.",
            alt: "The Genos Inbox with a report of today's work, grouped by project with status chips",
        },
        audiences: {
            title: "Made for how you work",
            items: [
                {
                    to: "/for-research",
                    title: "Research and labs",
                    body: "Hypotheses, experiments and results, linked to the next experiment.",
                },
                {
                    to: "/for-teams",
                    title: "Business teams",
                    body: "Meetings, notes and follow-ups that don't fall through.",
                },
                {
                    to: "/for-projects",
                    title: "Projects and startups",
                    body: "Decisions, specs and tasks that stay in sync.",
                },
                {
                    to: "/for-students",
                    title: "Students",
                    body: "Lectures, notes and assignments in one place.",
                },
            ],
        },
        trust: {
            title: "Built to be trusted with your work",
            items: [
                "Sources on every answer",
                "AI writes only after you approve",
                "Your activity record is yours alone: one switch stops it and deletes it",
                "Calendar events are read live, never stored",
                "Export your data or delete your account at any time",
            ],
        },
        plans: {
            title: "Start free.",
            body: "The Free plan covers chat, tasks and notes. Core and up add MCP connections and Genos reports, and higher plans raise the AI limits.",
            link: "Compare plans",
        },
        faq: {
            title: "Questions",
            items: [
                {
                    q: "What is Genos?",
                    a: "A team workspace for chat, tasks and notes where everything links back to the discussion or decision it came from. Its AI, Genos, answers from that with sources and only makes changes you approve.",
                },
                {
                    q: "How is this different from adding AI to Slack, Notion and Jira?",
                    a: "Each of those can be searched, but the links between a discussion, the decision and the work are lost. Genos keeps those links as the work happens, so answers can follow them.",
                },
                {
                    q: "Does Genos work with Claude or ChatGPT?",
                    a: "Yes. Genos is an MCP server: add it to Claude as a connector (you sign in with Genos), or use an API key from any MCP client. ChatGPT support is coming. MCP is available on Core and up.",
                },
                {
                    q: "Who can see what Genos notes about my work?",
                    a: "Only you. It never appears in team dashboards or in answers to other people. You can turn it off in Settings at any time, and turning it off deletes it.",
                },
                {
                    q: "Can I try it without signing up?",
                    a: "Yes. The demo opens a sample team's workspace, with chats, tasks and notes already in it, in your language. Nothing to install, no card.",
                },
            ],
        },
        cta: {
            title: "See your team's work connected.",
            body: "Open the demo in seconds, or start a free workspace for your team.",
            primary: "Try the demo",
            secondary: "Start free",
        },
        coming: "Coming",
    },
};
