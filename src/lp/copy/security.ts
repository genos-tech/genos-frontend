import type { Lang } from "../lpLang";

/**
 * /security copy, Japanese and English (MIP-1248). Written, not translated.
 *
 * Truth rules for this file. Every statement is checked against code or a document named in the PR body
 * (claim -> evidence table). Things only Ken can confirm (backup schedule and retention, whether each AI
 * vendor trains on our data, the database region, any certification) are NOT on this page. They are
 * questions in a Genos note, linked from the task.
 *
 * Statements that a personal-data review found contradicted are left out or narrowed (note 194 on MIP-1780,
 * list in the PR body): the name inside message text, the Team Notes outcome of deletion, the removal of
 * Google and GitHub tokens at the provider, the export contents, and the claims about teams and anonymisation.
 *
 * MIP-2284 (Ken, 2026-11-24, no paid certification now): the page says that the host, Railway, states a SOC 2
 * Type II report and AES-256 at rest, that Genos is built with reference to public guidance, and publishes the
 * information security basic policy that IPA's SECURITY ACTION two stars asks for. Hard rule: Genos itself holds
 * NO certification and no sentence may say or imply it does (SecurityPage.test.tsx pins this). The SECURITY
 * ACTION line is NOT here: it is added only after Ken has declared (genos-docs compliance/public-statement/04).
 * Wording approved by Ken and counsel on 2026-11-24.
 */

export interface SecurityLink {
    label: string;
    /** Always an https URL; the source of the sentence above it. */
    href: string;
}

export interface SecuritySection {
    id: string;
    heading: string;
    /** Paragraphs and list items, plain text. */
    body: string[];
    /** Sources for the paragraphs above, shown as a list of external links. */
    links?: SecurityLink[];
}

export interface SecurityCopy {
    title: string;
    lead: string;
    sections: SecuritySection[];
    moreHeading: string;
    privacy: string;
    legal: string;
    reportLabel: string;
    reportButton: string;
    /** Accessible name of each section's list of source links. */
    sourcesLabel: string;
}

export const SECURITY_COPY: Record<Lang, SecurityCopy> = {
    en: {
        title: "Security and data handling",
        lead: "Where your data is kept, who can reach it, how it is protected, and how you delete it. This page describes how Genos works today.",
        sections: [
            {
                id: "where",
                heading: "Where your data is kept",
                body: [
                    // Evidence: genos-docs/operations/THIRD_PARTY_REVIEW.md §2.1 (Railway is the only production host);
                    // genos-api/.railway/railway.ts (cron services in asia-southeast1).
                    "Genos runs on Railway. Our scheduled jobs run in Singapore.",
                    // Evidence (MIP-2284, read 2026-11-24): docs.railway.com/enterprise/security ("Railway has a SOC 2 Type II
                    // report and a SOC 3 report from an independent auditor"; "All data stored on Railway is encrypted at rest
                    // with AES-256 in every region"; "public endpoints require HTTPS with TLS 1.2 or 1.3") and /compliance.
                    // It is Railway's attestation. Railway's own word "certified" is not copied: a SOC 2 is a report.
                    "Railway states that it holds a SOC 2 Type II report and a SOC 3 report from an independent auditor, that all data stored on Railway is encrypted at rest with AES-256, and that its public endpoints require HTTPS with TLS 1.2 or 1.3. These are Railway's statements about its platform. Genos itself holds no certification.",
                    "The companies that process data for us, and what each one receives, are listed on the privacy page.",
                ],
                links: [
                    {
                        label: "Railway: security",
                        href: "https://docs.railway.com/enterprise/security",
                    },
                    {
                        label: "Railway: compliance",
                        href: "https://docs.railway.com/enterprise/compliance",
                    },
                ],
            },
            {
                id: "encryption",
                heading: "Encryption",
                body: [
                    // Evidence: genos-api/apis/settings.py (HSTS, SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE, SECURE_PROXY_SSL_HEADER);
                    // origin/services/crypto.py (Fernet, FIELD_ENCRYPTION_KEYS); origin/services/blind_index.py (HMAC keyed by BLIND_INDEX_KEYS).
                    "In transit: connections to Genos use HTTPS. The Genos service sends HTTP Strict Transport Security, and its session and CSRF cookies are marked Secure.",
                    "In the database: personal details are encrypted before they are saved. These are your email address, location and profile text; the email addresses on team invitations and on connected accounts, and the generated email address of each team; the access and refresh tokens of connected Google and GitHub accounts; the keys of push subscriptions; and the secrets of outgoing webhooks. The encryption keys are kept apart from the data.",
                    "To find an account by email address without decrypting every address, we store a keyed hash of it (a blind index).",
                ],
            },
            {
                id: "passwords",
                heading: "Passwords and sign-in",
                body: [
                    // Evidence: settings.py PASSWORD validators; Django default hashers (PBKDF2 first); simplejwt settings
                    // (ACCESS 24 h, REFRESH 7 d, rotation, blacklist, CHECK_REVOKE_TOKEN, CHECK_USER_IS_ACTIVE default True);
                    // auth_views.py throttles and _record_signin_failed.
                    "Passwords are never stored in readable form. They are hashed with PBKDF2 and a salt. A password must be at least 8 characters, and common or all-numeric passwords are refused.",
                    "Signing in gives you an access token valid for 24 hours and a refresh token (7 days) that is rotated each time it is used. Signing out revokes your refresh token. Changing or resetting your password signs out existing sessions. A deactivated account is refused on its next request.",
                    "Sign-in, sign-up and password-reset requests are rate-limited per network address. Failed sign-in attempts are recorded.",
                ],
            },
            {
                id: "keys-apps",
                heading: "API keys and connected AI apps",
                body: [
                    // Evidence: origin/models/common/api_key_models.py (key_hash only, shown once); api_key_auth.py (revoked and expired refused);
                    // mcp_connection_models.py and services/mcp_connections.py (scopes; revoke deletes tokens); mcp_oauth_auth.py (connection_revoked).
                    "An API key is shown once, when you create it. Genos stores only a hash of the key. Revoking a key takes effect on its next request.",
                    "A connected AI app can act for you only within the permissions you give it: read, write, and, if you allow it, deleting. You can see every connected app in Settings and disconnect it there. Disconnecting removes the app's access tokens, and the app is refused on its next request.",
                ],
            },
            {
                id: "access",
                heading: "Who can see what",
                body: [
                    // Evidence: origin/views/utils/scope_guards.py is_team_member; views/utils/note_role.py get_effective_role
                    // (personal notes get no implicit access unless filed in a team folder); personal_tag_views.py filters on request.user.
                    "A workspace belongs to its team. Only members of a team can see that team's tasks, chats and shared notes.",
                    "Your personal notes are private to you, unless you file them in a team folder.",
                    "Private tags that you add to a chat are visible only to you.",
                ],
            },
            {
                id: "delete",
                heading: "Deleting your account",
                body: [
                    // Evidence: origin/views/common/user_views.py AccountDeletionView (confirm "DELETE", password if set);
                    // origin/services/account_deletion.py. Contradicted statements of note 194 are narrowed (see file header).
                    "You can delete your account in Settings. To confirm, type DELETE and, if you have a password, enter it. Deletion runs at once.",
                    "Deletion removes your personal notes and folders, your to-dos, your connections to Google and GitHub (removed from Genos; to end the access at Google or GitHub, revoke Genos there yourself), your connected AI apps, your personal tags and your first-month trial record. It revokes your API keys.",
                    "Your profile is cleared: your email address is replaced by a placeholder, your name is shown as Deleted user, and your location, profile text and avatar are removed. Your password can no longer be used.",
                    "Messages and comments you wrote stay in the chats and tasks they belong to, shown as from Deleted user. A name you typed inside a message, a note or a task can remain in that text.",
                    "Stripe, our payment provider, keeps the billing record it holds for you. Genos does not delete it there.",
                ],
            },
            {
                id: "export",
                heading: "Your data file",
                body: [
                    // Evidence: origin/views/common/user_views.py AccountExportView; services/account_export.py. The export does not hold everything (note 194).
                    "Settings lets you download a file of your own data. It does not yet include everything Genos holds about you.",
                ],
            },
            {
                id: "ai",
                heading: "AI and search",
                body: [
                    // Evidence: origin/search_engine/llm/gemini_client.py and agent (tool results sent to the model);
                    // the search index (OpenSearch) holds the text of your workspace content for search.
                    "To answer a question, the AI model receives the question and the workspace content it looks up for that question. Workspace content is also indexed for search. The companies involved, and what each receives, are listed on the privacy page.",
                ],
            },
            {
                id: "standards",
                heading: "Guidance we refer to",
                body: [
                    // Evidence: genos-docs compliance/public-statement/03-framework-mapping.md (versions read 2026-11-24:
                    // IPA SME guideline 4.0, OWASP ASVS 5.0.0, OWASP Top 10 2025, NIST CSF 2.0). "With reference to" only.
                    "Genos is built and run with reference to public security guidance: the guidelines for information security measures at small and medium-sized enterprises from Japan's IPA (version 4.0), the OWASP Application Security Verification Standard (version 5.0) and OWASP Top 10 (2025), and the NIST Cybersecurity Framework 2.0.",
                    "This is the guidance we use as a reference when we design and review our work. It is not an audit, and Genos has not been assessed or certified against any of it.",
                ],
                links: [
                    {
                        label: "IPA: information security guidelines for small and medium-sized enterprises (Japanese)",
                        href: "https://www.ipa.go.jp/security/guide/sme/about.html",
                    },
                    {
                        label: "OWASP Application Security Verification Standard",
                        href: "https://asvs.owasp.org/",
                    },
                    { label: "OWASP Top 10 (2025)", href: "https://top10.owasp.org/2025" },
                    {
                        label: "NIST Cybersecurity Framework 2.0",
                        href: "https://doi.org/10.6028/NIST.CSWP.29",
                    },
                ],
            },
            {
                id: "policy",
                heading: "Information security basic policy",
                body: [
                    // Source: IPA's sample basic policy (appendix 2 of the SME guideline), five articles, adapted to one operator
                    // plus AI agents. Evidence per article: genos-docs compliance/public-statement/02-basic-policy-public.md.
                    // Wording approved by Ken and counsel on 2026-11-24. The date established (制定日) is the day of approval, same as genos-docs 02-basic-policy-public.md.
                    "The operator of Genos (the company) protects the information assets that customers entrust to it (messages, tasks, notes, files, AI history and personal data) from accidents, disasters and crime, and works under the policy below to keep the trust of its customers and of society.",
                    "1. Responsibility of the owner. The company works on a continual, organised basis to improve information security, led by its operator. The operator approves this policy, decides how to respond to an incident, and gives the final approval for every change to the production environment.",
                    "2. Organisation. The operator is the person responsible, and runs Genos with the help of AI coding and operations agents. Security measures are written down as internal rules. Changes to the service go through review and automated checks before release. Agents are run within the operator's instructions, and writes to production need the operator's approval.",
                    "3. Practice. The operator keeps learning the knowledge and skills that information security requires. The internal rules are reviewed at least once a year, and after a serious incident or a change of supplier.",
                    "4. Legal and contractual requirements. The company complies with the laws, regulations, norms and contractual obligations on information security, and meets its customers' expectations.",
                    "5. Violations and incidents. If a violation of law or contract, or an incident, occurs, the company handles it by procedure, informs the customers affected where appropriate, and works to prevent it from happening again.",
                    "Established: November 24, 2026",
                ],
            },
            {
                id: "report",
                heading: "Report a security problem",
                body: [
                    // Evidence: genos-docs/operations/INCIDENT_RESPONSE.md (no SECURITY.md; the support mailbox is the contact);
                    // public/.well-known/security.txt (Contact).
                    'Please report security problems by email to genos.support@genosai.dev with the subject "Security". Tell us what you found, how to reproduce it, and which page or address it affects.',
                    "Please do not test against accounts or data that are not yours, and give us a reasonable time to fix a problem before you publish it. The same contact is published at /.well-known/security.txt.",
                ],
            },
        ],
        moreHeading: "Related pages",
        privacy: "Privacy Policy",
        legal: "Legal Notice",
        reportLabel: "Report by email",
        reportButton: "Email us about security",
        sourcesLabel: "Sources",
    },
    ja: {
        title: "セキュリティとデータの扱い",
        lead: "データがどこに保存されるか、誰が見られるか、どう守られているか、どう削除するか。このページは現在の Genos の仕組みを説明しています。",
        sections: [
            {
                id: "where",
                heading: "データの保存場所",
                body: [
                    "Genos は Railway 上で動作しています。定期実行されるジョブはシンガポールで動いています。",
                    "Railway は、独立した監査人による SOC 2 Type II レポートと SOC 3 レポートを保有し、Railway に保存されるすべてのデータは保存時に AES-256 で暗号化され、公開エンドポイントは TLS 1.2 または 1.3 の HTTPS を必須としていると説明しています。これらは Railway のプラットフォームに関する Railway 自身の説明です。Genos 自体は認証を取得していません。",
                    "当社のためにデータを処理する企業と、それぞれが受け取るデータは、プライバシーポリシーのページに掲載しています。",
                ],
                links: [
                    {
                        label: "Railway：セキュリティ（英語）",
                        href: "https://docs.railway.com/enterprise/security",
                    },
                    {
                        label: "Railway：コンプライアンス（英語）",
                        href: "https://docs.railway.com/enterprise/compliance",
                    },
                ],
            },
            {
                id: "encryption",
                heading: "暗号化",
                body: [
                    "通信中：Genos への接続は HTTPS を使います。Genos は HTTP Strict Transport Security を送り、セッションと CSRF の Cookie には Secure 属性を付けています。",
                    "データベース内：個人情報は保存される前に暗号化されます。メールアドレス、所在地、プロフィールの文章、チームへの招待と接続したアカウントのメールアドレス、チームごとに生成されるメールアドレス、接続した Google と GitHub のアクセストークンとリフレッシュトークン、プッシュ通知の鍵、送信 Webhook の秘密情報が対象です。暗号化の鍵はデータとは別に保管しています。",
                    "メールアドレスで利用者を探すときは、全件を復号せず、鍵つきのハッシュ（ブラインドインデックス）で照合しています。",
                ],
            },
            {
                id: "passwords",
                heading: "パスワードとサインイン",
                body: [
                    "パスワードは読める形では保存しません。PBKDF2 とソルトでハッシュ化しています。パスワードは 8 文字以上が必要で、よく使われるものや数字だけのものは受け付けません。",
                    "サインインすると、24 時間有効のアクセストークンと、使うたびに更新される 7 日間有効のリフレッシュトークンが発行されます。サインアウトするとリフレッシュトークンは無効になります。パスワードを変更またはリセットすると、既存のセッションはサインアウトされます。停止されたアカウントは次のリクエストから拒否されます。",
                    "サインイン、新規登録、パスワード再設定のリクエストは、ネットワークアドレスごとに回数を制限しています。失敗したサインインの試行は記録されます。",
                ],
            },
            {
                id: "keys-apps",
                heading: "API キーと接続した AI アプリ",
                body: [
                    "API キーは作成したときに一度だけ表示されます。Genos が保存するのはキーのハッシュだけです。キーを無効にすると、次のリクエストから使えなくなります。",
                    "接続した AI アプリは、あなたが許可した権限（閲覧、編集、許可した場合は削除）の範囲でのみ動きます。設定で接続したアプリをすべて確認し、そこで接続を解除できます。解除するとアプリのアクセストークンは削除され、次のリクエストから拒否されます。",
                ],
            },
            {
                id: "access",
                heading: "誰が何を見られるか",
                body: [
                    "ワークスペースはチームに属します。チームのタスク、チャット、共有されたノートを見られるのは、そのチームのメンバーだけです。",
                    "個人のノートは、チームのフォルダに入れない限り、あなただけが見られます。",
                    "チャットにつけた非公開のタグは、あなただけが見られます。",
                ],
            },
            {
                id: "delete",
                heading: "アカウントの削除",
                body: [
                    "アカウントは設定から削除できます。確認のため DELETE と入力し、パスワードを設定している場合はパスワードも入力します。削除はすぐに実行されます。",
                    "削除すると、個人のノートとフォルダ、ToDo、Google と GitHub との接続（Genos からは削除されます。Google や GitHub 側でのアクセスを止めるには、それぞれでご自身で取り消してください）、接続した AI アプリ、個人のタグ、最初の 1 か月の特典の記録が削除されます。API キーは無効になります。",
                    "プロフィールは消去されます。メールアドレスは仮の値に置き換えられ、名前は「Deleted user」と表示され、所在地、プロフィールの文章、アバターは削除されます。パスワードは使えなくなります。",
                    "あなたが書いたメッセージとコメントは、属していたチャットやタスクに残り、「Deleted user」の投稿として表示されます。メッセージ、ノート、タスクの本文に入力した名前は、その本文に残る場合があります。",
                    "支払いの事業者である Stripe は、あなたの請求記録を保持します。Genos は Stripe 側の記録を削除しません。",
                ],
            },
            {
                id: "export",
                heading: "データファイル",
                body: [
                    "設定から、ご自身のデータのファイルをダウンロードできます。Genos が保持するすべてのデータが含まれているわけではありません。",
                ],
            },
            {
                id: "ai",
                heading: "AI と検索",
                body: [
                    "AI モデルは、質問に答えるために、その質問で参照されたワークスペースの内容を受け取ります。ワークスペースの内容は検索のためにもインデックス化されます。関係する企業と、それぞれが受け取るデータは、プライバシーポリシーのページに掲載しています。",
                ],
            },
            {
                id: "standards",
                heading: "参考にしている指針",
                body: [
                    "Genos は、公開されているセキュリティの指針を参考にして作り、運用しています。IPA の「中小企業の情報セキュリティ対策ガイドライン」（第 4.0 版）、OWASP の Application Security Verification Standard（第 5.0 版）と OWASP Top 10（2025 年版）、NIST サイバーセキュリティフレームワーク 2.0 です。",
                    "これは、設計や見直しのときに参照している指針です。監査ではありません。Genos は、これらのいずれについても評価や認証を受けていません。",
                ],
                links: [
                    {
                        label: "IPA：中小企業の情報セキュリティ対策ガイドライン",
                        href: "https://www.ipa.go.jp/security/guide/sme/about.html",
                    },
                    {
                        label: "OWASP Application Security Verification Standard（英語）",
                        href: "https://asvs.owasp.org/",
                    },
                    {
                        label: "OWASP Top 10 2025 年版（英語）",
                        href: "https://top10.owasp.org/2025",
                    },
                    {
                        label: "NIST サイバーセキュリティフレームワーク 2.0（英語）",
                        href: "https://doi.org/10.6028/NIST.CSWP.29",
                    },
                ],
            },
            {
                id: "policy",
                heading: "情報セキュリティ基本方針",
                body: [
                    "Genos の運営者（以下、当社）は、お客様からお預かりした情報資産（メッセージ、タスク、ノート、ファイル、AI の利用履歴、個人情報）を事故・災害・犯罪などの脅威から守り、お客様ならびに社会の信頼に応えるべく、以下の方針に基づき情報セキュリティに取り組みます。",
                    "1. 経営者の責任：当社は、運営者の主導で、組織的かつ継続的に情報セキュリティの改善・向上に努めます。方針の承認、事故対応の判断、本番環境への変更の最終承認は、運営者が行います。",
                    "2. 体制の整備：当社は、運営者が責任者となり、AI のコーディング・運用エージェントの支援を受けて運営しています。情報セキュリティ対策は社内の規程として文書に定めています。サービスの変更は、レビューと自動チェックを通してから反映します。エージェントは運営者が与えた指示の範囲で動くよう運用し、本番環境への書き込みには運営者の承認を必要とします。",
                    "3. 取組み：運営者は、情報セキュリティのために必要とされる知識と技術を習得し続けます。社内の規程は少なくとも年に 1 回、また重大な事故や委託先の変更のあとに見直します。",
                    "4. 法令及び契約上の要求事項の遵守：当社は、情報セキュリティに関わる法令、規制、規範、契約上の義務を遵守するとともに、お客様の期待に応えます。",
                    "5. 違反及び事故への対応：当社は、情報セキュリティに関わる法令違反、契約違反及び事故が発生した場合には、手順に従って適切に対処し、必要に応じて影響を受けるお客様にお知らせし、再発防止に努めます。",
                    "制定日：2026年11月24日",
                ],
            },
            {
                id: "report",
                heading: "セキュリティの問題の報告",
                body: [
                    "セキュリティの問題は、件名を「Security」として genos.support@genosai.dev にメールでご報告ください。見つけた内容、再現の手順、影響するページや機能を教えてください。",
                    "ご自身のものではないアカウントやデータで試さないでください。公表の前に、修正のための妥当な期間をいただけると助かります。同じ連絡先は /.well-known/security.txt にも掲載しています。",
                ],
            },
        ],
        moreHeading: "関連ページ",
        privacy: "プライバシーポリシー",
        legal: "特定商取引法に基づく表記",
        reportLabel: "メールで報告",
        reportButton: "セキュリティについてメールする",
        sourcesLabel: "出典",
    },
};

/** The link on the pricing page (MIP-1248). */
export const PRICING_SECURITY_LINK: Record<Lang, string> = {
    en: "Security and data handling",
    ja: "セキュリティとデータの扱い",
};
