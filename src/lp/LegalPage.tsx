import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

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

const CONTACT_EMAIL = "genos.support@genosai.dev";

type Row = { label: string; body: React.ReactNode };

const RowTable = ({ rows }: { rows: Row[] }) => (
    <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white/80 dark:border-white/10 dark:bg-white/5">
        <dl>
            {rows.map((row, i) => (
                <div
                    key={row.label}
                    className={
                        "grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[220px_1fr] sm:gap-6" +
                        (i > 0 ? " border-t border-violet-100/70 dark:border-white/10" : "")
                    }
                >
                    <dt className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {row.label}
                    </dt>
                    <dd className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {row.body}
                    </dd>
                </div>
            ))}
        </dl>
    </div>
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
        body: (
            <a className="underline hover:text-violet-700" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
            </a>
        ),
    },
    {
        label: "販売URL",
        body: (
            <a className="underline hover:text-violet-700" href="https://genosai.dev">
                https://genosai.dev
            </a>
        ),
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
        body: (
            <a className="underline hover:text-violet-700" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
            </a>
        ),
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
        <main className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#faf7ff_44%,#ffffff_100%)] px-4 py-10 text-slate-950 sm:px-6 lg:px-8 dark:bg-[linear-gradient(180deg,#020617_0%,#111827_48%,#020617_100%)] dark:text-white">
            <div className="mx-auto max-w-3xl">
                <Link
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-white"
                    to="/home"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Genos
                </Link>

                <h1 className="mt-6 text-2xl font-black sm:text-3xl">特定商取引法に基づく表記</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Legal disclosure under Japan’s Specified Commercial Transactions Act.
                </p>

                <div className="mt-8">
                    <RowTable rows={JA_ROWS} />
                </div>

                <h2 className="mt-12 text-xl font-black">Legal Notice (English summary)</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    The Japanese text above is the operative disclosure; this summary is provided
                    for convenience.
                </p>
                <div className="mt-6">
                    <RowTable rows={EN_ROWS} />
                </div>

                <p className="mt-10 text-xs text-slate-400 dark:text-slate-500">
                    <Link className="underline hover:text-violet-700" to="/privacy">
                        プライバシーポリシー / Privacy Policy
                    </Link>
                </p>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                    © {new Date().getFullYear()} Genos
                </p>
            </div>
        </main>
    );
}
