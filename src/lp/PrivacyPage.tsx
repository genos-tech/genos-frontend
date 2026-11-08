import { Link } from "react-router-dom";

import { CONTACT_EMAIL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import { PROCESSORS } from "./privacyProcessors";

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
 * Every claim is grounded in the code (see genos-docs
 * `operations/THIRD_PARTY_REVIEW.md`, MIP-729, for what each processor
 * receives). Update this page — and that document — when a processor
 * is added or removed.
 *
 * This text is rendered to users, so nothing here is a placeholder. What
 * could NOT be stated as fact is left OUT of the page and listed here for
 * the owner (legal sign-off) instead:
 *
 * TODO(owner): legal review of the whole text; the Japanese was drafted
 *   by an AI assistant, not by a lawyer or native legal writer.
 * TODO(owner): add an effective / last-updated date when the text is
 *   approved. None is shown (it is a legal fact the owner sets).
 * TODO(owner): the previous text said the AI providers are used "via
 *   business-tier APIs that do not train on your data". Nothing in the
 *   repos documents the agreement behind that, so it is not claimed.
 *   Reinstate it once confirmed for the route in use (Gemini via AI
 *   Studio vs Vertex; Anthropic; OpenAI).
 * TODO(owner): which optional providers are live in production
 *   (EMBEDDING_PROVIDER, RAG_RERANKER_PROVIDER, LLM_PROVIDER, ...) is a
 *   Railway setting that was not checked. OpenAI is listed because it is
 *   the code default for embeddings; Anthropic and Cohere are described
 *   as "when configured".
 * TODO(owner): not stated because unknown: hosting region and any
 *   cross-border-transfer wording, vendor retention, signed DPAs,
 *   compliance regimes, retention periods, how long the security audit
 *   log is kept.
 * Decided (owner): MIP-767 Stripe keeps the customer email (needed for
 *   receipts and Checkout); MIP-864 PostHog stays on by default with the
 *   opt-out, and receives the team ID, not the team name (genos-frontend
 *   #573). Merge #573 before this page ships, so the PostHog entry is true.
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
                    <b>利用状況</b>：機能改善のためのプロダクト分析（PostHog。送信内容は第 3
                    項のとおりです）。アプリ内の「設定 → 一般 →
                    プライバシーと分析」から無効にできます。また、AI
                    利用回数などプラン上限の計測データを保持します。
                </li>
                <li>
                    <b>Cookie 等</b>
                    ：ログイン状態の維持と、プロダクト分析（PostHog）の識別子の保存のために、Cookie
                    とブラウザストレージを使用します。広告目的の Cookie は使用しません。
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
                    利用する事業者は、設定や提供状況により変更されることがあります。変更する場合は、本ページを更新します。
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
                    <b>アカウントの削除</b>
                    ：アプリ内の「設定 → アカウント →
                    アカウントを削除」から、ご自身で実行できます。実行すると、氏名・メールアドレス・プロフィールが匿名化され、すべての端末で直ちにサインアウトされます。非公開のノート・To-Do・AI
                    の利用履歴は削除され、API キーは無効化され、Google・GitHub
                    等の連携は削除されます。チームのメンバーと共同で作成した内容はそのチームに残り、「削除されたユーザー」の名義になります。あなたが最後のメンバーであるチームは閉鎖されます。他のメンバーがいるチームのオーナーである場合は、先にオーナー権限を譲渡する必要があります。
                </p>
                <p>
                    この操作の対象は当サービス内のデータです。第 3
                    項の事業者にすでに送信された情報や、セキュリティ上の監査記録は、この操作では自動的には削除されません。
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
                ご自身が作成したデータは、アプリ内の「設定 → アカウント →
                データをエクスポート」から JSON
                ファイルでダウンロードできます。保有個人データの開示・訂正・利用停止等のご請求は、
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                まで。
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
        body: "Account details (email, username, team; if you sign in with or connect Google or GitHub, the basic profile and whatever access you grant, such as calendar or repositories), the content you create (messages, tasks, notes, files), Stripe customer/plan references (card numbers never touch our servers), product analytics (PostHog — can be disabled in Settings → General → Privacy & analytics), and cookies/browser storage for keeping you signed in and for the analytics identifier. No advertising cookies.",
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
                    update this page when they do.
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
                    <b>Deleting your account:</b> you can do it yourself in the app under Settings
                    → Account → Delete account. Your name, email and profile are anonymized and you
                    are signed out on every device immediately. Your private notes, to-dos and AI
                    history are deleted, your API keys are revoked and your Google / GitHub
                    connections are removed. Work you did with teammates stays in their workspace,
                    attributed to "Deleted user". Teams where you were the last member are closed.
                    If you own a team that still has other members, you must transfer ownership
                    first.
                </p>
                <p>
                    This applies to data within the service. Information already sent to the
                    processors above, and security audit records, are not deleted automatically by
                    it.
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
                You can download the data you created in the app under Settings → Account → Export
                your data. Disclosure, correction, or deletion requests:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Seller information is on
                the <Link to="/legal">Legal Notice</Link>.
            </>
        ),
    },
];

export default function PrivacyPage() {
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
