import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * `/privacy` — プライバシーポリシー (privacy policy).
 *
 * Same conventions as `/legal` (LegalPage.tsx): a public, auth-free
 * legal document deliberately NOT run through the app i18n — the
 * wording must not drift per-locale. Japanese is the operative text
 * (個人情報保護法 audience); an English summary follows.
 *
 * Every claim is grounded in the actual stack: PostHog product
 * analytics with the in-app opt-out (Settings → Privacy & analytics),
 * Stripe-hosted payments (no card numbers on our servers), AI features
 * via business-tier APIs (Gemini / Claude) that don't train on the
 * data, Tavily for web-search queries, Resend for transactional mail,
 * Google Cloud / Railway hosting. Update this page when a processor is
 * added or removed.
 */

const CONTACT_EMAIL = "genos.support@genosai.dev";

type Section = { heading: string; body: React.ReactNode };

const SectionList = ({ sections }: { sections: Section[] }) => (
    <div className="space-y-7">
        {sections.map((s) => (
            <section key={s.heading}>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {s.heading}
                </h3>
                <div className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {s.body}
                </div>
            </section>
        ))}
    </div>
);

const JA_SECTIONS: Section[] = [
    {
        heading: "1. 収集する情報",
        body: (
            <ul className="list-disc space-y-1.5 pl-5">
                <li>
                    <b>アカウント情報</b>：メールアドレス、ユーザー名、チーム情報。Google
                    アカウントでのサインインや連携を行った場合は、Google
                    から提供される基本プロフィールと、お客様が許可した範囲の情報（例：カレンダー）。
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
                    <b>利用状況</b>：機能改善のためのプロダクト分析（PostHog）。アプリ内の「設定 →
                    一般 → プライバシーと分析」からいつでも無効にできます。また、AI
                    利用回数などプラン上限の計測データを保持します。
                </li>
                <li>
                    <b>Cookie 等</b>：ログイン状態の維持のための Cookie
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
                    サービスの提供に必要な範囲で、以下の事業者に処理を委託しています：
                </p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    <li>Stripe（決済処理）</li>
                    <li>Google Cloud / Railway（ホスティング・データ保管）</li>
                    <li>
                        Google Gemini / Anthropic Claude（AI 機能 — AI
                        機能の実行に必要なコンテンツのみが送信されます。モデルの学習にデータが利用されない事業者向け
                        API を利用しています）
                    </li>
                    <li>Tavily（AI のウェブ検索機能における検索クエリ）</li>
                    <li>PostHog（プロダクト分析 — 「設定 → 一般」から無効化できます）</li>
                    <li>Resend（通知・確認メールの送信）</li>
                </ul>
            </>
        ),
    },
    {
        heading: "4. データの保存と削除",
        body: (
            <>
                データはアカウントが有効な間保存されます。プランによるメッセージ履歴の表示期間は「非表示」であり、データの削除ではありません（アップグレードすると再び表示されます）。アカウントおよびデータの削除をご希望の場合は、下記メールアドレスまでご連絡ください。合理的な期間内に対応いたします。
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
                保有個人データの開示・訂正・利用停止等のご請求は、
                <a className="underline hover:text-violet-700" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                </a>
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
                <Link className="underline hover:text-violet-700" to="/legal">
                    特定商取引法に基づく表記
                </Link>
                をご覧ください。
            </>
        ),
    },
];

const EN_SECTIONS: Section[] = [
    {
        heading: "What we collect",
        body: "Account details (email, username, team), the content you create (messages, tasks, notes, files), Stripe customer/plan references (card numbers never touch our servers), product analytics (PostHog — can be disabled in Settings → General → Privacy & analytics), and cookies/browser storage for keeping you signed in. No advertising cookies.",
    },
    {
        heading: "How we use it",
        body: "To provide and maintain the service, power the AI features (search, summaries, agent), process billing, respond to support, prevent abuse, and improve the product.",
    },
    {
        heading: "Processors",
        body: "We never sell personal data or share it for advertising. Processors used to run the service: Stripe (payments), Google Cloud / Railway (hosting), Google Gemini / Anthropic Claude (AI features — only the content needed for the request is sent, via business APIs that do not train on your data), Tavily (web-search queries), PostHog (analytics, opt-out available), Resend (transactional email).",
    },
    {
        heading: "Retention & deletion",
        body: "Data is kept while your account is active. Plan-based history windows hide messages, they don't delete them (upgrading restores visibility). To delete your account and data, email us — we will act within a reasonable period.",
    },
    {
        heading: "Your requests",
        body: (
            <>
                Disclosure, correction, or deletion requests:{" "}
                <a className="underline hover:text-violet-700" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                </a>
                . Seller information is on the{" "}
                <Link className="underline hover:text-violet-700" to="/legal">
                    Legal Notice
                </Link>
                .
            </>
        ),
    },
];

export default function PrivacyPage() {
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

                <h1 className="mt-6 text-2xl font-black sm:text-3xl">プライバシーポリシー</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Privacy policy — the Japanese text is operative; an English summary follows.
                </p>

                <div className="mt-8">
                    <SectionList sections={JA_SECTIONS} />
                </div>

                <h2 className="mt-12 text-xl font-black">Privacy Policy (English summary)</h2>
                <div className="mt-4">
                    <SectionList sections={EN_SECTIONS} />
                </div>

                <p className="mt-10 text-xs text-slate-400 dark:text-slate-500">
                    © {new Date().getFullYear()} Genos
                </p>
            </div>
        </main>
    );
}
