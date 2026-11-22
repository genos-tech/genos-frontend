import type { ShortcutId } from "../../shortcuts";
import type { Lang } from "../lpLang";

/**
 * /docs copy, Japanese and English (MIP-1259).
 *
 * Truth rules for this file:
 *  - Every menu and button name is the app's own label, copied from the
 *    catalogs: en/settings.ts and ja/index.ts (`settings.tabs`, `developer.keys`,
 *    `account`, `schedules`), en/connectApp.ts (the connect steps). If one of
 *    those changes, change it here too.
 *  - Keys are never typed here: `{key:global.notesNew}` is filled in from the
 *    shortcut registry (src/shortcuts/registry.ts) for the visitor's system.
 *  - Inline markup, parsed by DocsPage: **bold** (a UI label), `code`,
 *    [label](#anchor) or [label](/path), and {key:ShortcutId}.
 *  - No claim about any AI app other than Claude (counsel, January; the
 *    messaging brief, note 176). No numbers, no prices, no customers.
 *
 * `TODO(copy): MIP-1259` marks the wording Ken has to read before this page
 * is merged.
 */

export type DocsSectionId =
    | "start"
    | "connect"
    | "api-keys"
    | "schedules"
    | "export"
    | "shortcuts"
    | "faq";

export interface DocsCopy {
    title: string;
    /** TODO(copy): MIP-1259 */
    lead: string;
    searchLabel: string;
    searchPlaceholder: string;
    noMatch: string;
    guidesHeading: string;
    guides: Record<DocsSectionId, { title: string; summary: string }>;
    start: { heading: string; intro: string; steps: string[] };
    connect: {
        heading: string;
        intro: string;
        addressLabel: string;
        claudeHeading: string;
        claudeSteps: string[];
        codeHeading: string;
        codeSteps: string[];
        plan: string;
        disconnect: string;
        trap: string;
    };
    apiKeys: {
        heading: string;
        intro: string;
        steps: string[];
        usageHeading: string;
        usageNote: string;
        usageExample: string;
    };
    schedules: { heading: string; intro: string; steps: string[]; plan: string };
    export: { heading: string; intro: string; steps: string[]; scope: string };
    shortcuts: {
        heading: string;
        intro: string;
        rows: Array<{ id: ShortcutId; label: string }>;
        note: string;
    };
    faq: { heading: string; items: Array<{ q: string; a: string }> };
    other: { heading: string; links: Array<{ to: string; label: string }> };
}

export const DOCS_COPY: Record<Lang, DocsCopy> = {
    en: {
        title: "Docs",
        lead: "Short guides for getting started, connecting an AI agent, and the things you do most often in Genos. TODO(copy): MIP-1259",
        searchLabel: "Search the docs",
        searchPlaceholder: "Search: connect, API key, export, shortcut",
        noMatch: "Nothing matches. Try another word, or browse the guides below.",
        guidesHeading: "Guides",
        guides: {
            start: {
                title: "Getting started",
                summary: "Five steps from a new account to your first note.",
            },
            connect: {
                title: "Connect Claude",
                summary: "Add Genos to claude.ai, Claude Desktop or Claude Code.",
            },
            "api-keys": {
                title: "API keys",
                summary: "Create a key for your own scripts and tools.",
            },
            schedules: {
                title: "Schedules",
                summary: "Have Genos prepare a report at the times you choose.",
            },
            export: {
                title: "Export your data",
                summary: "Download what you created as a JSON file.",
            },
            shortcuts: {
                title: "Keyboard shortcuts",
                summary: "The keys that move you around Genos.",
            },
            faq: {
                title: "FAQ",
                summary: "Short answers to the questions people ask first.",
            },
        },
        start: {
            heading: "Getting started in five steps",
            intro: "A new account needs no setup beyond these steps.",
            steps: [
                "**Sign up** with your email address and a password, then confirm the email we send you.",
                "**Create a project**: on the **Tasks** page, choose **New Project** under **Projects**.",
                "**Add a task**: open the project and choose **Task**.",
                "**Write a note**: on the **Notes** page, choose **New My Note**.",
                "**Connect Claude** so it can work in Genos for you, following [Connect Claude](#connect).",
            ],
        },
        connect: {
            heading: "Connect Claude",
            intro: "No API key is needed. Connecting uses a sign-in: you paste the address into the app, sign in to Genos, and choose what the app may do.",
            addressLabel: "Address to paste into the app:",
            claudeHeading: "claude.ai and Claude Desktop",
            claudeSteps: [
                "In Claude, open **Customize**, then **Connectors**, and choose **Add custom connector**.",
                "Paste the address above and confirm.",
                "Sign in to Genos when Claude asks.",
                "On the approval page, choose the team and what the app may do: read, make changes, and deleting, which starts unticked.",
                "Press **Allow**.",
            ],
            codeHeading: "Claude Code",
            codeSteps: [
                "Run this command in your terminal: `claude mcp add --transport http genos ADDRESS`, with the address above in place of ADDRESS.",
                "In Claude Code, run `/mcp` and sign in to Genos.",
                "On the approval page, choose the team and what it may do, then press **Allow**.",
            ],
            plan: "Connecting needs the Core plan or above. On Free, the approval page says the app is not included in your plan.",
            disconnect:
                "To disconnect an app, open **Settings → Developer → Connected apps** and choose **Revoke**. The app stops working on its next request.",
            trap: "Paste the whole address, including the path at the end. Without it Claude says it signed in, then reports that Genos refused its request.",
        },
        apiKeys: {
            heading: "API keys",
            intro: "Use an API key to call the Genos API from your own scripts and tools. A key acts as you, so it can only see what you can see.",
            steps: [
                "Open **Settings → Developer → API keys**.",
                "Name the key, so you remember what it is for, and choose **Read** or **Read & write**.",
                "Choose when it expires. The default is 90 days, and the longest is one year.",
                "Choose **Create key**, then **Copy** the key. It is shown once.",
                "To stop a key working, choose **Revoke**. A revoked key cannot be turned back on.",
            ],
            usageHeading: "Using the key",
            usageNote:
                "Send the key in the Authorization header, with the word ApiKey in front of it. Keys work on the public API: this call returns who the key acts as. The endpoints are listed on the [Developers](/developers) page.",
            usageExample: 'curl -H "Authorization: ApiKey YOUR_KEY" ORIGIN/api/public/v1/me/',
        },
        schedules: {
            heading: "Schedules",
            intro: "A schedule makes Genos prepare a report at a time you choose. The report arrives in your Inbox, so nothing needs to be typed to start it.",
            steps: [
                "Open **Settings → Genos** and find **Genos Assist Schedules**.",
                "Choose **New schedule**, pick a report and a time, then choose **Create schedule**.",
                "Turn a schedule off with its switch, without deleting it. To change it, choose **Edit**; to remove it, choose **Delete**.",
            ],
            plan: "Schedules need the Core plan or above. If your plan changes, paused schedules resume when you upgrade.",
        },
        export: {
            heading: "Export your data",
            intro: "You can download a copy of what you created in Genos.",
            steps: [
                "Open **Settings → Account**.",
                "Under **Export your data**, choose **Download my data**.",
                "Your browser saves a JSON file with your profile, notes, to-dos, tasks, messages and comments.",
            ],
            scope: "Content that other people wrote for a team is not included. Your own account and the security activity list are on the same page.",
        },
        shortcuts: {
            heading: "Keyboard shortcuts",
            intro: "These work anywhere in Genos. The keys below are the ones for your system.",
            rows: [
                { id: "global.spotlight", label: "Open Spotlight: search and ask Genos" },
                { id: "global.tasksNew", label: "New task" },
                { id: "global.notesNew", label: "New note" },
                { id: "global.calendar", label: "Calendar" },
                { id: "global.meetClipboard", label: "Meeting clipboard" },
                { id: "global.history", label: "History" },
                { id: "global.taskGraph", label: "Task diagram" },
                { id: "global.todo", label: "To-do list" },
                {
                    id: "global.cycle",
                    label: "Hold the first key and tap the second: switch between open services",
                },
                { id: "global.undo", label: "Undo the last action, while its toast is up" },
            ],
            note: "You can change the letter shortcuts under Settings → Shortcuts.",
        },
        faq: {
            heading: "Frequently asked questions",
            items: [
                {
                    q: "Do I need an API key to connect Claude?",
                    a: "No. Connecting Claude uses a sign-in on the Genos approval page. An API key is for your own scripts and tools.",
                },
                {
                    q: "Which plan do I need to connect an AI app?",
                    a: "The Core plan or above. On Free, the approval page says the app is not included in your plan.",
                },
                {
                    q: "How do I disconnect an AI app?",
                    a: "Open Settings → Developer → Connected apps and choose Revoke. The app stops working on its next request.",
                },
                {
                    q: "Can an API key delete things?",
                    a: "Not unless you allow it. Deleting, changing who has access, and sharing are off by default; you can turn them on when you create the key.",
                },
                {
                    q: "How long does an API key last?",
                    a: "Every key expires. The default is 90 days and the longest is one year.",
                },
                {
                    q: "Can I see an API key again after I create it?",
                    a: "No. It is shown once. If you lose it, revoke it and create another.",
                },
                {
                    q: "Can I get all my data out?",
                    a: "Yes. Settings → Account → Download my data gives you a JSON file of what you created. Team content written by other people is not included.",
                },
                {
                    q: "Which AI app works with Genos today?",
                    a: "Claude: claude.ai, Claude Desktop and Claude Code. TODO(copy): MIP-1259 approval of this sentence is pending.",
                },
                {
                    q: "Where do schedule reports arrive?",
                    a: "In your Inbox. You do not need to open the schedule to see them.",
                },
            ],
        },
        other: {
            heading: "Other pages",
            links: [
                { to: "/features-guide", label: "Features guide" },
                { to: "/demo-guide", label: "Demo guide" },
                { to: "/developers", label: "Developers: REST API, MCP tools and webhooks" },
                { to: "/migrate", label: "Moving to Genos" },
                { to: "/support", label: "Support" },
            ],
        },
    },
    ja: {
        title: "ドキュメント",
        lead: "はじめ方、AI エージェントの接続、よく使う操作を短くまとめました。 TODO(copy): MIP-1259",
        searchLabel: "ドキュメントを検索",
        searchPlaceholder: "検索：接続、APIキー、エクスポート、ショートカット",
        noMatch: "一致する項目がありません。別の言葉で探すか、下のガイドをご覧ください。",
        guidesHeading: "ガイド",
        guides: {
            start: {
                title: "はじめに",
                summary: "新しいアカウントから最初のノートまで、5つのステップ。",
            },
            connect: {
                title: "Claude を接続する",
                summary: "claude.ai、Claude Desktop、Claude Code に Genos を追加します。",
            },
            "api-keys": {
                title: "APIキー",
                summary: "ご自身のスクリプトやツールのためのキーを作成します。",
            },
            schedules: {
                title: "スケジュール",
                summary: "選んだ時刻に、Genos がレポートを用意します。",
            },
            export: {
                title: "データのエクスポート",
                summary: "作成したデータを JSON ファイルでダウンロードします。",
            },
            shortcuts: {
                title: "キーボードショートカット",
                summary: "Genos の中を移動するためのキー。",
            },
            faq: {
                title: "よくある質問",
                summary: "最初によく聞かれる質問への短い答え。",
            },
        },
        start: {
            heading: "はじめに：5つのステップ",
            intro: "新しいアカウントは、以下の手順だけで使い始められます。",
            steps: [
                "メールアドレスとパスワードで**サインアップ**し、届いたメールで確認します。",
                "**Tasks** ページで、**Projects** の下の **New Project** を選び、**プロジェクトを作成**します。",
                "プロジェクトを開き、**Task** を選んで**タスクを追加**します。",
                "**Notes** ページで **New My Note** を選び、**ノートを書きます**。",
                "[Claude を接続する](#connect)の手順に従い、Claude が Genos で作業できるようにします。",
            ],
        },
        connect: {
            heading: "Claude を接続する",
            intro: "API キーは不要です。下のアドレスをアプリに貼り付け、Genos にサインインし、アプリに許可する内容を選びます。",
            addressLabel: "アプリに貼り付けるアドレス：",
            claudeHeading: "claude.ai と Claude Desktop",
            claudeSteps: [
                "Claude で **Customize** を開き、**Connectors** を選んで **Add custom connector** を選びます。",
                "上のアドレスを貼り付けて確定します。",
                "Claude に求められたら、Genos にサインインします。",
                "承認画面で、チームとアプリに許可する内容を選びます。読み取り、変更、そして削除（最初はオフ）があります。",
                "**Allow** を押します。",
            ],
            codeHeading: "Claude Code",
            codeSteps: [
                "ターミナルで次のコマンドを実行します：`claude mcp add --transport http genos ADDRESS`（ADDRESS を上のアドレスに置き換えてください）。",
                "Claude Code で `/mcp` を実行し、Genos にサインインします。",
                "承認画面で、チームと許可する内容を選び、**Allow** を押します。",
            ],
            plan: "接続には Core プラン以上が必要です。Free では、承認画面にプランに含まれないと表示されます。",
            disconnect:
                "アプリの接続を解除するには、**設定 → Developer → 接続済みアプリ** を開き、**取り消す** を選びます。解除したアプリは、次のリクエストから使えなくなります。",
            trap: "アドレスは末尾のパスを含めて、すべて貼り付けてください。パスがないと、Claude は接続できたと報告したあと、Genos がリクエストを拒否したと伝えます。",
        },
        apiKeys: {
            heading: "APIキー",
            intro: "APIキーを使うと、ご自身のスクリプトやツールから Genos API を呼び出せます。キーはあなたとして動くため、あなたが見られるものだけを扱えます。",
            steps: [
                "**設定 → Developer → APIキー** を開きます。",
                "何のためのキーか分かる名前を付け、**Read** または **Read & write** を選びます。",
                "有効期限を選びます。既定は 90 日で、最長は 1 年です。",
                "**キーの作成** を選び、表示されたキーを **Copy** します。キーは一度しか表示されません。",
                "キーを使えなくするには **取り消す** を選びます。取り消したキーは、再び有効にできません。",
            ],
            usageHeading: "キーの使い方",
            usageNote:
                "キーは Authorization ヘッダーで送り、先頭に ApiKey という語を付けます。公開 API で使えます。次の呼び出しは、キーが代わりに動くユーザーを返します。エンドポイントの一覧は [Developers](/developers) ページにあります。",
            usageExample: 'curl -H "Authorization: ApiKey YOUR_KEY" ORIGIN/api/public/v1/me/',
        },
        schedules: {
            heading: "スケジュール",
            intro: "スケジュールは、選んだ時刻に Genos がレポートを用意する機能です。レポートは受信箱に届くので、開始するために何かを入力する必要はありません。",
            steps: [
                "**設定 → Genos** を開き、**Genos Assist スケジュール** を見つけます。",
                "**新しいスケジュール** を選び、レポートと時刻を選んで **Create schedule** を選びます。",
                "削除せずに止めたいときは、各行のスイッチを切ります。変更は **Edit**、削除は **Delete** から行います。",
            ],
            plan: "スケジュールには Core プラン以上が必要です。プランが変わると、一時停止されていたスケジュールは、アップグレード後に再開します。",
        },
        export: {
            heading: "データのエクスポート",
            intro: "Genos で作成したデータのコピーをダウンロードできます。",
            steps: [
                "**設定 → アカウント** を開きます。",
                "**データをエクスポート** の下で **データをダウンロード** を選びます。",
                "プロフィール、ノート、To-Do、タスク、メッセージ、コメントを含む JSON ファイルが、ブラウザに保存されます。",
            ],
            scope: "他のメンバーがチームのために書いたコンテンツは含まれません。同じページには、ご自身のアカウントとセキュリティ アクティビティも表示されます。",
        },
        shortcuts: {
            heading: "キーボードショートカット",
            intro: "Genos のどこからでも使えます。下のキーは、お使いの環境のものです。",
            rows: [
                { id: "global.spotlight", label: "Spotlight を開く：検索と質問" },
                { id: "global.tasksNew", label: "新しいタスク" },
                { id: "global.notesNew", label: "新しいノート" },
                { id: "global.calendar", label: "カレンダー" },
                { id: "global.meetClipboard", label: "ミーティング クリップボード" },
                { id: "global.history", label: "履歴" },
                { id: "global.taskGraph", label: "タスクの図" },
                { id: "global.todo", label: "To-Do リスト" },
                {
                    id: "global.cycle",
                    label: "1つ目のキーを押したまま2つ目を押す：開いているサービスを切り替える",
                },
                { id: "global.undo", label: "直前の操作を取り消す（トーストが表示されている間）" },
            ],
            note: "文字キーのショートカットは、設定 → ショートカット で変更できます。",
        },
        faq: {
            heading: "よくある質問",
            items: [
                {
                    q: "Claude を接続するには、APIキーが必要ですか？",
                    a: "いいえ。Claude の接続は、Genos の承認画面でのサインインで行います。APIキーは、ご自身のスクリプトやツールのためのものです。",
                },
                {
                    q: "AI アプリを接続するには、どのプランが必要ですか？",
                    a: "Core プラン以上です。Free では、承認画面にプランに含まれないと表示されます。",
                },
                {
                    q: "AI アプリの接続を解除するには？",
                    a: "設定 → Developer → 接続済みアプリ を開き、取り消す を選びます。解除したアプリは、次のリクエストから使えなくなります。",
                },
                {
                    q: "APIキーで削除などもできますか？",
                    a: "許可しない限りできません。削除、アクセス権の変更、共有は既定でオフです。キーを作成するときにオンにできます。",
                },
                {
                    q: "APIキーの有効期限は？",
                    a: "すべてのキーに有効期限があります。既定は 90 日、最長は 1 年です。",
                },
                {
                    q: "作成したAPIキーをもう一度見られますか？",
                    a: "いいえ。一度だけ表示されます。紛失した場合は取り消して、新しいキーを作成してください。",
                },
                {
                    q: "自分のデータをすべて取り出せますか？",
                    a: "はい。設定 → アカウント → データをダウンロード で、作成したデータの JSON ファイルを取得できます。他のメンバーがチームのために書いたコンテンツは含まれません。",
                },
                {
                    q: "現在、Genos で使える AI アプリは？",
                    a: "Claude です：claude.ai、Claude Desktop、Claude Code。 TODO(copy): MIP-1259 この文の承認待ちです。",
                },
                {
                    q: "スケジュールのレポートはどこに届きますか？",
                    a: "受信箱に届きます。見るためにスケジュールを開く必要はありません。",
                },
            ],
        },
        other: {
            heading: "関連ページ",
            links: [
                { to: "/features-guide", label: "機能ガイド" },
                { to: "/demo-guide", label: "デモの見方" },
                { to: "/developers", label: "開発者向け：REST API、MCP ツール、Webhook" },
                { to: "/migrate", label: "Genos への移行" },
                { to: "/support", label: "サポート" },
            ],
        },
    },
};
