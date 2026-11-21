import { Link } from "react-router-dom";

import { CONTACT_EMAIL } from "./kit/links";
import { LpShell } from "./kit/LpShell";
import { COOKIES_META } from "./seo/pageMeta";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * `/cookies` — Cookie と分析のお知らせ (MIP-1251). What the site and the app
 * keep in the browser, and what the analytics does as built on `main`.
 * Every row was read from the code (services/analytics.ts, consentStorage,
 * marketingFunnel, the auth view that sets the refresh cookie, and the
 * sign-out wipe in AuthContext). No advertising cookies are set by us.
 *
 * Not stated here, because it is not verified: retention of the browser
 * cache after the browser's own clean-up; third-party cookies set by
 * Google or GitHub on their own pages during sign-in.
 */

type Row = { name: string; kind: string; purpose: string; when: string };

const JA_ROWS: Row[] = [
    {
        name: "refresh",
        kind: "Cookie（HttpOnly。JavaScript からは読み取れません）",
        purpose: "サインイン状態を保つ",
        when: "サインイン中。サインアウトすると削除され、期限が過ぎると無効になります。",
    },
    {
        name: "genos-marketing-consent:v1",
        kind: "ブラウザのストレージ",
        purpose: "マーケティングページで選んだ「同意する」「拒否する」の選択を覚える",
        when: "選択を変えるか、ブラウザのサイトデータを消去するまで。識別子や日付は含みません。",
    },
    {
        name: "genos-analytics-preferences:v1",
        kind: "ブラウザのストレージ",
        purpose: "アプリ内の「プライバシーと分析」の設定を覚える",
        when: "設定を変えるか、ブラウザのサイトデータを消去するまで。",
    },
    {
        name: "genos-first-touch-utm:v1",
        kind: "ブラウザのストレージ（sessionStorage）",
        purpose: "同意した訪問に限り、アクセス元の広告キャンペーンの値（utm）を一時的に覚える",
        when: "そのタブを閉じるまで。拒否すると消去されます。",
    },
    {
        name: "ph_…（PostHog）",
        kind: "Cookie・ブラウザのストレージ",
        purpose: "分析の識別子（ランダムなブラウザ ID やセッション ID など）",
        when: "分析に同意した後のみ保存されます。拒否するか分析をオフにすると消去されます。",
    },
    {
        name: "アプリのデータ（IndexedDB と localStorage）",
        kind: "ブラウザのストレージ",
        purpose: "画面をすばやく表示するためのキャッシュと、表示名などの設定",
        when: "通常のサインアウトで消去されます。端末の識別子など、一部はサインアウト後も残ります。",
    },
];

const EN_ROWS: Row[] = [
    {
        name: "refresh",
        kind: "Cookie (HttpOnly; JavaScript cannot read it)",
        purpose: "Keeps you signed in",
        when: "While you are signed in. Removed when you sign out; it stops working when it expires.",
    },
    {
        name: "genos-marketing-consent:v1",
        kind: "Browser storage",
        purpose: "Remembers your Accept or Reject choice on the marketing pages",
        when: "Until you change the choice or clear the site data. It holds no identifier or date.",
    },
    {
        name: "genos-analytics-preferences:v1",
        kind: "Browser storage",
        purpose: "Remembers the setting under Privacy & analytics in the app",
        when: "Until you change the setting or clear the site data.",
    },
    {
        name: "genos-first-touch-utm:v1",
        kind: "Browser storage (sessionStorage)",
        purpose:
            "Only for a visit you accepted: keeps the campaign values (utm) of how you arrived, for that visit",
        when: "Until you close the tab. Removed if you reject.",
    },
    {
        name: "ph_… (PostHog)",
        kind: "Cookie and browser storage",
        purpose: "Analytics identifiers (a random browser ID, session and window IDs and similar)",
        when: "Only after you accept analytics. Removed if you reject or turn analytics off.",
    },
    {
        name: "App data (IndexedDB and localStorage)",
        kind: "Browser storage",
        purpose: "A cache so screens show quickly, and settings such as your display name",
        when: "Removed on a normal sign-out. Some items, such as a device identifier, remain after sign-out.",
    },
];

const StorageTable = ({ lang, rows }: { lang: "ja" | "en"; rows: Row[] }) => {
    const ja = lang === "ja";
    return (
        <div className="lp-table-scroll">
            <table>
                <thead>
                    <tr>
                        <th scope="col">{ja ? "名前" : "Name"}</th>
                        <th scope="col">{ja ? "種類" : "Type"}</th>
                        <th scope="col">{ja ? "目的" : "Purpose"}</th>
                        <th scope="col">{ja ? "保存される期間" : "How long"}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.name}>
                            <th scope="row">
                                <code>{r.name}</code>
                            </th>
                            <td>{r.kind}</td>
                            <td>{r.purpose}</td>
                            <td>{r.when}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default function CookiesPage() {
    useDocumentMeta(COOKIES_META);
    return (
        <LpShell active={null}>
            {() => (
                <>
                    <header className="lp-pagehead">
                        <div className="lp-container lp-container--narrow lp-stack-s">
                            <h1 className="lp-title" lang="ja">
                                Cookie と分析のお知らせ
                            </h1>
                            <p className="lp-body" lang="en">
                                Cookies &amp; analytics — the Japanese text is operative; an
                                English summary follows.
                            </p>
                        </div>
                    </header>

                    <div className="lp-container lp-container--narrow lp-pagebody">
                        <article className="lp-prose">
                            <div className="lp-pagesection" lang="ja">
                                <section>
                                    <h2>1. ブラウザに保存されるもの</h2>
                                    <p>
                                        本サービスは、次の情報をお使いのブラウザに保存します。広告目的の
                                        Cookie は使用しません。
                                    </p>
                                    <StorageTable lang="ja" rows={JA_ROWS} />
                                </section>
                                <section>
                                    <h2>2. プロダクト分析（PostHog）</h2>
                                    <p>
                                        分析は、同意していただいた場合にのみ行います。マーケティングページの同意バナー、またはアプリ内の案内で選べます。同意しない場合は、分析のための保存も送信も行いません。
                                    </p>
                                    <p>
                                        同意後の送信内容、IP
                                        アドレスの扱い、アカウント削除時の扱いは、
                                        <Link to="/privacy">プライバシーポリシー</Link>
                                        の第 1 項と第 3 項に記載しています。
                                    </p>
                                    <p>
                                        変更方法：アプリ内の「設定 → 一般 →
                                        プライバシーと分析」、またはマーケティングページ下部のリンクから、いつでも変更できます。オフにすると、保存された分析の識別子は消去されます。
                                    </p>
                                </section>
                                <section>
                                    <h2>3. その他</h2>
                                    <p>
                                        サインイン時に Google または GitHub
                                        の画面を開くと、それぞれのサービスが自身のページで Cookie
                                        を設定することがあります。その内容は各サービスのポリシーに従います。
                                    </p>
                                    <p>
                                        ブラウザの設定で Cookie
                                        やサイトデータを消去できます。ただし、サインイン用の Cookie
                                        を消去するとサインアウトされます。
                                    </p>
                                    <p>
                                        ご質問は{" "}
                                        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
                                        まで。
                                    </p>
                                </section>
                            </div>

                            <section className="lp-pagesection" lang="en">
                                <h2>Cookies &amp; analytics (English summary)</h2>
                                <section>
                                    <h3>1. What is stored in your browser</h3>
                                    <p>
                                        The site and the app store the following in your browser.
                                        We do not set advertising cookies.
                                    </p>
                                    <StorageTable lang="en" rows={EN_ROWS} />
                                </section>
                                <section>
                                    <h3>2. Product analytics (PostHog)</h3>
                                    <p>
                                        Analytics runs only if you accept it, on the marketing
                                        pages through the banner, or in the app through the prompt.
                                        If you reject, nothing is stored or sent for analytics.
                                        What is sent after you accept, how IP addresses are handled
                                        and what happens at account deletion are in section 1 and 3
                                        of the <Link to="/privacy">Privacy Policy</Link>.
                                    </p>
                                    <p>
                                        You can change it at any time under Settings → General →
                                        Privacy &amp; analytics, or from the link at the bottom of
                                        our marketing pages. Turning it off removes the stored
                                        analytics identifiers.
                                    </p>
                                </section>
                                <section>
                                    <h3>3. Other</h3>
                                    <p>
                                        When you sign in with Google or GitHub, those services may
                                        set their own cookies on their pages; their policies apply
                                        to those.
                                    </p>
                                    <p>
                                        You can clear cookies and site data in your browser.
                                        Clearing the sign-in cookie signs you out. Questions:{" "}
                                        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                                    </p>
                                </section>
                            </section>
                        </article>
                    </div>
                </>
            )}
        </LpShell>
    );
}
