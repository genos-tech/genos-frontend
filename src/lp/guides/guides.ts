import type { ShotName } from "../kit/shots";
import type { Lang } from "../lpLang";

/**
 * The visual guide at the top of each /docs topic (MIP-2415): pictures first, a headline, and a
 * few words. The full text stays below it, folded, and is still the manual source
 * (`src/manual/`), so there is one long text to keep true; this file only says what to look at.
 *
 * Rules: every statement here must also be in that topic's manual text or visible in its picture.
 * `pins` are the words for the numbered dots on a picture, in the order
 * `scripts/lp-guide-screenshots.mjs` measures them. `lpDocsGuides.test.ts` fails when a picture
 * is missing or the number of pins differs.
 */
export type GuideText = {
    title: string;
    /** At most a line or two. */
    line?: string;
    pins?: string[];
    /** A diagram instead of a picture (or under it): short boxes joined by arrows. */
    flow?: string[];
};

export type GuideStep = Record<Lang, GuideText> & {
    /** A picture under `public/lp/guide/<lang>/` (see `kit/guideShots.json`). */
    shot?: string;
    /** A picture the home page already uses, under `public/lp/shots/<lang>/`. */
    lpShot?: ShotName;
    /** The boxes under `flow` are alternatives, not steps: draw no arrows. */
    set?: boolean;
};

export const GUIDES: Record<string, GuideStep[]> = {
    basics: [
        {
            shot: "overview",
            en: {
                title: "Everything starts from the left sidebar",
                pins: [
                    "Ask or search here",
                    "Inbox: what waits for you",
                    "Chats",
                    "Tasks and projects",
                    "Notes",
                    "To-Do",
                ],
            },
            ja: {
                title: "左のサイドバーがすべての入口です",
                pins: [
                    "ここで検索・質問",
                    "受信箱：対応が必要なもの",
                    "チャット",
                    "タスクとプロジェクト",
                    "ノート",
                    "To-Do",
                ],
            },
        },
        {
            en: {
                title: "One thing leads to the next",
                line: "A chat thread can become a task. A task has its own notes. Genos can answer from all of them.",
                flow: ["Chat thread", "Task", "Note", "Ask Genos"],
            },
            ja: {
                title: "情報はつながります",
                line: "スレッドはタスクにでき、タスクにはノートがあり、Genosはそのすべてから答えます。",
                flow: ["チャットのスレッド", "タスク", "ノート", "Genosに質問"],
            },
        },
    ],
    chat: [
        {
            shot: "chat",
            en: {
                title: "Chats, with side talk kept in threads",
                pins: [
                    "Your chats",
                    "Replies open the thread",
                    "Write a message",
                    "The thread, beside the chat",
                ],
            },
            ja: {
                title: "脇道の話はスレッドへ",
                pins: [
                    "チャット一覧",
                    "返信数を押すとスレッドが開く",
                    "メッセージを書く",
                    "スレッドは横に表示",
                ],
            },
        },
        {
            shot: "message-menu",
            en: {
                title: "Point at a message, then “…”",
                line: "Reply in thread, flag for later, add to To-Do, or ask Genos about it.",
                pins: ["Remind me: it comes back at a time you pick"],
            },
            ja: {
                title: "メッセージの「…」から",
                line: "スレッドで返信、フラグ、To-Doに追加、Genosに質問ができます。",
                pins: ["リマインド：指定した時刻にもう一度お知らせ"],
            },
        },
    ],
    tasks: [
        {
            shot: "tasks",
            en: {
                title: "A project is a table of tasks",
                pins: ["New task", "Filters", "Status", "A milestone and its tasks"],
            },
            ja: {
                title: "プロジェクトはタスクの一覧表",
                pins: ["新しいタスク", "フィルター", "ステータス", "マイルストーンとそのタスク"],
            },
        },
        {
            shot: "task",
            en: {
                title: "Open a task to set it up",
                pins: [
                    "Status",
                    "Due date",
                    "Links, such as a pull request",
                    "What it blocks and waits on",
                ],
            },
            ja: {
                title: "タスクを開いて設定する",
                pins: ["ステータス", "締切", "リンク（プルリクエストなど）", "依存関係"],
            },
        },
        {
            shot: "board",
            en: { title: "The same tasks as a board", line: "One column per status." },
            ja: { title: "同じタスクをボードで", line: "ステータスごとの列で表示します。" },
        },
        {
            shot: "graph",
            en: {
                title: "The task graph shows what is waiting",
                line: "When an open blocker is added, Genos sets the task to Blocked.",
            },
            ja: {
                title: "タスクグラフで「何待ちか」を確認",
                line: "未完了のブロッカーを追加すると、GenosがタスクをBlockedにします。",
            },
        },
    ],
    notes: [
        {
            shot: "note",
            en: {
                title: "Write together, in one place",
                pins: [
                    "My Notes, Team Notes and notes on tasks and chats",
                    "Headings, lists, checkboxes, tables",
                    "Share the note and ask Genos about it",
                ],
            },
            ja: {
                title: "ノートはみんなで同時に編集",
                pins: [
                    "マイノート、チームノート、タスクやチャットのノート",
                    "見出し・リスト・チェックボックス・表",
                    "共有と、このノートへの質問",
                ],
            },
        },
        {
            set: true,
            en: {
                title: "Who can read a note",
                flow: [
                    "My Notes: you, plus anyone you share with",
                    "Team folder: the team, or people you choose",
                    "Task note: project members",
                    "Chat note: people in the chat",
                ],
            },
            ja: {
                title: "ノートを読める人",
                flow: [
                    "マイノート：自分と共有相手",
                    "チームフォルダ：全員か選んだ人",
                    "タスクノート：プロジェクトのメンバー",
                    "チャットノート：チャットの参加者",
                ],
            },
        },
    ],
    "genos-ai": [
        {
            lpShot: "ask",
            en: {
                title: "Ask in plain words",
                line: "The answer links to its sources, so you can check it.",
            },
            ja: {
                title: "ふつうの言葉で質問",
                line: "回答には出典へのリンクが付くので、確認できます。",
            },
        },
        {
            lpShot: "approval",
            en: {
                title: "Nothing changes without your approval",
                line: "Genos shows what it will change. Approve or reject; many can be edited first. (Changes need Core or above.)",
            },
            ja: {
                title: "承認するまで何も変わりません",
                line: "変更内容を表示します。承認か却下。多くは編集もできます（変更はCore以上）。",
            },
        },
        {
            shot: "skills",
            en: {
                title: "Type / to run a skill",
                line: "A skill is a note of written steps with a name.",
                pins: ["Type /", "Pick the skill"],
            },
            ja: {
                title: "「/」でスキルを実行",
                line: "スキルは、手順を書いて名前を付けたノートです。",
                pins: ["「/」を入力", "スキルを選ぶ"],
            },
        },
        {
            shot: "schedules",
            en: {
                title: "Reports on a schedule",
                line: "Settings → Genos. Most reports use no AI. Core and above.",
                pins: ["Run now, or let it run on time"],
            },
            ja: {
                title: "定期レポート",
                line: "設定 → Genos。多くのレポートはAIを使いません。Core以上。",
                pins: ["「今すぐ実行」も、定時実行も"],
            },
        },
        {
            shot: "dashboard",
            en: {
                title: "A dashboard page that updates itself",
                line: "Each run replaces the page with new numbers. Core and above.",
            },
            ja: {
                title: "自動で更新されるダッシュボード",
                line: "実行のたびに最新の数字に置き換わります。Core以上。",
            },
        },
    ],
    searching: [
        {
            shot: "ask",
            en: {
                title: "One box: search and ask",
                pins: [
                    "Type to search. Press Enter to ask",
                    "Starter questions",
                    "Narrow by type or project",
                ],
            },
            ja: {
                title: "1つの入力欄で検索も質問も",
                pins: ["入力で検索、Enterで質問", "質問の例", "種類やプロジェクトで絞り込み"],
            },
        },
        {
            set: true,
            en: {
                title: "Three shortcuts that save time",
                flow: ["Cmd-K / Ctrl-K opens it", "@ names a person", "# names a task or note"],
            },
            ja: {
                title: "覚えると速い操作",
                flow: ["Cmd-K / Ctrl-Kで開く", "@で人を指定", "#でタスクやノートを指定"],
            },
        },
    ],
    notifications: [
        {
            shot: "notifications",
            en: {
                title: "Choose what reaches you",
                pins: ["Settings → Notifications: switch groups on or off, or pause everything"],
            },
            ja: {
                title: "届く通知を選ぶ",
                pins: ["設定 → 通知：種類ごとのオン・オフと、一時停止"],
            },
        },
        {
            set: true,
            en: {
                title: "Three ways it can reach you",
                line: "Email is sent only when your Genos has email turned on.",
                flow: ["In the app", "Push, when you are elsewhere", "Email, when you are away"],
            },
            ja: {
                title: "通知の届き方は3つ",
                line: "メールは、お使いのGenosでメールが有効な場合のみ送られます。",
                flow: ["アプリ内", "プッシュ（別の画面のとき）", "メール（離れているとき）"],
            },
        },
    ],
    shortcuts: [
        {
            shot: "shortcuts",
            en: {
                title: "Every shortcut, listed in the app",
                pins: ["Settings → Shortcuts"],
            },
            ja: {
                title: "ショートカット一覧はアプリ内に",
                pins: ["設定 → ショートカット"],
            },
        },
    ],
    tips: [
        {
            shot: "todo",
            en: {
                title: "Plan your day in To-Do",
                line: "It opens over the page you are on.",
                pins: ["Start today’s list"],
            },
            ja: {
                title: "1日の予定はTo-Doで",
                line: "今開いているページの上に表示されます。",
                pins: ["今日のリストを始める"],
            },
        },
    ],
    teams: [
        {
            en: {
                title: "Bring people in",
                line: "Team menu → Show Team Profile. Invite links last 7 days.",
                flow: ["Invite by email", "They join as Viewers", "Make one person an Editor"],
            },
            ja: {
                title: "メンバーを招待する",
                line: "チームメニュー → チームプロフィール。招待リンクは7日間有効です。",
                flow: ["メールで招待", "閲覧者として参加", "1人を編集者に"],
            },
        },
        {
            set: true,
            en: {
                title: "Four roles",
                flow: [
                    "Owner: one per team",
                    "Editor: helps run it",
                    "Viewer: works in it",
                    "Guest: only invited projects",
                ],
            },
            ja: {
                title: "役割は4つ",
                flow: [
                    "オーナー：チームに1人",
                    "編集者：運営を手伝う",
                    "閲覧者：中で作業する",
                    "ゲスト：招待されたプロジェクトのみ",
                ],
            },
        },
    ],
    "cross-team": [
        {
            en: {
                title: "Share one thing with another company",
                line: "They see only what you shared: one chat, project or note folder.",
                flow: [
                    "Connect the two teams once",
                    "Share one item",
                    "They accept",
                    "Stop any time",
                ],
            },
            ja: {
                title: "別の会社と「1つだけ」共有する",
                line: "相手に見えるのは、共有したチャット・プロジェクト・ノートフォルダだけです。",
                flow: ["チーム同士を一度接続", "1つを共有", "相手が承認", "いつでも停止できる"],
            },
        },
    ],
    "company-setup": [
        {
            en: {
                title: "The owner’s path",
                flow: [
                    "List the departments",
                    "Groups, folders, chats, projects",
                    "Invite people",
                    "Turn on two-step sign-in",
                ],
            },
            ja: {
                title: "オーナーの手順",
                flow: [
                    "部署を書き出す",
                    "グループ・フォルダ・チャット・プロジェクト",
                    "メンバーを招待",
                    "2段階認証をオン",
                ],
            },
        },
    ],
    "company-organising": [
        {
            set: true,
            en: {
                title: "One department, four things, one name",
                line: "Keep the whole company in one team.",
                flow: ["Project tag", "@mention group", "Team folder", "Public group chat"],
            },
            ja: {
                title: "部署＝同じ名前の4点セット",
                line: "会社全体は1つのチームにまとめます。",
                flow: [
                    "プロジェクトのタグ",
                    "@メンショングループ",
                    "チームフォルダ",
                    "公開グループチャット",
                ],
            },
        },
    ],
    playbooks: [
        {
            en: {
                title: "The same pattern for any kind of work",
                flow: [
                    "Talk in chat",
                    "Commit with tasks",
                    "Keep knowledge in notes",
                    "Ask Genos",
                ],
            },
            ja: {
                title: "どんな仕事も同じ形で",
                flow: ["相談はチャット", "約束はタスク", "知識はノート", "Genosに質問"],
            },
        },
    ],
    settings: [
        {
            shot: "settings",
            en: {
                title: "Your settings in one window",
                pins: ["Pick a tab. General has theme, language and sidebar"],
            },
            ja: {
                title: "個人の設定はひとつの画面に",
                pins: ["タブを選ぶ。「一般」はテーマ・言語・サイドバー"],
            },
        },
    ],
    plans: [
        {
            en: {
                title: "What each step adds",
                line: "Settings → Plan & Usage shows your numbers.",
                flow: [
                    "Free: ask and search",
                    "Core: Genos acts, AI apps connect",
                    "Pro: bigger changes at once",
                    "Max: higher limits",
                ],
            },
            ja: {
                title: "プランで増えること",
                line: "自分の数字は「設定 → プランと使用状況」で確認できます。",
                flow: [
                    "Free：質問と検索",
                    "Core：Genosが実行、AIアプリ接続",
                    "Pro：まとめて大きな変更",
                    "Max：より高い上限",
                ],
            },
        },
    ],
    security: [
        {
            shot: "security",
            en: {
                title: "Turn on two-step verification",
                line: "For email and password sign-in. Keep your recovery codes.",
                pins: ["Settings → Security → Turn on"],
            },
            ja: {
                title: "2段階認証をオンに",
                line: "メールとパスワードでのサインインが対象。リカバリーコードは保管してください。",
                pins: ["設定 → セキュリティ → オンにする"],
            },
        },
    ],
    connecting: [
        {
            shot: "connect",
            en: {
                title: "Connect Claude, no API key",
                line: "Settings → Developer. Core and above.",
                pins: ["Pick your app", "Follow its steps: copy and paste"],
            },
            ja: {
                title: "APIキー不要でClaudeを接続",
                line: "設定 → 開発者。Core以上。",
                pins: ["使うアプリを選ぶ", "手順どおりにコピーして貼り付け"],
            },
        },
        {
            lpShot: "record",
            en: {
                title: "Then you can see who wrote what",
                line: "Entries made through a connected app are marked. Entries you type in Genos do not.",
            },
            ja: {
                title: "誰が書いたかが分かります",
                line: "接続したアプリ経由の記録には印が付きます。Genosで直接入力した内容には付きません。",
            },
        },
    ],
    "api-keys": [
        {
            en: {
                title: "A key for scripts",
                line: "Settings → Developer → API keys. AI apps like Claude do not need one.",
                flow: ["Create the key", "Copy it: shown once", "Send it with each request"],
            },
            ja: {
                title: "スクリプト用のAPIキー",
                line: "設定 → 開発者 → APIキー。ClaudeなどのAIアプリには不要です。",
                flow: ["キーを作る", "表示は一度だけ。コピー", "リクエストごとに送る"],
            },
        },
    ],
    fixes: [
        {
            en: {
                title: "No notifications? Check in this order",
                flow: [
                    "Web notifications on",
                    "Not paused",
                    "Browser permission",
                    "Chat not muted",
                ],
            },
            ja: {
                title: "通知が来ないときの確認順",
                flow: [
                    "Web通知がオン",
                    "一時停止していない",
                    "ブラウザの許可",
                    "ミュートしていない",
                ],
            },
        },
    ],
};

/** The picture on a topic's card on /docs: the first one its guide shows. */
export const guideCover = (topic: string): { shot?: string; lpShot?: ShotName } | undefined =>
    GUIDES[topic]?.find((step) => step.shot || step.lpShot);
