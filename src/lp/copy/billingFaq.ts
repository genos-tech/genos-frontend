import type { Lang } from "../lpLang";

/**
 * Billing FAQ for the pricing page (/plans), Japanese and English (MIP-1250).
 *
 * Truth rules for this file. Each answer was checked against the code and docs named next to it;
 * if one of them changes, change the answer in the same PR.
 *  - Cancel, refund, end of plan: Ken's policy D9 (2026-11-21), the /legal page
 *    (`src/lp/LegalPage.tsx`), `genos-api/origin/services/stripe_billing.py` (`cancel` flow,
 *    `customer.subscription.deleted` → free) and `genos-docs/operations/SUBSCRIPTION_TIERS.md` §8.1.
 *  - Upgrades and downgrades: `stripe_billing.py` `_portal_flow_data` (`update` flow) and the
 *    `customer.subscription.updated` arm of `handle_event` (a plan change applies at once).
 *  - Currencies: `stripe_billing.py` `supported_currencies` / `price_for_plan`; the /legal page
 *    (prices set per currency, no exchange-rate conversion).
 *  - Tax: `apis/settings.py` `STRIPE["AUTOMATIC_TAX"]` is off unless `STRIPE_AUTOMATIC_TAX=true`
 *    (not set on backend-django, names read 2026-11-21); the /legal page states ¥ prices are tax included.
 *  - Free-plan windows (180 days chat, 30 days AI history): `SUBSCRIPTION_TIERS.md` §1.1 and §1.2.
 *  - The first free month: `SUBSCRIPTION_TIERS.md` §3.1. Shown ONLY when the public plans response
 *    carries `first_month_offer: true` (the server's own switch, `FIRST_MONTH_CORE_TRIAL`).
 *
 * Each `TODO(copy)` is a sentence Ken has to read before the page is public. They are listed in the PR.
 */

export interface BillingFaqItem {
    id: string;
    q: string;
    /** Paragraphs of the answer, plain text. */
    a: string[];
    /** Shown only while the first-month offer is switched on. */
    firstMonth?: boolean;
}

export interface BillingFaqCopy {
    heading: string;
    lead: string;
    items: BillingFaqItem[];
}

export const BILLING_FAQ: Record<Lang, BillingFaqCopy> = {
    en: {
        heading: "Billing questions",
        lead: "How paying, cancelling and changing a plan work. The rules are the same for every plan.",
        items: [
            {
                id: "pay",
                q: "How do I pay, and when am I charged?",
                a: [
                    "You pay by credit card. Checkout is run by Stripe, so your card details never reach Genos. You are charged when you subscribe, and the plan then renews every month until you cancel.",
                ],
            },
            {
                id: "cancel",
                q: "Can I cancel at any time?",
                a: [
                    // The cancel flow opens Stripe's portal (`_portal_flow_data`, flow "cancel"); its mode is
                    // at period end in the Stripe dashboard (SUBSCRIPTION_TIERS.md §8.1, setup step 5).
                    "Yes. Go to Settings → Plan & Usage → Manage billing and cancel there. The cancellation takes effect at the end of the current billing period: your paid features stay on until then, and nothing more is charged.",
                ],
            },
            {
                id: "refund",
                q: "Do you give refunds?",
                a: [
                    // TODO(copy): MIP-1250. Ken's policy D9 (2026-11-21): no refund for a started month. Same
                    // sentence as the /legal page. Ken reads this wording before the page is public.
                    "We do not refund a month that has already started. If you cancel in the middle of a period, your paid features stay on until the end of that period. If you were charged by mistake or charged twice, email genos.support@genosai.dev and we will review it one case at a time.",
                ],
            },
            {
                id: "tax",
                q: "Is tax included?",
                a: [
                    // TODO(copy): MIP-1250. ¥ prices are tax included (the /legal page). USD tax treatment is not
                    // decided: Ken to confirm before this sentence is published. Automatic tax (Stripe Tax) is off.
                    "Yen prices include consumption tax. For other currencies, the price shown on this page is the price charged: checkout does not add a tax line on top of it.",
                ],
            },
            {
                id: "currency",
                q: "Which currencies can I pay in?",
                a: [
                    "Yen is the default. A plan can also be sold in another currency where we have set a price for it. The pricing page shows the currencies you can choose, and the amount in the one you pick is the amount charged. Each currency has its own prices, and nothing is converted at an exchange rate. A subscription keeps the currency it started in.",
                ],
            },
            {
                id: "change",
                q: "How do I upgrade or switch plans?",
                a: [
                    "Use the plan's button on this page, or Manage billing in Settings. The change takes effect at once: Stripe works out the difference for the rest of the current billing period, and the new plan's features are available straight away. The plan keeps its currency.",
                ],
            },
            {
                id: "downgrade",
                q: "What happens if I switch to a cheaper plan?",
                a: [
                    "A cheaper plan takes effect at the end of the current billing period, and you keep your current plan until then. There is no credit for the rest of the period. An upgrade takes effect at once and you are charged the difference. Anything the cheaper plan does not include is hidden, not deleted, and comes back when you move to a plan that includes it.",
                ],
            },
            {
                id: "end",
                q: "What happens when a paid plan ends?",
                a: [
                    "The account goes back to Free at the end of the paid period. Your data is kept. Chat and AI history older than the Free window (180 days of chat, 30 days of AI history) is hidden, not deleted, and comes back on a paid plan. Connected AI apps pause and show as paused until you return to Core or above. Scheduled reports pause and are kept. The public REST API works on every plan.",
                ],
            },
            {
                id: "ai-credits",
                q: "What uses AI credits?",
                a: [
                    // MIP-1965 / MIP-1971: Ken approved this wording 2026-11-22. Labels match the app's locale files.
                    "A search by a connected AI app uses a small amount of AI credit. You can see how many credits each AI job uses in Settings > Plan & Usage.",
                ],
            },
            {
                id: "first-month",
                firstMonth: true,
                q: "Is the first month free?",
                a: [
                    // MIP-1737 / MIP-1250. The existing-account grant is run by the operator. Hidden until the switch is on.
                    "Yes, for now. The first 30 days of the Core plan are free, once per account, and no card is needed to start. When the 30 days end, the account goes back to Free unless you choose a paid plan. We may end this offer once many people have signed up.",
                ],
            },
            {
                id: "discounts",
                q: "Are there discounts?",
                a: ["There are no discount or promotion codes at launch."],
            },
        ],
    },
    ja: {
        heading: "料金・お支払いについて",
        lead: "お支払い、解約、プラン変更の決まりです。どのプランでも同じです。",
        items: [
            {
                id: "pay",
                q: "支払い方法と請求のタイミングは？",
                a: [
                    "お支払いはクレジットカードです。決済画面は Stripe が提供するため、カード情報が Genos に届くことはありません。お申し込みのときに初回の請求が行われ、解約されるまで毎月自動で更新されます。",
                ],
            },
            {
                id: "cancel",
                q: "いつでも解約できますか？",
                a: [
                    "はい。設定 → プランと使用状況 →「請求を管理」から解約してください。解約は現在の請求期間の末日で有効になります。それまで有料の機能はそのまま使え、以降の請求は行われません。",
                ],
            },
            {
                id: "refund",
                q: "返金はありますか？",
                a: [
                    // TODO(copy): MIP-1250. Ken's policy D9 (2026-11-21): 開始した月分は返金しない。/legal と同じ内容。
                    "開始した月分の返金は行っていません。期間の途中で解約しても、有料の機能は期間の末日まで使えます。誤って、または二重に請求された場合は genos.support@genosai.dev までメールでご連絡ください。一件ずつ確認します。",
                ],
            },
            {
                id: "tax",
                q: "税金は含まれていますか？",
                a: [
                    // TODO(copy): MIP-1250. 日本円の税込は /legal に記載。USD の税の扱いは Ken の確認が必要。
                    "日本円の料金は消費税込みです。その他の通貨の場合は、このページに表示された金額がそのまま請求されます。決済画面で税額が上乗せされることはありません。",
                ],
            },
            {
                id: "currency",
                q: "どの通貨で支払えますか？",
                a: [
                    "通常は日本円です。通貨ごとに料金が設定されているプランは、その通貨で申し込めます。選べる通貨は料金ページに表示され、選んだ通貨の金額がそのまま請求されます。通貨ごとに料金を個別に定めており、為替レートで換算することはありません。申し込んだ通貨は、その契約の間は変わりません。",
                ],
            },
            {
                id: "change",
                q: "プランをアップグレードするには？",
                a: [
                    "このページのプランのボタン、または設定の「請求を管理」から変更できます。変更はすぐに反映され、新しいプランの機能もすぐに使えます。Stripe が現在の請求期間の残りの日数分の差額を計算します。プランの通貨は変わりません。",
                ],
            },
            {
                id: "downgrade",
                q: "下位のプランに変えるとどうなりますか？",
                a: [
                    "下位のプランへの変更は、現在の請求期間の終了時に適用され、それまでは現在のプランをご利用いただけます。期間の残り分の返金や差額の充当はありません。アップグレードはすぐに適用され、差額が請求されます。下位のプランに含まれない機能は非表示になるだけで削除されず、上位のプランに戻すと再び使えます。",
                ],
            },
            {
                id: "end",
                q: "有料プランが終わるとどうなりますか？",
                a: [
                    "有料期間が終わると、アカウントは Free に戻ります。データは残ります。Free の期間を超えた古いチャットや AI の履歴（チャットは 180 日、AI の履歴は 30 日）は非表示になるだけで、削除されません。有料プランに戻すと再び見られます。接続した AI アプリは一時停止し、Core 以上に戻るまで一時停止と表示されます。スケジュールされたレポートも一時停止して残ります。公開 REST API は全プランで使えます。",
                ],
            },
            {
                id: "ai-credits",
                q: "AI クレジットは何に使われますか？",
                a: [
                    "連携した AI アプリによる検索では、少量の AI クレジットを使用します。どの AI 機能がどれだけクレジットを使ったかは、設定 > プランと使用状況 で確認できます。",
                ],
            },
            {
                id: "first-month",
                firstMonth: true,
                q: "最初の 1 か月は無料ですか？",
                a: [
                    // MIP-1737 / MIP-1250. 既存アカウントへの付与は運用者が実行する。スイッチが入るまでは非表示。
                    "はい、当面の間です。Core プランの最初の 30 日間を、アカウントごとに一度無料でお使いいただけます。始めるのにカードは不要です。30 日が過ぎると、有料プランを選ばない限り Free に戻ります。多くの方が登録された時点で、この特典は終了する場合があります。",
                ],
            },
            {
                id: "discounts",
                q: "割引はありますか？",
                a: ["リリース時点では、割引やプロモーションコードはありません。"],
            },
        ],
    },
};
