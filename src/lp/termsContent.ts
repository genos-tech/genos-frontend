/**
 * The words of the Terms of Service (`/terms`), and nothing else.
 *
 * ONE module on purpose: when counsel's approved text arrives, replacing the
 * strings here (and flipping `TERMS_STATUS`) is the whole content change. The
 * page (TermsPage.tsx) only lays them out; it holds no legal wording.
 *
 * STATUS: DRAFT. This is the working draft from genos-docs
 * `legal/TERMS_OF_SERVICE_DRAFT.md`, not approved text, and the page that shows
 * it is behind the build-time flag `VITE_SHOW_TERMS_PAGE` (default off, see
 * `termsFlag.ts`). Do not turn the flag on in production until counsel's text
 * is in and `TERMS_STATUS` is "approved" (`TermsPage.test.tsx` fails an
 * "approved" module that still carries a 【placeholder】).
 *
 * What is deliberately NOT carried over from the draft document:
 *  - the 【弁護士確認：…】 reviewer notes (they are instructions to counsel, not
 *    terms); the draft document keeps them;
 *  - 第9条の2 (connected apps): it is proposed in genos-docs
 *    `legal/COUNSEL_BRIEF_TERMS_AND_CONNECTED_APPS.md` section 4, not in the
 *    draft. 第9条の3 keeps its draft number, so the sequence skips 9の2 until
 *    counsel's text arrives.
 *
 * Japanese is the operative text; the English summary is for convenience. Like
 * /privacy and /legal this is not run through the app i18n (the other five
 * app locales have no copy here; the marketing shell narrows them to English).
 */

export type TermsStatus = "draft" | "approved";

/** Flip to "approved" only with counsel's approved text in this file. */
export const TERMS_STATUS: TermsStatus = "draft";

/** Placeholders to fill from counsel's text / the 特定商取引法 page (`/legal`). */
export const OPERATOR_JA = "【運営者名】";
export const OPERATOR_EN = "【Operator】";
export const COURT_JA = "【管轄裁判所名】";
export const COURT_EN = "【court】";
export const ENACTED_ON = "【日付】";

/** Shown at the top of the page while `TERMS_STATUS` is "draft". */
export const TERMS_DRAFT_NOTICE = {
    ja: "これは弁護士の確認前のドラフトです。内容は確定しておらず、法的効力を持ちません。",
    en: "This is a draft that counsel has not reviewed. It is not final and has no legal effect.",
} as const;

export const TERMS_TITLE_JA = "利用規約";
export const TERMS_SUBTITLE_EN =
    "Terms of Service — the Japanese text is operative; an English summary follows.";
export const TERMS_EN_HEADING = "Terms of Service (English summary)";
export const TERMS_EN_NOTE =
    "The Japanese text above is the operative version. This summary is provided for convenience; if they differ, the Japanese text governs.";
export const TERMS_TOC_LABEL = "目次 / Contents";
export const TERMS_EN_LINK_LABEL = "English summary";

export type TermsArticle = {
    /** Anchor id, `article-<n>` or `article-<n>-<m>` for 第n条のm. */
    id: string;
    /** "第1条（適用）" */
    heading: string;
    /** Text before the numbered clauses, or the whole article when it has none. */
    lead?: string;
    /** Numbered clauses (1., 2., ...). */
    clauses?: string[];
};

export const TERMS_INTRO_JA = `本利用規約（以下「本規約」）は、${OPERATOR_JA}（以下「当社」）が提供するコラボレーションサービス「Genos」（ウェブサイト、アプリケーション及び関連サービスを含み、以下「本サービス」）の利用条件を定めるものです。利用者は、アカウントを登録し又は本サービスを利用することにより、本規約に同意したものとみなされます。`;

export const TERMS_ARTICLES: TermsArticle[] = [
    {
        id: "article-1",
        heading: "第1条（適用）",
        clauses: [
            "本規約は、本サービスの提供条件及び当社と利用者との間の権利義務関係を定めることを目的とし、利用者と当社との間の本サービスの利用に関わる一切の関係に適用されます。",
            "当社が本サービス上に掲載するプライバシーポリシー及び特定商取引法に基づく表記は、本規約の一部を構成します。",
        ],
    },
    {
        id: "article-2",
        heading: "第2条（定義）",
        clauses: [
            "「利用者」とは、本サービスのアカウントを保有する個人をいいます。",
            "「チーム」とは、本サービス上で複数の利用者が共同作業を行うために作成される単位をいいます。",
            "「ユーザーコンテンツ」とは、利用者が本サービスに投稿・保存するメッセージ、タスク、ノート、ファイルその他一切のデータをいいます。",
            "「AI機能」とは、本サービスに含まれる検索・要約・エージェント・ブリーフィング・定期レポート等の人工知能を用いた機能をいいます。",
        ],
    },
    {
        id: "article-3",
        heading: "第3条（アカウント登録）",
        clauses: [
            "アカウント登録は、正確かつ最新の情報をもって行うものとします。",
            "未成年者は、法定代理人の同意を得た上で本サービスを利用するものとします。",
            "当社は、登録申請者が本規約に違反したことがある場合その他当社が不適当と判断した場合、登録を拒否することがあります。",
            "登録申請者は、アカウントの登録に際し、本規約及びプライバシーポリシーに同意する旨を、本サービス所定の画面において明示的に表示するものとし、同意の表示がない場合、アカウントは登録されません。当社は、同意の日時及び同意の対象となった本規約等の版を、利用者のアカウントに紐づけて記録します。",
        ],
    },
    {
        id: "article-4",
        heading: "第4条（アカウントの管理）",
        clauses: [
            "利用者は、自己の責任においてアカウントの認証情報を管理するものとし、第三者への貸与・譲渡・共用をしてはなりません。",
            "認証情報の管理不十分による損害の責任は利用者が負うものとし、当社は当社に故意又は重過失がある場合を除き責任を負いません。",
            "アカウントの不正利用を認知した場合、利用者は直ちに当社に通知するものとします。",
        ],
    },
    {
        id: "article-5",
        heading: "第5条（チームおよび権限）",
        clauses: [
            "チーム内のユーザーコンテンツへのアクセス権限は、チーム・プロジェクト・チャンネル等に設定される役割（オーナー、エディター、ビューアー等）に従います。",
            "チームのオーナー及びエディターは、当該チームのメンバー管理・コンテンツ管理について、チーム内の他の利用者に対する責任を負います。当社はチーム内部の紛争について関与する義務を負いません。",
            "オーナーが長期間応答しない場合の権限移転（オーナーシップクレーム）は、本サービス所定の手続によります。",
            "チームは、本サービス所定の手続により、他のチームとの間でグループチャット、プロジェクト又はノートフォルダを共有することができます。共有を申し出たチームのオーナー又はエディターは、共有先のチームの利用者が、設定された権限の範囲内で当該情報を閲覧し、又は編集できることについて責任を負います。共有は、いずれのチームのオーナー又はエディターもいつでも終了することができます。",
        ],
    },
    {
        id: "article-6",
        heading: "第6条（料金および支払い）",
        clauses: [
            "本サービスには無料プラン及び有料プランがあり、各プランの内容・料金は本サービスの料金ページに表示するとおりとします。",
            "有料プランの決済は、当社が利用する決済代行事業者（Stripe）を通じて行われ、購読期間ごとに自動更新されます。解約・返金の条件は特定商取引法に基づく表記によります。",
            "AI機能の利用量（1日あたりの利用回数、クレジット等）はプランごとに定められ、当社は公正な利用の範囲を超える利用を制限することがあります。",
            "当社は、料金体系を変更する場合、相当な予告期間をもって通知します。",
        ],
    },
    {
        id: "article-7",
        heading: "第7条（禁止事項）",
        lead: "利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。",
        clauses: [
            "法令又は公序良俗に違反する行為",
            "当社又は第三者の知的財産権、プライバシーその他の権利を侵害する行為",
            "本サービスのサーバー・ネットワークに過度の負荷をかける行為、不正アクセス、リバースエンジニアリングその他本サービスの運営を妨害する行為",
            "他の利用者の認証情報の使用、なりすまし行為",
            "迷惑メール送信、マルウェア配布その他第三者に損害を与える行為",
            "AI機能を用いた違法・有害コンテンツの生成又は拡散",
            "その他当社が合理的に不適切と判断する行為",
        ],
    },
    {
        id: "article-8",
        heading: "第8条（ユーザーコンテンツの権利）",
        clauses: [
            "ユーザーコンテンツの知的財産権は、利用者又は正当な権利者に帰属します。",
            "利用者は当社に対し、本サービスの提供・維持・改善（バックアップ、検索インデックス作成、AI機能への入力を含む）に必要な範囲で、ユーザーコンテンツを使用する非独占的な権利を許諾します。",
            "当社は、ユーザーコンテンツを本サービスの提供目的以外に使用せず、AIモデルの学習（トレーニング）に使用しません。",
        ],
    },
    {
        id: "article-9",
        heading: "第9条（AI機能）",
        clauses: [
            "AI機能の出力は自動生成されたものであり、当社はその正確性・完全性・有用性を保証しません。利用者は自己の判断と責任において出力を利用するものとします。",
            "AI機能の提供にあたり、ユーザーコンテンツの一部が当社の委託先であるAI事業者（例えば Google Gemini、Anthropic Claude、OpenAI の法人向け API。利用者が選択したモデル及び機能によります。委託先の一覧はプライバシーポリシーに記載します。）により処理されることがあります。当社と当該事業者との契約条件上、これらの事業者は当該データをモデルの学習に使用しません。詳細はプライバシーポリシーによります。",
            "AI機能の仕様・提供範囲・利用量は、プラン及び当社の運用方針により変更されることがあります。",
            "AI機能が本サービス上の情報の作成・変更等の操作を提案した場合、当該操作は利用者が承認したときに限り実行され、利用者が承認した操作は利用者自身の操作として扱われます。当社は、一定の期間及び条件の下で実行済みの操作を取り消す機能を提供することがありますが、取り消しができること及びその結果を保証しません。既に送信された通知、メールその他外部への送信は取り消されません。",
            "利用者は、本サービス所定の設定により、AI機能が利用者の指定した日時に自動で作成するレポート（以下「定期レポート」）を受け取ることができます。定期レポートの作成にAI機能が用いられる場合、その利用量は当該レポートに表示され、プランに定める利用量の対象となることがあります。定期レポートは利用者がいつでも変更、停止又は削除できます。",
        ],
    },
    {
        id: "article-9-3",
        heading: "第9条の3（外部サービスとの連携）",
        clauses: [
            "利用者は、本サービス所定の方法により、Google（カレンダー等）、GitHub その他の外部サービスのアカウントを本サービスに連携することができます。連携に伴い、当社は利用者が許可した範囲で当該外部サービスの情報を取得し、又は利用者若しくは利用者の承認したAI機能若しくは連携アプリの指示に基づき当該外部サービス上の情報を作成、変更又は削除することがあります。",
            "外部サービスの利用は、当該外部サービスの利用規約及びプライバシーポリシーに従います。当社は、外部サービスの提供、内容及び変更について責任を負いません。",
            "利用者は、本サービス所定の方法により、いつでも連携を解除することができます。",
        ],
    },
    {
        id: "article-10",
        heading: "第10条（サービスの変更・中断・終了）",
        clauses: [
            "当社は、利用者への事前通知なく本サービスの内容を変更し、又は保守・障害・不可抗力等のため一時的に中断することがあります。",
            "当社は、本サービスの全部又は一部の提供を終了する場合、相当な予告期間をもって通知し、利用者がユーザーコンテンツをエクスポートできる合理的な機会を提供するよう努めます。",
            "利用者は、本サービス所定の方法により、いつでも自己が作成したデータをエクスポートすることができます。",
        ],
    },
    {
        id: "article-11",
        heading: "第11条（保証の否認）",
        lead: "本サービスは「現状有姿」で提供され、当社は、本サービスに事実上又は法律上の瑕疵（安全性、信頼性、正確性、完全性、特定目的への適合性、セキュリティ等に関する欠陥、エラーやバグ、権利侵害等を含む）がないことを明示的にも黙示的にも保証しません。",
    },
    {
        id: "article-12",
        heading: "第12条（責任の制限）",
        clauses: [
            "当社は、当社の故意又は重過失による場合を除き、本サービスに起因して利用者に生じた損害について、賠償責任を負いません。",
            "消費者契約法その他の強行法規の適用により当社が責任を負う場合であっても、当社の責任は、当社に故意又は重過失がある場合を除き、損害発生前12か月間に当該利用者が当社に支払った利用料金の総額を上限とし、逸失利益・間接損害・特別損害については責任を負いません。",
        ],
    },
    {
        id: "article-13",
        heading: "第13条（利用停止・登録抹消）",
        clauses: [
            "当社は、利用者が本規約に違反した場合その他本サービスの運営上不適切と判断した場合、事前通知なく、当該利用者による本サービスの利用を停止し、又はアカウントを抹消することがあります。",
            "利用者は、本サービス所定の方法により、いつでも有料プランを解約し、又は自己のアカウントを削除することができます。",
            "有料プランの解約は、当該購読期間の満了時に効力を生じ、以後は無料プランが適用されます。無料プランで表示されない過去のメッセージ等は削除されず、有料プランへの変更により再び表示されます。",
            "アカウントを削除した場合、当社は、利用者の氏名、メールアドレス及びプロフィールを匿名化し、利用者の個人的なノート、ToDo、定期レポート、AI機能の履歴、外部サービス及び連携アプリとの連携その他本サービス所定のデータを削除します。他の利用者と共有されたチーム内のユーザーコンテンツは、削除されたユーザーによるものとして残ります。他のメンバーがいるチームのオーナーである利用者は、オーナー権限を移転した後でなければアカウントを削除できません。",
            "アカウントの削除後も、セキュリティ監査の記録及び決済代行事業者が保持する顧客情報・請求履歴は、プライバシーポリシーに定めるところにより保持されることがあります。",
        ],
    },
    {
        id: "article-14",
        heading: "第14条（個人情報）",
        lead: "当社による個人情報の取扱いは、プライバシーポリシーによります。",
    },
    {
        id: "article-15",
        heading: "第15条（本規約の変更）",
        lead: "当社は、民法第548条の4の定めるところにより、本規約を変更することがあります。変更後の規約は、効力発生日を定めて本サービス上で周知し、効力発生日以降の利用に適用されます。利用者に重大な影響を及ぼす変更については、相当な予告期間をもって通知します。",
    },
    {
        id: "article-16",
        heading: "第16条（準拠法・裁判管轄）",
        clauses: [
            "本規約は日本法に準拠し、日本法に従って解釈されます。",
            `本サービスに起因又は関連する紛争については、${COURT_JA}を第一審の専属的合意管轄裁判所とします。`,
        ],
    },
];

export const TERMS_CONTACT_HEADING_JA = "お問い合わせ";
export const TERMS_CONTACT_JA = "本規約に関するお問い合わせ";
export const TERMS_CONTACT_EN = "Contact";
export const TERMS_ENACTED_LABEL_JA = "制定日";

export type TermsSummaryItem = {
    /** Bold lead-in, e.g. "The service." */
    lead: string;
    body: string;
};

export const TERMS_SUMMARY_EN: TermsSummaryItem[] = [
    {
        lead: "The service.",
        body: `Genos is a collaboration service (chat, tasks, notes, and AI features) operated by ${OPERATOR_EN}. By creating an account or using Genos you agree to these terms, the Privacy Policy, and the commercial disclosure page.`,
    },
    {
        lead: "Accounts.",
        body: 'Register with accurate information, keep your credentials to yourself, and tell us immediately about unauthorized use. Minors need parental consent. Sign-up needs an explicit tick of "I agree to the Terms of Service and the Privacy Policy", and Genos records when you agreed and to which version.',
    },
    {
        lead: "Teams and roles.",
        body: "Access to content follows the roles configured in the product (owner / editor / viewer at team, project, and channel level). Disputes inside a team are the team's to resolve; an absent owner can be replaced through the in-product ownership-claim process. A team can share a group chat, project or note folder with another team; the sharing team's owner or editor answers for what the guests can see and do within the permissions set; either team can end the sharing.",
    },
    {
        lead: "Fees.",
        body: "Free and paid plans as shown on the pricing page. Paid plans renew automatically and are billed through Stripe; cancellation and refunds follow the commercial disclosure page. AI usage (daily asks, credits) is plan-limited and subject to fair use.",
    },
    {
        lead: "Prohibited conduct.",
        body: "No illegal activity, infringement, impersonation, abuse of the infrastructure, reverse engineering, malware, spam, or using the AI features to generate or spread illegal or harmful content.",
    },
    {
        lead: "Your content.",
        body: "You own your content. You grant us only the license needed to run, back up, index, and improve the service, including feeding it to the AI features you invoke. We do not use your content to train AI models, and under our terms with them neither do the business AI APIs we use (for example Google Gemini, Anthropic Claude, OpenAI; the full list is in the Privacy Policy).",
    },
    {
        lead: "AI output.",
        body: "AI-generated output is provided as-is and may be wrong; verify before relying on it.",
    },
    {
        lead: "AI actions, reports and integrations.",
        body: "A change the AI proposes runs only if you approve it, and an approved change is yours; undo may be offered for a limited time but is not guaranteed, and notifications already sent cannot be recalled. Scheduled reports you set up may use AI; the usage is shown on each report and may count toward your plan's limits. Integrations (Google, GitHub) follow those services' terms; Genos reads or changes data there only as you or what you approved instruct; you can disconnect at any time.",
    },
    {
        lead: "Availability.",
        body: "The service is provided as-is, without warranties; we may change or suspend it, and if we ever discontinue it we will give reasonable notice and a reasonable chance to export your data. You can export the data you created at any time.",
    },
    {
        lead: "Liability.",
        body: "Except in cases of willful misconduct or gross negligence, our liability is capped at the fees you paid us in the 12 months before the damage arose, and excludes indirect and consequential damages.",
    },
    {
        lead: "Termination.",
        body: 'We may suspend or delete accounts that violate these terms. You may cancel a paid plan (effective at the end of the period, then the Free plan applies; hidden history is not deleted) or delete your account at any time. Deletion anonymizes you and deletes your private data; work shared with teammates stays as "Deleted user"; a team owner with other members must transfer ownership first; security audit records and the payment provider\'s records may be kept as the Privacy Policy says.',
    },
    {
        lead: "Changes.",
        body: "We may amend these terms per Article 548-4 of the Civil Code of Japan, with notice and an effective date; material changes get reasonable advance notice.",
    },
    {
        lead: "Law.",
        body: `Japanese law governs; exclusive jurisdiction ${COURT_EN}.`,
    },
];
