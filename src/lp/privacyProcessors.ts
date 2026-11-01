/**
 * The third parties the privacy page (PrivacyPage.tsx) says user data is
 * sent to, with what each receives. Kept out of the component file so the
 * test can import it (react-refresh wants component-only exports there).
 */

type Processor = {
    /** Shown in bold, identical in both languages. */
    name: string;
    /** What it is used for and what it receives (Japanese, operative). */
    ja: string;
    /** The same, in English. */
    en: string;
};

/**
 * Every third party the code sends user data to, with what it receives.
 * Source: genos-docs `operations/THIRD_PARTY_REVIEW.md` (MIP-729, which
 * checked each item in the code). Exported for the test, which pins that
 * both languages render every row.
 */
export const PROCESSORS: Processor[] = [
    {
        name: "Railway",
        ja: "ホスティング・データ保管。本サービスの本番環境は Railway 上でのみ稼働しており、アカウント情報やコンテンツを含むサービス上のすべてのデータが保存されます。",
        en: "Hosting and storage. Production runs on Railway only; all service data, including account details and your content, is stored there.",
    },
    {
        name: "Google（Gemini）",
        ja: "AI 機能（検索・要約・エージェント）。質問と会話、および回答に必要な範囲で取得したワークスペースの内容（メッセージ、タスク、ノート、カレンダーの予定など）が送信されます。",
        en: "AI features (search, summaries, agent). Your question and conversation, plus the workspace content retrieved to answer it (messages, tasks, notes, calendar events and similar), are sent.",
    },
    {
        name: "Anthropic（Claude）",
        ja: "設定により、AI 機能で Google の代わりに利用されます。送信される内容は Google（Gemini）と同じです。",
        en: "Used for the AI features instead of Google when configured. It receives the same content as Google (Gemini).",
    },
    {
        name: "OpenAI",
        ja: "検索のための埋め込み（ベクトル）生成。検索対象としてインデックス化されるチャットメッセージ・タスク・ノートのテキストと、入力された検索語が送信されます。",
        en: "Embeddings for search. The text of chat messages, tasks and notes that is indexed for search, and the search terms you type, are sent.",
    },
    {
        name: "Cohere",
        ja: "検索結果の並べ替え（リランキング）に Cohere を設定した場合のみ利用されます。検索語と、候補の題名・抜粋が送信されます。",
        en: "Used only when it is configured for re-ranking search results. The search query and each candidate's title and a short excerpt are sent.",
    },
    {
        name: "Tavily",
        ja: "AI のウェブ検索機能。AI が作成した検索クエリがそのまま送信されます。",
        en: "The AI's web-search feature. The search query written by the AI is sent as is.",
    },
    {
        name: "Stripe",
        ja: "決済・請求。メールアドレス、ユーザー名、内部 ID、プラン、チームの課金ではチーム名とチームのメールアドレスが送信されます。クレジットカード番号は Stripe のページで直接入力され、当サービスのサーバーには届きません。",
        en: "Payments and billing. Your email address, username, internal IDs and plan are sent, and for team billing the team name and team email. Card numbers are entered on Stripe's own page and never reach our servers.",
    },
    {
        name: "Resend",
        ja: "メール送信（確認・パスワード再設定・招待・通知・ダイジェスト）。宛先アドレス、件名、本文が送信されます。通知メールの本文には、メッセージやタスクなどの内容の抜粋が含まれることがあります。",
        en: "Email delivery (verification, password reset, invitations, notifications, digests). The recipient address, subject and body are sent. Notification emails can include excerpts of messages, tasks and similar content.",
    },
    {
        name: "PostHog",
        ja: "プロダクト分析。ユーザー ID、チーム ID、チーム名、役割（ロール）、閲覧したページのパス（クエリ文字列を除く）、デモ体験の開始・完了・失敗のイベントが送信され、ユーザー ID とチーム名が結び付けられます。クリックの自動取得とセッション録画は行っていません。この分析は初期状態で有効で、「設定 → 一般 → プライバシーと分析」からそのブラウザでの送信を停止できます。",
        en: "Product analytics. Your user ID, team ID, team name, role, the path of the pages you view (without query strings) and demo started / completed / failed events are sent, and your user ID is linked to your team name. Click auto-capture and session recording are not used. Analytics is on by default; you can stop it for that browser in Settings → General → Privacy & analytics.",
    },
    {
        name: "GIPHY",
        ja: "GIF ピッカー。入力した検索語が当サービスのサーバーから GIPHY に送信されます。表示される GIF は GIPHY の配信サーバーからお使いのブラウザが直接読み込むため、その際に IP アドレスやブラウザ情報が GIPHY に届きます。",
        en: "The GIF picker. The search term you type is sent from our server to GIPHY. GIFs are loaded by your browser directly from GIPHY's servers, so your IP address and browser details reach GIPHY when one is shown.",
    },
    {
        name: "Google（サインイン・カレンダー）",
        ja: "Google アカウントでのサインインでは、基本プロフィールとメールアドレスを受け取ります。「カレンダー連携」を有効にした場合は、お客様のカレンダーの予定を読み取り、機能の利用に応じて作成・更新する予定（タイトル・日時・参加者）を Google に送信します。",
        en: "Signing in with Google gives us your basic profile and email address. If you connect your calendar, we read your calendar events and send the events we create or update through the features you use (title, time, attendees) to Google.",
    },
    {
        name: "GitHub",
        ja: "GitHub アカウントでのサインインでは、ユーザー情報とメールアドレスを受け取ります。「GitHub 連携」を有効にした場合は、非公開リポジトリを含むリポジトリへのアクセス権限（repo スコープ）を許可していただき、取得したトークンを当サービスが保存します。プルリクエストの連携のため、対象のリポジトリに Webhook を登録します。",
        en: "Signing in with GitHub gives us your user details and email address. If you connect GitHub, you grant access to your repositories, including private ones (the repo scope), and we store the resulting token. To link pull requests we register a webhook on the repositories involved.",
    },
    {
        name: "ブラウザ提供元のプッシュ通知サービス（Apple・Google・Mozilla）",
        ja: "プッシュ通知の配信。通知内容（送信者名とメッセージの抜粋を含む）は暗号化されて送信されます。",
        en: "Delivery of push notifications by the browser vendor's push service (Apple, Google, Mozilla). The notification content, which includes the sender's name and a message excerpt, is sent encrypted.",
    },
];
