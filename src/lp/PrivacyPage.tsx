import { Link } from "react-router-dom";

import { CONTACT_EMAIL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import { PROCESSORS } from "./privacyProcessors";
import { PRIVACY_META } from "./seo/pageMeta";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/privacy` — プライバシーポリシー (privacy policy).
 *
 * Same conventions as `/legal` (LegalPage.tsx): a public, auth-free
 * legal document deliberately NOT run through the app i18n — the
 * wording must not drift per-locale. Japanese is the operative text
 * (個人情報保護法 audience); an English summary follows. Both are
 * written from the one `PROCESSORS` table (privacyProcessors.ts), so a processor cannot
 * be added to one language and forgotten in the other.
 *
 * Every claim is grounded in the code on `main` (see genos-docs
 * `operations/THIRD_PARTY_REVIEW.md` for what each processor receives).
 * Update this page — and that document — when a processor is added or
 * removed, or when a deletion or retention behaviour changes.
 *
 * MIP-1792 (2026-11-21): the statements the personal-data review
 * contradicted were rewritten to describe what the code does today:
 * deletion (Team Notes kept, provider-side revoke, what stays), analytics
 * (device fields sent in the app, IP discarded in PostHog, consent first),
 * the Google Cloud Storage cost reports, embeddings on Vertex, the export.
 * The wording is a draft for Ken's re-read; counsel's text is still pending.
 *
 * This text is rendered to users, so nothing here is a placeholder. What
 * could NOT be stated as fact is left OUT of the page and listed for the
 * owner (legal sign-off) in the pull request instead:
 *
 * TODO(owner): legal review of the whole text; the Japanese was drafted
 *   by an AI assistant, not by a lawyer or native legal writer.
 * TODO(owner): add an effective / last-updated date when the text is
 *   approved. None is shown (it is a legal fact the owner sets).
 * TODO(owner): hosting region, vendor retention, signed DPAs,
 *   compliance regimes: not stated because not verified.
 * Decided (owner): MIP-767 Stripe keeps the customer email (needed for
 *   receipts and Checkout); Stripe customer and billing history are kept
 *   at account deletion (2026-11-02, MIP-874).
 */

type Section = { heading: string; body: React.ReactNode };

const SectionList = ({
    sections,
    headingLevel,
}: {
    sections: Section[];
    headingLevel: "h2" | "h3";
}) => {
    const Heading = headingLevel;
    return (
        <div className="lp-sections">
            {sections.map((s) => (
                <section key={s.heading}>
                    <Heading>{s.heading}</Heading>
                    <div className="lp-sec-body">{s.body}</div>
                </section>
            ))}
        </div>
    );
};

const JA_SECTIONS: Section[] = [
    {
        heading: "1. 収集する情報",
        body: (
            <ul>
                <li>
                    <b>アカウント情報</b>：メールアドレス、ユーザー名、チーム情報。Google または
                    GitHub
                    でのサインインや連携を行った場合は、各社から提供される基本プロフィールと、お客様が許可した範囲の情報（例：カレンダー、リポジトリ）。
                </li>
                <li>
                    <b>コンテンツ</b>
                    ：チャットメッセージ、タスク、ノート、アップロードされたファイルなど、サービスの利用にあたって作成されるデータ。
                </li>
                <li>
                    <b>決済情報</b>：決済は Stripe 社が処理します。クレジットカード番号を
                    当サービスのサーバーで保存・処理することはありません（Stripe の顧客 ID
                    とプラン情報のみを保持します）。
                </li>
                <li>
                    <b>利用状況</b>
                    ：機能改善のためのプロダクト分析（PostHog）を行います。分析は、同意していただいた場合にのみ送信します。送信内容は第
                    3
                    項のとおりです。同意は、マーケティングページの同意バナー、またはアプリ内の案内で選択でき、「設定
                    → 一般 → プライバシーと分析」からいつでも変更できます。また、AI
                    利用回数などプラン上限の計測データを保持します。
                </li>
                <li>
                    <b>Cookie 等</b>
                    ：ログイン状態の維持のため、サインインを保つための Cookie（JavaScript
                    からは読み取れない設定です）とブラウザのストレージを使用します。プロダクト分析の識別子は、同意していただいた場合に限り
                    Cookie とブラウザのストレージに保存します。広告目的の Cookie は使用しません。
                </li>
            </ul>
        ),
    },
    {
        heading: "2. 利用目的",
        body: "サービスの提供・維持、AI 機能（検索・要約・エージェント）の提供、課金処理、サポート対応、不正利用の防止、サービスの改善のために利用します。",
    },
    {
        heading: "3. 第三者への提供・処理の委託",
        body: (
            <>
                <p>
                    個人情報を販売したり、広告目的で第三者に提供したりすることはありません。
                    サービスの提供に必要な範囲で、以下の事業者に処理を委託しています。各事業者に送信される情報は次のとおりです：
                </p>
                <ul>
                    {PROCESSORS.map((p) => (
                        <li key={p.name}>
                            <b>{p.name}</b>：{p.ja}
                        </li>
                    ))}
                </ul>
                <p>
                    利用する事業者は、設定や提供状況により変更されることがあります。変更する場合は、本ページを更新します。事業者の一覧は
                    <Link to="/subprocessors">サブプロセッサー一覧</Link>にもあります。
                </p>
                <p>
                    また、チームの管理者が Webhook
                    を設定した場合、管理者が選択したイベント（チャット、タスクなどの内容）が、管理者の指定した送信先に送信されます。この送信先は当サービスの委託先ではなく、管理者の責任で設定されます。
                </p>
            </>
        ),
    },
    {
        heading: "4. データの保存と削除",
        body: (
            <>
                <p>
                    データはアカウントが有効な間保存されます。プランによるメッセージ履歴の表示期間は「非表示」であり、データの削除ではありません（アップグレードすると再び表示されます）。
                </p>
                <p>
                    一部の記録には自動で削除される期間があります。たとえば、セキュリティの監査記録は最長
                    365 日、AI アプリからの通知は 90
                    日保存されます。チャット、タスク、ノートなどの内容には、現時点で自動の削除期間を設けていません。
                </p>
                <p>
                    <b>アカウントの削除</b>
                    ：アプリ内の「設定 → アカウント →
                    アカウントを削除」から、ご自身で実行できます。実行すると、すべての端末から直ちにサインアウトされ、氏名・メールアドレス・プロフィールが匿名化されます。非公開のノート・To-Do・AI
                    の利用履歴は削除され、API キーは無効化されます。Google・GitHub
                    との連携情報は当サービスから削除され、各サービス側の許可の取り消しも行います。チームのメンバーと共同で作成した内容（チームのノートを含む）はそのチームに残り、「削除されたユーザー」の名義になります。あなたが最後のメンバーであるチームは閉鎖され、そのチームのデータ（メッセージ、タスク、ノート、ファイルなど）はすべて完全に削除されます。他のメンバーがいるチームのオーナーである場合は、先にオーナー権限を譲渡する必要があります。
                </p>
                <p>
                    この操作の対象は当サービス内のデータです。次のものは、この操作では自動的には削除されません。
                </p>
                <ul>
                    <li>
                        第 3 項の事業者にすでに送信された情報。Stripe
                        上の顧客情報と請求履歴を含みます。分析サービス（PostHog）上の情報も、アカウント削除では削除されません。
                    </li>
                    <li>
                        他の人のメッセージ・タスク・ノートなどの中に含まれる、あなたの氏名（メンションや変更履歴の表示など）。
                    </li>
                    <li>
                        セキュリティの監査記録（操作の種類と日時など）。IP
                        アドレスとユーザーエージェントは、削除時に消去されます。
                    </li>
                </ul>
                <p>
                    <b>バックアップ</b>
                    ：データベースとアップロードされたファイルのバックアップを、最長27日間保管します。バックアップはホスティング事業者のスケジュールに従って削除されます。アカウントやデータを削除しても、既存のバックアップからは、そのバックアップが期限切れになるまで削除されません。
                </p>
                <p>
                    サインインできない場合など、アプリ内で削除できない場合は、下記メールアドレスまでご連絡ください。合理的な期間内に対応いたします。
                </p>
            </>
        ),
    },
    {
        heading: "5. 安全管理措置",
        body: "通信の暗号化（TLS）、アクセス制御など、合理的な安全管理措置を講じています。",
    },
    {
        heading: "6. 開示・訂正・利用停止等の請求",
        body: (
            <>
                <p>
                    ご自身が作成したデータは、アプリ内の「設定 → アカウント →
                    データをエクスポート」から JSON
                    ファイルでダウンロードできます。書き出しには、AI
                    への質問と回答、リアクション、添付ファイルの情報（ファイル名など）、タスクの変更履歴、セキュリティの記録、API
                    キーの名前と権限（キーの値は含みません）、連携アプリの情報などが含まれます。件数の多い項目は最新分に上限があり、上限を超えた場合は書き出しファイルにその旨が記載されます。他の利用者が作成したチーム内の内容は含まれません。
                </p>
                <p>
                    保有個人データの開示・訂正・利用停止等のご請求は、
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                    まで。
                </p>
            </>
        ),
    },
    {
        heading: "7. 改定",
        body: "本ポリシーを改定する場合は、本ページで告知します。",
    },
    {
        heading: "8. 事業者情報",
        body: (
            <>
                事業者情報は
                <Link to="/legal">特定商取引法に基づく表記</Link>
                をご覧ください。
            </>
        ),
    },
];

const EN_SECTIONS: Section[] = [
    {
        heading: "What we collect",
        body: "Account details (email, username, team; if you sign in with or connect Google or GitHub, the basic profile and whatever access you grant, such as calendar or repositories), the content you create (messages, tasks, notes, files), Stripe customer/plan references (card numbers never touch our servers), product analytics (PostHog — sent only with your consent, and you can change it in Settings → General → Privacy & analytics), and cookies/browser storage: a sign-in cookie that JavaScript cannot read, and, only with consent, the analytics identifier. No advertising cookies.",
    },
    {
        heading: "How we use it",
        body: "To provide and maintain the service, power the AI features (search, summaries, agent), process billing, respond to support, prevent abuse, and improve the product.",
    },
    {
        heading: "Processors",
        body: (
            <>
                <p>
                    We never sell personal data or share it for advertising. We use the following
                    processors to run the service, and send each of them only what is listed:
                </p>
                <ul>
                    {PROCESSORS.map((p) => (
                        <li key={p.name}>
                            <b>{p.name}</b>: {p.en}
                        </li>
                    ))}
                </ul>
                <p>
                    The providers we use can change with configuration and availability; we will
                    update this page when they do. The list is also on the{" "}
                    <Link to="/subprocessors">Subprocessors</Link> page.
                </p>
                <p>
                    If a team administrator configures a webhook, the events they choose (chat,
                    task and similar content) are sent to the destination they specify. That
                    destination is not our processor; the administrator is responsible for it.
                </p>
            </>
        ),
    },
    {
        heading: "Retention & deletion",
        body: (
            <>
                <p>
                    Data is kept while your account is active. Plan-based history windows hide
                    messages, they don't delete them (upgrading restores visibility).
                </p>
                <p>
                    Some records are deleted automatically on a schedule: security audit records
                    after up to 365 days, AI-app notices after 90 days. Chat, task, note and
                    similar content has no automatic deletion period yet.
                </p>
                <p>
                    <b>Deleting your account:</b> you can do it yourself in the app under Settings
                    → Account → Delete account. Your name, email and profile are anonymized and you
                    are signed out on every device immediately. Your private notes, to-dos and AI
                    history are deleted, your API keys are revoked, and the Google and GitHub
                    connection details we store are removed; we also revoke the access at Google
                    and GitHub. Work you did with teammates, including team notes, stays in their
                    workspace, attributed to "Deleted user". A team where you were the last member
                    is closed and all of its data (messages, tasks, notes, files and more) is
                    permanently deleted. If you own a team that still has other members, you must
                    transfer ownership first.
                </p>
                <p>
                    Deletion covers the data within the service. The following are not deleted
                    automatically: information already sent to the processors above (including
                    Stripe's customer record and billing history, and the data stored in PostHog,
                    which is not contacted on deletion); your name where other people's messages,
                    tasks or notes mention you; and security audit records (the event and its time;
                    the IP address and user agent are erased at deletion).
                </p>
                <p>
                    <b>Backups:</b> we keep backups of our database and of uploaded files for up to
                    27 days, and they are deleted on our hosting provider's schedule. Deleting your
                    account or data does not remove it from existing backups until they expire.
                </p>
                <p>
                    If you cannot sign in, or cannot delete in the app, email us at the address
                    below — we will act within a reasonable period.
                </p>
            </>
        ),
    },
    {
        heading: "Your requests",
        body: (
            <>
                <p>
                    You can download the data you created in the app under Settings → Account →
                    Export your data. The export includes your AI questions and answers, reactions,
                    attachment details, task change history, security events, API key names and
                    scopes (never the key values), and connected apps. Long lists are capped at the
                    newest entries, and the file says so when a cap applies. Content other users
                    created in a team is not included.
                </p>
                <p>
                    Disclosure, correction, or deletion requests:{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Seller information is
                    on the <Link to="/legal">Legal Notice</Link>.
                </p>
            </>
        ),
    },
];

export default function PrivacyPage() {
    useDocumentMeta(PRIVACY_META);
    return (
        <LpShell active={null}>
            {() => (
                <>
                    <header className="lp-pagehead">
                        <div className="lp-container lp-container--narrow lp-stack-s">
                            <h1 className="lp-title" lang="ja">
                                プライバシーポリシー
                            </h1>
                            <p className="lp-body" lang="en">
                                Privacy policy — the Japanese text is operative; an English summary
                                follows.
                            </p>
                        </div>
                    </header>

                    <div className="lp-container lp-container--narrow lp-pagebody">
                        <article className="lp-prose">
                            <div className="lp-pagesection" lang="ja">
                                <SectionList headingLevel="h2" sections={JA_SECTIONS} />
                            </div>

                            <section className="lp-pagesection" lang="en">
                                <h2>Privacy Policy (English summary)</h2>
                                <SectionList headingLevel="h3" sections={EN_SECTIONS} />
                            </section>
                        </article>
                    </div>
                </>
            )}
        </LpShell>
    );
}
