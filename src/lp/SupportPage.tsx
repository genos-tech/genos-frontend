import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { useLpLang, type Lang } from "./lpLang";
import { SUPPORT_EMAIL, SUPPORT_UI_LABELS } from "./supportLabels";

/**
 * `/support` — how to get help with Genos.
 *
 * Public and auth-free, same shell as `/legal` and `/privacy`: someone who
 * cannot sign in is exactly who needs this page. Like those pages it holds its
 * own copy (ja + en, `useLpLang` picks the starting language) instead of
 * mounting the app's I18nProvider.
 *
 * Deliberately short and bare. The only support channel that exists is the
 * email address below, so that is all the page offers: no response-time
 * promise, no phone number, no chat widget, no contact form (there is no
 * backend for one). Do not add any of those unless they really exist.
 *
 * The "Connected AI apps" steps quote the app's own labels (`supportLabels.ts`). They are the
 * strings in `settings.tabs.developer` and `settings.connectedApps` (en/settings.ts
 * and ja/index.ts), shown by SettingsModal and ConnectedAppsSection. If those
 * labels change, change them here too; SupportPage.test.tsx compares the two,
 * so a rename fails the test instead of leaving the page pointing at nothing.
 */

const linkClass = "underline hover:text-violet-700 dark:hover:text-white";

/** A label from the app's UI, set apart in bold; ja wraps it in 「」 as /privacy does. */
const makeLabel =
    (lang: Lang) =>
    ({ children }: { children: React.ReactNode }) => (
        <b className="font-semibold text-slate-800 dark:text-slate-100">
            {lang === "ja" ? <>「{children}」</> : children}
        </b>
    );
const LABELS = { en: makeLabel("en"), ja: makeLabel("ja") };

const COPY: Record<
    Lang,
    {
        title: string;
        lead: string;
        contactHeading: string;
        contactBody: string;
        contactCopy: string;
        includeHeading: string;
        includeItems: string[];
        includeNote: string;
        appsHeading: string;
        appsIntro: string;
        appsSteps: (
            l: Record<string, string>,
            Label: (props: { children: React.ReactNode }) => React.ReactNode
        ) => React.ReactNode[];
        appsOutro: string;
        moreHeading: string;
        privacy: string;
        legal: string;
    }
> = {
    en: {
        title: "Support",
        lead: "If something in Genos is not working, or you have a question about your account, write to us by email.",
        contactHeading: "Contact",
        contactBody: "Email us at",
        contactCopy: "If the link does not open your mail app, copy the address:",
        includeHeading: "What to include",
        includeItems: [
            "The email address of your Genos account.",
            "What you were doing, and what you expected to happen.",
            "Any error message, copied exactly as it was shown. A screenshot also helps.",
            "If it involves an AI app connected to Genos: which app it is, and what you asked it to do.",
        ],
        includeNote: "Please do not send your password or an API key.",
        appsHeading: "Connected AI apps",
        appsIntro:
            "An AI app you have connected to Genos can use Genos as you. You can see which apps are connected, and disconnect any of them, yourself:",
        appsSteps: (l, Label) => [
            <>
                Open <Label>{l.settings}</Label> in Genos and choose <Label>{l.developer}</Label>.
            </>,
            <>
                Under <Label>{l.connectedApps}</Label>, each app is listed with what it may do (
                <Label>{l.scopeRead}</Label> or <Label>{l.scopeWrite}</Label>, and{" "}
                <Label>{l.canDelete}</Label> if deleting is allowed), the teams it can use, and
                when it was last used.
            </>,
            <>
                Choose <Label>{l.change}</Label> to narrow what an app may do, or{" "}
                <Label>{l.revoke}</Label> to disconnect it. Genos asks you to confirm, and the app
                stops working on its next request.
            </>,
        ],
        appsOutro:
            "If you cannot sign in, or an app you do not recognise is listed, email us and say which app.",
        moreHeading: "Other pages",
        privacy: "Privacy Policy",
        legal: "Legal Notice",
    },
    ja: {
        title: "サポート",
        lead: "Genos が思うように動かないときや、アカウントについてのご質問は、メールでご連絡ください。",
        contactHeading: "お問い合わせ",
        contactBody: "メールアドレス：",
        contactCopy:
            "リンクからメールアプリが開かない場合は、こちらのアドレスをコピーしてください：",
        includeHeading: "お知らせいただきたい内容",
        includeItems: [
            "Genos アカウントのメールアドレス。",
            "何をしていたか、どうなると思っていたか。",
            "エラーメッセージ（表示されたとおりにコピーしてください）。スクリーンショットも助けになります。",
            "Genos に接続した AI アプリが関係する場合は、そのアプリ名と、依頼した内容。",
        ],
        includeNote: "パスワードや API キーは送らないでください。",
        appsHeading: "接続済みの AI アプリ",
        appsIntro:
            "Genos に接続した AI アプリは、あなたとして Genos を使うことができます。どのアプリが接続されているかの確認と、接続の解除は、ご自身でできます。",
        appsSteps: (l, Label) => [
            <>
                Genos で <Label>{l.settings}</Label> を開き、<Label>{l.developer}</Label>{" "}
                を選びます。
            </>,
            <>
                <Label>{l.connectedApps}</Label> に、各アプリの権限（<Label>{l.scopeRead}</Label>{" "}
                または <Label>{l.scopeWrite}</Label>。削除が許可されている場合は{" "}
                <Label>{l.canDelete}</Label>）、使えるチーム、最終使用日が表示されます。
            </>,
            <>
                <Label>{l.change}</Label> でアプリの権限を絞り込むか、<Label>{l.revoke}</Label>{" "}
                で接続を解除します。確認が表示され、解除したアプリは次のリクエストから使えなくなります。
            </>,
        ],
        appsOutro:
            "サインインできない場合や、見覚えのないアプリが表示されている場合は、アプリ名を添えてメールでご連絡ください。",
        moreHeading: "関連ページ",
        privacy: "プライバシーポリシー",
        legal: "特定商取引法に基づく表記",
    },
};

const LangToggle = ({ lang, setLang }: { lang: Lang; setLang: (next: Lang) => void }) => (
    <div aria-label="Language / 言語" className="flex gap-1 text-xs font-semibold" role="group">
        {(["en", "ja"] as const).map((l) => (
            <button
                key={l}
                aria-pressed={lang === l}
                type="button"
                className={
                    "rounded-full px-3 py-1 transition " +
                    (lang === l
                        ? "bg-violet-600 text-white"
                        : "text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-white")
                }
                onClick={() => setLang(l)}
            >
                {l === "en" ? "English" : "日本語"}
            </button>
        ))}
    </div>
);

export default function SupportPage() {
    const { lang, setLang } = useLpLang();
    const c = COPY[lang];

    return (
        <main
            className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#faf7ff_44%,#ffffff_100%)] px-4 py-10 text-slate-950 sm:px-6 lg:px-8 dark:bg-[linear-gradient(180deg,#020617_0%,#111827_48%,#020617_100%)] dark:text-white"
            lang={lang}
        >
            <div className="mx-auto max-w-3xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-white"
                        to="/home"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Genos
                    </Link>
                    <LangToggle lang={lang} setLang={setLang} />
                </div>

                <h1 className="mt-6 text-2xl font-black sm:text-3xl">{c.title}</h1>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {c.lead}
                </p>

                <div className="mt-8 space-y-7">
                    <section>
                        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                            {c.contactHeading}
                        </h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {c.contactBody}{" "}
                            <a className={linkClass} href={`mailto:${SUPPORT_EMAIL}`}>
                                {SUPPORT_EMAIL}
                            </a>
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {c.contactCopy}{" "}
                            <span data-testid="support-email-text">{SUPPORT_EMAIL}</span>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                            {c.includeHeading}
                        </h2>
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {c.includeItems.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {c.includeNote}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                            {c.appsHeading}
                        </h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {c.appsIntro}
                        </p>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {c.appsSteps(SUPPORT_UI_LABELS[lang], LABELS[lang]).map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ol>
                        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {c.appsOutro}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                            {c.moreHeading}
                        </h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            <Link className={linkClass} to="/privacy">
                                {c.privacy}
                            </Link>
                            {" · "}
                            <Link className={linkClass} to="/legal">
                                {c.legal}
                            </Link>
                        </p>
                    </section>
                </div>

                <p className="mt-10 text-xs text-slate-400 dark:text-slate-500">
                    © {new Date().getFullYear()} Genos
                </p>
            </div>
        </main>
    );
}
