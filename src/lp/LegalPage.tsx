import { Link } from "react-router-dom";

import { CONTACT_EMAIL } from "./kit/links";
import { LpShell } from "./kit/LpShell";

/**
 * `/legal` — 特定商取引法に基づく表記 (the disclosure Japanese law
 * requires of online paid services), including the cancellation and
 * refund policy the billing flows point at (Stripe customer-portal
 * business links, checkout terms consent).
 *
 * Deliberately NOT run through the app i18n: this is a legal document
 * whose wording must not drift per-locale. Japanese is the operative
 * text; an English summary follows for non-Japanese readers. Public
 * and auth-free, like the other `lp/` pages.
 *
 * Prices here are STATIC, and stay static now that Genos sells in more
 * than one currency. Fetching them from /billing/plans/ would keep them
 * from going stale, but a disclosure page that renders "loading…" — or
 * renders nothing because a fetch failed — is a worse compliance
 * outcome than one that is a release behind. 特商法 requires the price
 * to BE THERE.
 *
 * The yen figures stay because 特商法 governs sales to consumers in
 * Japan and those sales are in yen. Other currencies are pointed at the
 * pricing page and checkout rather than enumerated: prices are declared
 * per currency by hand (see genos-docs/operations/CURRENCY.md), so
 * listing them here would be a second place to forget to update. When a
 * non-Japanese market gets its own disclosure requirements, it needs
 * its own section rather than more rows in this one.
 *
 * ⚠️ Changing the yen prices means changing them HERE and in Stripe.
 *
 * Operator identity here mirrors what the landing page already
 * publishes (name + contact email); address/phone use the
 * disclose-on-request pattern permitted for individual sellers.
 */

type Row = { label: string; body: React.ReactNode };

const RowTable = ({ rows }: { rows: Row[] }) => (
    <dl className="lp-dl">
        {rows.map((row) => (
            <div key={row.label} className="lp-dl__row">
                <dt>{row.label}</dt>
                <dd>{row.body}</dd>
            </div>
        ))}
    </dl>
);

const JA_ROWS: Row[] = [
    { label: "販売事業者", body: "Genos（個人事業主）" },
    { label: "運営責任者", body: "Kentaro Kamiya" },
    {
        label: "所在地",
        body: "請求があった場合、遅滞なく開示いたします。",
    },
    {
        label: "電話番号",
        body: "請求があった場合、遅滞なく開示いたします。お問い合わせは下記メールアドレスにて承ります。",
    },
    {
        label: "メールアドレス",
        body: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
    },
    {
        label: "販売URL",
        body: <a href="https://genosai.dev">https://genosai.dev</a>,
    },
    {
        label: "販売価格",
        body: (
            <>
                Core プラン：月額 1,200 円（税込） / Pro プラン：月額 2,500 円（税込） / Max
                プラン：月額 4,900 円（税込）。
                各プランの内容はアプリ内の「プランと料金」ページをご確認ください。
                なお、価格改定前にご契約いただいたお客様は、プランを変更されるまで
                従来の月額料金が引き続き適用されます。
                <br />
                日本円以外の通貨でご契約の場合、適用される通貨と金額は
                「プランと料金」ページおよび決済画面に表示されるものとなります。
                表示価格は各通貨ごとに個別に設定されており、為替レートによる 自動換算は行いません。
            </>
        ),
    },
    {
        label: "商品代金以外の必要料金",
        body: "インターネット接続に必要な通信料等はお客様のご負担となります。",
    },
    { label: "お支払い方法", body: "クレジットカード（Stripe による決済）" },
    {
        label: "お支払い時期",
        body: "お申込み時に初回分が課金され、以降は毎月の更新日に自動的に課金されます。",
    },
    { label: "サービスの提供時期", body: "決済完了後、直ちにご利用いただけます。" },
    {
        label: "解約について",
        body: (
            <>
                いつでも解約いただけます（アプリ内：設定 → プランと使用状況 →
                「請求を管理」）。解約は現在の請求期間の末日をもって有効となり、
                期間の末日までは有料プランの機能をご利用いただけます。
                次回以降の請求は発生しません。
            </>
        ),
    },
    {
        label: "返金について",
        body: (
            <>
                デジタルサービスという性質上、期間途中の解約による日割り返金は原則として
                行っておりません。誤課金・二重課金など特別な事情がある場合は、
                上記メールアドレスまでご連絡ください。個別に確認のうえ対応いたします。
            </>
        ),
    },
    {
        label: "動作環境",
        body: "最新版の Google Chrome / Microsoft Edge / Firefox / Safari",
    },
];

const EN_ROWS: Row[] = [
    { label: "Seller", body: "Genos (sole proprietor)" },
    { label: "Operator", body: "Kentaro Kamiya" },
    {
        label: "Address / Phone",
        body: "Disclosed without delay upon request. Please contact us by email below.",
    },
    {
        label: "Contact",
        body: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
    },
    {
        label: "Pricing",
        body: "Core: ¥1,200 / month · Pro: ¥2,500 / month · Max: ¥4,900 / month (tax included). Where a currency other than Japanese yen applies, the currency and amount charged are those shown on the Plans & pricing page and at checkout; prices are set separately per currency and are not converted at an exchange rate. See the in-app Plans & pricing page for details. Subscribers who signed up before the price change keep their original monthly rate until they change plans.",
    },
    {
        label: "Payment",
        body: "Credit card via Stripe. The first charge is made at sign-up; the subscription then renews automatically each month.",
    },
    {
        label: "Service delivery",
        body: "Available immediately after payment completes.",
    },
    {
        label: "Cancellation",
        body: "Cancel anytime from Settings → Plan & Usage → Manage billing. Cancellation takes effect at the end of the current billing period; paid features remain available until then, and no further charges occur.",
    },
    {
        label: "Refunds",
        body: "As a digital service, we do not normally issue prorated refunds for mid-period cancellations. For exceptional cases such as erroneous or duplicate charges, contact us by email and we will review individually.",
    },
];

export default function LegalPage() {
    return (
        <LpShell active={null}>
            {() => (
                <>
                    <header className="lp-pagehead">
                        <div className="lp-container lp-container--narrow lp-stack-s">
                            <h1 className="lp-title" lang="ja">
                                特定商取引法に基づく表記
                            </h1>
                            <p className="lp-body" lang="en">
                                Legal disclosure under Japan’s Specified Commercial Transactions
                                Act.
                            </p>
                        </div>
                    </header>

                    <div className="lp-container lp-container--narrow lp-pagebody">
                        <article className="lp-prose">
                            <div className="lp-pagesection" lang="ja">
                                <RowTable rows={JA_ROWS} />
                            </div>

                            <section className="lp-pagesection" lang="en">
                                <h2>Legal Notice (English summary)</h2>
                                <p className="lp-small">
                                    The Japanese text above is the operative disclosure; this
                                    summary is provided for convenience.
                                </p>
                                <RowTable rows={EN_ROWS} />
                            </section>

                            <p className="lp-small">
                                <Link to="/privacy">プライバシーポリシー / Privacy Policy</Link>
                            </p>
                        </article>
                    </div>
                </>
            )}
        </LpShell>
    );
}
