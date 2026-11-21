/**
 * The words of the Terms of Service (`/terms`), and nothing else.
 *
 * INTERIM v1, drafted 2026-11-21 for Ken to re-check (task MIP-1843). This is
 * NOT counsel's text and NOT legal advice. It is short on purpose: the users
 * are friends and nobody pays yet. Counsel is asked again at the first paying
 * user (MIP-1844). Every line is `TODO(copy): MIP-1843` until Ken approves it.
 *
 * Structure: 15 articles. Each article has a Japanese block (the operative
 * text) and an English block (the same article, same number, same order). The
 * test in `src/__tests__/TermsPage.test.tsx` fails if the two languages drift
 * apart in ids, order or number of clauses.
 *
 * What is deliberately NOT in this text (for counsel, not for users):
 *  - a liability cap, a general exclusion of liability, a warranty disclaimer:
 *    private users are consumers under Japanese law (消費者契約法), where such
 *    clauses can be void. Left for counsel's full package.
 *  - indemnities, arbitration, anything about companies as customers.
 *  - the names of individual AI vendors: the Privacy Policy keeps that list.
 *  - the court. The text says only that disputes go to a court under the law.
 *
 * Where a sentence repeats the 特定商取引法 page (`/legal`) or the Privacy
 * Policy, it repeats their wording and does not add a rule of its own.
 *
 * The page (TermsPage.tsx) only lays this out; it holds no legal wording.
 */

export type TermsStatus = "interim" | "approved";

/** "interim" until Ken approves this text; then the page may say so. */
export const TERMS_STATUS: TermsStatus = "interim";

/** Shown at the top of the page while `TERMS_STATUS` is "interim". */
export const TERMS_INTERIM_NOTICE = {
    // TODO(copy): MIP-1843
    ja: "これは暫定版の利用規約です。弁護士の確認はまだ受けていません。",
    en: "This is an interim version of the Terms. A lawyer has not reviewed it yet.",
} as const;

/** The operator, as the 特定商取引法 page names them (`/legal`). */
export const OPERATOR_JA = "Genos（個人事業主）";
export const OPERATOR_EN = "Genos, a sole proprietorship";

/** Date the terms take effect: filled in when the page is published. */
// TODO(copy): MIP-1843 — Ken to confirm the date on publication.
export const ENACTED_ON_JA = "公開の日（2026年12月予定）";
export const ENACTED_ON_EN = "the day of publication (planned for December 2026)";

export const TERMS_TITLE_JA = "利用規約";
export const TERMS_TITLE_EN = "Terms of Service";
export const TERMS_SUBTITLE_JA = "日本語が正式な文面です。英語版は各条の下に続きます。";
export const TERMS_SUBTITLE_EN =
    "The Japanese text is the operative version. The English text follows each article.";
export const TERMS_TOC_LABEL = "目次 / Contents";
export const TERMS_INTRO_JA = `この利用規約（以下「本規約」）は、${OPERATOR_JA}（以下「当社」）が提供する「Genos」（チャット、タスク、ノート、AI機能、連携アプリを含むコラボレーションサービス）の利用条件です。アカウントを作成するか本サービスを利用すると、利用者は本規約に同意したものとします。`;
export const TERMS_INTRO_EN = `These terms (the “Terms”) govern your use of Genos, the collaboration service (chat, tasks, notes, AI features and connected apps) provided by ${OPERATOR_EN} (“we”). By creating an account or using Genos you agree to the Terms.`;

export const TERMS_CONTACT_HEADING_JA = "お問い合わせ";
export const TERMS_CONTACT_HEADING_EN = "Contact";
export const TERMS_CONTACT_JA = "本規約に関するお問い合わせ";
export const TERMS_ENACTED_LABEL_JA = "施行日";
export const TERMS_ENACTED_LABEL_EN = "Effective date";

/** One language of one article. `items` are the numbered clauses. */
export type TermsLang = { heading: string; items: string[] };

/** One article, in both languages. The ids match across languages. */
export type TermsArticle = { id: string; ja: TermsLang; en: TermsLang };

// The contact address is the one the Support and Privacy pages show. It is
// written in the page from `CONTACT_EMAIL` (kit/links), so it cannot drift.
export const TERMS_ARTICLES: TermsArticle[] = [
    {
        id: "article-1",
        ja: {
            heading: "第1条（適用）",
            items: [
                "本規約は、本サービスの利用に関する当社と利用者の間の関係に適用されます。プライバシーポリシー及び特定商取引法に基づく表記は、本規約の一部です。",
                "利用者は、アカウントを作成するか本サービスを利用することにより、本規約に同意したものとします。",
            ],
        },
        en: {
            heading: "Article 1 (Scope)",
            items: [
                "These Terms apply to the relationship between us and you in connection with the Service. The Privacy Policy and the Legal Notice form part of these Terms.",
                "By creating an account or using the Service, you agree to these Terms.",
            ],
        },
    },
    {
        id: "article-2",
        ja: {
            heading: "第2条（アカウント）",
            items: [
                "アカウントは、正確な情報で作成してください。サインアップの画面で本規約とプライバシーポリシーへの同意が必要です。",
                "未成年の方は、法定代理人の同意を得た上で本サービスを利用してください。",
                "当社は、本規約に違反したことがある方などの登録を断ることがあります。",
            ],
        },
        en: {
            heading: "Article 2 (Accounts)",
            items: [
                "Create your account with accurate information. Sign-up asks you to agree to these Terms and the Privacy Policy.",
                "If you are a minor, use the Service only with the consent of your legal guardian.",
                "We may refuse to open an account for someone who has broken these Terms before.",
            ],
        },
    },
    {
        id: "article-3",
        ja: {
            heading: "第3条（アカウントの管理）",
            items: [
                "パスワード、APIキー、連携の許可など、アカウントの認証情報は自分で管理し、第三者に渡さないでください。",
                "アカウントの不正利用に気づいたら、すぐに下記のお問い合わせ先へ知らせてください。",
            ],
        },
        en: {
            heading: "Article 3 (Keeping your account safe)",
            items: [
                "Keep your passwords, API keys and connection approvals to yourself. Do not give them to anyone else.",
                "If you notice that someone else is using your account, tell us at the contact address below straight away.",
            ],
        },
    },
    {
        id: "article-4",
        ja: {
            heading: "第4条（禁止事項）",
            items: [
                "法令や公序良俗に反する行為。",
                "他人の著作権、プライバシーその他の権利を侵害する行為。",
                "なりすまし、他人のアカウントや認証情報の使用。",
                "本サービスや他の利用者の運営を妨げる行為（過度な負荷をかける行為、不正アクセス、リバースエンジニアリング、利用上限を回避する行為など）。",
                "迷惑メールやマルウェアの送信・配布。",
                "AI機能を使って違法又は有害なコンテンツを作成・拡散すること。",
            ],
        },
        en: {
            heading: "Article 4 (What you must not do)",
            items: [
                "Breaking the law or acting against public order and morals.",
                "Infringing someone else's copyright, privacy or other rights.",
                "Impersonating someone, or using another person's account or credentials.",
                "Interfering with the Service or other users (for example, putting excessive load on it, unauthorised access, reverse engineering, or getting around usage limits).",
                "Sending spam or distributing malware.",
                "Using the AI features to create or spread illegal or harmful content.",
            ],
        },
    },
    {
        id: "article-5",
        ja: {
            heading: "第5条（AIアプリ・APIキーの利用）",
            items: [
                "MCP又はAPIキーを使い、AIアプリや自作のツールを本サービスに接続することができます。",
                "接続したアプリが読み取れる内容と実行できる操作は、あなたが許可した範囲に限られます。接続したアプリに何をさせるかは、あなたの指示であり、その結果についてはあなたが責任を負います。",
                "接続は、本サービスの設定からいつでも解除でき、APIキーは無効にできます。",
            ],
        },
        en: {
            heading: "Article 5 (AI apps, MCP and API keys)",
            items: [
                "You may connect AI apps and tools you build to the Service, using MCP or API keys.",
                "A connected app can read and do only what you allow it. What you tell a connected app to do is your instruction, and you are responsible for the results.",
                "You can disconnect an app at any time from the Service's settings, and you can revoke an API key.",
            ],
        },
    },
    {
        id: "article-6",
        ja: {
            heading: "第6条（あなたのコンテンツ）",
            items: [
                "利用者が本サービスに投稿・保存したメッセージ、タスク、ノート、ファイルその他のデータ（以下「ユーザーコンテンツ」）の権利は、利用者又は正当な権利者に残ります。",
            ],
        },
        en: {
            heading: "Article 6 (Your content)",
            items: [
                "You keep the rights in the messages, tasks, notes, files and other data you post or store in the Service (“your content”). Rights held by others stay with them.",
            ],
        },
    },
    {
        id: "article-7",
        ja: {
            heading: "第7条（当社によるユーザーコンテンツの利用）",
            items: [
                "当社は、本サービスを提供するために必要な範囲でのみ、ユーザーコンテンツを利用します。具体的には、保存、バックアップ、検索（検索用の索引の作成を含む）、表示、安全の維持、不具合の修正です。",
                "利用者が依頼したAI機能の処理のため、ユーザーコンテンツを当社の委託先であるAI事業者に送ることがあります（第8条）。",
                "当社は、ユーザーコンテンツをAIモデルの学習に使用しません。",
            ],
        },
        en: {
            heading: "Article 7 (What we may do with your content)",
            items: [
                "We use your content only as far as needed to run the Service: to store it, back it up, search it (including building a search index), show it to you, keep it safe and fix faults.",
                "To run an AI feature you ask for, we may send your content to an AI provider we use (see Article 8).",
                "We do not use your content to train AI models.",
            ],
        },
    },
    {
        id: "article-8",
        ja: {
            heading: "第8条（AI機能）",
            items: [
                "AI機能の出力は自動で作られたもので、誤りを含むことがあります。利用者は、出力を確認し、自分の判断と責任で利用してください。",
                "本サービス内のAI機能が、データを作成・変更・削除する操作を提案した場合は、利用者が承認したものだけが実行されます。外部のAIアプリから接続した場合の操作は、第5条のとおり利用者の指示に基づきます。",
                "当社は、AI機能の処理のために、法人向けAPIを提供する事業者に委託することがあります。委託先の一覧と取扱いは、プライバシーポリシーに記載します。",
                "AI機能の内容や利用回数の上限は、プランによって異なり、変更されることがあります。",
            ],
        },
        en: {
            heading: "Article 8 (AI features)",
            items: [
                "AI output is generated automatically and may be wrong. Check it, and use it at your own judgement and responsibility.",
                "When an AI feature inside the Service proposes a change that creates, edits or deletes data, only the changes you approve are carried out. Actions taken by an AI app you connect are carried out on your instruction, as Article 5 says.",
                "To run AI features, we use business API providers. The list of providers and how they handle data are in the Privacy Policy.",
                "The AI features available and the limits on their use depend on your plan, and may change.",
            ],
        },
    },
    {
        id: "article-9",
        ja: {
            heading: "第9条（外部サービスとの連携）",
            items: [
                "Google（カレンダー等）、GitHub などの外部サービスを連携できます。連携すると、当社は、利用者が許可した範囲で当該サービスの情報を取得し、利用者又は利用者が承認した操作に基づいてのみ、当該サービス上の情報を作成・変更します。",
                "外部サービスの利用は、そのサービスの利用規約及びプライバシーポリシーに従います。外部サービスの内容と変更について、当社は責任を負いません。",
                "連携はいつでも解除できます。",
            ],
        },
        en: {
            heading: "Article 9 (Connected services)",
            items: [
                "You can connect external services such as Google (for example, Calendar) and GitHub. Once connected, we get information from those services only as far as you allow, and create or change information there only on your instruction or on a change you approved.",
                "Your use of an external service is governed by that service's terms and privacy policy. We are not responsible for the content or changes of external services.",
                "You can disconnect a service at any time.",
            ],
        },
    },
    {
        id: "article-10",
        ja: {
            heading: "第10条（料金と支払い）",
            items: [
                "本サービスには無料プランと有料プランがあります。各プランの内容と料金は、「プランと料金」のページ及び特定商取引法に基づく表記のとおりです。",
                "有料プランの支払いは、Stripe を通じたクレジットカードによる決済で、解約されるまで毎月自動で更新されます。",
                "いつでも解約できます。解約は現在の請求期間の末日に効力を生じ、それまで有料プランの機能を使えます。以後の請求は行われません。",
                "開始した月の利用料金は返金しません。誤って又は二重に請求された場合は、お問い合わせ先へご連絡ください。個別に確認します。",
                "価格を改定する場合は、相当な予告期間をもって通知します。価格改定の前に契約した方は、プランを変更するまで従来の料金が適用されます。",
            ],
        },
        en: {
            heading: "Article 10 (Plans and payment)",
            items: [
                "The Service has a free plan and paid plans. The features and prices of each plan are as shown on the Plans & pricing page and in the Legal Notice.",
                "Paid plans are paid by credit card through Stripe. They renew automatically every month until you cancel.",
                "You can cancel at any time. A cancellation takes effect at the end of the current billing period, and paid features stay available until then. No further charges are made.",
                "We do not refund a month that has already started. If you were charged by mistake or charged twice, contact us at the address below and we will review it case by case.",
                "If we change a price, we will give you reasonable notice first. If you subscribed before a price change, your previous rate applies until you change plan.",
            ],
        },
    },
    {
        id: "article-11",
        ja: {
            heading: "第11条（サービスの変更・停止）",
            items: [
                "当社は、本サービスの機能を追加、変更又は停止することがあります。機能の停止など重要な変更は、可能な限り事前に、メール又は本サービス上でお知らせします。",
                "当社は、本サービスを安定して提供するよう努めます。保守や障害のため、一時的に利用できない場合があります。",
                "本サービスの提供を終了する場合は、相当な予告期間をもってお知らせし、その間にユーザーコンテンツを書き出せるようにします。",
            ],
        },
        en: {
            heading: "Article 11 (Changes and availability)",
            items: [
                "We may add, change or stop features of the Service. For significant changes, including stopping a feature, we will tell you in advance where we reasonably can, by email or in the Service.",
                "We try to keep the Service running well. It may be unavailable for a time for maintenance or because of a fault.",
                "If we stop providing the Service, we will give you reasonable notice, and you will be able to export your content during that time.",
            ],
        },
    },
    {
        id: "article-12",
        ja: {
            heading: "第12条（データの書き出しと削除）",
            items: [
                "作成したデータは、「設定」→「アカウント」→「データをエクスポート」から、JSON形式でいつでもダウンロードできます。他の利用者が作成したチーム内の内容は含まれません。",
                "アカウントは、「設定」→「アカウント」→「アカウントを削除」から、いつでも削除できます。削除すると、すべての端末から直ちにサインアウトされ、氏名、メールアドレス及びプロフィールは匿名化されます。非公開のノート、ToDo及びAI機能の履歴は削除され、APIキーは無効になり、当社に保存されているGoogle・GitHub等の連携情報は削除されます。（連携先のサービス側での許可は、各サービスの設定画面から取り消してください。）",
                "他の人と共同で作成した内容（チームのメッセージ、タスク、DMへの投稿など）は、その人の側に残り、「削除されたユーザー」として表示されます。ただし、他の利用者が書いた文章の中にあなたの氏名が含まれる場合など、一部は削除されずに残ることがあります。最後のメンバーだったチームは閉鎖され、利用できなくなりますが、内容は保存されたままです。他のメンバーがいるチームのオーナーは、先にオーナー権限を譲渡してください。",
                "削除の対象は本サービス内のデータです。既に外部の事業者に送信された情報や、セキュリティの監査記録は、この操作では自動的に削除されません。詳しくはプライバシーポリシーをご覧ください。",
            ],
        },
        en: {
            heading: "Article 12 (Exporting and deleting your data)",
            items: [
                "You can download the data you created at any time, in JSON format, from Settings → Account → Export your data. Content that other users created in a team is not included.",
                "You can delete your account at any time from Settings → Account → Delete account. Deleting it signs you out on every device straight away, and anonymises your name, email and profile. Your private notes, to-dos and AI history are deleted, your API keys are revoked, and the Google and GitHub connection details we store are removed. (Revoke access on the service's own settings page too.)",
                "Work you did together with others (for example, team messages, tasks and posts in direct messages) stays with them and shows as “Deleted user”. Some items may stay in part, for example where your name appears in text another user wrote. A team you were the last member of is closed and can no longer be used, but its content is kept. If you own a team that has other members, transfer ownership first.",
                "Deletion covers the data within the Service. Information already sent to external providers, and security audit records, are not deleted automatically by this step. See the Privacy Policy for details.",
            ],
        },
    },
    {
        id: "article-13",
        ja: {
            heading: "第13条（利用の停止と解除）",
            items: [
                "利用者が本規約に違反した場合、当社は、利用の停止又はアカウントの削除を行うことがあります。違反が重大でない場合は、その理由を事前にお知らせします。",
                "利用者は、第12条のとおりアカウントをいつでも削除できます。",
                "有料プランが終了すると無料プランになります。無料プランで表示されない過去の履歴は削除されず、有料プランに戻すと再び表示されます。",
            ],
        },
        en: {
            heading: "Article 13 (Suspension and ending)",
            items: [
                "If you break these Terms, we may suspend your use of the Service or delete your account. Unless the breach is serious, we will tell you the reason in advance.",
                "You can delete your account at any time, as Article 12 explains.",
                "When a paid plan ends, the account goes back to the free plan. History the free plan does not show is not deleted, and it shows again if you return to a paid plan.",
            ],
        },
    },
    {
        id: "article-14",
        ja: {
            heading: "第14条（規約の変更）",
            items: [
                "当社は、本規約を変更することがあります。重要な変更は、相当な予告期間をもって、メール又は本サービス上でお知らせし、効力発生日を示します。",
                "変更後も本サービスを利用し続けた場合、利用者は変更後の規約に同意したものとします。変更に同意しない場合は、第12条によりアカウントを削除してください。",
                "アカウント登録時に同意した本規約の版は、当社が記録します。",
            ],
        },
        en: {
            heading: "Article 14 (Changes to these Terms)",
            items: [
                "We may change these Terms. For significant changes, we will tell you by email or in the Service, with reasonable notice and an effective date.",
                "If you keep using the Service after a change takes effect, you agree to the changed Terms. If you do not agree, delete your account under Article 12.",
                "We record which version of these Terms you agreed to when you signed up.",
            ],
        },
    },
    {
        id: "article-15",
        ja: {
            heading: "第15条（準拠法・裁判所・お問い合わせ）",
            items: [
                "本規約は日本法に従って解釈されます。",
                "本サービスに関して争いが生じた場合は、まず誠実に協議します。協議で解決しない場合は、法令に従って定められる裁判所を通じて解決します。",
                "本規約に関するお問い合わせは、下記のメールアドレスへお送りください。",
            ],
        },
        en: {
            heading: "Article 15 (Governing law, courts and contact)",
            items: [
                "These Terms are governed by Japanese law.",
                "If a dispute arises about the Service, we will first discuss it in good faith. If we cannot settle it that way, it will be resolved in a court determined under applicable law.",
                "Send questions about these Terms to the email address below.",
            ],
        },
    },
];

/** The article ids, in order: used by the page's contents list and the tests. */
export const TERMS_ARTICLE_IDS = TERMS_ARTICLES.map((a) => a.id);
