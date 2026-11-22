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
 * Source: genos-docs `operations/THIRD_PARTY_REVIEW.md` (checked in the
 * code on `main`). Exported for the test, which pins that both languages
 * render every row. Production facts (EMBEDDING_PROVIDER=vertex, the cost
 * reports in Cloud Storage) were read from the variable and job names on
 * 2026-11-21, not from the values.
 */
export const PROCESSORS: Processor[] = [
    {
        name: "Railway",
        ja: "ホスティング・データ保管。本サービスの本番環境は Railway 上で稼働しており、アカウント情報やコンテンツなど、サービスのデータはここに保存されます（AI 利用料の集計ページを除きます。下記の Google Cloud Storage を参照）。",
        en: "Hosting and storage. Production runs on Railway, and service data, including account details and your content, is stored there (AI cost reports are the exception; see Google Cloud Storage below).",
    },
    {
        name: "Google Cloud Storage",
        ja: "AI 利用料の集計ページを毎日保存します。保存されるのは AI の利用量と費用の集計で、利用者の ID を含みます。",
        en: "Stores the daily AI cost reports. These hold AI usage and cost totals, including user IDs.",
    },
    {
        name: "Google（Gemini）",
        ja: "AI 機能（検索・要約・エージェント）。質問と会話、および回答に必要な範囲で取得したワークスペースの内容（メッセージ、タスク、ノート、カレンダーの予定など）が送信されます。本番環境では、検索用の索引（埋め込み）の作成も Google Cloud（Vertex AI）で行っており、索引化されるテキスト（メッセージ、タスク、ノートなど）と検索語が送信されます。",
        en: "AI features (search, summaries, agent). Your question and conversation, plus the workspace content retrieved to answer it (messages, tasks, notes, calendar events and similar), are sent. In production, the search index (embeddings) is also built on Google Cloud (Vertex AI): the text that is indexed (messages, tasks, notes and similar) and the search terms are sent.",
    },
    {
        name: "Anthropic（Claude）",
        ja: "設定により、AI 機能で Google の代わりに利用されます。送信される内容は Google（Gemini）と同じです。",
        en: "Used for the AI features instead of Google when configured. It receives the same content as Google (Gemini).",
    },
    {
        name: "OpenAI",
        ja: "設定により選択された場合のみ利用されます。その場合、検索用の埋め込み（インデックス化されるテキストと検索語）や AI 機能の処理内容が送信されます。本番環境では、2026 年 11 月 21 日時点で検索用の埋め込みには使用していません。",
        en: "Used only when it is configured. Then the text indexed for search and the search terms, or the content of AI requests, are sent. In production, it was not used for search embeddings as of 21 November 2026.",
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
        ja: "決済・請求。メールアドレス、ユーザー名、内部 ID、プラン、チームの課金ではチーム名とチームのメールアドレスが送信されます。クレジットカード番号は Stripe のページで直接入力され、当サービスのサーバーには届きません。アカウントを削除しても、Stripe 上の顧客情報と請求履歴は削除されず、保持されます。",
        en: "Payments and billing. Your email address, username, internal IDs and plan are sent, and for team billing the team name and team email. Card numbers are entered on Stripe's own page and never reach our servers. Deleting your account does not delete your customer record or billing history at Stripe; they are kept.",
    },
    {
        name: "Resend",
        ja: "メール送信（確認・パスワード再設定・招待・通知・ダイジェスト）。宛先アドレス、件名、本文が送信されます。通知メールの本文には、メッセージやタスクなどの内容の抜粋が含まれることがあります。",
        en: "Email delivery (verification, password reset, invitations, notifications, digests). The recipient address, subject and body are sent. Notification emails can include excerpts of messages, tasks and similar content.",
    },
    {
        name: "PostHog",
        ja: "プロダクト分析。同意していただいた場合にのみ送信します。送信するのは、ユーザー ID、チーム ID、役割（ロール）、閲覧したページのパス（クエリ文字列を除く）、デモ体験の開始・完了・失敗のイベント、マーケティングページでクリックしたボタン（例:「デモを試す」）、サインアップ、ページの言語、およびアクセス元（アクセスしたリンクに含まれる utm_source・utm_medium・utm_campaign・utm_content・utm_term の値と、参照元ウェブサイトのドメインのみ）です。アプリ内では、これに加えてブラウザの種類、OS、端末の種類、画面と表示領域のサイズ、ユーザーエージェント、ページのタイトルも送信します（マーケティングページでは送信しません）。IP アドレスは、PostHog で保存しないよう設定しています。ただし、通信の際に接続元の IP アドレスが PostHog のサーバーに届きます。サインイン前はランダムなブラウザ ID に、サインイン後はユーザー ID に紐づきます（匿名ではありません）。チーム名は送信しません。クリックの自動取得とセッション録画は行っていません。「設定 → 一般 → プライバシーと分析」またはマーケティングページ下部のリンクから、そのブラウザでの送信を停止できます。アカウントを削除しても、PostHog 上の情報は自動では削除されません。",
        en: 'Product analytics, sent only with your consent. What is sent: your user ID, team ID, role, the path of the pages you view (without query strings), demo started / completed / failed events, which button you click on our marketing pages (for example "Try the demo"), the moment you sign up, the language of the page, and the marketing source of your visit (the utm_source, utm_medium, utm_campaign, utm_content and utm_term values in the link you arrived by, and the website you came from, domain only). In the app, the browser, operating system, device type, screen and viewport size, user agent and page title are also sent (not on our marketing pages). IP addresses are set not to be stored by PostHog, but the connecting IP address still reaches PostHog\'s servers with each request. Before you sign in, this is tied to a random browser ID, and once you sign in it is tied to your user ID (not anonymous). The team name is not sent. Click auto-capture and session recording are not used. You can stop it for that browser in Settings > General > Privacy & analytics, or from the link at the bottom of our marketing pages. Deleting your account does not automatically delete your data in PostHog.',
    },
    {
        name: "GIPHY",
        ja: "GIF ピッカー。入力した検索語が当サービスのサーバーから GIPHY に送信されます。表示される GIF は GIPHY の配信サーバーからお使いのブラウザが直接読み込むため、その際に IP アドレスやブラウザ情報が GIPHY に届きます。",
        en: "The GIF picker. The search term you type is sent from our server to GIPHY. GIFs are loaded by your browser directly from GIPHY's servers, so your IP address and browser details reach GIPHY when one is shown.",
    },
    {
        name: "Google（サインイン・カレンダー）",
        ja: "Google アカウントでのサインインでは、基本プロフィールとメールアドレスを受け取ります。「カレンダー連携」を有効にした場合は、お客様のカレンダーの予定を読み取り、機能の利用に応じて作成・更新する予定（タイトル・日時・参加者）を Google に送信します。連携を解除または削除すると、保存しているトークンを削除し、Google 側の許可も取り消します。",
        en: "Signing in with Google gives us your basic profile and email address. If you connect your calendar, we read your calendar events and send the events we create or update through the features you use (title, time, attendees) to Google. If you disconnect or delete your account, we delete the token we store and also revoke the access at Google.",
    },
    {
        name: "GitHub",
        ja: "GitHub アカウントでのサインインでは、ユーザー情報とメールアドレスを受け取ります。「GitHub 連携」を有効にした場合は、非公開リポジトリを含むリポジトリへのアクセス権限（repo スコープ）を許可していただき、取得したトークンを当サービスが保存します。プルリクエストの連携のため、対象のリポジトリに Webhook を登録します。連携を解除または削除すると、保存しているトークンを削除し、GitHub 側の許可も取り消します。",
        en: "Signing in with GitHub gives us your user details and email address. If you connect GitHub, you grant access to your repositories, including private ones (the repo scope), and we store the resulting token. To link pull requests we register a webhook on the repositories involved. If you disconnect or delete your account, we delete the token we store and also revoke the access at GitHub.",
    },
    {
        name: "ブラウザ提供元のプッシュ通知サービス（Apple・Google・Mozilla）",
        ja: "プッシュ通知の配信。通知内容（送信者名とメッセージの抜粋を含む）は暗号化されて送信されます。",
        en: "Delivery of push notifications by the browser vendor's push service (Apple, Google, Mozilla). The notification content, which includes the sender's name and a message excerpt, is sent encrypted.",
    },
];
