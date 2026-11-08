import { Link } from "react-router-dom";

import { LpShell } from "./kit/LpShell";
import type { Lang } from "./lpLang";
import { SUPPORT_EMAIL, SUPPORT_UI_LABELS } from "./supportLabels";

/**
 * `/support` — how to get help with Genos.
 *
 * Public and auth-free, same shell as `/legal` and `/privacy`: someone who
 * cannot sign in is exactly who needs this page. Like those pages it holds its
 * own copy (ja + en) instead of mounting the app's I18nProvider. The language
 * comes from `LpShell`, which owns the toggle (and `useLpLang`, which picks the
 * starting language), so there is one switch for the header, the footer and
 * this page.
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

/** A label from the app's UI, set apart in bold; ja wraps it in 「」 as /privacy does. */
const makeLabel =
    (lang: Lang) =>
    ({ children }: { children: React.ReactNode }) => (
        <b>{lang === "ja" ? <>「{children}」</> : children}</b>
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

function SupportBody({ lang }: { lang: Lang }) {
    const c = COPY[lang];

    return (
        <>
            <header className="lp-pagehead">
                <div className="lp-container lp-container--narrow lp-stack-s">
                    <h1 className="lp-title">{c.title}</h1>
                    <p className="lp-body">{c.lead}</p>
                </div>
            </header>

            <div className="lp-container lp-container--narrow lp-pagebody">
                <article className="lp-prose">
                    <section>
                        <h2>{c.contactHeading}</h2>
                        <p>
                            {c.contactBody} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                        </p>
                        <p className="lp-small">
                            {c.contactCopy}{" "}
                            <span data-testid="support-email-text" translate="no">
                                {SUPPORT_EMAIL}
                            </span>
                        </p>
                    </section>

                    <section>
                        <h2>{c.includeHeading}</h2>
                        <ul>
                            {c.includeItems.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                        <p>{c.includeNote}</p>
                    </section>

                    <section>
                        <h2>{c.appsHeading}</h2>
                        <p>{c.appsIntro}</p>
                        <ol>
                            {c.appsSteps(SUPPORT_UI_LABELS[lang], LABELS[lang]).map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ol>
                        <p>{c.appsOutro}</p>
                    </section>

                    <section>
                        <h2>{c.moreHeading}</h2>
                        <p>
                            <Link to="/privacy">{c.privacy}</Link>
                            {" · "}
                            <Link to="/legal">{c.legal}</Link>
                        </p>
                    </section>
                </article>
            </div>
        </>
    );
}

export default function SupportPage() {
    return <LpShell active={null}>{({ lang }) => <SupportBody lang={lang} />}</LpShell>;
}
